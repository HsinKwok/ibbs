import AssignMedal from "../medal.js";

/* 对内 获取用户会员信息函数；user 为可选参数，调用方已查出用户行时复用以避免重复查询 */
const getVipInfo = async (id, user) => {
    let groupInfo = {};
    const users = user ? [user] : await global.db.query('SELECT * FROM n_users where id = ?', [id]);

    if (users.length === 0) {
        const info = await global.db.query('SELECT * FROM n_usergroup where n_deft = 1');
        if (info.length > 0) {
            groupInfo = info[0];
        }
    } else {
        if (users[0].n_group_id && users[0].n_group_id > 0) {
            const info = await global.db.query('SELECT * FROM n_usergroup where id = ?', [users[0].n_group_id]);
            if (info.length > 0) {
                groupInfo = info[0];
            } else {
                const info = await global.db.query('SELECT * FROM n_usergroup where n_deft = 1');
                if (info.length > 0) {
                    groupInfo = info[0];
                }
            }
        } else {
            const info = await global.db.query('SELECT * FROM n_usergroup where n_deft = 1');
            if (info.length > 0) {
                groupInfo = info[0];
            }
        }
    }

    return groupInfo;
}

/* 用户可自行修改的字段白名单，防止越权修改积分/余额/权限等敏感字段 */
const EDITABLE_FIELDS = ['n_nickname', 'n_avatar', 'n_userback', 'n_signature', 'n_qqnumber', 'n_wxnumber'];

/* 各可编辑字段的长度上限（字符），避免超长内容入库 */
const FIELD_MAX_LEN = {
    n_nickname: 30,
    n_avatar: 500,
    n_userback: 500,
    n_signature: 200,
    n_qqnumber: 50,
    n_wxnumber: 50
};

/* 「我的信息」中始终不应下发的内部标识字段；余额/积分/会员等到期等本人可见字段保留 */
const INTERNAL_USER_FIELDS = ['n_password', 'n_MiniProgramOpenid'];

/* 以 URL 形式渲染的字段（头像/背景图）：由前端直接绑定到 img/背景，需限制协议 */
const URL_FIELDS = ['n_avatar', 'n_userback'];

