export default {
    /* 获取商品列表（公开，仅上架；发布/编辑/删除由后台管理员完成） */
    GetMarketList: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;
        const SqlBuilder = new global.SqlBuilder();
        const sql = SqlBuilder
            .add('n_name', pre.search, 'like')
            .add('n_category', pre.n_category)
            .add('n_status', '1')
            .build();
        const res = await global.db.getPaginatedData('n_market', sql.sql, sql.params, ['id', 'desc'], pre.page, pre.pagesize);
        global.sendMsg(reply, 200, '获取成功', res.data, res.total);
    }),
}
