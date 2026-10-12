/* n_medal_log */

/* 勋章定义缓存：AssignMedal 在发帖/评论/点赞等热点路径都会读取勋章定义，
   而勋章定义极少变动，用短 TTL 缓存减少一次 D1 往返；后台增删改后立即失效 */
const MEDAL_CACHE_TTL = 60 * 1000;
let medalCache = { data: null, expire: 0 };

/* 失效勋章定义缓存（后台增删改勋章后调用） */
export function clearMedalCache() {
    medalCache = { data: null, expire: 0 };
}

/* 读取勋章定义（带短 TTL 缓存） */
async function getMedalDefs() {
    const now = Date.now();
    if (medalCache.data && medalCache.expire > now) return medalCache.data;
    const data = await global.db.query(`SELECT * FROM n_medal`);
    medalCache = { data, expire: now + MEDAL_CACHE_TTL };
    return data;
}

export default {
    /* 分配勋章 */
    AssignMedal: async (id) => {
        /* 三个读取互不依赖，并行发起以减少 D1 往返延迟 */
        const [userStats, medals, userMedals] = await Promise.all([
            global.db.query(`
                SELECT
                    (SELECT COUNT(*) FROM n_threads WHERE n_uid = ?) AS n_posts,
                    (SELECT COUNT(*) FROM n_user_like WHERE n_tid = ?) AS n_followers,
                    (SELECT COUNT(*) FROM n_user_like WHERE n_uid = ?) AS n_following,
                    (SELECT COUNT(*) FROM n_comment WHERE n_uid = ?) AS n_comment,
                    (SELECT SUM(n_starts) FROM n_threads WHERE n_uid = ?) AS n_likes
            `, [id, id, id, id, id]),
            getMedalDefs(),
            global.db.query(`
                SELECT n_mid FROM n_medal_log WHERE n_uid = ?
            `, [id])
        ]);

        let posts = userStats[0].n_posts || 0;
        let followers = userStats[0].n_followers || 0;
        let following = userStats[0].n_following || 0;
        let comment = userStats[0].n_comment || 0;
        let likes = userStats[0].n_likes || 0;

        const userMedalIds = new Set(userMedals.map(m => m.n_mid));

        /* 筛选出「满足条件且尚未获得」的勋章，避免循环内逐条查询 */
        const toAward = medals.filter((medal) => {
            /* 阈值必须为有效数字：空串/null/undefined 会被 JS 隐式转为 0，导致 `>=` 恒真而给所有人误发勋章 */
            if (medal.n_threshold === '' || medal.n_threshold === null || medal.n_threshold === undefined) return false;
            const threshold = Number(medal.n_threshold);
            if (!Number.isFinite(threshold)) return false;
            let shouldAward = false;
            /* 根据勋章类型判断是否达到阈值 */
            switch (medal.n_type) {
                case '1': // 发帖数
                    shouldAward = posts >= threshold;
                    break;
                case '2': // 获赞数
                    shouldAward = likes >= threshold;
                    break;
                case '3': // 评论数
                    shouldAward = comment >= threshold;
                    break;
                case '4': // 粉丝数
                    shouldAward = followers >= threshold;
                    break;
            }
            return shouldAward && !userMedalIds.has(medal.id);
        });
        if (!toAward.length) return;

        /* 一次性批量幂等写入勋章日志，替代循环内逐条查询+写入 */
        const insertResults = await global.db.batch(toAward.map((medal) => ({
            sql: `INSERT INTO n_medal_log (n_uid, n_mid, n_time) SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM n_medal_log WHERE n_uid = ? AND n_mid = ?)`,
            params: [id, medal.id, new Date(), id, medal.id]
        })));

        /* 仅为本次真正新增的勋章批量写入通知消息 */
        const msgStatements = [];
        toAward.forEach((medal, i) => {
            if (!insertResults[i] || !insertResults[i].changes) return;
            msgStatements.push({
                sql: 'INSERT INTO n_msg (n_uid, n_html, n_time, n_name, n_tid) VALUES (?, ?, ?, ?, ?)',
                params: [id, `恭喜您获得勋章「${medal.n_name}」`, new Date(), '恭喜您获得勋章', 0]
            });
        });
        if (msgStatements.length) {
            await global.db.batch(msgStatements);
        }
    },
    /* 获取勋章列表 */
     getMedal: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;
        const Ware = request.Ware;

        const SqlBuilder = new global.SqlBuilder();
        const sql = SqlBuilder.add('n_name', pre.search, 'like').build();
        const res = await global.db.getPaginatedData('n_medal', sql.sql, sql.params, ['n_sort', 'desc'], pre.page, pre.pagesize)
        
        /* 获取用户已获得的勋章 */
        const userMedals = await global.db.query(`
            SELECT n_mid FROM n_medal_log WHERE n_uid = ?
        `, [Ware.id]);
        const userMedalIds = new Set(userMedals.map(m => m.n_mid));
        
        /* 将用户已获得的勋章ID添加到结果中 */
        res.data.forEach(medal => {
            medal.isEarned = userMedalIds.has(medal.id);
        });
        
        global.sendMsg(reply, 200, '获取成功', res.data, res.total);
    }),
}