/* 仅允许无协议（相对路径）、http(s) 与 data:image/*，拒绝 javascript:/data:text 等危险协议 */
const isSafeUrl = (value) => {
    const m = /^([a-z][a-z0-9+.-]*):/i.exec(value);
    if (!m) return true;
    const scheme = m[1].toLowerCase();
    if (scheme === 'http' || scheme === 'https') return true;
    if (scheme === 'data' && /^data:image\//i.test(value)) return true;
    return false;
};

export default {
    getVipInfo,
    /* 获取我的信息 */
    info: (request, reply) => global.Fun(reply, async () => {
        const Ware = request.Ware;

        const users = await global.db.query('SELECT * FROM n_users where id = ?', [Ware.id]);

        if (users.length === 0) {
            global.sendMsg(reply, 201, '用户不存在');
            return;
        }
        /* 仅向下发必要字段：剔除密码哈希及内部标识，避免内部信息泄露 */
        for (const field of INTERNAL_USER_FIELDS) delete users[0][field];
        const VipInfo = await getVipInfo(Ware.id, users[0]);
        global.sendMsg(reply, 200, '获取成功', {
            ...users[0],
            VipInfo: VipInfo,
        });
    }),

    /* 修改我的信息 */
    editinfo: (request, reply) => global.Fun(reply, async () => {
        const Ware = request.Ware;
        const pre = request.body;

        const users = await global.db.query('SELECT * FROM n_users where id = ?', [Ware.id]);

        if (users.length === 0) {
            global.sendMsg(reply, 201, '用户不存在');
            return;
        }
        /* 仅取白名单字段，防止越权修改敏感字段 */
        const data = {};
        for (const field of EDITABLE_FIELDS) {
            if (pre[field] !== undefined) {
                const value = pre[field];
                /* 长度校验：超出上限直接拒绝，避免超长资料入库 */
                if (typeof value === 'string' && value.length > FIELD_MAX_LEN[field]) {
                    global.sendMsg(reply, 201, `字段长度不能超过${FIELD_MAX_LEN[field]}字符`);
                    return;
                }
                /* URL 字段（头像/背景图）额外做协议校验，避免前端渲染时执行危险协议 */
                if (URL_FIELDS.includes(field) && typeof value === 'string' && value.trim() && !isSafeUrl(value.trim())) {
                    global.sendMsg(reply, 201, '图片地址不合法，请使用 http(s) 或站内相对路径');
                    return;
                }
                /* 统一净化，避免存储型 XSS 等富文本内容入库 */
                data[field] = typeof value === 'string' ? global.Sanitize(value) : value;
            }
        }

        if (Object.keys(data).length === 0) {
            global.sendMsg(reply, 201, '没有需要修改的内容');
            return;
        }

        /* 昵称需保持全站唯一（与他人的用户名/昵称均不可重复，排除自身） */
        if (data.n_nickname !== undefined) {
            const conflict = await global.Tools.findUserIdentifierConflict({ nickname: data.n_nickname, excludeId: Ware.id });
            if (conflict) {
                global.sendMsg(reply, 201, '昵称已存在');
                return;
            }
        }

        try {
            await global.db.update('n_users', data, 'id = ?', [Ware.id])
        } catch (e) {
            /* 数据库触发器兜底：并发下昵称被他处占用 */
            global.sendMsg(reply, 201, '昵称已被占用，请更换后重试');
            return;
        }

        global.sendMsg(reply, 200, '修改成功');
    }),
    /* 积分转余额 */
    pointsToBalance: (request, reply) => global.Fun(reply, async () => {
        const Ware = request.Ware;
        const pre = request.body;

        const users = await global.db.query('SELECT * FROM n_users where id = ?', [Ware.id]);
        if (users.length === 0) {
            global.sendMsg(reply, 201, '用户不存在');
            return;
        }

        /* 校验积分数 */
        const points = Number(pre.points);
        if (!points || points <= 0) {
            global.sendMsg(reply, 201, '请输入正确的积分数');
            return;
        }

        const VipInfo = await getVipInfo(Ware.id, users[0]);

        /* 计算可兑换余额：ratio 表示多少积分兑 1 元 */
        const ratio = Number(VipInfo.n_points_ratio) || 100;
        const balance = points / ratio;

        /* 原子扣减积分并按比例增加余额：以 n_points >= ? 作为条件，避免并发下重复兑换（丢失更新） */
        const meta = await global.db.run(
            'UPDATE `n_users` SET n_points = n_points - ?, n_balance = n_balance + ? WHERE id = ? AND n_points >= ?',
            [points, balance, Ware.id, points]
        );
        if (!meta.changes) {
            global.sendMsg(reply, 201, '积分不足');
            return;
        }

        /* 写入账单：余额收入 + 积分支出，同一事务批量执行，避免只写入一条导致账目不一致 */
        try {
            await global.db.batch([
                {
                    sql: 'INSERT INTO n_user_bill (n_name, n_amount, n_uid, n_time, n_type, n_status) VALUES (?, ?, ?, ?, ?, ?)',
                    params: ['积分转余额', balance, Ware.id, new Date(), 1, 2]
                },
                {
                    sql: 'INSERT INTO n_user_bill (n_name, n_amount, n_uid, n_time, n_type, n_status) VALUES (?, ?, ?, ?, ?, ?)',
                    params: ['积分转余额', points, Ware.id, new Date(), 2, 1]
                }
            ]);
        } catch (error) {
            /* 账单写入失败：补偿回滚已完成的积分/余额变动，避免「扣了积分却没有账单」 */
            console.log(error);
            await global.db.run('UPDATE `n_users` SET n_points = n_points + ?, n_balance = n_balance - ? WHERE id = ?', [points, balance, Ware.id]);
            global.sendMsg(reply, 201, '操作失败，请稍后重试');
            return;
        }
        global.sendMsg(reply, 200, '操作成功');

    }),
      /* 关注用户 */
    LikeUser: (request, reply) => global.Fun(reply, async () => {
        const Ware = request.Ware;
        const pre = request.body;
        /* 不允许关注自己 */
        if (String(pre.id) === String(Ware.id)) {
            return global.sendMsg(reply, 201, '不能关注自己');
        }
        /* 获取帖子信息 */
        const Threads = await global.db.query('SELECT * FROM n_users WHERE id = ?', [pre.id]);
        if (!Threads || Threads.length === 0) {
            return global.sendMsg(reply, 404, '用户不存在');
        }

        /* 检查是否关注过 */
        const Like = await global.db.query('SELECT id FROM n_user_like WHERE n_tid = ? AND n_uid = ?', [pre.id, Ware.id]);

        if (Like && Like.length > 0) {
            /* 取消关注 */
            await global.db.delete('n_user_like', 'n_tid = ? AND n_uid = ?', [pre.id, Ware.id]);
            return global.sendMsg(reply, 200, '取消关注成功');
        }
        /* 并发下可能同时走到这里，用 INSERT ... WHERE NOT EXISTS 兜底，避免重复关注 */
        const meta = await global.db.run(
            'INSERT INTO `n_user_like` (`n_tid`, `n_uid`) SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM `n_user_like` WHERE `n_tid` = ? AND `n_uid` = ?)',
            [pre.id, Ware.id, pre.id, Ware.id]
        );
        if (meta.changes) {
            await AssignMedal.AssignMedal(pre.id)
        }
        global.sendMsg(reply, 200, '关注成功');
    }),
}
