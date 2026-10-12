import { calculatePrice, formatOrderGoods, getTransporter, upPayNotify, getOrderNo } from './logic.js'
import AlipayService from './Alipay/index.js';
import WechatPayService from './WeChatPay/index.js';
import EpayService from './Epay/index.js';

// 静态注册支付模块（Workers 不支持计算路径的动态 import）
const PayModules = {
    Alipay: AlipayService,
    WeChatPay: WechatPayService,
    Epay: EpayService,
};

/* 从各支付回调返回的数据中提取实付金额（易支付 total_fee / 支付宝 total_amount / 微信 amount.total）。
 * 全部解析失败时返回 null，表示无法核对、跳过金额校验。 */
function extractNotifyAmount(data) {
    if (!data || typeof data !== 'object') return null;
    /* 微信：金额位于解密报文的 amount.total，单位为「分」，需换算为「元」 */
    if (data.amount && typeof data.amount === 'object') {
        const totalFen = Number(data.amount.total);
        if (Number.isFinite(totalFen)) return totalFen / 100;
    }
    const raw = data.total_fee ?? data.total_amount ?? data.money;
    if (raw === undefined || raw === null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

class PayService {
    constructor() {
        this.transporters = new Map(); // 缓存多个transporter实例
    }


    /**
     * 创建订单
     * @param {Object} options 订单选项
     * @param {string} options.n_paymethod 支付方式,1:QQ，2：微信，3：支付宝，4:余额，5:积分
     * @param {string} options.n_paydevice 支付设备（可选）
     * @param {number} options.n_uid 所属用户ID
     * @param {Object} options.n_from 支付详情（JSON格式，可选,[]数组模式）
     */
    async CreateOrder(options, reply) {
        try {
            /* 创建订单 */

            options.n_creatertime = new Date();
            options.n_type = 1;
            options.n_no = global.Tools.generateOrderCode('ORD');

            /* 服务端重新计算订单金额，拒绝非法/异常金额 */
            try {
                options.n_amount = await calculatePrice(options.n_from);
            } catch (error) {
                if (error.code === 'INVALID_AMOUNT') {
                    return global.sendMsg(reply, 201, error.message);
                }
                throw error;
            }

            /* 拦截作者购买自己发布的帖子 / 重复购买（type=3 为帖子购买）。
               calculatePrice 已校验 n_from 为合法非空数组，此处解析不会抛错。
               分片批量查询帖子归属与已购记录，避免逐条查询造成 N+1。 */
            const goods = JSON.parse(options.n_from);
            const postIds = [...new Set(goods.filter((item) => item.type === 3).map((item) => item.id))];
            if (postIds.length) {
                const posts = await global.Tools.queryInChunks(postIds, (chunk) =>
                    global.db.query(`SELECT id, n_uid FROM n_threads WHERE id IN (${chunk.map(() => '?').join(', ')})`, chunk)
                );
                const ownerMap = new Map(posts.map((row) => [String(row.id), String(row.n_uid)]));
                /* 该查询含 1 个固定参数(n_uid) + IN 列表，分片上限需预留 1 个位置 */
                const bought = await global.Tools.queryInChunks(postIds, (chunk) =>
                    global.db.query(`SELECT n_tid FROM n_threads_buy WHERE n_uid = ? AND n_tid IN (${chunk.map(() => '?').join(', ')})`, [options.n_uid, ...chunk]),
                    global.Tools.MAX_BATCH_IDS - 1
                );
                const boughtSet = new Set(bought.map((row) => String(row.n_tid)));
                for (const id of postIds) {
                    if (ownerMap.get(String(id)) === String(options.n_uid)) {
                        return global.sendMsg(reply, 201, '无需购买自己发布的帖子');
                    }
                    if (boughtSet.has(String(id))) {
                        return global.sendMsg(reply, 201, '您已购买过该帖子');
                    }
                }
            }

            delete options.n_paymethod;
            delete options.n_paydevice;

            const id = await global.db.insert('n_payorder', options)

            try {
                await formatOrderGoods(options.n_from, id)
            } catch (error) {
                /* 明细写入失败则回滚订单，避免留下「无明细」的脏订单导致后续无法发货 */
                console.log(error);
                await global.db.deleteIn('n_payorder_item', 'n_oid', [id])
                await global.db.deleteIn('n_payorder', 'id', [id])
                return global.sendMsg(reply, 201, '❌ 订单创建失败  : ' + error.message);
            }

            global.sendMsg(reply, 200, '成功', {
                order: options.n_no
            });

        } catch (error) {
            console.log(error);

            global.sendMsg(reply, 201, '❌ 订单创建失败  : ' + error.message);
        }
    }


    /**
     * 支付订单
     * @param {Object} options 支付选项
     * @param {string} options.n_paymethod 支付方式,1:QQ，2：微信，3：支付宝，4:余额，5:积分
     * @param {string} options.n_paydevice 支付设备（可选）
     * @param {string} options.n_type 支付类型（可选, jsapi,h5等）
     * @param {string} options.n_no 订单号
     */
    async PayOrder(options, reply) {

        try {

            /* 查询订单 */
            const order = await global.db.query('SELECT * FROM n_payorder where n_no = ?', [options.n_no]);
            if (order.length === 0) {
                return global.sendMsg(reply, 201, '订单不存在');
            }

            /* 校验订单归属，禁止支付他人订单 */
            if (order[0].n_uid != options.n_uid) {
                return global.sendMsg(reply, 403, '无权限');
            }

            /* 校验订单状态，禁止重复支付已完成的订单 */
            if (order[0].n_type !== '1') {
                return global.sendMsg(reply, 201, '订单已支付');
            }

            /* 查询支付方式 */
            const paymethod = await global.db.query('SELECT * FROM n_paymethod where n_code = ?', [options.n_paymethod]);
            if (paymethod.length === 0) {
                return global.sendMsg(reply, 201, '支付方式不存在');
            }

            /* 充值单（含余额/积分充值项）不允许用余额或积分支付，避免「用余额充值余额」的循环套利 */
            if (paymethod[0].n_code === '4' || paymethod[0].n_code === '5') {
                const rechargeItems = await global.db.query(
                    'SELECT id FROM n_payorder_item where n_oid = ? AND n_type = ?',
                    [order[0].id, 1]
                );
                if (rechargeItems.length !== 0) {
                    return global.sendMsg(reply, 201, '充值订单不支持余额或积分支付');
                }
            }

            /* 如果是余额支付 则调用余额支付逻辑分支 */
            if (paymethod[0].n_code === '4') {
                const ok = await this.BalancePay(order[0], reply)
                if (ok) {
                    await global.db.update('n_payorder', { n_paycode: 'BalancePay' }, 'id = ?', [order[0].id])
                }

                return false;
            }

            /* 如果是积分支付 则调用积分支付逻辑分支 */
            if (paymethod[0].n_code === '5' && order[0].n_balance === '3') {
                const ok = await this.PointsPay(order[0], reply)
                if (ok) {
                    await global.db.update('n_payorder', { n_paycode: 'PointsPay' }, 'id = ?', [order[0].id])
                }

                return false;
            }

            /* 获取支付方式对应的transporter */
            const transporter = await getTransporter(paymethod[0].n_code);
            if (!transporter) {
                return global.sendMsg(reply, 201, '该支付方式未配置，请先在后台完成支付配置');
            }

            const PayModuleClass = PayModules[transporter.n_code];
            if (!PayModuleClass) {
                return global.sendMsg(reply, 201, '支付方式不支持');
            }

            // 创建实例
            const payInstance = new PayModuleClass();
            options.n_amount = order[0].n_amount
            options.n_uid = order[0].n_uid
            options.n_path = order[0].n_path

            /* 写入订单 支付的插件 方便支付回调调用 */
            await global.db.update('n_payorder', { n_paycode: transporter.n_code }, 'id = ?', [order[0].id])


            await payInstance.CreatePay(options, reply)

        } catch (error) {
            console.log(error);
            global.sendMsg(reply, 201, '❌ 发起支付失败  : ' + error.message);
        }
    }

    /* 余额/积分支付公共逻辑：原子占用订单 → 原子扣减 → 发货回调 → 记录账单
     * 二者仅用户资产字段、不足提示与账单类型不同 */
    async _payWithField(options, reply, { field, insufficientMsg, billStatus }) {
        try {
            options.n_amount = Number(options.n_amount)

            /* 原子占用订单：仅当订单未支付时才能置为已支付，避免重复/并发支付重复发放 */
            const claimed = await global.db.run(
                'UPDATE n_payorder SET n_type = ?, n_paytime = ? WHERE id = ? AND n_type = ?',
                [2, new Date(), options.id, 1]
            )
            if (!claimed.changes) {
                global.sendMsg(reply, 201, '订单已支付');
                return false;
            }

            /* 原子扣减资产：仅当资产充足时才会更新成功，避免并发下先读后写导致的双花。
             * field 为内部固定字段名（n_balance / n_points），非用户输入。 */
            const paid = await global.db.run(
                `UPDATE n_users SET ${field} = ${field} - ? WHERE id = ? AND ${field} >= ?`,
                [options.n_amount, options.n_uid, options.n_amount]
            )
            if (!paid.changes) {
                /* 扣款失败，回滚订单状态 */
                await global.db.update('n_payorder', { n_type: 1, n_paytime: null }, 'id = ?', [options.id])
                global.sendMsg(reply, 201, insufficientMsg);
                return false;
            }

            /* 调用回调；发货失败则回滚资产与订单占用，向用户报告失败 */
            try {
                await upPayNotify(options, reply)
            } catch (error) {
                console.log(error);
                await global.db.run(`UPDATE n_users SET ${field} = ${field} + ? WHERE id = ?`, [options.n_amount, options.n_uid])
                await global.db.update('n_payorder', { n_type: 1, n_paytime: null }, 'id = ?', [options.id])
                global.sendMsg(reply, 201, '❌ 支付失败，请稍后重试  : ' + error.message)
                return false
            }

            await global.db.insert('n_user_bill', {
                n_name: '在线支付',
                n_amount: options.n_amount,
                n_uid: options.n_uid,
                n_time: new Date(),
                n_type: 2,
                n_status: billStatus
            })

            return true;

        } catch (error) {
            console.log(error);
            global.sendMsg(reply, 201, '❌ 发起支付失败  : ' + error.message);
            return false;
        }
    }

    /* 余额支付逻辑  */
    async BalancePay(options, reply) {
        return this._payWithField(options, reply, { field: 'n_balance', insufficientMsg: '余额不足', billStatus: 1 })
    }

    /* 积分支付逻辑 PointsPay */
    async PointsPay(options, reply) {
        return this._payWithField(options, reply, { field: 'n_points', insufficientMsg: '积分不足', billStatus: 2 })
    }


    /* 支付回调函数 */
    async PayNotify(options, reply, type = 1, rawBody = '', headers = {}) {

        /* 微信支付要求通知处理失败时返回非 200 状态码，否则微信视为成功而不再重试 */
        const isWeChatNotify = type !== 2 && !!headers['wechatpay-signature'];
        const notifyFail = (msg) => {
            if (isWeChatNotify) {
                reply.statusCode = 500;
                return reply.send({ code: 'FAIL', message: msg });
            }
            return global.sendMsg(reply, 201, msg);
        };
        /* 成功响应：微信返回 200 JSON；支付宝/易支付必须返回纯文本 success，否则平台会持续重试回调 */
        const notifyOk = () => {
            if (isWeChatNotify) {
                reply.statusCode = 200;
                return reply.send({ code: 'SUCCESS', message: '成功' });
            }
            if (type === 2) {
                return global.sendMsg(reply, 200);
            }
            return reply.send('success');
        };

        try {

            options.out_trade_no = await getOrderNo(options)
            /* 查询订单 */
            const order = await global.db.query('SELECT * FROM n_payorder where n_no = ?', [options.out_trade_no]);
            if (order.length === 0) {
                return notifyFail('订单不存在');
            }
            /* type=2 为后台手动回调，未发起过支付的订单 n_paycode 为空属正常，不在此拦截 */
            if (type !== 2 && (order[0].n_paycode === '' || order[0].n_paycode === null)) {
                return notifyFail('支付插件错误');
            }
            if (order[0].n_type === '2') {
                /* 重复回调：订单已支付，按平台要求返回成功，避免微信等平台持续重试报错 */
                return notifyOk();
            }
            if (order[0].n_type !== '1') {
                return notifyFail('订单错误！');
            }


            let res = {
                code: 0,
                msg: 'success'
            }

            if (order[0].n_paycode !== 'BalancePay' && type !== 2) {
                const PayModuleClass = PayModules[order[0].n_paycode];
                if (!PayModuleClass) {
                    return notifyFail('支付插件不存在');
                }

                // 创建实例
                const payInstance = new PayModuleClass();
                res = await payInstance.verifyNotify(options, rawBody, headers)
            } else {
                res.code = 200
            }

            if (res.code === 200) {
                /* 校验回调报文中（已验签/解密）的订单号与本地订单一致，防止订单号混淆
                   （如回调携带他人订单号、或金额相同但订单不同的伪造/异常回调） */
                if (res.data && res.data.out_trade_no
                    && String(res.data.out_trade_no) !== String(order[0].n_no)) {
                    return notifyFail('订单号不匹配');
                }

                /* 核对实付金额与订单金额，防止金额被篡改的伪造/异常回调；
                 * 微信等无法取到金额的回调返回 null，此处跳过校验。 */
                const paidAmount = extractNotifyAmount(res.data);
                if (paidAmount !== null) {
                    const expected = Number(order[0].n_amount);
                    if (!Number.isFinite(expected) || Math.abs(paidAmount - expected) > 0.0001) {
                        return notifyFail('订单金额不匹配');
                    }
                }

                /* 原子占用订单，防止支付平台重复回调导致重复发放（幂等） */
                const claimed = await global.db.run(
                    'UPDATE n_payorder SET n_type = ?, n_paytime = ? WHERE id = ? AND n_type = ?',
                    [2, new Date(), order[0].id, 1]
                )
                if (!claimed.changes) {
                    /* 重复回调：订单已支付，仍按平台要求返回成功，避免平台无谓重试 */
                    return notifyOk();
                }
                /* 执行支付回调逻辑函数；失败则释放订单占用并返回失败，交由支付平台重试 */
                try {
                    await upPayNotify(order[0])
                } catch (error) {
                    console.log(error);
                    await global.db.update('n_payorder', { n_type: 1, n_paytime: null }, 'id = ?', [order[0].id])
                    return notifyFail('❌ 回调发货失败  : ' + error.message);
                }
                notifyOk();
            } else {
                notifyFail('❌ 回调失败  : ' + res.msg);
            }


        } catch (error) {
            console.log(error);
            notifyFail('❌ 回调失败  : ' + error.message);
        }
    }


}

export default PayService;