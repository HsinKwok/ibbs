/* 按站点配置时区返回日期字符串，offsetDays 为相对今天的偏移（可为负） */
const getDateStr = (offsetDays = 0) => {
    return global.Tools.formatDate(new Date(Date.now() + offsetDays * 86400000));
};

/* 将统计行数组转为 { 日期: 值 } 的映射 */
const toDateMap = (rows, key) => {
    const map = {};
    for (const row of rows) map[row.d] = row[key];
    return map;
};

/* 统计查询较重（含全表 COUNT / 区间聚合），缓存已序列化响应文本：
   isolate 内存 30s → KV 指定 TTL，后台最多晚一个 TTL 看到新数字；缓存层不可用时直接回源 */
async function sendStats(reply, cacheKey, ttlSeconds, builder) {
    const cache = global.RedisUtils;
    if (cache && cache.getOrSetTextCache) {
        const bodyText = await cache.getOrSetMemoryCache(cacheKey + ':l1', 30, () =>
            cache.getOrSetTextCache(cacheKey, ttlSeconds, async () =>
                JSON.stringify({ code: 200, msg: '成功', data: await builder(), total: 0 })
            )
        );
        reply.sendJsonText(bodyText);
        return;
    }
    global.sendMsg(reply, 200, '成功', await builder());
}

export default {
    // 获取首页统计数据
    GetIndexStatistics: (request, reply) => global.Fun(reply, async () => {
        const build = async () => {
            // 今日/昨日时间范围（统一按站点配置时区，避免 UTC 与存档时间戳不一致）
            const todayStr = getDateStr() + ' 00:00:00';
            const yesterdayStr = getDateStr(-1) + ' 00:00:00';

            // 各项统计相互独立，并发执行以缩短总耗时（原为十余次串行 D1 查询）
            const [
                totalUsers, totalThreads, totalComments,
                todayRegister, todayThreads, todayComments,
                yesterdayRegister, yesterdayThreads, yesterdayComments,
                todayRevenue, yesterdayRevenue,
                todayBillList, yesterdayBillList
            ] = await Promise.all([
                global.db.query('SELECT COUNT(*) as count FROM n_users'),
                global.db.query('SELECT COUNT(*) as count FROM n_threads'),
                global.db.query('SELECT COUNT(*) as count FROM n_comment'),
                global.db.query('SELECT COUNT(*) as count FROM n_users WHERE n_registertime >= ?', [todayStr]),
                global.db.query('SELECT COUNT(*) as count FROM n_threads WHERE n_time >= ?', [todayStr]),
                global.db.query('SELECT COUNT(*) as count FROM n_comment WHERE n_time >= ?', [todayStr]),
                global.db.query('SELECT COUNT(*) as count FROM n_users WHERE n_registertime >= ? AND n_registertime < ?', [yesterdayStr, todayStr]),
                global.db.query('SELECT COUNT(*) as count FROM n_threads WHERE n_time >= ? AND n_time < ?', [yesterdayStr, todayStr]),
                global.db.query('SELECT COUNT(*) as count FROM n_comment WHERE n_time >= ? AND n_time < ?', [yesterdayStr, todayStr]),
                global.db.query("SELECT COALESCE(SUM(CAST(n_amount AS REAL)), 0) as amount FROM n_payorder WHERE n_paytime >= ? AND n_type = '2'", [todayStr]),
                global.db.query("SELECT COALESCE(SUM(CAST(n_amount AS REAL)), 0) as amount FROM n_payorder WHERE n_paytime >= ? AND n_paytime < ? AND n_type = '2'", [yesterdayStr, todayStr]),
                global.db.query("SELECT n_no, n_type, n_amount, n_paytime, n_paymethod, n_uid, n_balance FROM n_payorder WHERE n_paytime >= ? AND n_type = '2' ORDER BY n_paytime DESC LIMIT 10", [todayStr]),
                global.db.query("SELECT n_no, n_type, n_amount, n_paytime, n_paymethod, n_uid, n_balance FROM n_payorder WHERE n_paytime >= ? AND n_paytime < ? AND n_type = '2' ORDER BY n_paytime DESC LIMIT 10", [yesterdayStr, todayStr])
            ]);

            // 今日流水金额 (只统计已支付的订单)
            const todayRevenueTotal = parseFloat(todayRevenue[0].amount) || 0;
            // 昨日流水金额
            const yesterdayRevenueTotal = parseFloat(yesterdayRevenue[0].amount) || 0;

            return {
                // 基础统计
                total: {
                    users: totalUsers[0].count,
                    threads: totalThreads[0].count,
                    comments: totalComments[0].count
                },
                // 今日统计
                today: {
                    register: todayRegister[0].count,
                    threads: todayThreads[0].count,
                    comments: todayComments[0].count,
                    revenue: todayRevenueTotal
                },
                // 昨日统计
                yesterday: {
                    register: yesterdayRegister[0].count,
                    threads: yesterdayThreads[0].count,
                    comments: yesterdayComments[0].count,
                    revenue: yesterdayRevenueTotal
                },
                // 流水列表
                billList: {
                    today: todayBillList,
                    yesterday: yesterdayBillList
                }
            };
        };

        await sendStats(reply, 'admin:stats:index:v1', 60, build);
    }),

    // 获取综合趋势数据(指定天数)
    GetComprehensiveTrend: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;
        let days = parseInt(pre.days) || 30; // 默认30天
        if (days < 1) days = 1;
        if (days > 365) days = 365; // 限制上限，避免过大范围查询

        const build = async () => {
            const startStr = getDateStr(-(days - 1)) + ' 00:00:00';
            const endStr = getDateStr() + ' 23:59:59';

            // 每个数据源按天聚合一次，替代逐天多次查询(N+1)
            const [users, threads, comments, revenues] = await Promise.all([
                global.db.query(
                    'SELECT substr(n_registertime, 1, 10) as d, COUNT(*) as count FROM n_users WHERE n_registertime >= ? AND n_registertime <= ? GROUP BY d',
                    [startStr, endStr]
                ),
                global.db.query(
                    'SELECT substr(n_time, 1, 10) as d, COUNT(*) as count FROM n_threads WHERE n_time >= ? AND n_time <= ? GROUP BY d',
                    [startStr, endStr]
                ),
                global.db.query(
                    'SELECT substr(n_time, 1, 10) as d, COUNT(*) as count FROM n_comment WHERE n_time >= ? AND n_time <= ? GROUP BY d',
                    [startStr, endStr]
                ),
                global.db.query(
                    "SELECT substr(n_paytime, 1, 10) as d, COALESCE(SUM(CAST(n_amount AS REAL)), 0) as amount FROM n_payorder WHERE n_paytime >= ? AND n_paytime <= ? AND n_type = '2' GROUP BY d",
                    [startStr, endStr]
                )
            ]);

            const userMap = toDateMap(users, 'count');
            const threadMap = toDateMap(threads, 'count');
            const commentMap = toDateMap(comments, 'count');
            const revenueMap = toDateMap(revenues, 'amount');

            const result = [];
            for (let i = days - 1; i >= 0; i--) {
                const date = getDateStr(-i);
                result.push({
                    date,
                    register: userMap[date] || 0,
                    threads: threadMap[date] || 0,
                    comments: commentMap[date] || 0,
                    revenue: parseFloat(revenueMap[date]) || 0
                });
            }
            return result;
        };

        await sendStats(reply, 'admin:stats:trend:v1:' + days, 300, build);
    })
}
