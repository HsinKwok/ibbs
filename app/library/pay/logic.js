/* 单笔订单金额上限（元），防止异常的超大金额 */
const MAX_ORDER_AMOUNT = 1000000;

/* 单笔订单最大商品项数，防止超长列表放大查询与写入开销 */
const MAX_ORDER_ITEMS = 100;

/* 抛出「金额不合法」错误（携带标记，避免被 calculatePrice 内部的 catch 吞掉） */
function invalidAmount(msg) {
    const err = new Error(msg);
    err.code = 'INVALID_AMOUNT';
    return err;
}

/* 计算价格函数 */
export async function calculatePrice(from) {

    let list;
    try {
        list = JSON.parse(from);
    } catch (error) {
        throw invalidAmount('订单内容格式错误');
    }

    if (!Array.isArray(list) || list.length === 0) {
        throw invalidAmount('订单内容为空');
    }

    if (list.length > MAX_ORDER_ITEMS) {
        throw invalidAmount('订单商品项过多');
    }

    try {
        /* 以「分」为单位累加，避免浮点相加导致 9.9 + 9.9 之类的精度误差 */
        let priceCents = 0

        /* 批量取价：先按类型收集去重后的 id 分片查询，避免逐项查询造成 N+1 */
        const type2Ids = [...new Set(list.filter((i) => i.type === 2).map((i) => i.id))];
        const type3Ids = [...new Set(list.filter((i) => i.type === 3).map((i) => i.id))];
        const memberPriceMap = new Map();
        const postPriceMap = new Map();
        if (type2Ids.length) {
            const rows = await global.Tools.queryInChunks(type2Ids, (chunk) =>
                global.db.query(`SELECT id, n_price FROM n_usergroup_price WHERE id IN (${chunk.map(() => '?').join(', ')})`, chunk)
            );
            for (const r of rows) memberPriceMap.set(String(r.id), r.n_price);
        }
        if (type3Ids.length) {
            const rows = await global.Tools.queryInChunks(type3Ids, (chunk) =>
                global.db.query(`SELECT id, n_price FROM n_threads WHERE id IN (${chunk.map(() => '?').join(', ')})`, chunk)
            );
            for (const r of rows) postPriceMap.set(String(r.id), r.n_price);
        }

        for (const item of list) {
            if (item.type === 1) {
                /* 充值金额由前端传入，必须校验为正数且不超过上限 */
                const amount = Number(item.price);
                if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_ORDER_AMOUNT) {
                    throw invalidAmount('充值金额不合法');
                }
                priceCents += Math.round(amount * 100)
            }
            if (item.type === 2) {
                /* 会员等级存在则按其价格累加（与逐条查询「length !== 0 才累加」语义一致） */
                const price = memberPriceMap.get(String(item.id));
                if (price !== undefined) {
                    priceCents += Math.round(Number(price) * 100)
                }
            }

            if (item.type === 3) {
                /* 购买帖子：帖子存在则按其价格累加 */
                const price = postPriceMap.get(String(item.id));
                if (price !== undefined) {
                    priceCents += Math.round(Number(price) * 100)
                }
            }
        }

        const price = priceCents / 100
        if (!Number.isFinite(price) || price <= 0 || price > MAX_ORDER_AMOUNT) {
            throw invalidAmount('订单金额不合法');
        }

        return price
    } catch (error) {
        console.log(error);
        if (error.code === 'INVALID_AMOUNT') throw error;
        /* 数据库等异常不再静默返回 0，避免生成 0 元订单导致白嫖 */
        throw error;
    }
}

