
export default {
    /* 获取分类 */
    class: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;
        if (pre.id) {
            const res = await global.db.query('SELECT * FROM n_class WHERE id = ?', [pre.id])
            if (res.length === 0) {
                global.sendMsg(reply, 201, '分类不存在');
                return
            }
            /* 获取分类下帖子数量 */
            const count = await global.db.query(`SELECT COUNT(DISTINCT n_tid) AS c FROM n_tclist WHERE n_cid = ?`, [pre.id]);
            res[0].n_threads = count[0].c;
            global.sendMsg(reply, 200, '获取成功', res[0]);
            return
        }
        const SqlBuilder = new global.SqlBuilder();
        const sql = SqlBuilder.add('n_name', pre.search, 'like').add('n_type', pre.type === '' || pre.type == null ? 1 : pre.type).build();
        const res = await global.db.getPaginatedData('n_class', sql.sql, sql.params, ['n_sort', 'desc'], pre.page, pre.pagesize)
        /* 批量获取各分类下帖子数量（避免 N+1 查询）；ids 可能达 pagesize 上限，需分片避免超出绑定参数上限 */
        if (res.data.length > 0) {
            const ids = res.data.map(c => c.id);
            const counts = await global.Tools.queryInChunks(ids, (chunk) =>
                global.db.query(
                    `SELECT n_cid AS id, COUNT(DISTINCT n_tid) AS c FROM n_tclist WHERE n_cid IN (${chunk.map(() => '?').join(', ')}) GROUP BY n_cid`,
                    chunk
                )
            );
            const countMap = counts.reduce((m, r) => { m[r.id] = r.c; return m; }, {});
            res.data.forEach(c => { c.n_threads = countMap[c.id] || 0; });
        }

        global.sendMsg(reply, 200, '获取成功', res.data, res.total);
    })

}