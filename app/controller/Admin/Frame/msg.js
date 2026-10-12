/*
 * 系统消息（n_msg）后台管理。
 * n_msg 每条记录只归属一个用户，没有「批次」字段；
 * 一次群发会为每位用户各插入一条，同批次共用同一个 n_time（同一 Date 生成）。
 * 因此列表以 n_name + n_html + n_time 聚合成「发布批次」，删除也按批次整批删除。
 */
const BATCH_CHUNK = 500;

export default {
    /* 获取发布批次列表 */
    getMsgBatch: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;
        const page = Number.isInteger(+pre.page) && +pre.page > 0 ? +pre.page : 1;
        const size = Number.isInteger(+pre.pagesize) && +pre.pagesize > 0 ? Math.min(+pre.pagesize, 1000) : 20;
        const offset = (page - 1) * size;
        const where = pre.search ? 'AND n_name LIKE ?' : '';
        const params = pre.search ? [`%${pre.search}%`] : [];

        const rows = await global.db.query(
            `SELECT n_name, n_html, n_time,
                    COUNT(*) AS total,
                    SUM(CASE WHEN n_read = '1' THEN 1 ELSE 0 END) AS read_count,
                    MAX(id) AS max_id
             FROM n_msg WHERE 1=1 ${where}
             GROUP BY n_name, n_html, n_time
             ORDER BY n_time DESC, max_id DESC
             LIMIT ${size} OFFSET ${offset}`, params);

        const totalRows = await global.db.query(
            `SELECT COUNT(*) AS total FROM (
                SELECT 1 FROM n_msg WHERE 1=1 ${where} GROUP BY n_name, n_html, n_time)`, params);

        rows.forEach(r => { r.key = `${r.n_time}-${r.max_id}`; });
        global.sendMsg(reply, 200, '获取成功', rows, totalRows[0].total || 0);
    }),
    /* 群发系统消息给全部用户 */
    addMsg: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;
        const name = String(pre.n_name ?? '').trim();
        /* 富文本内容统一净化，防止群发的系统消息成为存储型 XSS 载体 */
        const html = global.Sanitize(String(pre.n_html ?? '').trim());
        if (!name) { global.sendMsg(reply, 201, '请填写消息标题'); return; }
        if (!html) { global.sendMsg(reply, 201, '请填写消息内容'); return; }

        /* 同一时间对象 → 同批次所有记录 n_time 完全一致，便于聚合与整批删除 */
        const time = new Date();
        /* 按 id 键集分页拉取用户并分批写入，避免一次性拉取/构造全量用户数组导致 O(N) 内存占用 */
        let lastId = 0;
        let sent = 0;
        while (true) {
            const users = await global.db.query(
                'SELECT id FROM n_users WHERE id > ? ORDER BY id ASC LIMIT ?',
                [lastId, BATCH_CHUNK]
            );
            if (!users.length) break;
            const statements = users.map(u => ({
                sql: 'INSERT INTO `n_msg` (`n_uid`, `n_name`, `n_html`, `n_time`, `n_read`) VALUES (?, ?, ?, ?, ?)',
                params: [u.id, name, html, time, '0'],
            }));
            await global.db.batch(statements);
            sent += users.length;
            lastId = users[users.length - 1].id;
            if (users.length < BATCH_CHUNK) break;
        }
        if (sent === 0) { global.sendMsg(reply, 201, '暂无用户可发送'); return; }
        global.sendMsg(reply, 200, `已发送给 ${sent} 位用户`);
    }),
    /* 按批次整批删除 */
    delMsg: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;
        if (!pre.n_time) { global.sendMsg(reply, 201, '参数错误'); return; }
        await global.db.delete('n_msg', '`n_name` = ? AND `n_html` = ? AND `n_time` = ?',
            [pre.n_name ?? '', pre.n_html ?? '', pre.n_time]);
        global.sendMsg(reply, 200, '删除成功');
    }),
};
