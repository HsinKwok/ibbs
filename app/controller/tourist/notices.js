
/* 公告属低频变更的公共数据，进程内缓存 60 秒 */
const CACHE_TTL = 60;

async function cached(key, fetcher) {
    const fn = global.RedisUtils?.getOrSetMemoryCache;
    return fn ? fn(key, CACHE_TTL, fetcher) : fetcher();
}

export default {
    /* 获取公告 */
    notices: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;
        if (pre.id) {
            const row = await cached(`notices:item:${pre.id}`, async () => {
                const res = await global.db.query('SELECT * FROM n_notices WHERE id = ?', [pre.id])
                return res.length === 0 ? null : res[0];
            })
            if (!row) {
                return global.sendMsg(reply, 404, '数据不存在');
            }
            global.sendMsg(reply, 200, '获取成功', row);
            return
        }
        const cacheKey = 'notices:list:' + JSON.stringify([pre.search || '', pre.page || 1, pre.pagesize || 20]);
        const res = await cached(cacheKey, async () => {
            const SqlBuilder = new global.SqlBuilder();
            const sql = SqlBuilder.add('n_name', pre.search, 'like').build();
            /* 置顶优先，其次按 id 倒序 */
            return global.db.getPaginatedData('n_notices', sql.sql, sql.params, [['n_top', 'desc'], ['id', 'desc']], pre.page, pre.pagesize)
        })
        global.sendMsg(reply, 200, '获取成功', res.data, res.total);
    })

}
