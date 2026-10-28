
/* 敏感字段白名单统一维护于 Tools.js，调用时通过 global.SENSITIVE_USER_FIELDS 读取（避免模块加载期缓存导致取值失效） */

/* 批量补充统计数据（帖子/粉丝/关注/评论）、是否关注与勋章。
   列表页 GetUser 与预取接口 GetUsers 复用同一逻辑；users 为已剔除敏感字段的用户数组（每项须含 id）。
   ids 不超过单语句参数上限时用 D1 batch 一次往返取全部结果，超出则按分片并发查询 */
async function hydrateUsers(users, Ware) {
    if (!users || users.length === 0) return;
    const userIds = users.map(user => user.id);
    const ph = (arr) => arr.map(() => '?').join(',');
    /* 需要按 uid 补充的统计语句（勋章只取下发用到的列，避免 SELECT m.* 带回冗余字段） */
    const hasLikedQuery = !!(Ware && Ware.id);
    const stmtCount = hasLikedQuery ? 6 : 5;

    const buildStatements = (c) => {
        const inList = ph(c);
        const statements = [
            { sql: `SELECT n_uid, COUNT(*) AS count FROM n_threads WHERE n_uid IN (${inList}) GROUP BY n_uid`, params: c },
            { sql: `SELECT n_tid, COUNT(*) AS count FROM n_user_like WHERE n_tid IN (${inList}) GROUP BY n_tid`, params: c },
            { sql: `SELECT n_uid, COUNT(*) AS count FROM n_user_like WHERE n_uid IN (${inList}) GROUP BY n_uid`, params: c },
            { sql: `SELECT n_uid, COUNT(*) AS count FROM n_comment WHERE n_uid IN (${inList}) GROUP BY n_uid`, params: c },
            {
                sql: `SELECT ml.n_uid, m.id, m.n_name, m.n_src, m.n_type, m.n_threshold, m.n_sort
                      FROM n_medal_log ml
                      LEFT JOIN n_medal m ON ml.n_mid = m.id
                      WHERE ml.n_uid IN (${inList})`,
                params: c
            }
        ];
        /* 当前登录用户是否关注了列表中的用户；语句含 1（Ware.id）+ 分片 ids */
        if (hasLikedQuery) {
            statements.push({ sql: `SELECT n_tid FROM n_user_like WHERE n_uid = ? AND n_tid IN (${inList})`, params: [Ware.id, ...c] });
        }
        return statements;
    };

    /* 记录所有分片的结果，最后按「第几条语句」归并 */
    const groups = [];
    if (userIds.length <= 99) {
        /* 单分片：batch 一次往返（结果顺序与语句顺序一致） */
        groups.push(await global.db.queryBatch(buildStatements(userIds)));
    } else {
        const shards = [];
        for (let i = 0; i < userIds.length; i += 90) shards.push(userIds.slice(i, i + 90));
        groups.push(...await Promise.all(shards.map(c => global.db.queryBatch(buildStatements(c)))));
    }

    const merged = Array.from({ length: stmtCount }, () => []);
    for (const group of groups) {
        for (let i = 0; i < stmtCount; i++) merged[i].push(...group[i]);
    }

    const [postCounts, followerCounts, followingCounts, commentCounts, userMedals] = merged;
    const likedUsers = hasLikedQuery ? merged[5] : null;

    /* 将统计数据映射到每个用户 */
    const getCountMap = (data, keyField) => {
        const map = {};
        data.forEach(item => map[item[keyField]] = item.count);
        return map;
    };
    const postMap = getCountMap(postCounts, 'n_uid');
    const followerMap = getCountMap(followerCounts, 'n_tid');
    const followingMap = getCountMap(followingCounts, 'n_uid');
    const commentMap = getCountMap(commentCounts, 'n_uid');

    /* 勋章按 n_uid 归组 */
    const medalsMap = {};
    userMedals.forEach(item => {
        if (!medalsMap[item.n_uid]) {
            medalsMap[item.n_uid] = [];
        }
        medalsMap[item.n_uid].push({
            id: item.id,
            n_name: item.n_name,
            n_src: item.n_src,
            n_type: item.n_type,
            n_threshold: item.n_threshold,
            n_sort: item.n_sort
        });
    });

    const likedSet = likedUsers ? new Set(likedUsers.map(item => item.n_tid)) : null;

    users.forEach(user => {
        user.posts = postMap[user.id] || 0;
        user.followers = followerMap[user.id] || 0;
        user.following = followingMap[user.id] || 0;
        user.n_comment = commentMap[user.id] || 0;
        user.medals = medalsMap[user.id] || [];
        if (likedSet) user.isLiked = likedSet.has(user.id);
    });
}