/* 整理订单货物 */
export async function formatOrderGoods(from, id) {
    try {
        /* 
            解释,from.type类型。1：余额充值。2：会员充值，3：帖子购买
        */
        let list = JSON.parse(from)

        /* 批量读取商品信息（会员等级、会员组、帖子），避免逐项查询造成 N+1；
           写入保持逐条（N 个商品必须对应 N 行明细） */
        const type2Ids = [...new Set(list.filter((i) => i.type === 2).map((i) => i.id))];
        const type3Ids = [...new Set(list.filter((i) => i.type === 3).map((i) => i.id))];
        const levelMap = new Map();
        const groupMap = new Map();
        const postMap = new Map();

        if (type2Ids.length) {
            const levels = await global.Tools.queryInChunks(type2Ids, (chunk) =>
                global.db.query(`SELECT id, n_price, n_gid FROM n_usergroup_price WHERE id IN (${chunk.map(() => '?').join(', ')})`, chunk)
            );
            for (const r of levels) levelMap.set(String(r.id), r);
            const gids = [...new Set(levels.map((r) => r.n_gid))];
            if (gids.length) {
                const groups = await global.Tools.queryInChunks(gids, (chunk) =>
                    global.db.query(`SELECT id, n_name FROM n_usergroup WHERE id IN (${chunk.map(() => '?').join(', ')})`, chunk)
                );
                for (const r of groups) groupMap.set(String(r.id), r);
            }
        }

        if (type3Ids.length) {
            const posts = await global.Tools.queryInChunks(type3Ids, (chunk) =>
                global.db.query(`SELECT id, n_price, n_permission FROM n_threads WHERE id IN (${chunk.map(() => '?').join(', ')})`, chunk)
            );
            for (const r of posts) postMap.set(String(r.id), r);
        }

        for (const item of list) {
            if (item.type === 1) {
                await global.db.insert('n_payorder_item', {
                    n_oid: id,
                    n_name: '积分余额充值',
                    n_number: 1,
                    /* 与 calculatePrice 相同的「按分取整」口径：入账金额必须等于计费金额，
                       否则传入 0.0149 → 计费 0.01、入账 0.0149，形成套利 */
                    n_price: Math.round(Number(item.price) * 100) / 100,
                    n_type: 1
                })

                await global.db.update('n_payorder', { n_balance: 2 }, 'id = ?', [id])
            }
            if (item.type === 2) {
                /* 会员等级与所属会员组均存在时才写入明细 */
                const memberLevel = levelMap.get(String(item.id));
                if (memberLevel) {
                    const memberGroup = groupMap.get(String(memberLevel.n_gid));
                    if (memberGroup) {
                        await global.db.insert('n_payorder_item', {
                            n_oid: id,
                            n_name: '购买' + memberGroup.n_name,
                            n_number: 1,
                            /* 与 calculatePrice 统一按分取整，避免明细金额与订单金额口径不一致 */
                            n_price: Math.round(Number(memberLevel.n_price) * 100) / 100,
                            n_type: 2,
                            n_sid: item.id
                        })
                    }
                }
            }

            if (item.type === 3) {
                const postInfo = postMap.get(String(item.id));
                if (postInfo) {
                    await global.db.insert('n_payorder_item', {
                        n_oid: id,
                        n_name: '购买帖子 - ' + postInfo.id,
                        n_number: 1,
                        /* 与 calculatePrice 统一按分取整，避免明细金额与订单金额口径不一致 */
                        n_price: Math.round(Number(postInfo.n_price) * 100) / 100,
                        n_type: 3,
                        n_sid: item.id
                    })
                    if (postInfo.n_permission == '2') {
                        await global.db.update('n_payorder', { n_balance: 3 }, 'id = ?', [id])
                    }
                }
            }
        }
    } catch (error) {
        /* 记录后上抛：订单明细是后续发货的唯一依据，写入失败必须由调用方回滚订单 */
        console.log(error);
        throw error;
    }


}

/* 获取支付方式对应的transporter */
export async function getTransporter(code) {

    try {
        let sql;

        if (code == 1) {
            sql = 'SELECT n_code FROM n_payconfig where n_qq = 1 and n_off = 1';
        }
        if (code == 2) {
            sql = 'SELECT n_code FROM n_payconfig where n_wx = 1 and n_off = 1';
        }
        if (code == 3) {
            sql = 'SELECT n_code FROM n_payconfig where n_ali = 1 and n_off = 1';
        }
        if (!sql) return false;
        const res = await global.db.query(sql);
        if (res.length === 0) {
            return false
        }
        return res[0];

    } catch (error) {

        console.log(error);

    }

}

/* 引入微信支付回调解密函数 */
import { decryption, DECRYPTED_RESOURCE } from './WeChatPay/decryption.js'
/* 获取回调订单号函数 */
export async function getOrderNo(options) {
    try {
        /* 微信加密回调：订单号必须以「已验签并解密的密文」为准。
           options.out_trade_no 可能来自未签名的 query（如 ?out_trade_no=他人订单号），
           若优先采信则可被篡改订单号，导致用小额真实回调为他人订单发货。 */
        if (options.event_type === 'TRANSACTION.SUCCESS' && options.resource && options.resource.ciphertext) {
            const decrypt = await decryption(options.resource)
            /* 缓存本次解密结果，供上层 verifyNotify 复用，避免同一次微信回调被重复解密 */
            options[DECRYPTED_RESOURCE] = decrypt
            return decrypt.out_trade_no || false
        }

        /* 非微信加密回调（支付宝/易支付等）：订单号来自回调参数本身（其参数整体参与验签） */
        if (options.out_trade_no) {
            return options.out_trade_no
        }
        return false
    } catch (error) {
        return false
    }
}

