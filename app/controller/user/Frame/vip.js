export default {
 
    /* 获取用户组列表 n_usergroup */
    usergroup: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;
        /* 排除默认组与系统内置组（管理员组），避免后者出现在前台会员购买列表 */
        const res = await global.db.query('SELECT * FROM n_usergroup where (n_deft is null or n_deft != 1) and (n_builtin is null or n_builtin != 1)')
        global.sendMsg(reply, 200, '获取成功', res);
    }),
    /* 获取用户组价格列表 */
    usergroup_price: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;
        const SqlBuilder = new global.SqlBuilder();
        const sql = SqlBuilder.add('n_gid', pre.n_gid).build();
        const res = await global.db.getPaginatedData('n_usergroup_price', sql.sql, sql.params, ['n_sort', 'desc'], pre.page, pre.pagesize)
        global.sendMsg(reply, 200, '获取成功', res.data, res.total);
    }),
    
}