export default {
    /*  */
    GetUser: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;
        const Ware = request.Ware;
        if (pre.id) {
            if (pre.id == 'me') {
                if (!Ware?.id) {
                    global.sendMsg(reply, 401, '请先登录');
                    return;
                }
                pre.id = Ware.id;
            }
            /* 回源逻辑：基础信息（列白名单）+ 统计/关注关系/勋章（三组独立查询并行） */
            const fetchDetail = async () => {
                const fields = await global.db.selectFields('n_users', global.SENSITIVE_USER_FIELDS || []);
                const res = await global.db.query(`SELECT ${fields} FROM n_users WHERE id = ?`, [pre.id])
                if (res.length == 0) return null;
                const thread = res[0];
                /* 统计、关注关系、勋章三组查询彼此独立，并行执行减少 D1 往返 */
                const statsPromise = global.db.query(`
                    SELECT
                        (SELECT COUNT(*) FROM n_threads WHERE n_uid = ?) AS n_posts,
                        (SELECT COUNT(*) FROM n_user_like WHERE n_tid = ?) AS n_followers,
                        (SELECT COUNT(*) FROM n_user_like WHERE n_uid = ?) AS n_following,
                        (SELECT COUNT(*) FROM n_comment WHERE n_uid = ?) AS n_comment
                `, [thread.id, thread.id, thread.id, thread.id]);
                const likedPromise = (Ware && Ware.id)
                    ? global.db.query(`SELECT COUNT(*) FROM n_user_like WHERE n_tid = ? AND n_uid = ?`, [pre.id, Ware.id])
                    : null;
                const medalsPromise = global.db.query(`
                    SELECT m.id, m.n_name, m.n_src, m.n_type, m.n_threshold, m.n_sort
                    FROM n_medal_log ml
                    LEFT JOIN n_medal m ON ml.n_mid = m.id
                    WHERE ml.n_uid = ?
                `, [thread.id]);

                const [userStats, isLiked, medals] = await Promise.all([statsPromise, likedPromise, medalsPromise]);

                thread.posts = userStats[0].n_posts;
                thread.followers = userStats[0].n_followers;
                thread.following = userStats[0].n_following;
                thread.n_comment = userStats[0].n_comment;

                /* 是否关注 */
                if (isLiked) {
                    thread.isLiked = isLiked[0]['COUNT(*)'] > 0;
                }

                /* 用户勋章 */
                thread.medals = medals;
                return thread;
            };

            /* 仅纯游客走缓存：登录用户需返回 isLiked（个人化），不缓存。
               两级：isolate 内存 10s → KV 60s，缓存完整响应文本 */
            if (!(Ware && Ware.id) && global.RedisUtils && global.RedisUtils.getOrSetTextCache) {
                const cacheKey = 'user:detail:v1:' + (pre.id || '');
                const bodyText = await global.RedisUtils.getOrSetMemoryCache('user:detail:l1:' + cacheKey, 10, () =>
                    global.RedisUtils.getOrSetTextCache(cacheKey, 60, async () => {
                        const row = await fetchDetail();
                        /* 空串表示用户不存在：可被内存缓存复用，但避免把 null 写入 KV */
                        if (!row) return '';
                        return JSON.stringify({ code: 200, msg: '获取成功', data: row, total: 0 });
                    })
                );
                if (!bodyText) {
                    global.sendMsg(reply, 404, '用户不存在');
                    return;
                }
                reply.sendJsonText(bodyText);
                return;
            }

            const thread = await fetchDetail();
            if (!thread) {
                global.sendMsg(reply, 404, '用户不存在');
                return;
            }
            global.sendMsg(reply, 200, '获取成功', thread);
            return;
        }
        /* 请求我的粉丝/关注 */
        if (pre.uid == 'me') {
            if (!Ware?.id) {
                global.sendMsg(reply, 401, '请先登录');
                return;
            }
            pre.uid = Ware.id;
        }
        const extraParams = [];
        const extraSql = [];
        if (pre.followers && pre.uid) {
            extraSql.push('id in (select n_uid from n_user_like where n_tid = ?)');
            extraParams.push(pre.uid);
        }
        if (pre.following && pre.uid) {
            extraSql.push('id in (select n_tid from n_user_like where n_uid = ?)');
            extraParams.push(pre.uid);
        }
        /* @提及搜索：同时匹配昵称与用户名（两者共用唯一命名空间），手工 OR 分组
           （SqlBuilder 仅支持 AND 连接，无法表达跨列 OR） */
        const search = typeof pre.search === 'string' ? pre.search.trim() : '';
        const searchParams = [];
        let conditionSql = '';
        if (search) {
            conditionSql += ' AND (`n_nickname` LIKE ? OR `n_username` LIKE ?)';
            searchParams.push(`%${search}%`, `%${search}%`);
        }
        conditionSql += ' AND `id` != ?';
        searchParams.push(Ware && Ware.id ? Ware.id : 0);
        conditionSql += extraSql.length ? ' AND ' + extraSql.join(' AND ') : '';
        const res = await global.db.getPaginatedData('n_users', conditionSql, [...searchParams, ...extraParams], ['id', 'desc'], pre.page, pre.pagesize, global.SENSITIVE_USER_FIELDS || []);

        /* 批量补充统计数据、关注关系与勋章（集中到 hydrateUsers，预取接口 GetUsers 复用同一逻辑） */
        await hydrateUsers(res.data, Ware);


        global.sendMsg(reply, 200, '获取成功', res.data, res.total);
    }),

    /* 批量获取用户基础信息（列表页头像/昵称预取用，替代逐条 /GetUser 造成的前端 N+1 请求） */
    GetUsers: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body || {};
        /* 前端统一以表单提交，数组会被压成逗号串，这里兼容数组与逗号串两种形式 */
        const ids = global.Tools.parseIds(pre.ids);
        if (ids.length === 0) {
            global.sendMsg(reply, 200, '获取成功', []);
            return;
        }
        if (ids.length > 100) {
            global.sendMsg(reply, 201, '请求数量过多');
            return;
        }
        const Ware = request.Ware;
        const ph = ids.map(() => '?').join(',');
        /* 回源逻辑：列白名单查询 + 批量补充统计/关注/勋章 */
        const fetchUsers = async () => {
            /* 列白名单：直接在 SQL 层排除敏感字段，避免 SELECT * 再逐用户 delete */
            const fields = await global.db.selectFields('n_users', global.SENSITIVE_USER_FIELDS || []);
            const users = await global.db.query(`SELECT ${fields} FROM n_users WHERE id IN (${ph})`, ids);
            await hydrateUsers(users, Ware);
            return users;
        };

        /* 列表页高频预取（每次滚动/翻页都会命中相同 ids 组合）：游客结果只依赖 ids，
           缓存完整响应文本 10s。仅放 isolate 内存不写 KV——键基数大，写 KV 不划算 */
        if (!(Ware && Ware.id) && global.RedisUtils && global.RedisUtils.getOrSetMemoryCache) {
            const cacheKey = 'user:batch:v1:' + ids.slice().sort().join(',');
            const bodyText = await global.RedisUtils.getOrSetMemoryCache(cacheKey, 10, async () => {
                const users = await fetchUsers();
                return JSON.stringify({ code: 200, msg: '获取成功', data: users, total: 0 });
            });
            reply.sendJsonText(bodyText);
            return;
        }

        const users = await fetchUsers();
        global.sendMsg(reply, 200, '获取成功', users);
    })

}