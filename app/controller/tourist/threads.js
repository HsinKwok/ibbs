
/* 列表排序字段白名单：sort 来自前端请求，直接透传会因非法列名让 D1 抛错（接口 500），
   也可能按内部列（如 n_hash）排序。仅允许对外可见的列，其余回落到 id。 */
const THREAD_SORT_FIELDS = new Set([
    'id', 'n_name', 'n_uid', 'n_time', 'n_read', 'n_starts', 'n_msgs',
    'n_profile', 'n_permission', 'n_price', 'n_resources',
    'n_haveimage', 'n_havevideo', 'n_msglastTime'
]);

/* FTS5 标题索引可用性：旧库未执行迁移时 n_threads_fts 不存在，
   探测一次并缓存结果，缺失时回退 LIKE，避免搜索接口整体 500 */
let ftsReady = null;
const hasThreadFts = async () => {
    if (ftsReady !== null) return ftsReady;
    try {
        await global.db.query('SELECT rowid FROM n_threads_fts LIMIT 1');
        ftsReady = true;
    } catch {
        ftsReady = false;
    }
    return ftsReady;
};

export default {
    /*  */
    GetThreads: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;
        const Ware = request.Ware;
        /* 登录用户 id（0 表示游客）：详情/列表多处用到，提前取一次 */
        const wareId = (Ware && Ware.id) ? Ware.id : 0;
        if (pre.id) {
            /* 详情装配：帖子、作者、分类、点赞、购买记录互相不依赖，合并进一次 D1 batch（单次往返）。
               作者与分类用子查询/关联下推到 SQL，省掉「先查帖子再查依赖数据」的第二轮往返。 */
            const buildDetail = async () => {
                const statements = [
                    { sql: 'SELECT * FROM n_threads WHERE id = ?', params: [pre.id] },
                    { sql: 'SELECT id, n_nickname, n_avatar FROM n_users WHERE id = (SELECT n_uid FROM n_threads WHERE id = ?)', params: [pre.id] },
                    /* GROUP BY c.id 保持原 IN 查询的去重语义（同一帖子重复关联同一分类时只出现一次） */
                    { sql: 'SELECT c.id, c.n_name, c.n_type, c.n_icon FROM n_tclist t JOIN n_class c ON c.id = t.n_cid WHERE t.n_tid = ? GROUP BY c.id ORDER BY c.id', params: [pre.id] }
                ];
                if (wareId) {
                    statements.push({ sql: 'SELECT COUNT(*) FROM n_threads_like WHERE n_tid = ? AND n_uid = ?', params: [pre.id, wareId] });
                    statements.push({ sql: 'SELECT id FROM n_threads_buy WHERE n_tid = ? AND n_uid = ? LIMIT 1', params: [pre.id, wareId] });
                }

                const rows = await global.db.queryBatch(statements);
                if (!rows[0] || rows[0].length === 0) return null;

                const thread = rows[0][0];
                /* n_hash 仅用于服务端去重比对，不对外下发 */
                delete thread.n_hash;

                const user = rows[1][0];
                if (user) {
                    thread.user = user;
                } else {
                    /* 用户已注销：帖子保留，仅下发占位信息 */
                    thread.user = {
                        id: thread.n_uid,
                        n_nickname: '该用户已被注销',
                        n_avatar: '',
                        isCancelled: true
                    };
                }

                thread.category = rows[2];

                thread.IsBuy = true
                const isAuthor = wareId && thread.n_uid == wareId;
                const isPaid = thread.n_price > 0 && thread.n_permission !== '1';
                /* 获取是否点赞 */
                if (wareId && rows[3] && rows[3].length > 0) {
                    thread.isLiked = rows[3][0]['COUNT(*)'] > 0;
                }
                if (isPaid) {
                    /* 作者本人查看自己的收费帖无需付费 */
                    if (!isAuthor) {
                        if (wareId) {
                            /* 获取用户是否购买 n_threads_buy */
                            if (!rows[4] || rows[4].length == 0) {
                                thread.n_resources = []
                                thread.n_html = 'needBuy'
                                thread.IsBuy = false
                            }
                        } else {
                            thread.IsBuy = false
                            thread.n_resources = []
                            thread.n_html = 'needBuy'
                        }
                    }
                }
                return thread;
            };

            /* 阅读数自增语句：只有回源（未命中缓存）时执行 */
            const bumpRead = () => global.db.run('UPDATE n_threads SET n_read = COALESCE(n_read, 0) + 1 WHERE id = ?', [pre.id]);

            /* 游客详情（无登录身份）对所有请求方一致，可缓存；isolate 内存 15s 挡热门帖重复回源。
               命中缓存时不再自增阅读数（15s 粒度误差可接受），避免每个读请求都写库。 */
            if (!wareId && global.RedisUtils && global.RedisUtils.getOrSetMemoryCache) {
                const bodyText = await global.RedisUtils.getOrSetMemoryCache('threads:detail:l1:' + pre.id, 15, async () => {
                    const thread = await buildDetail();
                    /* 空串作 404 哨兵：不存在的帖子在短时间内同样不再回源 */
                    if (!thread) return '';
                    if (!pre.noread) await bumpRead();
                    return JSON.stringify({ code: 200, msg: '获取成功', data: thread, total: 0 });
                });
                if (!bodyText) {
                    global.sendMsg(reply, 404, '帖子不存在');
                    return;
                }
                reply.sendJsonText(bodyText);
                return;
            }

            const thread = await buildDetail();
            if (!thread) {
                global.sendMsg(reply, 404, '帖子不存在');
                return;
            }

            /* 仅刷新个性化状态（登录后补拉 isLiked / IsBuy）：只回状态字段，不再重发整份帖子正文。
               付费帖的正文与资源仅在「本站已解锁」（作者本人或已购）时才需要带回，其余情况匿名 SSR 已下发 needBuy */
            if (pre.statusOnly) {
                const status = {
                    id: thread.id,
                    isLiked: !!thread.isLiked,
                    IsBuy: thread.IsBuy,
                    n_starts: thread.n_starts
                };
                if (thread.n_price > 0 && thread.n_permission !== '1' && thread.n_html !== 'needBuy') {
                    status.n_html = thread.n_html;
                    status.n_resources = thread.n_resources;
                }
                global.sendMsg(reply, 200, '获取成功', status);
                return;
            }

            /* 写入阅读（先更新再响应，避免后续异常使已发送的成功响应被覆盖为 500）
               点赞后重新拉取等场景传 noread 跳过自增，避免虚增阅读量 */
            if (!pre.noread) {
                const incRead = bumpRead();
                /* 阅读数非关键路径：用 waitUntil 放到响应之后执行，减少详情接口首字节延迟；
                   ctx 缺失（本地/测试环境）时退回同步等待，保证行为一致 */
                if (request.ctx && typeof request.ctx.waitUntil === 'function') {
                    request.ctx.waitUntil(incRead.catch((error) => console.error('更新阅读数失败:', error)));
                } else {
                    await incRead;
                }
            }

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
        if (pre.isMyLike) {
            extraSql.push('id in (select n_tid from n_threads_like where n_uid = ?)');
            extraParams.push(Ware?.id || 0);
        }
        if (pre.ismy) {
            extraSql.push('n_uid = ?');
            extraParams.push(Ware?.id || 0);
        }
        if (pre.isMyBuy) {
            extraSql.push('id in (select n_tid from n_threads_buy where n_uid = ?)');
            extraParams.push(Ware?.id || 0);
        }
        const SqlBuilder = new global.SqlBuilder();
        /* 标题搜索：>=3 个字符走 FTS5 trigram 索引（子串语义与 LIKE 一致），
           更短的关键词 trigram 无法命中，回退到原来的 LIKE 全表匹配 */
        const keyword = typeof pre.search === 'string' ? pre.search.trim() : '';
        if (keyword.length >= 3 && await hasThreadFts()) {
            SqlBuilder.conditions.push('id IN (SELECT rowid FROM n_threads_fts WHERE n_name LIKE ?)');
            SqlBuilder.params.push(`%${keyword}%`);
        } else {
            SqlBuilder.add('n_name', keyword, 'like');
        }
        const sql = SqlBuilder
            .add('n_uid', pre.uid)
            .add('n_haveimage', pre.image)
            .add('n_havevideo', pre.video)
            .build();
        const conditionSql = sql.sql + (extraSql.length ? ' AND ' + extraSql.join(' AND ') : '');
        /* 排序字段走白名单，非法值回落 id，避免 ORDER BY 拼出不存在/内部列 */
        const sortField = THREAD_SORT_FIELDS.has(pre.sort) ? pre.sort : 'id';

        /* 列表查询与装配封装为可缓存函数：装配结果只依赖帖子自身与其作者公开信息，不含任何个性化字段 */
        const buildList = async () => {
            /* 列表不返回 n_html（正文最长 5000 字符，前端列表卡片仅用 n_profile/n_resources），
               剔除后显著缩小 D1 传输与响应序列化体积 */
            const res = await global.db.getPaginatedData('n_threads', conditionSql, [...sql.params, ...extraParams], [sortField, pre.sortType ?? 'desc'], pre.page, pre.pagesize, ['n_html'])

            /* 获取分类以及话题 */
            if (res.data.length === 0) {
                return { data: [], total: res.total };
            }
            const tids = res.data.map(item => item.id);
            const uids = [...new Set(res.data.map(item => item.n_uid))];

            /* 分类关系与作者信息互不依赖，并行查询：
               分类：关系行已带分类字段，省掉「先查关系表、再查分类表」的串行往返；
               作者：昵称/头像/勋章随列表一次带回，前端卡片不再对每个作者各发一次请求（N+1）。
               勋章用 LEFT JOIN 一并取出，作者无勋章时 m_id 为 NULL。 */
            const [Relation, Authors] = await Promise.all([
                global.Tools.queryInChunks(tids, (c) => global.db.query(`SELECT DISTINCT t.n_tid, c.id, c.n_name, c.n_type, c.n_icon FROM n_tclist t JOIN n_class c ON c.id = t.n_cid WHERE t.n_tid IN (${c.map(() => '?').join(',')})`, c)),
                global.Tools.queryInChunks(uids, (c) => global.db.query(`SELECT u.id, u.n_nickname, u.n_avatar, m.id AS m_id, m.n_name AS m_name, m.n_src AS m_src, m.n_type AS m_type FROM n_users u LEFT JOIN n_medal_log ml ON ml.n_uid = u.id LEFT JOIN n_medal m ON ml.n_mid = m.id WHERE u.id IN (${c.map(() => '?').join(',')})`, c))
            ]);

            /* 关系行已带分类字段，按帖子归并即可，无需二次查分类 */
            const threadCategoryMap = {};
            for (const row of Relation) {
                const list = threadCategoryMap[row.n_tid] || (threadCategoryMap[row.n_tid] = []);
                list.push({ id: row.id, n_name: row.n_name, n_type: row.n_type, n_icon: row.n_icon });
            }

            /* 作者信息去重归并：一名作者可能有多枚勋章，LEFT JOIN 会返回多行 */
            const userMap = {};
            for (const row of Authors) {
                const user = userMap[row.id] || (userMap[row.id] = { id: row.id, n_nickname: row.n_nickname, n_avatar: row.n_avatar, medals: [] });
                if (row.m_id) user.medals.push({ id: row.m_id, n_name: row.m_name, n_src: row.m_src, n_type: row.m_type });
            }

            /* 列表对所有访客返回一致内容（前端才可安全 SSR 并复用缓存）：
               判定只看帖子自身字段，不查购买记录、不依赖登录身份——付费帖的资源一律不在列表下发，
               作者与已购用户进详情页查看。 */
            for (const thread of res.data) {
                thread.category = threadCategoryMap[thread.id] || [];
                /* 作者已注销时给占位信息，与详情页 GetUser 的 404 行为保持一致 */
                thread.user = userMap[thread.n_uid] || { id: thread.n_uid, n_nickname: '该用户已被注销', n_avatar: '', isCancelled: true };
                if (thread.n_price > 0 && thread.n_permission !== '1') {
                    thread.n_resources = []
                    continue
                }
                try {
                    /* n_resources 可能为 NULL（无资源帖），JSON.parse(null) 会得到 null 而非数组，需兜底为空数组 */
                    thread.n_resources = thread.n_resources ? JSON.parse(thread.n_resources) : []
                } catch (error) {
                    thread.n_resources = []
                }
            }

            return { data: res.data, total: res.total };
        };

        /* 列表内容已与登录身份无关（只按帖子自身字段组装），仅「我的/我赞/我购」这类按人筛选的结果不能共享 */
        const canCache = !pre.ismy && !pre.isMyLike && !pre.isMyBuy;
        if (canCache && global.RedisUtils && global.RedisUtils.getOrSetTextCache) {
            /* 用 JSON 序列化构造缓存键：字符串会被引号包裹，避免 join(':') 时
               用户可控参数中含冒号导致的键碰撞（如 search='a:b' 与 search='a',uid='b'） */
            /* v4：列表新增作者信息（user 字段），换前缀避免读到缺少该字段的旧缓存 */
            const cacheKey = 'threads:list:v4:' + JSON.stringify([
                keyword, pre.uid || '', pre.image ?? '', pre.video ?? '',
                pre.cid || '', pre.cidt || '', sortField, pre.sortType ?? 'desc',
                pre.page || 1, pre.pagesize || 20
            ]);
            /* 两级缓存：isolate 内存 10s 挡热点重复读（零外部调用），未命中再回源 KV(60s) */
            const bodyText = await global.RedisUtils.getOrSetMemoryCache('threads:list:l1:' + cacheKey, 10, () =>
                global.RedisUtils.getOrSetTextCache(cacheKey, 60, async () => {
                    const listResult = await buildList();
                    return JSON.stringify({ code: 200, msg: '获取成功', data: listResult.data, total: listResult.total });
                })
            );
            reply.sendJsonText(bodyText);
            return;
        }
        const listResult = await buildList();
        global.sendMsg(reply, 200, '获取成功', listResult.data, listResult.total);
    }),
    /* 获取评论列表 */
    GetComments: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;
        const Ware = request.Ware;
        /* 「只看我的」与「按作者筛选」二选一：二者同时生效会生成互相冲突的 n_uid 条件导致结果恒空，
           优先取 ismy（当前登录用户），否则按 pre.uid 筛选作者 */
        const commentUid = pre.ismy ? (Ware?.id || 0) : pre.uid;

        /* 回源逻辑：评论分页 + 用户信息（+ 按作者筛选时的帖子信息） */
        const buildResult = async () => {
            const SqlBuilder = new global.SqlBuilder();
            const sql = SqlBuilder
                .add('n_tid', pre.id)
                .add('n_uid', commentUid)
                .build();
            const res = await global.db.getPaginatedData('n_comment', sql.sql, sql.params, ['id', 'desc'], pre.page, pre.pagesize)
            if (res.data.length === 0) {
                return { data: [], total: res.total };
            }
            /* 分页内 uid/tid 会重复出现，先去重再分批查询，减少绑定参数与返回行数 */
            const userIds = [...new Set(res.data.map(comment => comment.n_uid))];
            const tids = pre.uid ? [...new Set(res.data.map(comment => comment.n_tid))] : null;
            /* 用户信息与帖子信息互不依赖，并行查询省掉一段串行往返 */
            const [User, Thread] = await Promise.all([
                global.Tools.queryInChunks(userIds, (c) => global.db.query(`SELECT id,n_nickname,n_avatar FROM n_users WHERE id IN (${c.map(() => '?').join(',')})`, c)),
                tids
                    /* 获取帖子信息（仅下发展示所需字段，避免泄露付费帖 n_resources/n_html） */
                    ? global.Tools.queryInChunks(tids, (c) => global.db.query(`SELECT id,n_name,n_uid FROM n_threads WHERE id IN (${c.map(() => '?').join(',')})`, c))
                    : Promise.resolve([])
            ]);
            const userMap = new Map(User.map(user => [user.id, user]));
            /* 原地赋值，避免 map 重建整个数组 */
            for (const comment of res.data) {
                comment.user = userMap.get(comment.n_uid);
            }

            if (tids) {
                const threadMap = new Map(Thread.map(thread => [thread.id, thread]));
                for (const comment of res.data) {
                    comment.thread = threadMap.get(comment.n_tid);
                }
            }

            return { data: res.data, total: res.total };
        };

        /* 评论结果不随登录身份变化（只按帖子/作者/分页组装），仅「只看我的」是按人视图、不缓存。
           两级：isolate 内存 10s → KV 60s，缓存完整响应文本 */
        const canCache = !pre.ismy;
        if (canCache && global.RedisUtils && global.RedisUtils.getOrSetTextCache) {
            const cacheKey = 'comments:list:v1:' + JSON.stringify([
                pre.id || '', pre.uid || '', pre.page || 1, pre.pagesize || 20
            ]);
            const bodyText = await global.RedisUtils.getOrSetMemoryCache('comments:list:l1:' + cacheKey, 10, () =>
                global.RedisUtils.getOrSetTextCache(cacheKey, 60, async () => {
                    const result = await buildResult();
                    return JSON.stringify({ code: 200, msg: '获取成功', data: result.data, total: result.total });
                })
            );
            reply.sendJsonText(bodyText);
            return;
        }

        const result = await buildResult();
        global.sendMsg(reply, 200, '获取成功', result.data, result.total);
    })

}