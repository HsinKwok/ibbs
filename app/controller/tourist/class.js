
/* 分类属低频变更的公共数据，进程内缓存 60 秒，避免每次页面导航都读 D1 */
const CACHE_TTL = 60;

/* 缓存层不可用时直接回源，保证功能不受影响 */
async function cached(key, fetcher) {
    const fn = global.RedisUtils?.getOrSetMemoryCache;
    return fn ? fn(key, CACHE_TTL, fetcher) : fetcher();
}

/* 构建一组分类列表（圈子或话题），并批量补齐各分类下的帖子数量 */
async function buildList(pre) {
    const SqlBuilder = new global.SqlBuilder();
    const sql = SqlBuilder.add('n_name', pre.search, 'like').add('n_type', pre.type).build();
    const data = await global.db.getPaginatedData('n_class', sql.sql, sql.params, ['n_sort', 'desc'], pre.page, pre.pagesize)
    /* 批量获取各分类下帖子数量（避免 N+1 查询）；ids 可能达 pagesize 上限，需分片避免超出绑定参数上限 */
    if (data.data.length > 0) {
        const ids = data.data.map(c => c.id);
        const counts = await global.Tools.queryInChunks(ids, (chunk) =>
            global.db.query(
                `SELECT n_cid AS id, COUNT(DISTINCT n_tid) AS c FROM n_tclist WHERE n_cid IN (${chunk.map(() => '?').join(', ')}) GROUP BY n_cid`,
                chunk
            )
        );
        const countMap = counts.reduce((m, r) => { m[r.id] = r.c; return m; }, {});
        data.data.forEach(c => { c.n_threads = countMap[c.id] || 0; });
    }
    return data;
}

export default {
    /* 获取分类 */
    class: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;
        if (pre.id) {
            const row = await cached(`category:item:${pre.id}`, async () => {
                const res = await global.db.query('SELECT * FROM n_class WHERE id = ?', [pre.id])
                if (res.length === 0) return null
                /* 获取分类下帖子数量 */
                const count = await global.db.query(`SELECT COUNT(DISTINCT n_tid) AS c FROM n_tclist WHERE n_cid = ?`, [pre.id]);
                res[0].n_threads = count[0].c;
                return res[0];
            })
            if (!row) {
                global.sendMsg(reply, 201, '分类不存在');
                return
            }
            global.sendMsg(reply, 200, '获取成功', row);
            return
        }

        /* 缓存键需覆盖全部筛选条件；参数用 JSON 序列化，避免用户输入含冒号导致键碰撞 */
        const type = pre.type === '' || pre.type == null ? 1 : pre.type;

        /* 侧栏一次取两组：圈子(type=1) + 话题(type=2)，省掉前端的第二次往返 */
        if (type === 'all') {
            const cacheKey = 'category:sidebar:v1:' + JSON.stringify([pre.search || '', pre.pagesize || 20]);
            const bodyText = await cached(cacheKey, async () => {
                const [circle, topic] = await Promise.all([
                    buildList({ search: pre.search, type: 1, page: 1, pagesize: pre.pagesize || 20 }),
                    buildList({ search: pre.search, type: 2, page: 1, pagesize: pre.pagesize || 20 })
                ]);
                return JSON.stringify({
                    code: 200,
                    msg: '获取成功',
                    data: { CategoryList: circle.data, TopicList: topic.data }
                });
            });
            reply.sendJsonText(bodyText);
            return
        }

        const cacheKey = 'category:list:v1:' + JSON.stringify([pre.search || '', type, pre.page || 1, pre.pagesize || 20]);

        /* 缓存已序列化的响应文本：命中时零反序列化，也省掉分页对象的再次 stringify */
        const bodyText = await cached(cacheKey, async () => {
            const data = await buildList({
                search: pre.search,
                type,
                page: pre.page || 1,
                pagesize: pre.pagesize
            });
            return JSON.stringify({ code: 200, msg: '获取成功', data: data.data, total: data.total });
        });

        reply.sendJsonText(bodyText);
    })

}
