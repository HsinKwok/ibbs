import UserInfo from './info.js';
export default {

    /* 获取提现方式 n_withdraw_method */
    GetWithdrawMethod: (request, reply) => global.Fun(reply, async () => {
        const Ware = request.Ware;
        const pre = request.body;
        const method = await global.db.query('SELECT * FROM n_withdraw_method where n_off = 1');
        global.sendMsg(reply, 200, '获取成功', method);
    }),

    /* 申请提现接口 */
    UpWithdraw: (request, reply) => global.Fun(reply, async () => {
        const Ware = request.Ware;
        const pre = request.body;

        /* 提现功能开关（'1' 表示开启） */
        const config = await global.Tools.getConfig();
        if (!config.length || config[0].n_wallet_withdraw_off !== '1') {
            global.sendMsg(reply, 403, '提现功能已关闭');
            return;
        }

        const users = await global.db.query('SELECT * FROM n_users where id = ?', [Ware.id]);
        if (users.length === 0) {
            global.sendMsg(reply, 201, '用户不存在');
            return;
        }
        let Vinfo = await UserInfo.getVipInfo(Ware.id, users[0])

        /* 金额校验：必须为合法数字，避免 NaN 绕过后续比较 */
        if (pre.n_amount === undefined || pre.n_amount === null || pre.n_amount === '') {
            global.sendMsg(reply, 201, '请输入提现金额');
            return;
        }
        const amount = Number(pre.n_amount)
        if (!Number.isFinite(amount) || amount <= 0) {
            global.sendMsg(reply, 201, '提现金额必须大于0');
            return;
        }
        /* 校验提现方式：必须为已启用（n_off='1'）的合法方式编码，避免非法值入库 */
        if (!pre.n_method) {
            global.sendMsg(reply, 201, '请选择提现方式');
            return;
        }
        const methodRows = await global.db.query("SELECT id FROM n_withdraw_method WHERE n_code = ? AND n_off = '1'", [String(pre.n_method)]);
        if (methodRows.length === 0) {
            global.sendMsg(reply, 201, '提现方式不存在或已停用');
            return;
        }
        /* 提现上下限：配置字段缺失或非数字时跳过对应比较，避免 NaN 比较恒为 false 而绕过限制 */
        const minRaw = Number(Vinfo.n_withdrawal_min);
        const maxRaw = Number(Vinfo.n_withdrawal_max);
        if (Number.isFinite(minRaw) && amount < minRaw) {
            global.sendMsg(reply, 201, '提现金额低于最低提现额度');
            return;
        }
        if (Number.isFinite(maxRaw) && amount > maxRaw) {
            global.sendMsg(reply, 201, '提现金额高于最高提现额度');
            return;
        }
        if (users[0].n_balance < amount) {
            global.sendMsg(reply, 201, '余额不足');
            return;
        }
        /* 校验提现账号：必须为非空字符串，净化后限长，避免超长/恶意内容入库 */
        if (typeof pre.n_acc !== 'string' || pre.n_acc.trim() === '') {
            global.sendMsg(reply, 201, '请输入正确的提现账号');
            return;
        }
        const account = global.Sanitize(pre.n_acc.trim()).slice(0, 200);
        if (!account) {
            global.sendMsg(reply, 201, '请输入正确的提现账号');
            return;
        }

        /* 原子扣减余额：带条件更新，防止并发提现超额 */
        const meta = await global.db.run('UPDATE n_users SET n_balance = n_balance - ? WHERE id = ? AND n_balance >= ?', [amount, Ware.id, amount]);
        if (!meta || !meta.changes) {
            global.sendMsg(reply, 201, '余额不足');
            return;
        }

        /* 获取用户手续费；字段缺失或非数字时兜底为 0，避免 NaN 写入手续费/到账金额 */
        const feeRaw = Number(Vinfo.n_withdrawal_fee)
        const fee = Number.isFinite(feeRaw) ? feeRaw / 100 : 0
        const handlingFee = amount * fee

        /* 提现日志与用户账单在同一事务内写入，避免部分成功导致账目不一致。
           仅写入白名单字段，避免请求体字段被当作列名 */
        try {
            await global.db.batch([
                {
                    sql: 'INSERT INTO n_withdrawlog (n_amount, n_method, n_acc, n_handling_fee, n_received, n_time, n_no, n_type, n_uid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    params: [amount, String(pre.n_method), account, handlingFee, amount - handlingFee, new Date(), global.Tools.generateOrderCode('WIT'), 1, Ware.id]
                },
                {
                    sql: 'INSERT INTO n_user_bill (n_name, n_amount, n_uid, n_time, n_type, n_status) VALUES (?, ?, ?, ?, ?, ?)',
                    params: ['在线提现', amount, Ware.id, new Date(), 2, 2]
                }
            ]);
        } catch (error) {
            /* 写日志失败：补偿回滚已扣减的余额，避免「扣了钱却没有提现记录」 */
            console.log(error);
            await global.db.run('UPDATE n_users SET n_balance = n_balance + ? WHERE id = ?', [amount, Ware.id]);
            global.sendMsg(reply, 201, '提现申请失败，请稍后重试');
            return;
        }

        global.sendMsg(reply, 200, '申请成功');
    }),

    /* 获取提现列表 */
    GetWithdrawList: (request, reply) => global.Fun(reply, async () => {
        const Ware = request.Ware;
        const pre = request.body;
        if (pre.id) {
            /* 仅允许查看属于自己的提现记录 */
            const res = await global.db.query('SELECT * FROM n_withdrawlog WHERE id = ? AND n_uid = ?', [pre.id, Ware.id])
            if (res.length == 0) {
                global.sendMsg(reply, 404, '提现记录不存在');
                return
            }
            global.sendMsg(reply, 200, '获取成功', res[0]);
            return
        }
        const SqlBuilder = new global.SqlBuilder();
        const sql = SqlBuilder.add('n_no', pre.search, 'like').add('n_uid', Ware.id).build();
        const res = await global.db.getPaginatedData('n_withdrawlog', sql.sql, sql.params, ['id', 'desc'], pre.page, pre.pagesize)
        global.sendMsg(reply, 200, '获取成功', res.data, res.total);
    }),


}
