
/* 帖子字段归一/校验、长度上限与级联删除与用户端共用，避免两端规则漂移 */
import { normalizeThreadFields, deleteThreadsCascade, TITLE_MAX_LEN, CONTENT_MAX_LEN } from "../../imp/Tools.js";

export default {
    /*  */
    GetThreads: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;
        if (pre.id) {
            /* 一次 batch 取齐帖子、作者、分类：作者与分类均用子查询解依赖，
               避免帖子→用户→分类关系→分类的 4 次串行往返 */
            const [res, User, Category] = await global.db.queryBatch([
                {
                    sql: 'SELECT id, n_name, n_uid, n_time, n_html, n_read, n_starts, n_msgs, n_profile, n_permission, n_price, n_resources, n_haveimage, n_havevideo, n_msglastTime FROM n_threads WHERE id = ?',
                    params: [pre.id]
                },
                {
                    sql: 'SELECT id, n_nickname, n_avatar FROM n_users WHERE id = (SELECT n_uid FROM n_threads WHERE id = ?)',
                    params: [pre.id]
                },
                {
                    sql: 'SELECT id, n_name, n_type, n_icon FROM n_class WHERE id IN (SELECT n_cid FROM n_tclist WHERE n_tid = ?)',
                    params: [pre.id]
                }
            ]);
            if (res.length == 0) {
                global.sendMsg(reply, 404, '帖子不存在');
                return;
            }
            const thread = res[0];

            // 获取用户信息（仅取公开展示字段，避免下发邮箱/余额等敏感信息）
            if (User.length > 0) {
                thread.user = User[0];
            } else {
                /* 用户已注销：帖子保留，仅下发占位信息 */
                thread.user = {
                    id: thread.n_uid,
                    n_nickname: '该用户已被注销',
                    n_avatar: '',
                    isCancelled: true
                };
            }

            thread.category = Category;

            global.sendMsg(reply, 200, '获取成功', thread);

            return
        }
        const extraParams = [];
        const extraSql = [];
        if (pre.cid) {
            extraSql.push('id in (select n_tid from n_tclist where n_cid = ? and n_type = 1)');
            extraParams.push(pre.cid);
        }
        if (pre.cidt) {
            extraSql.push('id in (select n_tid from n_tclist where n_cid = ? and n_type = 2)');
            extraParams.push(pre.cidt);
        }

        const SqlBuilder = new global.SqlBuilder();
        const sql = SqlBuilder
            .add('n_name', pre.search, 'like')
            .add('n_uid', pre.uid)
            .add('n_haveimage', pre.image)
            .add('n_havevideo', pre.video)
            .build();
        const conditionSql = sql.sql + (extraSql.length ? ' AND ' + extraSql.join(' AND ') : '');
        const res = await global.db.getPaginatedData('n_threads', conditionSql, [...sql.params, ...extraParams], [pre.sort ?? 'id', pre.sortType ?? 'desc'], pre.page, pre.pagesize)
        if (res.data.length === 0) {
            return global.sendMsg(reply, 200, '获取成功', [], res.total);
        }
        const Userid = res.data.map(thread => thread.n_uid);
        const tids = res.data.map(item => item.id);
        /* 作者、帖子-分类关系、分类三者互不依赖，全部并行；分类用子查询解掉对 Tclist 的依赖，
           把原来的「作者 → 分类关系 → 分类」三层串行压缩为一次并行往返 */
        const [User, Tclist, Category] = await Promise.all([
            global.Tools.queryInChunks(Userid, (c) => global.db.query(`SELECT id,n_nickname,n_avatar FROM n_users WHERE id IN (${c.map(() => '?').join(',')})`, c)),
            global.Tools.queryInChunks(tids, (c) => global.db.query(`SELECT n_cid,n_tid FROM n_tclist WHERE n_tid IN (${c.map(() => '?').join(',')})`, c)),
            global.Tools.queryInChunks(tids, (c) => global.db.query(`SELECT id,n_name,n_type,n_icon FROM n_class WHERE id IN (SELECT n_cid FROM n_tclist WHERE n_tid IN (${c.map(() => '?').join(',')}))`, c))
        ]);

        // 将用户信息添加到帖子数据中
        const userMap = User.reduce((acc, user) => {
            acc[user.id] = user;
            return acc;
        }, {});

        res.data = res.data.map(thread => {
            /* 用户已注销时下发占位信息 */
            thread.user = userMap[thread.n_uid] || {
                id: thread.n_uid,
                n_nickname: '该用户已被注销',
                n_avatar: '',
                isCancelled: true
            };
            return thread;
        });

        // 建立分类映射关系（分片查询可能重复返回同一分类，先按 id 去重）
        const categoryMap = new Map(Category.map(cat => [cat.id, cat]));
        const threadCategoryMap = {};
        for (const item of Tclist) {
            if (!threadCategoryMap[item.n_tid]) {
                threadCategoryMap[item.n_tid] = [];
            }
            const category = categoryMap.get(item.n_cid);
            if (category) {
                threadCategoryMap[item.n_tid].push(category);
            }
        }

        res.data = res.data.map(thread => {
            thread.category = threadCategoryMap[thread.id] || [];
            return thread;
        });

        global.sendMsg(reply, 200, '获取成功', res.data, res.total);
    }),
    /* 删除帖子 */
    DeleteThread: (request, reply) => global.Fun(reply, async () => {

        const pre = request.body;
        /* 级联删除关联数据与热度回收，全部置于同一 D1 batch（事务） */
        await deleteThreadsCascade(pre.id);
        global.sendMsg(reply, 200, '删除成功');
    }),
    /* 批量删除帖子 */
    batchDeleteThread: (request, reply) => global.Fun(reply, async () => {
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
        /* 级联删除与热度递减置于同一事务，避免中途失败残留孤儿数据 */
        await deleteThreadsCascade(ids);
        global.sendMsg(reply, 200, '删除成功');
    }),
    /* 编辑帖子 */
    EditThreads: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;

        /* 获取帖子详情（仅需判断是否存在） */
        const Threads = await global.db.query('SELECT id FROM n_threads WHERE id = ?', [pre.id]);
        if (!Threads || Threads.length === 0) {
            return global.sendMsg(reply, 404, '帖子不存在');
        }

        /* 仅保留白名单字段，未传字段不覆盖，避免 undefined 绑定错误或误清空 */
        const source = { ...pre };
        /* 长度校验：标题与正文过长直接拒绝（与 user/threads.js 一致，避免编辑绕过限制） */
        if (source.n_name !== undefined && String(source.n_name ?? '').length > TITLE_MAX_LEN) {
            return global.sendMsg(reply, 201, `标题长度不能超过${TITLE_MAX_LEN}字符`);
        }
        if (source.n_html !== undefined && String(source.n_html ?? '').length > CONTENT_MAX_LEN) {
            return global.sendMsg(reply, 201, `内容长度不能超过${CONTENT_MAX_LEN}字符`);
        }
        /* 标题/正文/简介统一 HTML 净化，防止存储型 XSS（与 user/threads.js 一致） */
        if (source.n_html !== undefined) source.n_html = global.Sanitize(source.n_html);
        if (source.n_name !== undefined) source.n_name = global.Sanitize(source.n_name);
        if (source.n_profile !== undefined) source.n_profile = global.Sanitize(source.n_profile);
        if (source.n_price !== undefined) {
            source.n_price = (source.n_price == null || !source.n_price || source.n_price === 'null') ? 0 : source.n_price;
        }
        /* 扩展字段校验（权限/资源/媒体标志位），仅覆盖显式传入的字段 */
        const ext = normalizeThreadFields(source);
        if (ext.error) {
            return global.sendMsg(reply, 201, ext.error);
        }
        Object.assign(source, ext.data);
        const Form = global.Tools.pickFields(source, [
            'n_name', 'n_html', 'n_profile', 'n_permission', 'n_price',
            'n_resources', 'n_haveimage', 'n_havevideo', 'n_starts', 'n_read'
        ]);
        if (Object.keys(Form).length) {
            await global.db.update('n_threads', Form, 'id = ?', [pre.id])
        }

        /* 仅在显式传递分类/话题时才重建关联，避免局部编辑误清空分类 */
        if (pre.n_category !== undefined || pre.n_topic !== undefined) {
            /* 记录旧分类，用于热度迁移 */
            const oldRows = await global.db.query('SELECT DISTINCT n_cid FROM n_tclist WHERE n_tid = ?', [pre.id]);
            const oldCids = oldRows.map((r) => r.n_cid);

            /* 清空旧关联、写入新分类/话题并迁移热度，全部置于同一事务，避免中途失败残留关联缺失或热度错乱 */
            const statements = [
                { sql: 'DELETE FROM n_tclist WHERE n_tid = ?', params: [pre.id] },
                ...global.Tools.buildThreadCategoryStatements(pre.id, pre.n_category, pre.n_topic),
            ];
            /* 新分类热度累加（每分类一次，分片避免超过参数上限） */
            for (const chunk of global.Tools.chunkArray(global.Tools.extractThreadCategoryCids(pre.n_category, pre.n_topic))) {
                statements.push({ sql: `UPDATE n_class SET n_hotnum = n_hotnum + 1 WHERE id IN (${chunk.map(() => '?').join(', ')})`, params: chunk });
            }
            /* 旧分类热度递减（重叠分类与新增热度自然抵消） */
            if (oldCids.length) {
                for (const chunk of global.Tools.chunkArray(oldCids)) {
                    statements.push({ sql: `UPDATE n_class SET n_hotnum = n_hotnum - 1 WHERE id IN (${chunk.map(() => '?').join(', ')})`, params: chunk });
                }
            }
            await global.db.batch(statements);
        }
        global.sendMsg(reply, 200, '操作成功');
    }),
    /* 获取评论列表 */
    GetComments: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;
        /* 获取评论列表 */
        const SqlBuilder = new global.SqlBuilder();
        const sql = SqlBuilder
            .add('n_tid', pre.id)
            .add('n_uid', pre.uid)
            .build();
        const res = await global.db.getPaginatedData('n_comment', sql.sql, sql.params, ['id', 'desc'], pre.page, pre.pagesize)
        if (res.data.length === 0) {
            return global.sendMsg(reply, 200, '获取成功', [], res.total);
        }
        /* 分页内 uid/tid 会重复出现，先去重再分批查询，减少绑定参数与返回行数 */
        const userIds = [...new Set(res.data.map(comment => comment.n_uid))];
        const tids = [...new Set(res.data.map(comment => comment.n_tid))];
        /* 用户信息与帖子信息互不依赖，并行查询省掉一段串行往返 */
        const [User, Thread] = await Promise.all([
            global.Tools.queryInChunks(userIds, (c) => global.db.query(`SELECT id,n_nickname,n_avatar FROM n_users WHERE id IN (${c.map(() => '?').join(',')})`, c)),
            /* 仅取评论卡片展示所需列 */
            global.Tools.queryInChunks(tids, (c) => global.db.query(`SELECT id, n_name, n_read, n_msgs, n_starts, n_permission, n_price FROM n_threads WHERE id IN (${c.map(() => '?').join(',')})`, c))
        ]);
        const userMap = new Map(User.map(user => [user.id, user]));
        const threadMap = new Map(Thread.map(thread => [thread.id, thread]));
        /* 原地赋值，避免重建整个数组 */
        for (const comment of res.data) {
            comment.user = userMap.get(comment.n_uid);
            comment.thread = threadMap.get(comment.n_tid);
        }

        global.sendMsg(reply, 200, '获取成功', res.data, res.total);
    }),
    /* 删除评论 */
    DeleteComment: (request, reply) => global.Fun(reply, async () => {
        const id = request.body.id;
        const comment = await global.db.query('SELECT n_tid FROM n_comment WHERE id = ?', [id]);
        /* 递减语句置于 DELETE 之前并用 EXISTS 守卫，与删除置于同一事务原子执行：
           并发下若评论已被删除则守卫不通过，不再重复递减，避免计数为负（与 user 版 DelComment 对称） */
        const statements = [];
        if (comment.length) {
            statements.push({ sql: 'UPDATE n_class SET n_hotnum = n_hotnum - 1 WHERE id IN (SELECT n_cid FROM n_tclist WHERE n_tid = ?) AND EXISTS (SELECT 1 FROM n_comment WHERE id = ?)', params: [comment[0].n_tid, id] });
            statements.push({ sql: 'UPDATE n_threads SET n_msgs = n_msgs - 1 WHERE id = ? AND EXISTS (SELECT 1 FROM n_comment WHERE id = ?)', params: [comment[0].n_tid, id] });
        }
        statements.push({ sql: 'DELETE FROM n_comment WHERE id = ?', params: [id] });
        await global.db.batch(statements);
        global.sendMsg(reply, 200, '删除成功');
    }),
    /* 批量删除评论 */
    batchDeleteComment: (request, reply) => global.Fun(reply, async () => {
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
        const placeholders = ids.map(() => '?').join(',');
        /* 逐条取回待删除评论所属帖子，删除前按每条评论各 1 点递减热度与评论数 */
        const rows = await global.db.query(`SELECT id, n_tid FROM n_comment WHERE id IN (${placeholders})`, ids);
        /* 递减语句置于 DELETE 之前并用 EXISTS 守卫，与删除置于同一事务原子执行：
           并发下若评论已被删除则守卫不通过，不再重复递减，避免计数为负（与 user 版 DelComment 对称） */
        const statements = [];
        for (const row of rows) {
            statements.push({ sql: 'UPDATE n_class SET n_hotnum = n_hotnum - 1 WHERE id IN (SELECT n_cid FROM n_tclist WHERE n_tid = ?) AND EXISTS (SELECT 1 FROM n_comment WHERE id = ?)', params: [row.n_tid, row.id] });
            statements.push({ sql: 'UPDATE n_threads SET n_msgs = n_msgs - 1 WHERE id = ? AND EXISTS (SELECT 1 FROM n_comment WHERE id = ?)', params: [row.n_tid, row.id] });
        }
        statements.push({ sql: `DELETE FROM n_comment WHERE id IN (${placeholders})`, params: ids });
        await global.db.batch(statements);
        global.sendMsg(reply, 200, '删除成功');
    }),
    /* 获取举报记录 */
    GetReport: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;
        const SqlBuilder = new global.SqlBuilder();
        const sql = SqlBuilder
            .add('n_tid', pre.id)
            .build();
        const res = await global.db.getPaginatedData('n_report', sql.sql, sql.params, ['id', 'desc'], pre.page, pre.pagesize)
        if (res.data.length === 0) {
            return global.sendMsg(reply, 200, '获取成功', [], res.total);
        }
        let Tid = []
        for (let a in res.data) {
            Tid.push(res.data[a].n_tid)
        }
        /* 获取帖子信息（仅取举报卡片展示所需列） */
        const Thread = await global.Tools.queryInChunks(Tid, (c) => global.db.query(`SELECT id, n_name, n_read, n_msgs, n_starts, n_permission, n_price FROM n_threads WHERE id IN (${c.map(() => '?').join(',')})`, c))
        const threadMap = Thread.reduce((acc, thread) => {
            acc[thread.id] = thread;
            return acc;
        }, {});

        res.data = res.data.map(report => {
            report.thread = threadMap[report.n_tid];
            return report;
        });

        global.sendMsg(reply, 200, '获取成功', res.data, res.total);
    }),
    /* 删除举报记录 */
    DeleteReport: (request, reply) => global.Fun(reply, async () => {
        const id = request.body.id;
        await global.db.delete('n_report', 'id = ?', [id]);
        global.sendMsg(reply, 200, '删除成功');
    }),
    /* 批量删除举报记录 */
    batchDeleteReport: (request, reply) => global.Fun(reply, async () => {
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
        await global.db.deleteIn('n_report', 'id', ids);
        global.sendMsg(reply, 200, '删除成功');
    }),

}