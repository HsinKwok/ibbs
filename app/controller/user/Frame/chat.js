/* n_user_msg 用户间私信 */

/* 可撤回时间窗口：2 分钟 */
const RECALL_WINDOW = 2 * 60 * 1000;

/* 私信发送频控：每用户 60 秒内最多发送 N 条 */
const CHAT_RATE_LIMIT = 20;
const CHAT_RATE_TTL = 60;

/* n_time 由 formatDateTime 以「站点配置时区」字符串存储（已含时区偏移），
   这里按同一基准解析为时间戳，用于计算已过去的时间 */
const parseSiteTime = (s) => {
    if (!s) return 0;
    const t = Date.parse(String(s).replace(' ', 'T') + 'Z');
    return isNaN(t) ? 0 : t;
};

export default {
    /* 发送私信 */
    SendChat: (request, reply) => global.Fun(reply, async () => {
        const Ware = request.Ware;
        const pre = request.body;
        const to = parseInt(pre.to, 10);
        const content = (pre.n_content == null ? '' : String(pre.n_content)).trim();

        if (!to) {
            global.sendMsg(reply, 201, '缺少接收人');
            return;
        }
        if (to === Ware.id) {
            global.sendMsg(reply, 201, '不能给自己发私信');
            return;
        }
        if (!content) {
            global.sendMsg(reply, 201, '私信内容不能为空');
            return;
        }
        if (content.length > 1000) {
            global.sendMsg(reply, 201, '私信内容过长');
            return;
        }

        /* 接收人必须存在 */
        const users = await global.db.query('SELECT id FROM n_users WHERE id = ?', [to]);
        if (users.length === 0) {
            global.sendMsg(reply, 404, '接收人不存在');
            return;
        }

        /* 频控：每用户 60 秒内最多发送 N 条私信 */
        if (await global.Tools.isRateLimited(`chat:send:${Ware.id}`, CHAT_RATE_LIMIT)) {
            global.sendMsg(reply, 201, '发送过于频繁，请稍后再试');
            return;
        }
        await global.Tools.incrRateCount(`chat:send:${Ware.id}`, CHAT_RATE_TTL);

        await global.db.insert('n_user_msg', {
            n_from: Ware.id,
            n_to: to,
            /* 私信内容消毒，防止前端渲染时产生存储型 XSS */
            n_content: global.Sanitize(content),
            n_time: new Date(),
            n_read: '0',
            n_recall: '0',
            n_from_del: '0',
            n_to_del: '0'
        });
        global.sendMsg(reply, 200, '发送成功');
    }),
    /* 会话列表：按对方聚合，返回最近一条消息与未读数 */
    GetConversations: (request, reply) => global.Fun(reply, async () => {
        const uid = request.Ware.id;

        /* 每个会话取最近一条消息 id（各自软删除的记录不计入） */
        const rows = await global.db.query(
            `SELECT CASE WHEN n_from = ? THEN n_to ELSE n_from END AS peer, MAX(id) AS last_id
             FROM n_user_msg
             WHERE (n_from = ? AND n_from_del != '1') OR (n_to = ? AND n_to_del != '1')
             GROUP BY peer
             ORDER BY last_id DESC`,
            [uid, uid, uid]
        );
        if (rows.length === 0) {
            global.sendMsg(reply, 200, '获取成功', []);
            return;
        }

        const peers = rows.map((r) => r.peer);
        const lastIds = rows.map((r) => r.last_id);

        /* 最近一条消息内容、未读数、对方用户信息三者相互独立，并行查询减少 D1 往返 */
        const [lastMsgs, unreadRows, users] = await Promise.all([
            global.Tools.queryInChunks(lastIds, (c) => global.db.query(
                `SELECT * FROM n_user_msg WHERE id IN (${c.map(() => '?').join(', ')})`,
                c
            )),
            global.db.query(
                `SELECT n_from AS peer, COUNT(*) AS cnt FROM n_user_msg WHERE n_to = ? AND n_read != '1' AND n_recall != '1' AND n_to_del != '1' GROUP BY n_from`,
                [uid]
            ),
            global.Tools.queryInChunks(peers, (c) => global.db.query(
                `SELECT id, n_nickname, n_avatar FROM n_users WHERE id IN (${c.map(() => '?').join(', ')})`,
                c
            ))
        ]);
        const msgMap = new Map(lastMsgs.map((m) => [m.id, m]));
        const unreadMap = new Map(unreadRows.map((r) => [r.peer, r.cnt]));
        const userMap = new Map(users.map((u) => [u.id, u]));

        const list = rows.map((r) => {
            const m = msgMap.get(r.last_id) || {};
            const u = userMap.get(r.peer) || {};
            const recalled = m.n_recall === '1';
            return {
                id: r.peer,
                n_nickname: u.n_nickname || '未知用户',
                n_avatar: u.n_avatar || '',
                /* 已撤回的消息不下发原文，仅保留撤回标记供前端展示 */
                n_content: recalled ? '' : (m.n_content || ''),
                n_time: m.n_time || '',
                n_from: m.n_from,
                n_recall: m.n_recall || '0',
                unread: unreadMap.get(r.peer) || 0
            };
        });
        global.sendMsg(reply, 200, '获取成功', list);
    }),
    /* 会话消息：我与某用户的私信记录（分页） */
    GetChatMsgs: (request, reply) => global.Fun(reply, async () => {
        const uid = request.Ware.id;
        const pre = request.body;
        const peer = parseInt(pre.id, 10);
        if (!peer) {
            global.sendMsg(reply, 201, '缺少会话对象');
            return;
        }

        const where = `AND ((n_from = ? AND n_to = ? AND n_from_del != '1') OR (n_from = ? AND n_to = ? AND n_to_del != '1'))`;
        const res = await global.db.getPaginatedData(
            'n_user_msg',
            where,
            [uid, peer, peer, uid],
            ['id', 'desc'],
            pre.page,
            pre.pagesize
        );
        /* 已撤回的消息不下发原文，仅保留撤回标记供前端展示 */
        const data = (res.data || []).map((m) => (
            m.n_recall === '1' ? { ...m, n_content: '' } : m
        ));
        global.sendMsg(reply, 200, '获取成功', data, res.total);
    }),
    /* 标记会话已读：将该用户发给我的私信全部置为已读 */
    ReadChat: (request, reply) => global.Fun(reply, async () => {
        const uid = request.Ware.id;
        const peer = parseInt(request.body.id, 10);
        if (!peer) {
            global.sendMsg(reply, 201, '缺少会话对象');
            return;
        }
        await global.db.run(`UPDATE n_user_msg SET n_read = '1' WHERE n_to = ? AND n_from = ?`, [uid, peer]);
        global.sendMsg(reply, 200, '操作成功');
    }),
    /* 删除会话：仅对当前用户软删除 */
    DelChat: (request, reply) => global.Fun(reply, async () => {
        const uid = request.Ware.id;
        const peer = parseInt(request.body.id, 10);
        if (!peer) {
            global.sendMsg(reply, 201, '缺少会话对象');
            return;
        }
        /* 两条软删除合并为一次 batch（同一事务内执行），避免半删除导致会话状态不一致 */
        await global.db.batch([
            { sql: `UPDATE n_user_msg SET n_from_del = '1' WHERE n_from = ? AND n_to = ?`, params: [uid, peer] },
            { sql: `UPDATE n_user_msg SET n_to_del = '1' WHERE n_to = ? AND n_from = ?`, params: [uid, peer] },
        ]);
        global.sendMsg(reply, 200, '删除成功');
    }),
    /* 撤回私信：仅发送者本人、且未撤回、在可撤回时间窗口内 */
    RecallChat: (request, reply) => global.Fun(reply, async () => {
        const uid = request.Ware.id;
        const id = parseInt(request.body.id, 10);
        if (!id) {
            global.sendMsg(reply, 201, '缺少消息标识');
            return;
        }

        const rows = await global.db.query('SELECT * FROM n_user_msg WHERE id = ?', [id]);
        if (rows.length === 0) {
            global.sendMsg(reply, 404, '消息不存在');
            return;
        }
        const msg = rows[0];
        if (msg.n_from !== uid) {
            global.sendMsg(reply, 203, '只能撤回自己发送的私信');
            return;
        }
        if (msg.n_recall === '1') {
            global.sendMsg(reply, 201, '消息已撤回');
            return;
        }
        const elapsed = Date.now() + global.Tools.getOffsetMinutes() * 60 * 1000 - parseSiteTime(msg.n_time);
        if (elapsed > RECALL_WINDOW) {
            global.sendMsg(reply, 201, '超过可撤回时间');
            return;
        }

        await global.db.update('n_user_msg', { n_recall: '1' }, 'id = ?', [id]);
        global.sendMsg(reply, 200, '撤回成功');
    }),
    /* 私信未读数量 */
    GetChatUnread: (request, reply) => global.Fun(reply, async () => {
        const uid = request.Ware.id;
        const res = await global.db.query(
            `SELECT COUNT(*) AS total FROM n_user_msg WHERE n_to = ? AND n_read != '1' AND n_recall != '1' AND n_to_del != '1'`,
            [uid]
        );
        global.sendMsg(reply, 200, '获取成功', { total: res[0].total });
    }),
}
