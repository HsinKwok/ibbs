/* 生成当前站点时区年月日（与写库时间戳约定保持一致） */
const getCurrentDate = () => {
    return global.Tools.formatDate();
}

/* 日期字符串加减天数（用 UTC 计算避免本机时区影响） */
const addDays = (dateStr, days) => {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

/* 归一化为 YYYY-MM-DD，兼容历史数据中未补零的写法（如 2026-10-9） */
const normalizeDate = (value) => {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(value ?? '').trim());
    return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : '';
}

/* 获取连续签到天数 */
const getContinuousDays = async (userId) => {
    const records = await global.db.query(
        `SELECT DISTINCT n_time as check_date FROM n_activity_checkin_log WHERE n_uid = ? AND n_time >= date('now','${global.Tools.sqlTimezoneModifier()}','-60 days')`,
        [userId]
    );

    /* 归一化后统一降序，避免历史数据未补零导致字符串比较错乱 */
    const dates = [...new Set(records.map((r) => normalizeDate(r.check_date)).filter(Boolean))].sort().reverse();
    if (dates.length === 0) return 0;

    /* 最新一条记录必须是今天或昨天，否则视为连续签到已中断 */
    const today = getCurrentDate();
    if (dates[0] !== today && dates[0] !== addDays(today, -1)) return 0;

    let expected = dates[0];
    let continuousDays = 0;
    for (const date of dates) {
        /* 检查记录日期是否是期望的日期，不匹配说明连续签到中断 */
        if (date === expected) {
            continuousDays++;
            expected = addDays(expected, -1);
        } else {
            break;
        }
    }

    return continuousDays;
}

/* 根据签到配置与连续天数计算今日/明日奖励 */
const calcReward = (config, continuousDays) => {
    let Today = 0;
    let Tomorrow = 0;
    for (let a in config) {
        if (Number(config[a].min) <= continuousDays && Number(config[a].max) >= continuousDays) {
            Today = config[a].price;
        }
        if (Number(config[a].min) <= (continuousDays + 1) && Number(config[a].max) >= (continuousDays + 1)) {
            Tomorrow = config[a].price;
        }
    }
    return { Today, Tomorrow };
}

/* 获取签到活动配置；活动不存在或已关闭（n_off !== '1'）返回 null */
const getCheckInActivity = async () => {
    const Config = await global.db.query("SELECT * FROM n_activity where n_code = 'checkIn'");
    if (Config.length === 0) return null;
    /* 后台开关约定：'1' 为正常/开启，'2'（或空）为已关闭，需与前端 activity.vue 保持一致 */
    if (String(Config[0].n_off) !== '1') return null;
    return Config[0];
}

/* 今日是否已签到 */
const isCheckedInToday = async (userId) => {
    const rows = await global.db.query(
        `SELECT n_time FROM n_activity_checkin_log WHERE n_uid = ? AND n_time >= date('now','${global.Tools.sqlTimezoneModifier()}')`,
        [userId]
    );
    const today = getCurrentDate();
    return rows.some((row) => normalizeDate(row.n_time) === today);
}

/* 获取奖励信息；活动未开启返回 null */
const getReward = async (userId) => {
    const Info = await getCheckInActivity();
    if (!Info) return null;

    /* 配置非法（脏数据/手改库）时按活动不可用处理，避免抛错导致 500 */
    let config;
    try {
        config = JSON.parse(Info.n_reward_config);
    } catch (e) {
        return null;
    }

    /* 未签到时“今日”应达天数为连续天数+1，已签到时连续天数已包含今日 */
    /* 两查询相互独立，并行执行减少 D1 往返 */
    const [continuousDays, signedToday] = await Promise.all([
        getContinuousDays(userId),
        isCheckedInToday(userId)
    ]);
    const todayDays = (signedToday ? continuousDays : continuousDays + 1) || 1;

    const { Today, Tomorrow } = calcReward(config, todayDays);
    return { Today, Tomorrow, Info, continuousDays: todayDays };
}

export default {
    /* 签到 */
    checkIn: (request, reply) => global.Fun(reply, async () => {
        const Ware = request.Ware;

        const reward = await getReward(Ware.id);
        if (!reward) {
            global.sendMsg(reply, 201, '签到活动未开启');
            return;
        }

        /* 奖励金额统一取数值并兜底：配置脏数据（NaN/负值/NULL）按 0 处理，避免账实不符或扣减余额 */
        const rewardAmount = Math.max(0, Number(reward.Today) || 0);

        /* 原子插入签到记录：同一用户同一天仅允许写入一条，避免并发/重复请求重复发放奖励。
           去重口径与 isCheckedInToday 的 normalizeDate 保持一致：兼容历史数据中未补零的写法（如 2026-10-9） */
        const today = getCurrentDate();
        const todayUnpadded = today.replace(/^(\d{4})-0?(\d{1,2})-0?(\d{1,2})$/, '$1-$2-$3');
        const inserted = await global.db.run(
            'INSERT INTO n_activity_checkin_log (n_uid, n_time, n_reward_number, n_reward_type) ' +
            'SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM n_activity_checkin_log WHERE n_uid = ? AND n_time IN (?, ?))',
            [Ware.id, today, rewardAmount, reward.Info.n_reward_type, Ware.id, today, todayUnpadded]
        );
        if (!inserted.changes) {
            global.sendMsg(reply, 201, '今天已经签到');
            return;
        }

        /* 入账与账单放入同一事务批量执行：要么全部成功、要么全部回滚，避免部分写入导致账实不符 */
        const updateSql = reward.Info.n_reward_type == '2'
            ? 'UPDATE n_users SET n_balance = n_balance + ? WHERE id = ?'
            : 'UPDATE n_users SET n_points = n_points + ? WHERE id = ?';
        try {
            await global.db.batch([
                { sql: updateSql, params: [rewardAmount, Ware.id] },
                {
                    sql: 'INSERT INTO n_user_bill (n_name, n_amount, n_uid, n_time, n_type, n_status) VALUES (?, ?, ?, ?, ?, ?)',
                    params: ['签到奖励', rewardAmount, Ware.id, new Date(), 1, reward.Info.n_reward_type]
                }
            ]);
        } catch (error) {
            /* 奖励入账失败：补偿删除已写入的签到记录，避免「有签到记录却未发放奖励」导致用户当天无法重试 */
            console.log(error);
            await global.db.run('DELETE FROM n_activity_checkin_log WHERE n_uid = ? AND n_time IN (?, ?)', [Ware.id, today, todayUnpadded]);
            global.sendMsg(reply, 201, '签到失败，请稍后重试');
            return;
        }

        global.sendMsg(reply, 200, '签到成功');
    }),

    /* 签到记录列表 */
    checkInList: (request, reply) => global.Fun(reply, async () => {
        const Ware = request.Ware;
        const users = await global.db.query(`SELECT * FROM n_activity_checkin_log where n_uid = ? and n_time >= date('now','${global.Tools.sqlTimezoneModifier()}','-40 days') ORDER BY n_time DESC`, [Ware.id]);
        global.sendMsg(reply, 200, '获取成功', users);
    }),

    /* 获取签到奖励 */
    getCheckInReward: (request, reply) => global.Fun(reply, async () => {
        const Ware = request.Ware;

        const reward = await getReward(Ware.id);
        if (!reward) {
            global.sendMsg(reply, 201, '签到活动未开启');
            return;
        }

        global.sendMsg(reply, 200, '获取成功', {
            continuousDays: reward.continuousDays,
            Today: reward.Today,
            Tomorrow: reward.Tomorrow,
            Config: { ...reward.Info, n_reward_config: '' }
        });
    })
}
