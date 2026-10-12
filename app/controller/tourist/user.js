
/* 敏感字段白名单统一维护于 Tools.js，调用时通过 global.SENSITIVE_USER_FIELDS 读取（避免模块加载期缓存导致取值失效） */

/* 批量补充统计数据（帖子/粉丝/关注/评论）、是否关注与勋章。
   列表页 GetUser 与预取接口 GetUsers 复用同一逻辑；users 为已剔除敏感字段的用户数组（每项须含 id）。
   各项查询彼此独立，并行执行以减少 D1 往返次数；userIds 可能达 pagesize 上限，IN 列表需分片避免超出 D1 绑定参数上限 */
async function hydrateUsers(users, Ware) {
    if (!users || users.length === 0) return;
    const userIds = users.map(user => user.id);
    const ph = (arr) => arr.map(() => '?').join(',');

    const tasks = [
        /* 帖子数 */
        global.Tools.queryInChunks(userIds, (c) => global.db.query(`SELECT n_uid, COUNT(*) AS count FROM n_threads WHERE n_uid IN (${ph(c)}) GROUP BY n_uid`, c)),
        /* 粉丝数 */
        global.Tools.queryInChunks(userIds, (c) => global.db.query(`SELECT n_tid, COUNT(*) AS count FROM n_user_like WHERE n_tid IN (${ph(c)}) GROUP BY n_tid`, c)),
        /* 关注数 */
        global.Tools.queryInChunks(userIds, (c) => global.db.query(`SELECT n_uid, COUNT(*) AS count FROM n_user_like WHERE n_uid IN (${ph(c)}) GROUP BY n_uid`, c)),
        /* 评论数 */
        global.Tools.queryInChunks(userIds, (c) => global.db.query(`SELECT n_uid, COUNT(*) AS count FROM n_comment WHERE n_uid IN (${ph(c)}) GROUP BY n_uid`, c)),
        /* 用户勋章（LEFT JOIN，无勋章时 m.* 为 null） */
        global.Tools.queryInChunks(userIds, (c) => global.db.query(`
            SELECT ml.n_uid, m.*
            FROM n_medal_log ml
            LEFT JOIN n_medal m ON ml.n_mid = m.id
            WHERE ml.n_uid IN (${ph(c)})
        `, c))
    ];

    /* 当前登录用户是否关注了列表中的用户；语句含 1（Ware.id）+ 分片 ids，
       故分片预算取 99 使单语句参数不超过 100 */
    if (Ware && Ware.id) {
        tasks.push(global.Tools.queryInChunks(userIds, (c) => global.db.query(`SELECT n_tid FROM n_user_like WHERE n_uid = ? AND n_tid IN (${ph(c)})`, [Ware.id, ...c]), 99));
    }

    const [postCounts, followerCounts, followingCounts, commentCounts, userMedals, likedUsers] = await Promise.all(tasks);

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
            const res = await global.db.query('SELECT * FROM n_users WHERE id = ?', [pre.id])
            if (res.length == 0) {
                global.sendMsg(reply, 404, '用户不存在');
                return;
            }
            const thread = res[0];
            /* 清除敏感字段，避免对外返回密码哈希、邮箱、手机号、余额等 */
            for (const field of (global.SENSITIVE_USER_FIELDS || [])) delete thread[field];
            /* 使用单次查询获取用户统计数据 */
            const userStats = await global.db.query(`
                SELECT
                    (SELECT COUNT(*) FROM n_threads WHERE n_uid = ?) AS n_posts,
                    (SELECT COUNT(*) FROM n_user_like WHERE n_tid = ?) AS n_followers,
                    (SELECT COUNT(*) FROM n_user_like WHERE n_uid = ?) AS n_following,
                    (SELECT COUNT(*) FROM n_comment WHERE n_uid = ?) AS n_comment
            `, [thread.id, thread.id, thread.id, thread.id]);
            thread.posts = userStats[0].n_posts;
            thread.followers = userStats[0].n_followers;
            thread.following = userStats[0].n_following;
            thread.n_comment = userStats[0].n_comment;


            /* 是否关注 */
            if (Ware && Ware.id) {
                const isLiked = await global.db.query(`SELECT COUNT(*) FROM n_user_like WHERE n_tid = ? AND n_uid = ?`, [pre.id, Ware.id || 0]);
                thread.isLiked = isLiked[0]['COUNT(*)'] > 0;
            }

            /* 获取用户勋章 */
            const medals = await global.db.query(`
                SELECT m.*
                FROM n_medal_log ml
                LEFT JOIN n_medal m ON ml.n_mid = m.id
                WHERE ml.n_uid = ?
            `, [thread.id]);

            thread.medals = medals;
            

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
        let ids = Array.isArray(pre.ids) ? pre.ids : [];
        /* 去重并统一为字符串（n_users.id 为字符串主键），剔除空值 */
        ids = [...new Set(ids.filter((id) => id !== undefined && id !== null && id !== '').map(String))];
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
        const users = await global.db.query(`SELECT * FROM n_users WHERE id IN (${ph})`, ids);
        /* 清除敏感字段，避免对外返回密码哈希、邮箱、手机号、余额等 */
        for (const user of users) {
            for (const field of (global.SENSITIVE_USER_FIELDS || [])) delete user[field];
        }
        await hydrateUsers(users, Ware);
        global.sendMsg(reply, 200, '获取成功', users);
    })

}