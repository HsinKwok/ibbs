export default {
    /* 获取公告 */
    notices: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;
        if (pre.id) {
            const res = await global.db.query('SELECT * FROM n_notices WHERE id = ?', [pre.id])
            if (res.length === 0) {
                return global.sendMsg(reply, 404, '数据不存在');
            }
            global.sendMsg(reply, 200, '获取成功', res[0]);
            return
        }
        const SqlBuilder = new global.SqlBuilder();
        const sql = SqlBuilder.add('n_name', pre.search, 'like').build();
        /* 置顶优先，其次按 id 倒序 */
        const res = await global.db.getPaginatedData('n_notices', sql.sql, sql.params, [['n_top', 'desc'], ['id', 'desc']], pre.page, pre.pagesize)
        global.sendMsg(reply, 200, '获取成功', res.data, res.total);
    })

}