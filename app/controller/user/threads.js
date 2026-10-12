import AssignMedal from "./medal.js";

/* 输入长度上限 */
const TITLE_MAX_LEN = 100;
const CONTENT_MAX_LEN = 5000;
/* 帖子价格上限 */
const PRICE_MAX = 1000000;
/* 频控：每用户 60 秒内最多发帖/评论数 */
const POST_RATE_LIMIT = 5;
const COMMENT_RATE_LIMIT = 10;
const RATE_TTL = 60;

/* 频控：每 IP 60 秒内最多发帖/评论数。用户维度限流可被换号绕过，IP 维度做兜底约束。 */
const POST_IP_RATE_LIMIT = 20;
const COMMENT_IP_RATE_LIMIT = 30;

/* 帖子权限：'1' 免费 / '2' 积分 / '3' 余额 */
const PERMISSION_VALUES = ['1', '2', '3'];
/* 资源数据（前端 JSON.stringify(resources) 得到的 JSON 数组字符串）长度上限 */
const RESOURCES_MAX_LEN = 100000;

/* 归一化并校验帖子的权限/资源/媒体标志位，仅处理显式传入的字段。
   返回 { error } 表示校验失败，否则返回 { data }（仅含传入字段，已归一）。 */
function normalizeThreadFields(source) {
    const data = {};

    if (source.n_permission !== undefined) {
        const permission = String(source.n_permission);
        if (!PERMISSION_VALUES.includes(permission)) {
            return { error: '权限类型不合法' };
        }
        data.n_permission = permission;
    }

    if (source.n_resources !== undefined) {
        const raw = source.n_resources;
        if (raw === null || raw === '' || raw === 'null') {
            data.n_resources = '[]';
        } else {
            if (typeof raw !== 'string' || raw.length > RESOURCES_MAX_LEN) {
                return { error: '资源数据不合法' };
            }
            let parsed;
            try {
                parsed = JSON.parse(raw);
            } catch (error) {
                return { error: '资源数据不合法' };
            }
            if (!Array.isArray(parsed)) {
                return { error: '资源数据不合法' };
            }
            data.n_resources = raw;
        }
    }

    /* 媒体标志位：1 有 / 2 无（前端默认 2），统一归一为数字 */
    for (const key of ['n_haveimage', 'n_havevideo']) {
        if (source[key] !== undefined) {
            data[key] = Number(source[key]) === 1 ? 1 : 2;
        }
    }

    return { data };
}

