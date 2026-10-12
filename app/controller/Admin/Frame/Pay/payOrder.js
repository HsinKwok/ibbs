import PayService from '../../../../library/pay/index.js'
export default {
    /* 获取支付配置列表 */
    getPayOrder: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;


        /* 如果有ID */
        if (pre.id) {
            let order = await global.db.query('select * from n_payorder where id = ?', [pre.id])
            if (order.length === 0) {
                global.sendMsg(reply, 201, '订单不存在');
                return;
            }
            const orderItem = await global.db.query('SELECT * FROM n_payorder_item where n_oid = ?', [order[0].id]);
            order[0].n_item = orderItem;

            /* 获取用户信息 */
            const user = await global.db.query('select * from n_users where id = ?', [order[0].n_uid])
            order[0].n_user_nickname = user.length > 0 ? user[0].n_nickname : ''
            order[0].n_user_username = user.length > 0 ? user[0].n_username : ''
            global.sendMsg(reply, 200, '获取成功', order[0]);
            return;
        }

        const SqlBuilder = new global.SqlBuilder();
        const sql = SqlBuilder
            .add('n_no', pre.search, 'like')
            .add('n_creatertime', [pre.starttime, pre.endtime], 'between')
            .build();

        const res = await global.db.getPaginatedData('n_payorder', sql.sql, sql.params, ['id', 'desc'], pre.page, pre.pagesize)

        /* 只查询当前页订单涉及的用户（昵称/用户名），避免全表扫描并规避读取密码哈希 */
        const map = new Map();
        const uids = [...new Set(res.data.map(item => item.n_uid).filter(v => v !== null && v !== undefined))];
        if (uids.length) {
            const users = await global.Tools.queryInChunks(uids, (c) => global.db.query(`SELECT id,n_nickname,n_username FROM n_users WHERE id IN (${c.map(() => '?').join(',')})`, c));
            users.forEach(item => map.set(item.id, item));
        }

        /* 匹配用户信息 */
        res.data.forEach(item => {
            const user = map.get(item.n_uid);
            item.n_user_nickname = user ? user.n_nickname : ''
            item.n_user_username = user ? user.n_username : ''
        })
        global.sendMsg(reply, 200, '获取成功', res.data, res.total);
    }),
    /* 删除订单 */
    delePayOrder: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;
        /* 级联清理订单明细与订单本身，置于同一事务，避免中途失败残留孤儿明细 */
        await global.db.batch([
            { sql: 'DELETE FROM n_payorder_item WHERE n_oid = ?', params: [pre.id] },
            { sql: 'DELETE FROM n_payorder WHERE id = ?', params: [pre.id] },
        ])
        global.sendMsg(reply, 200, '删除成功');

    }),
    /* 批量删除订单 */
    batchDelePayOrder: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;
        const ids = global.Tools.parseIds(pre.ids)
        if (ids.length === 0) {
            global.sendMsg(reply, 201, '请选择要删除的数据');
            return;
        }
        if (ids.length > global.Tools.MAX_BATCH_IDS) {
            global.sendMsg(reply, 201, `单次最多操作 ${global.Tools.MAX_BATCH_IDS} 条`);
            return;
        }
        /* 级联清理订单明细与订单本身，置于同一事务，避免中途失败残留孤儿明细 */
        const placeholders = ids.map(() => '?').join(',');
        await global.db.batch([
            { sql: `DELETE FROM n_payorder_item WHERE n_oid IN (${placeholders})`, params: ids },
            { sql: `DELETE FROM n_payorder WHERE id IN (${placeholders})`, params: ids },
        ])
        global.sendMsg(reply, 200, '删除成功');
    }),
    /* 支付回调 */
    upPayNotify: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;
        const Pay = new PayService()
        await Pay.PayNotify(pre, reply, 2, request.rawBody, request.headers)
    }),
}
