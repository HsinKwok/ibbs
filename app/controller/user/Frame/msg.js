/* n_msg */
export default {
    /* 获取消息列表 */
    GetMsgs: (request, reply) => global.Fun(reply, async () => {
        const Ware = request.Ware;
        const pre = request.body;
        if (pre.id) {
            /* 仅允许查看属于自己的消息 */
            const res = await global.db.query('SELECT * FROM n_msg WHERE id = ? AND n_uid = ?', [pre.id, Ware.id])
            if (res.length == 0) {
                global.sendMsg(reply, 404, '消息不存在');
                return
            }
            global.sendMsg(reply, 200, '获取成功', res[0]);
            return
        }
        const SqlBuilder = new global.SqlBuilder();
        const sql = SqlBuilder.add('n_name', pre.search, 'like').add('n_uid', Ware.id).build();
        const res = await global.db.getPaginatedData('n_msg', sql.sql, sql.params, ['id', 'desc'], pre.page, pre.pagesize)
        global.sendMsg(reply, 200, '获取成功', res.data, res.total);
    }),
    /* 获取未读消息数量 */
    GetUnreadCount: (request, reply) => global.Fun(reply, async () => {
        const Ware = request.Ware;
        const res = await global.db.query(
            `SELECT COUNT(*) AS total FROM n_msg WHERE n_uid = ? AND (n_read IS NULL OR n_read != '1')`,
            [Ware.id]
        );
        global.sendMsg(reply, 200, '获取成功', { total: res[0].total });
    }),
    /* 标记消息已读：传 id 标记单条，不传则全部已读 */
    ReadMsg: (request, reply) => global.Fun(reply, async () => {
        const Ware = request.Ware;
        const pre = request.body;
        if (pre.id) {
            await global.db.run(`UPDATE n_msg SET n_read = '1' WHERE id = ? AND n_uid = ?`, [pre.id, Ware.id]);
        } else {
            await global.db.run(`UPDATE n_msg SET n_read = '1' WHERE n_uid = ?`, [Ware.id]);
        }
        global.sendMsg(reply, 200, '操作成功');
    }),
}
