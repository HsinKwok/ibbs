
/* 轮播图属低频变更的公共数据，进程内缓存 60 秒 */
const CACHE_TTL = 60;

async function cached(key, fetcher) {
    const fn = global.RedisUtils?.getOrSetMemoryCache;
    return fn ? fn(key, CACHE_TTL, fetcher) : fetcher();
}

export default {
    /* 获取轮播图 */
    swipers: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;
        if(pre.id){
            const row = await cached(`swipers:item:${pre.id}`, async () => {
                const res = await global.db.query('SELECT * FROM n_swipers WHERE id = ?', [pre.id])
                return res.length === 0 ? null : res[0];
            })
            if (!row) {
                return global.sendMsg(reply, 404, '数据不存在');
            }
            global.sendMsg(reply, 200, '获取成功', row);
            return
        }
        const cacheKey = 'swipers:list:' + JSON.stringify([pre.search || '', pre.pos || '', pre.page || 1, pre.pagesize || 20]);
        const res = await cached(cacheKey, async () => {
            const SqlBuilder = new global.SqlBuilder();
            const sql = SqlBuilder.add('n_name', pre.search, 'like').add('n_pos', pre.pos).build();
            return global.db.getPaginatedData('n_swipers', sql.sql, sql.params, ['n_sort', 'desc'], pre.page, pre.pagesize)
        })
        global.sendMsg(reply, 200, '获取成功', res.data, res.total);
    })

}