export default {
    /*  */
    AddThreads: (request, reply) => global.Fun(reply, async () => {
        const Ware = request.Ware;
        const pre = request.body;

        /* 禁言校验：处于禁言期的用户不得发帖（禁言在业务层校验，与现有频控风格一致）。
           放在长度/字段校验之前，避免被禁言者仍能用无效请求探测业务逻辑。 */
        if (await global.Tools.isUserMuted(Ware.id)) {
            return global.sendMsg(reply, 201, '您已被禁言，暂时无法发帖');
        }

        /* 长度校验：标题与正文过长直接拒绝，避免超长内容入库 */
        const title = String(pre.n_name ?? '');
        if (title.length > TITLE_MAX_LEN) {
            return global.sendMsg(reply, 201, `标题长度不能超过${TITLE_MAX_LEN}字符`);
        }
        const content = String(pre.n_html ?? '');
        if (content.length > CONTENT_MAX_LEN) {
            return global.sendMsg(reply, 201, `内容长度不能超过${CONTENT_MAX_LEN}字符`);
        }

        /* 价格校验：仅接受有限数字且在合法范围内 */
        let n_price = 0;
        if (pre.n_price != null && pre.n_price !== '' && pre.n_price !== 'null') {
            n_price = Number(pre.n_price);
            if (!Number.isFinite(n_price) || n_price < 0 || n_price > PRICE_MAX) {
                return global.sendMsg(reply, 201, `价格必须为 0 - ${PRICE_MAX} 之间的数字`);
            }
        }

        /* 扩展字段校验（权限/资源/媒体标志位） */
        const ext = normalizeThreadFields(pre);
        if (ext.error) {
            return global.sendMsg(reply, 201, ext.error);
        }

        /* 频控：每用户 60 秒内最多发帖 N 条；叠加 IP 维度兜底，防止换号绕过用户级限流批量灌水。
           先统一判定两者再累加计数，避免被拦截的请求仍消耗用户配额。 */
        const clientIp = global.Tools.getClientIp(request);
        const userRateKey = `thread:add:${Ware.id}`;
        const ipRateKey = `thread:add:ip:${clientIp}`;
        if (await global.Tools.isRateLimited(userRateKey, POST_RATE_LIMIT)
            || await global.Tools.isRateLimited(ipRateKey, POST_IP_RATE_LIMIT)) {
            return global.sendMsg(reply, 201, '发帖过于频繁，请稍后再试');
        }
        await global.Tools.incrRateCount(userRateKey, RATE_TTL);
        await global.Tools.incrRateCount(ipRateKey, RATE_TTL);

        let Form = {
            n_name: global.Sanitize(pre.n_name),
            n_uid: Ware.id,
            n_time: new Date(),
            n_html: global.Sanitize(pre.n_html),
            n_read: 0,
            n_starts: 0,
            n_msgs: 0,
            n_profile: global.Sanitize(pre.n_profile),
            n_permission: ext.data.n_permission ?? '1',
            n_price: n_price,
            n_resources: ext.data.n_resources ?? '[]',
            n_haveimage: ext.data.n_haveimage ?? 2,
            n_havevideo: ext.data.n_havevideo ?? 2
        }

        const Threads = await global.db.insert('n_threads', Form)

        /*  */

        /* 写入分类以及话题（并累加分类热度） */
        await global.Tools.insertThreadCategories(Threads, pre.n_category, pre.n_topic, true)
        await AssignMedal.AssignMedal(Ware.id)
        global.sendMsg(reply, 200, '操作成功');
    }),
    /* 编辑贴贴 */
    EditThreads: (request, reply) => global.Fun(reply, async () => {
        const Ware = request.Ware;
        const pre = request.body;

        /* 获取帖子详情 */
        const Threads = await global.db.query('SELECT * FROM n_threads WHERE id = ?', [pre.id]);
        if (!Threads || Threads.length === 0) {
            return global.sendMsg(reply, 404, '帖子不存在');
        }
        if (Threads[0].n_uid !== Ware.id) {
            return global.sendMsg(reply, 403, '无权限');
        }

        /* 仅保留白名单字段，未传字段不覆盖，避免 undefined 绑定错误或误清空 */
        const source = { ...pre };

        /* 长度校验：标题与正文过长直接拒绝（与 AddThreads 一致，避免编辑绕过限制） */
        if (source.n_name !== undefined && String(source.n_name ?? '').length > TITLE_MAX_LEN) {
            return global.sendMsg(reply, 201, `标题长度不能超过${TITLE_MAX_LEN}字符`);
        }
        if (source.n_html !== undefined && String(source.n_html ?? '').length > CONTENT_MAX_LEN) {
            return global.sendMsg(reply, 201, `内容长度不能超过${CONTENT_MAX_LEN}字符`);
        }

        if (source.n_html !== undefined) source.n_html = global.Sanitize(source.n_html);
        if (source.n_name !== undefined) source.n_name = global.Sanitize(source.n_name);
        if (source.n_profile !== undefined) source.n_profile = global.Sanitize(source.n_profile);
        if (source.n_price !== undefined) {
            /* 价格校验：空值归零，其余仅接受有限数字且在合法范围内 */
            if (source.n_price == null || !source.n_price || source.n_price === 'null') {
                source.n_price = 0;
            } else {
                const price = Number(source.n_price);
                if (!Number.isFinite(price) || price < 0 || price > PRICE_MAX) {
                    return global.sendMsg(reply, 201, `价格必须为 0 - ${PRICE_MAX} 之间的数字`);
                }
                source.n_price = price;
            }
        }
        /* 扩展字段校验（权限/资源/媒体标志位），仅覆盖显式传入的字段 */
        const ext = normalizeThreadFields(source);
        if (ext.error) {
            return global.sendMsg(reply, 201, ext.error);
        }
        Object.assign(source, ext.data);

        const Form = global.Tools.pickFields(source, [
            'n_name', 'n_html', 'n_profile', 'n_permission', 'n_price',
            'n_resources', 'n_haveimage', 'n_havevideo'
        ]);
        if (Object.keys(Form).length) {
            await global.db.update('n_threads', Form, 'id = ?', [pre.id])
        }

        /* 仅在显式传递分类/话题时才重建关联，避免局部编辑误清空分类 */
        if (pre.n_category !== undefined || pre.n_topic !== undefined) {
            /* 记录旧分类，用于热度迁移 */
            const oldRows = await global.db.query('SELECT DISTINCT n_cid FROM n_tclist WHERE n_tid = ?', [pre.id]);
            const oldCids = oldRows.map((r) => r.n_cid);

            /* 删除旧关联、写入新关联并累加热度、递减旧热度，合并为一次 batch 保证原子性：
               避免中途失败导致 n_tclist 与 n_class.n_hotnum 不一致 */
            const statements = [
                { sql: 'DELETE FROM n_tclist WHERE n_tid = ?', params: [pre.id] },
                ...global.Tools.buildThreadCategoryStatements(pre.id, pre.n_category, pre.n_topic)
            ];
            for (const chunk of global.Tools.chunkArray(global.Tools.extractThreadCategoryCids(pre.n_category, pre.n_topic))) {
                statements.push({
                    sql: `UPDATE n_class SET n_hotnum = n_hotnum + 1 WHERE id IN (${chunk.map(() => '?').join(', ')})`,
                    params: chunk
                });
            }
            /* 旧分类热度递减（重叠分类与新增热度自然抵消）；按 chunkArray 分片避免超过 D1 参数上限 */
            for (const chunk of global.Tools.chunkArray(oldCids)) {
                statements.push({
                    sql: `UPDATE n_class SET n_hotnum = n_hotnum - 1 WHERE id IN (${chunk.map(() => '?').join(', ')})`,
                    params: chunk
                });
            }
            await global.db.batch(statements);
        }
        global.sendMsg(reply, 200, '操作成功');
    }),
    /* 删除帖子 */
    DelThreads: (request, reply) => global.Fun(reply, async () => {
        const Ware = request.Ware;
        const pre = request.body;
        /* 获取帖子信息 */
        const Threads = await global.db.query('SELECT * FROM n_threads WHERE id = ?', [pre.id]);
        if (!Threads || Threads.length === 0) {
            return global.sendMsg(reply, 404, '帖子不存在');
        }
        if (Threads[0].n_uid !== Ware.id) {
            return global.sendMsg(reply, 403, '无权限');
        }

        /* 删除前取出关联分类与评论数，用于删除后对称递减热度 */
        const hotRows = await global.db.query('SELECT DISTINCT n_cid FROM n_tclist WHERE n_tid = ?', [pre.id]);
        /* 每条评论对帖子所属每个分类各贡献 1 热度（见 CommentThreads），删帖级联删除评论时须一并回收 */
        const commentRows = await global.db.query('SELECT COUNT(*) AS c FROM n_comment WHERE n_tid = ?', [pre.id]);
        const hotDec = (commentRows[0]?.c || 0) + 1;

        /* 全部删除与热度递减合并为一次 batch，保证原子性：避免部分写入后失败留下孤儿数据 */
        const statements = [
            { sql: 'DELETE FROM n_tclist WHERE n_tid = ?', params: [pre.id] },
            { sql: 'DELETE FROM n_comment WHERE n_tid = ?', params: [pre.id] },
            { sql: 'DELETE FROM n_threads_like WHERE n_tid = ?', params: [pre.id] },
            { sql: 'DELETE FROM n_threads_buy WHERE n_tid = ?', params: [pre.id] },
            { sql: 'DELETE FROM n_report WHERE n_tid = ?', params: [pre.id] },
            { sql: 'DELETE FROM n_threads WHERE id = ?', params: [pre.id] }
        ];
        /* 每帖对每个唯一分类贡献 1 热度，其下评论又各贡献 1 热度；删除后按 hotDec 同步递减。
           按 chunkArray 分片避免超过 D1 参数上限 */
        for (const chunk of global.Tools.chunkArray(hotRows.map((row) => row.n_cid))) {
            statements.push({
                sql: `UPDATE n_class SET n_hotnum = n_hotnum - ? WHERE id IN (${chunk.map(() => '?').join(', ')})`,
                params: [hotDec, ...chunk]
            });
        }
        await global.db.batch(statements);
        global.sendMsg(reply, 200, '删除成功');

    }),

    /* 点赞 */
    LikeThreads: (request, reply) => global.Fun(reply, async () => {
        const Ware = request.Ware;
        const pre = request.body;
        /* 获取帖子信息 */
        const Threads = await global.db.query('SELECT * FROM n_threads WHERE id = ?', [pre.id]);
        if (!Threads || Threads.length === 0) {
            return global.sendMsg(reply, 404, '帖子不存在');
        }

        /* 检查是否点赞过 */
        const Like = await global.db.query('SELECT id FROM n_threads_like WHERE n_tid = ? AND n_uid = ?', [pre.id, Ware.id]);
        if (Like && Like.length > 0) {
            /* 删除点赞；仅当确实删除成功才递减计数，避免并发下计数漂移 */
            const removed = await global.db.delete('n_threads_like', 'n_tid = ? AND n_uid = ?', [pre.id, Ware.id]);
            if (removed) {
                await global.db.run('UPDATE n_threads SET n_starts = n_starts - 1 WHERE id = ?', [pre.id]);
            }
            return global.sendMsg(reply, 200, '取消点赞成功');
        }
        /* 并发下可能同时走到这里，用 INSERT ... WHERE NOT EXISTS 兜底，避免重复点赞与重复计数 */
        const meta = await global.db.run(
            'INSERT INTO `n_threads_like` (`n_tid`, `n_uid`, `n_time`) SELECT ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM `n_threads_like` WHERE `n_tid` = ? AND `n_uid` = ?)',
            [pre.id, Ware.id, new Date(), pre.id, Ware.id]
        );
        if (meta.changes) {
            /* 更新帖子点赞数 */
            await global.db.run('UPDATE n_threads SET n_starts = n_starts + 1 WHERE id = ?', [pre.id]);
            await AssignMedal.AssignMedal(Threads[0].n_uid)
        }

        global.sendMsg(reply, 200, '点赞成功');
    }),
    /* 评论帖子 */
    CommentThreads: (request, reply) => global.Fun(reply, async () => {
        const Ware = request.Ware;
        const pre = request.body;

        /* 禁言校验：处于禁言期的用户不得评论 */
        if (await global.Tools.isUserMuted(Ware.id)) {
            return global.sendMsg(reply, 201, '您已被禁言，暂时无法评论');
        }

        /* 获取帖子信息 */
        const Threads = await global.db.query('SELECT * FROM n_threads WHERE id = ?', [pre.id]);
        if (!Threads || Threads.length === 0) {
            return global.sendMsg(reply, 404, '帖子不存在');
        }

        if (typeof pre.n_html !== 'string' || pre.n_html.trim().length < 1) {
            return global.sendMsg(reply, 400, '评论内容不能为空');
        }
        /* 评论内容长度校验 */
        if (pre.n_html.length > CONTENT_MAX_LEN) {
            return global.sendMsg(reply, 201, `评论内容长度不能超过${CONTENT_MAX_LEN}字符`);
        }

        /* 频控：每用户 60 秒内最多评论 N 条；叠加 IP 维度兜底，防止换号绕过用户级限流批量灌水。 */
        const clientIp = global.Tools.getClientIp(request);
        const userRateKey = `thread:comment:${Ware.id}`;
        const ipRateKey = `thread:comment:ip:${clientIp}`;
        if (await global.Tools.isRateLimited(userRateKey, COMMENT_RATE_LIMIT)
            || await global.Tools.isRateLimited(ipRateKey, COMMENT_IP_RATE_LIMIT)) {
            return global.sendMsg(reply, 201, '评论过于频繁，请稍后再试');
        }
        await global.Tools.incrRateCount(userRateKey, RATE_TTL);
        await global.Tools.incrRateCount(ipRateKey, RATE_TTL);

        const from = {
            n_tid: pre.id,
            n_uid: Ware.id,
            n_html: global.Sanitize(pre.n_html),
            n_cid: pre.n_cid ?? 0,
            n_time: new Date()
        }
        /* 新增评论、累加分类热度、累加评论数合并为一次 batch，保证原子性并收敛往返 */
        const cols = Object.keys(from);
        await global.db.batch([
            {
                sql: `INSERT INTO n_comment (${cols.map((c) => `\`${c}\``).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
                params: Object.values(from)
            },
            {
                sql: 'UPDATE n_class SET n_hotnum = n_hotnum + 1 WHERE id in (select n_cid from n_tclist where n_tid = ?)',
                params: [pre.id]
            },
            {
                sql: 'UPDATE n_threads SET n_msgs = n_msgs + 1, n_msglastTime = ? WHERE id = ?',
                params: [new Date(), pre.id]
            }
        ]);
        /* 先完成勋章结算再响应，避免后续异常使已发送的成功响应被覆盖为 500 */
        await AssignMedal.AssignMedal(Ware.id)
        global.sendMsg(reply, 200, '评论成功');

    }),


    /* 删除评论 */
    DelComment: (request, reply) => global.Fun(reply, async () => {
        const Ware = request.Ware;
        const pre = request.body;
        /* 获取评论信息 */
        const Comment = await global.db.query('SELECT * FROM n_comment WHERE id = ?', [pre.id]);
        if (!Comment || Comment.length === 0) {
            return global.sendMsg(reply, 404, '评论不存在');
        }
        if (Comment[0].n_uid !== Ware.id) {
            return global.sendMsg(reply, 403, '无权限');
        }
        /* 递减与删除合并为一次 batch 原子执行；用 EXISTS 守卫递减语句，
           并发下若评论已被删除则不再重复递减，避免计数为负（与 CommentThreads 对称） */
        await global.db.batch([
            {
                sql: 'UPDATE n_class SET n_hotnum = n_hotnum - 1 WHERE id in (select n_cid from n_tclist where n_tid = ?) AND EXISTS (SELECT 1 FROM n_comment WHERE id = ?)',
                params: [Comment[0].n_tid, pre.id]
            },
            {
                sql: 'UPDATE n_threads SET n_msgs = n_msgs - 1 WHERE id = ? AND EXISTS (SELECT 1 FROM n_comment WHERE id = ?)',
                params: [Comment[0].n_tid, pre.id]
            },
            { sql: 'DELETE FROM n_comment WHERE id = ? AND n_uid = ?', params: [pre.id, Ware.id] }
        ]);
        global.sendMsg(reply, 200, '删除成功');

    }),

    /* 举报帖子 n_report */
    ReportThreads: (request, reply) => global.Fun(reply, async () => {
        const Ware = request.Ware;
        const pre = request.body;
        /* 获取帖子信息 */
        const Threads = await global.db.query('SELECT * FROM n_threads WHERE id = ?', [pre.n_tid]);
        if (!Threads || Threads.length === 0) {
            return global.sendMsg(reply, 404, '帖子不存在');
        }

        /* 同一用户对同一帖子去重 + 冷却，避免重复举报刷表 */
        const exist = await global.db.query('SELECT id FROM n_report WHERE n_tid = ? AND n_uid = ?', [pre.n_tid, Ware.id]);
        if (exist.length > 0) {
            return global.sendMsg(reply, 201, '您已举报过该帖子');
        }
        /* 冷却：先自增计数再判断（先写后判），避免「先查后写」在并发下被绕过 */
        const reportCount = await global.Tools.incrRateCount(`report:cool:${Ware.id}`, 10);
        if (reportCount > 1) {
            return global.sendMsg(reply, 201, '举报过于频繁，请稍后再试');
        }

        let report = {
            n_tid: pre.n_tid,
            n_uid: Ware.id,
            n_html: global.Sanitize(pre.n_html),
            n_time: new Date()
        }

        /* 原子条件插入：以 NOT EXISTS 守卫去重，避免「先查后插」在并发下重复写入 */
        const inserted = await global.db.run(
            'INSERT INTO n_report (n_tid, n_uid, n_html, n_time) SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM n_report WHERE n_tid = ? AND n_uid = ?)',
            [report.n_tid, report.n_uid, report.n_html, report.n_time, report.n_tid, report.n_uid]
        );
        if (!inserted || inserted.changes === 0) {
            return global.sendMsg(reply, 201, '您已举报过该帖子');
        }
        global.sendMsg(reply, 200, '举报成功');
    }),

  
}