/* 支付回调 */
export async function upPayNotify(info, reply) {

    try {

        /* 获取订单物品 */
        const orderItem = await global.db.query('SELECT * FROM n_payorder_item where n_oid = ?', [info.id]);

        /* 先做只读校验并收集全部写语句，最后用 D1 batch 在同一事务内原子执行：
           任一明细失败则整体回滚，避免「部分发放 + 平台重试 → 重复发放」。 */
        const writes = [];

        /* 会员到期时间与写库时间戳同口径，按站点配置时区计算 SQL 修饰符（如 '+480 minutes'） */
        const tzMod = global.Tools.sqlTimezoneModifier();

        for (let a in orderItem) {

            const item = orderItem[a];

            /* 如果是充值余额积分 */
            if (item.n_type === '1') {
                writes.push({
                    sql: 'UPDATE n_users SET n_balance = n_balance + ? WHERE id = ?',
                    params: [item.n_price, info.n_uid]
                });

                writes.push({
                    sql: 'INSERT INTO `n_user_bill` (`n_name`, `n_amount`, `n_uid`, `n_time`, `n_type`, `n_status`) VALUES (?, ?, ?, ?, ?, ?)',
                    params: ['在线充值', item.n_price, info.n_uid, new Date(), 1, 2]
                });
            }
            /* 如果是购买会员 */
            if (item.n_type === '2') {
                /* 查询会员等级信息 */
                const memberLevel = await global.db.query('SELECT * FROM n_usergroup_price where id = ?', [item.n_sid]);
                if (memberLevel.length == 0) {
                    /* 数据缺失时必须抛错：订单已被占用为已支付，静默跳过会造成「钱货两空」且平台不重试 */
                    throw new Error('会员等级不存在：' + item.n_sid);
                };

                /* 获取会员组 */

                const memberGroup = await global.db.query('SELECT * FROM n_usergroup where id = ?', [memberLevel[0].n_gid]);
                if (memberGroup.length == 0) {
                    throw new Error('会员组不存在：' + memberLevel[0].n_gid);
                };
                /* 原子 UPDATE 完成「续费/换组」，避免并发回调读后写丢失续费时长 */
                const memberGid = memberGroup[0].id;
                writes.push({
                    sql: `UPDATE n_users SET
                        n_group_id = ?,
                        n_group_time = CASE
                            WHEN n_group_id = ? AND n_group_time > datetime('now','${tzMod}')
                                THEN datetime(n_group_time, '+' || ? || ' days')
                            ELSE datetime('now','${tzMod}','+' || ? || ' days')
                        END
                     WHERE id = ?`,
                    params: [memberGid, memberGid, memberLevel[0].n_day, memberLevel[0].n_day, info.n_uid]
                });
            }

            /* 如果是购买帖子 */
            if (item.n_type === '3') {
                /* 校验帖子仍存在，否则视为无法发货（抛错交由回调方释放订单/触发重试） */
                const post = await global.db.query('SELECT id FROM n_threads WHERE id = ?', [item.n_sid]);
                if (post.length === 0) {
                    throw new Error('帖子不存在，无法发货：' + item.n_sid);
                }
                /* 幂等写入购买记录，避免回调重试导致重复发货 */
                writes.push({
                    sql: 'INSERT INTO n_threads_buy (n_tid, n_uid, n_time) SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM n_threads_buy WHERE n_tid = ? AND n_uid = ?)',
                    params: [item.n_sid, info.n_uid, new Date(), item.n_sid, info.n_uid]
                });
            }
        }

        /* 余额充值 / 会员续费都会写 n_users，先确认用户存在，避免「已扣款但发货 0 行」 */
        if (orderItem.some(i => i.n_type === '1' || i.n_type === '2')) {
            const user = await global.db.query('SELECT id FROM n_users WHERE id = ?', [info.n_uid]);
            if (user.length === 0) {
                throw new Error('用户不存在：' + info.n_uid);
            }
        }

        /* 原子执行全部发货语句；失败则整体回滚，交由调用方释放订单并触发平台重试 */
        if (writes.length) {
            await global.db.batch(writes);
        }

        if (reply) {
            global.sendMsg(reply, 200);
        }

    } catch (error) {
        /* 不再吞掉异常：发货失败必须上抛，由调用方回滚订单状态并触发重试 */
        console.log(error);
        throw error;
    }

}