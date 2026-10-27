
export default {
    /*  */
    GetThreads: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;
        const Ware = request.Ware;
        if (pre.id) {
            const res = await global.db.query('SELECT * FROM n_threads WHERE id = ?', [pre.id])
            if (res.length == 0) {
                global.sendMsg(reply, 404, '帖子不存在');
                return;
            }
            const thread = res[0];

            /* 用户信息与分类关系相互独立，并行查询减少一次往返 */
            const [User, Tclist] = await Promise.all([
                global.db.query(`SELECT id, n_nickname, n_avatar FROM n_users WHERE id = ?`, [thread.n_uid]),
                global.db.query(`SELECT n_cid FROM n_tclist WHERE n_tid = ?`, [pre.id])
            ]);
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

            /* 分类详情、点赞状态、购买记录三者互不依赖，一并并行 */
            const CID = Tclist.map(item => item.n_cid);
            const isAuthor = Ware && Ware.id && thread.n_uid == Ware.id;
            const isPaid = thread.n_price > 0 && thread.n_permission !== '1';
            const [Category, isLiked, buylog] = await Promise.all([
                CID.length > 0
                    ? global.db.query(`SELECT id,n_name,n_type,n_icon FROM n_class WHERE id IN (${CID.map(() => '?').join(',')})`, CID)
                    : Promise.resolve([]),
                (Ware && Ware.id)
                    ? global.db.query(`SELECT COUNT(*) FROM n_threads_like WHERE n_tid = ? AND n_uid = ?`, [pre.id, Ware.id])
                    : Promise.resolve(null),
                (isPaid && !isAuthor && Ware && Ware.id)
                    ? global.db.query('select * FROM n_threads_buy where n_tid = ? and n_uid = ?', [pre.id, Ware.id])
                    : Promise.resolve(null)
            ]);

            thread.category = Category;

            thread.IsBuy = true
            /* 获取是否点赞 */
            if (isLiked) {
                thread.isLiked = isLiked[0]['COUNT(*)'] > 0;
            }
            if (isPaid) {
                /* 作者本人查看自己的收费帖无需付费 */
                if (!isAuthor) {
                    if (Ware && Ware.id) {
                        /* 获取用户是否购买 n_threads_buy */
                        if (!buylog || buylog.length == 0) {
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

            /* 写入阅读（先更新再响应，避免后续异常使已发送的成功响应被覆盖为 500）
               点赞后重新拉取等场景传 noread 跳过自增，避免虚增阅读量 */
            if (!pre.noread) {
                await global.db.run('UPDATE n_threads SET n_read = COALESCE(n_read, 0) + 1 WHERE id = ?', [pre.id]);
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
        const sql = SqlBuilder
            .add('n_name', pre.search, 'like')
            .add('n_uid', pre.uid)
            .add('n_haveimage', pre.image)
            .add('n_havevideo', pre.video)
            .build();
        const conditionSql = sql.sql + (extraSql.length ? ' AND ' + extraSql.join(' AND ') : '');

        /* 列表查询与装配封装为可缓存函数；只有「游客且无个性化筛选」时结果才对所有请求方一致，可安全缓存 */
        const buildList = async () => {
            /* 列表不返回 n_html（正文最长 5000 字符，前端列表卡片仅用 n_profile/n_resources），
               剔除后显著缩小 D1 传输与响应序列化体积 */
            const res = await global.db.getPaginatedData('n_threads', conditionSql, [...sql.params, ...extraParams], [pre.sort ?? 'id', pre.sortType ?? 'desc'], pre.page, pre.pagesize, ['n_html'])

            /* 获取分类以及话题 */
            if (res.data.length === 0) {
                return { data: [], total: res.total };
            }
        const tids = res.data.map(item => item.id);
        const Tclist = await global.Tools.queryInChunks(tids, (c) => global.db.query(`SELECT n_cid,n_tid FROM n_tclist WHERE n_tid IN (${c.map(() => '?').join(',')})`, c))
        let CID = []
        for (let a in Tclist) {
            CID.push(Tclist[a].n_cid)
        }

        if (CID.length > 0) {
            /* 获取分类 */
            const Category = await global.Tools.queryInChunks(CID, (c) => global.db.query(`SELECT id,n_name,n_type,n_icon FROM n_class WHERE id IN (${c.map(() => '?').join(',')})`, c))
            // 建立分类映射关系（先用 Map 建索引，避免循环内 find 的 O(n·m) 扫描）
            const categoryById = new Map()
            for (const cat of Category) categoryById.set(cat.id, cat)
            const threadCategoryMap = {};
            for (let item of Tclist) {
                if (!threadCategoryMap[item.n_tid]) {
                    threadCategoryMap[item.n_tid] = [];
                }
                const category = categoryById.get(item.n_cid);
                if (category) {
                    threadCategoryMap[item.n_tid].push(category);
                }
            }

            res.data = res.data.map(thread => {
                thread.category = threadCategoryMap[thread.id] || [];
                return thread;
            });

        }

        /* 收费帖媒体资源：作者本人与已购用户可见，其他人隐藏（与详情分支保持一致） */
        let boughtSet = new Set()
        if (Ware && Ware.id && res.data.length > 0) {
            const tidList = res.data.map(item => item.id)
            /* 语句含 1（Ware.id）+ 分片 ids，分片预算取 99 使参数不超过 100 */
            const buys = await global.Tools.queryInChunks(tidList, (c) => global.db.query(`SELECT n_tid FROM n_threads_buy WHERE n_uid = ? AND n_tid IN (${c.map(() => '?').join(',')})`, [Ware.id, ...c]), 99)
            for (const row of buys) boughtSet.add(row.n_tid)
        }

        for (let a in res.data) {
            try {
                const isAuthor = Ware && Ware.id && res.data[a].n_uid == Ware.id
                const isBuyer = boughtSet.has(res.data[a].id)
                if (res.data[a].n_price > 0 && res.data[a].n_permission !== '1' && !isAuthor && !isBuyer) {
                    res.data[a].n_resources = []
                } else {
                    /* n_resources 可能为 NULL（无资源帖），JSON.parse(null) 会得到 null 而非数组，需兜底为空数组 */
                    const raw = res.data[a].n_resources
                    res.data[a].n_resources = raw ? JSON.parse(raw) : []
                }
            } catch (error) {
                res.data[a].n_resources = []
            }
        }



            return { data: res.data, total: res.total };
        };

        /* 仅当请求方是纯游客（无登录身份，且未使用「我的/我赞/我购」等个性化筛选）时命中 KV 缓存，
           TTL 60s，避免热门/列表读被反复打库；登录用户因付费资源可见性不同而不缓存 */
        const isGuest = !(Ware && Ware.id) && !pre.ismy && !pre.isMyLike && !pre.isMyBuy;
        if (isGuest && global.RedisUtils && global.RedisUtils.getOrSetTextCache) {
            /* 用 JSON 序列化构造缓存键：字符串会被引号包裹，避免 join(':') 时
               用户可控参数中含冒号导致的键碰撞（如 search='a:b' 与 search='a',uid='b'） */
            /* v2：缓存内容从「数据对象」改为「完整响应文本」，换前缀避免读到旧格式缓存 */
            const cacheKey = 'threads:list:v2:' + JSON.stringify([
                pre.search || '', pre.uid || '', pre.image ?? '', pre.video ?? '',
                pre.cid || '', pre.cidt || '', pre.sort ?? 'id', pre.sortType ?? 'desc',
                pre.page || 1, pre.pagesize || 20
            ]);
            /* 缓存的是最终响应文本：命中时零反序列化，直接作为 body 返回，
               省掉「KV 字符串 → JSON.parse → 再 JSON.stringify」的两次同步序列化 */
            const bodyText = await global.RedisUtils.getOrSetTextCache(cacheKey, 60, async () => {
                const listResult = await buildList();
                return JSON.stringify({ code: 200, msg: '获取成功', data: listResult.data, total: listResult.total });
            });
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
        /* 获取评论列表 */
        const SqlBuilder = new global.SqlBuilder();
        /* 「只看我的」与「按作者筛选」二选一：二者同时生效会生成互相冲突的 n_uid 条件导致结果恒空，
           优先取 ismy（当前登录用户），否则按 pre.uid 筛选作者 */
        const commentUid = pre.ismy ? (Ware?.id || 0) : pre.uid;
        const sql = SqlBuilder
            .add('n_tid', pre.id)
            .add('n_uid', commentUid)
            .build();
        const res = await global.db.getPaginatedData('n_comment', sql.sql, sql.params, ['id', 'desc'], pre.page, pre.pagesize)
        if (res.data.length === 0) {
            return global.sendMsg(reply, 200, '获取成功', [], res.total);
        }
        /* 获取用户信息 */
        let Userid = []
        let Tid = []
        for (let a in res.data) {
            Userid.push(res.data[a].n_uid)
            Tid.push(res.data[a].n_tid)
        }
        const User = await global.Tools.queryInChunks(Userid, (c) => global.db.query(`SELECT id,n_nickname,n_avatar FROM n_users WHERE id IN (${c.map(() => '?').join(',')})`, c))
        // 将用户信息添加到评论数据中
        const userMap = User.reduce((acc, user) => {
            acc[user.id] = user;
            return acc;
        }, {});

        res.data = res.data.map(comment => {
            comment.user = userMap[comment.n_uid];
            return comment;
        });

        if (pre.uid) {
            /* 获取帖子信息（仅下发展示所需字段，避免泄露付费帖 n_resources/n_html） */
            const Thread = await global.Tools.queryInChunks(Tid, (c) => global.db.query(`SELECT id,n_name,n_uid FROM n_threads WHERE id IN (${c.map(() => '?').join(',')})`, c))
            const threadMap = Thread.reduce((acc, thread) => {
                acc[thread.id] = thread;
                return acc;
            }, {});

            res.data = res.data.map(comment => {
                comment.thread = threadMap[comment.n_tid];
                return comment;
            });
        }

        global.sendMsg(reply, 200, '获取成功', res.data, res.total);
    })

}