import { createCrudController } from '../../../imp/CrudFactory.js';

/* 从上传文件 URL 中提取 R2 文件名（仅处理本系统上传的 img_/file_ 前缀文件） */
function extractUploadFilename(url) {
    if (!url) return '';
    const name = String(url).split('?')[0].split('/').pop();
    return /^(img|file)_/.test(name) ? name : '';
}

/* 解析帖子 n_resources，收集其中引用的上传文件名 */
function collectResourceFilenames(n_resources) {
    const filenames = [];
    try {
        const list = JSON.parse(n_resources || '[]');
        for (const item of list) {
            const name = extractUploadFilename(item && item.url);
            if (name) filenames.push(name);
        }
    } catch (error) {
        console.log(error);
    }
    return filenames;
}

/*
 * 删除若干用户的全部内容：
 * 帖子（含分类关系与评论）、帖子资源引用的 R2 文件、用户头像与背景图，
 * 以及该用户名下的关联数据（私信 / 关注 / 通知 / 评论 / 点赞 / 购买 / 举报 / 域名 / 自建房间）。
 * 说明：数据库未记录文件归属用户，只能依据其帖子的 n_resources 与头像/背景反推文件。
 */
async function deleteUserContent(userIds) {
    const ids = Array.isArray(userIds) ? userIds : [userIds];
    if (!ids.length) return;
    const placeholders = ids.map(() => '?').join(',');
    const filenames = new Set();

    const users = await global.db.query(`SELECT id,n_avatar,n_userback FROM n_users WHERE id IN (${placeholders})`, ids);
    users.forEach(user => {
        const avatar = extractUploadFilename(user.n_avatar);
        if (avatar) filenames.add(avatar);
        const back = extractUploadFilename(user.n_userback);
        if (back) filenames.add(back);
    });

    /* ids 由批量删除入口限制在 MAX_BATCH_IDS(100) 以内，但单个用户名下的帖子数可能远超 100，
       故 threadIds 相关的 IN 查询与写语句必须分片，否则触发 D1 单语句绑定参数上限报错 */
    const threads = await global.Tools.queryInChunks(ids, (chunk) =>
        global.db.query(`SELECT id,n_resources FROM n_threads WHERE n_uid IN (${chunk.map(() => '?').join(',')})`, chunk)
    );
    const threadIds = threads.map(t => t.id);
    const threadIdSet = new Set(threadIds);
    threads.forEach(thread => collectResourceFilenames(thread.n_resources).forEach(name => filenames.add(name)));

    /* 先完成全部只读查询（热度统计、他人帖子下的评论数），再统一构造写语句，
       避免边写边读破坏统计口径 */
    let hotRows = [];
    if (threadIds.length) {
        /* 统计各分类被删除的帖子数（每帖对每个唯一分类贡献 1 热度），用于同步递减。
           分片查询后跨分片按 n_cid 求和（分片间 n_tid 互不相同，故可直接累加） */
        const hotMap = new Map();
        await global.Tools.queryInChunks(threadIds, async (chunk) => {
            const rows = await global.db.query(
                `SELECT n_cid, COUNT(DISTINCT n_tid) AS c FROM n_tclist WHERE n_tid IN (${chunk.map(() => '?').join(',')}) GROUP BY n_cid`,
                chunk
            );
            for (const row of rows) hotMap.set(row.n_cid, (hotMap.get(row.n_cid) || 0) + row.c);
            return [];
        });
        hotRows = [...hotMap].map(([n_cid, c]) => ({ n_cid, c }));
    }

    /* 该用户在「他人帖子」下的评论：先按 n_uid 聚合（ids ≤ 100 单语句合法），
       再在 JS 侧剔除其自己帖子（threadIds）下的评论，规避 NOT IN 列表无法随 threadIds 一起分片的问题 */
    const allCommentRows = await global.db.query(
        `SELECT n_tid, COUNT(*) AS c FROM n_comment WHERE n_uid IN (${placeholders}) GROUP BY n_tid`,
        ids
    );
    const otherCommentRows = threadIdSet.size
        ? allCommentRows.filter(row => !threadIdSet.has(row.n_tid))
        : allCommentRows;

    /* 该用户在「他人帖子」下点的赞：删除点赞行后需同步递减帖子的 n_starts（其自己帖子下的点赞
       随帖子一并删除，无需处理），与下方评论数递减对称，避免计数只增不减 */
    const allLikeRows = await global.db.query(
        `SELECT n_tid, COUNT(*) AS c FROM n_threads_like WHERE n_uid IN (${placeholders}) GROUP BY n_tid`,
        ids
    );
    const otherLikeRows = threadIdSet.size
        ? allLikeRows.filter(row => !threadIdSet.has(row.n_tid))
        : allLikeRows;

    /* 全部写操作合并为一次 batch（D1 batch 在同一事务内顺序执行，任一失败则整体回滚），
       既保证「要么全删、要么全不删」，也把 N 次往返收敛为一次 */
    const statements = [];

    if (threadIds.length) {
        /* 同一张表的删除按 threadIds 分片为多条 ≤100 参数的语句，仍同处一个 batch 保证原子性 */
        for (const chunk of global.Tools.chunkArray(threadIds)) {
            const tp = chunk.map(() => '?').join(',');
            /* 批量删除：分类关系、评论、点赞、购买、举报、帖子 */
            statements.push({ sql: `DELETE FROM n_tclist WHERE n_tid IN (${tp})`, params: chunk });
            statements.push({ sql: `DELETE FROM n_comment WHERE n_tid IN (${tp})`, params: chunk });
            statements.push({ sql: `DELETE FROM n_threads_like WHERE n_tid IN (${tp})`, params: chunk });
            statements.push({ sql: `DELETE FROM n_threads_buy WHERE n_tid IN (${tp})`, params: chunk });
            statements.push({ sql: `DELETE FROM n_report WHERE n_tid IN (${tp})`, params: chunk });
            statements.push({ sql: `DELETE FROM n_threads WHERE id IN (${tp})`, params: chunk });
        }

        for (const row of hotRows) {
            statements.push({ sql: 'UPDATE n_class SET n_hotnum = n_hotnum - ? WHERE id = ?', params: [row.c, row.n_cid] });
        }
    }

    /* 清理该用户名下的关联数据，避免孤儿记录（关注数 / 私信查询等不再指向已删用户） */
    /* 私信 / 关注关系语句含两次 ids 占位（2×ids），ids 达 100 时参数为 200，
       故按 50 分片使每片参数不超过 100 */
    for (const chunk of global.Tools.chunkArray(ids, 50)) {
        const cp = chunk.map(() => '?').join(',');
        /* 私信：该用户收发的全部消息 */
        statements.push({ sql: `DELETE FROM n_user_msg WHERE n_from IN (${cp}) OR n_to IN (${cp})`, params: [...chunk, ...chunk] });
        /* 关注关系：该用户关注的、以及关注该用户的 */
        statements.push({ sql: `DELETE FROM n_user_like WHERE n_uid IN (${cp}) OR n_tid IN (${cp})`, params: [...chunk, ...chunk] });
    }
    /* 系统通知 */
    statements.push({ sql: `DELETE FROM n_msg WHERE n_uid IN (${placeholders})`, params: ids });
    /* 其在他人帖子下的评论、点赞、购买、举报 */
    statements.push({ sql: `DELETE FROM n_comment WHERE n_uid IN (${placeholders})`, params: ids });
    statements.push({ sql: `DELETE FROM n_threads_like WHERE n_uid IN (${placeholders})`, params: ids });
    /* 点赞行删除后递减相应帖子的点赞数（与用户端取消点赞对称，避免计数只增不减） */
    for (const row of otherLikeRows) {
        statements.push({ sql: 'UPDATE n_threads SET n_starts = n_starts - ? WHERE id = ?', params: [row.c, row.n_tid] });
    }
    statements.push({ sql: `DELETE FROM n_threads_buy WHERE n_uid IN (${placeholders})`, params: ids });
    statements.push({ sql: `DELETE FROM n_report WHERE n_uid IN (${placeholders})`, params: ids });
    /* 评论删除后递减对应帖子的评论数与分类热度（与用户端删除评论对称，避免计数只增不减） */
    for (const row of otherCommentRows) {
        statements.push({ sql: 'UPDATE n_threads SET n_msgs = n_msgs - ? WHERE id = ?', params: [row.c, row.n_tid] });
        statements.push({ sql: 'UPDATE n_class SET n_hotnum = n_hotnum - ? WHERE id IN (SELECT n_cid FROM n_tclist WHERE n_tid = ?)', params: [row.c, row.n_tid] });
    }
    /* 用户发布的商品与自建房间 */
    statements.push({ sql: `DELETE FROM n_market WHERE n_uid IN (${placeholders})`, params: ids });
    statements.push({ sql: `DELETE FROM n_wrooms WHERE n_uid IN (${placeholders})`, params: ids });

    await global.db.batch(statements);

    /* 删除 R2 上的文件（并行删除，减少串行往返）；文件删除在数据库事务提交后进行 */
    if (global.R2 && filenames.size) {
        await Promise.all([...filenames].map(async (name) => {
            try {
                await global.R2.delete(`upload/${name}`);
            } catch (error) {
                console.log(error);
            }
        }));
    }
}

/* 解析是否同时删除内容参数（表单均为字符串，需严格判断） */
function isDelContent(v) {
    return v === '1' || v === 'true' || v === 1 || v === true;
}

/* 判断给定用户组 id 中是否包含系统内置组（如管理员组，不可删除/编辑/设为默认） */
async function findBuiltinGroups(ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    if (!list.length) return [];
    const placeholders = list.map(() => '?').join(',');
    return global.db.query(`SELECT id FROM n_usergroup WHERE n_builtin = 1 AND id IN (${placeholders})`, list);
}

/* 从给定用户 id 中筛出「属于内置管理员组」的用户 id（字符串）：
   封禁/禁言等操作须跳过管理员，避免把唯一后台账号锁死 */
async function findAdminUserIds(ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    if (!list.length) return [];
    const rows = await global.Tools.queryInChunks(list, (chunk) =>
        global.db.query(
            `SELECT u.id FROM n_users u JOIN n_usergroup g ON u.n_group_id = g.id
             WHERE g.n_builtin = 1 AND u.id IN (${chunk.map(() => '?').join(',')})`,
            chunk
        )
    );
    return rows.map(row => String(row.id));
}

/* 批量用户操作的公共入参处理：解析 ids 并校验数量上限；
   校验不通过时已回复响应并返回 null，调用方据此提前 return */
function parseBatchUserIds(request, reply, emptyMsg) {
    const ids = global.Tools.parseIds(request.body?.ids);
    if (!ids.length) {
        global.sendMsg(reply, 201, emptyMsg);
        return null;
    }
    if (ids.length > global.Tools.MAX_BATCH_IDS) {
        global.sendMsg(reply, 201, `单次最多操作 ${global.Tools.MAX_BATCH_IDS} 个用户`);
        return null;
    }
    return ids;
}

/* 从用户 id 列表中剔除内置管理员组用户，返回 { targets, skipped }：
   targets 为可操作用户，skipped 为被跳过的管理员数量（用于提示文案） */
async function withoutAdminUsers(ids) {
    const adminIds = new Set(await findAdminUserIds(ids));
    return { targets: ids.filter(id => !adminIds.has(id)), skipped: adminIds.size };
}

/* 按 id 批量更新 n_users：自动按 90 分片（为时区/天数等额外绑定参数预留余量）。
   extraParams 为位于 IN 列表之前的额外绑定参数（如 datetime 的时区/天数修饰符） */
async function batchUpdateUsers(ids, setClause, extraParams = []) {
    for (const chunk of global.Tools.chunkArray(ids, 90)) {
        await global.db.run(
            `${setClause} WHERE id IN (${chunk.map(() => '?').join(',')})`,
            [...extraParams, ...chunk]
        );
    }
}

/* 删除用户组时清理其价格配置，并将引用了被删用户组的用户回退到默认用户组 */
async function removeUserGroups(ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    if (!list.length) return;
    const placeholders = list.map(() => '?').join(',');

    await global.db.deleteIn('n_usergroup_price', 'n_gid', list);

    /* 优先回退到未被删除的默认用户组；若默认组也在删除列表中，则退选任一剩余的非内置组，避免用户组悬空或错误落入管理员组 */
    let target = await global.db.query(
        `SELECT id FROM n_usergroup WHERE n_deft = 1 AND id NOT IN (${placeholders}) ORDER BY id ASC LIMIT 1`,
        list
    );
    if (!target.length) {
        target = await global.db.query(
            `SELECT id FROM n_usergroup WHERE (n_builtin IS NULL OR n_builtin != 1) AND id NOT IN (${placeholders}) ORDER BY id ASC LIMIT 1`,
            list
        );
    }
    if (target.length) {
        /* 回退目标 id 固定，用户组列表可能达上限（1 + list 会超过 100 参数），故按 50 分片 */
        const targetId = target[0].id;
        for (const chunk of global.Tools.chunkArray(list, 50)) {
            await global.db.run(
                `UPDATE n_users SET n_group_id = ? WHERE n_group_id IN (${chunk.map(() => '?').join(',')})`,
                [targetId, ...chunk]
            );
        }
    } else {
        /* 无可用回退组（如删除全部非内置组）：置空 n_group_id，避免悬空指向已删除的用户组 */
        await global.db.run(
            `UPDATE n_users SET n_group_id = NULL WHERE n_group_id IN (${placeholders})`,
            list
        );
    }
}

/* 后台可编辑的用户字段白名单 */
const USER_EDITABLE_FIELDS = ['n_avatar', 'n_userback', 'n_nickname', 'n_signature', 'n_username', 'n_points', 'n_balance', 'n_encoding', 'n_group_id', 'n_group_time'];
/* 用户组可编辑字段白名单 */
const USERGROUP_FIELDS = ['n_name', 'n_icon', 'n_back', 'n_note', 'n_sort', 'n_deft', 'n_text_color', 'n_mini_icon', 'n_info_icon', 'n_back_image', 'n_withdrawal_fee', 'n_withdrawal_min', 'n_withdrawal_max', 'n_qps', 'n_discount', 'n_points_ratio'];
/* 用户组价格可编辑字段白名单 */
const USERGROUP_PRICE_FIELDS = ['n_gid', 'n_price', 'n_strikethroughprice', 'n_give', 'n_day', 'n_sort', 'n_points'];

/* n_users：列表 / 编辑 / 删除（可选级联删除内容） */
const usersCrud = createCrudController({
    table: 'n_users',
    fields: USER_EDITABLE_FIELDS,
    keys: {
        list: 'userlist',
        edit: 'edituser',
        del: 'deluser',
        batchDel: 'batchDeluser',
    },
    searchField: 'n_nickname',
    sort: [['id', 'desc']],
    exclude: ['n_password'],
    /* 密码非空时校验强度并加密写入；留空表示不修改密码 */
    beforeEdit: async (data, pre, reply) => {
        /* 用户名/昵称共用一个全站唯一命名空间（各自唯一 + 交叉唯一），排除自身 */
        if (data.n_username !== undefined) {
            const username = String(data.n_username ?? '').trim();
            if (username === '') {
                global.sendMsg(reply, 201, '用户名不能为空');
                return false;
            }
            data.n_username = username;
        }
        const conflict = await global.Tools.findUserIdentifierConflict({
            username: data.n_username,
            nickname: data.n_nickname,
            excludeId: pre.id
        });
        if (conflict) {
            global.sendMsg(reply, 201, conflict.field === 'username' ? '该用户名已被占用' : '该昵称已被占用');
            return false;
        }
        /* 管理员身份由「是否属于内置管理员组」决定，中间件不逐请求复查组，
           故用户组变更若涉及管理员组（迁入或迁出），须撤销其 admin / user 令牌强制重新登录 */
        if (data.n_group_id !== undefined) {
            const rows = await global.db.query('SELECT n_group_id FROM n_users WHERE id = ?', [pre.id]);
            const oldGroupId = rows.length ? rows[0].n_group_id : null;
            if (String(oldGroupId ?? '') !== String(data.n_group_id ?? '')) {
                const touched = await findBuiltinGroups([oldGroupId, data.n_group_id]);
                if (touched.length) {
                    await global.Tools.revokeToken('admin', pre.id);
                    await global.Tools.revokeToken('user', pre.id);
                }
            }
        }
        if (pre.n_password === undefined || pre.n_password === null || pre.n_password === '') return;
        if (global.Tools.VerifyField(reply, pre, [['n_password', '密码', 'required|password']])) return false;
        data.n_password = await global.Hash.bcryptStyle(pre.n_password);
        /* 管理员重置用户密码后，撤销该用户此前签发的 token，强制旧登录态失效 */
        await global.Tools.revokeToken('user', pre.id);
    },
    /* delContent=1 时同时删除用户的帖子与上传的文件 */
    beforeDelete: async (ids, pre) => {
        if (isDelContent(pre.delContent)) {
            await deleteUserContent(ids);
        }
        /* 中间件不查库，已删用户的有效令牌仍能通过校验，故删除时逐账号撤销 admin / user 令牌；
           并发撤销，避免批量删除时串行 KV 写放大延迟 */
        await Promise.all(ids.flatMap(id => [
            global.Tools.revokeToken('admin', id),
            global.Tools.revokeToken('user', id),
        ]))
    },
    successMsg: { edit: '编辑成功' },
});

/* n_usergroup：用户组 CRUD，删除时级联清理价格并回退用户组 */
const usergroupCrud = createCrudController({
    table: 'n_usergroup',
    fields: USERGROUP_FIELDS,
    keys: {
        list: 'usergroup',
        add: 'addusergroup',
        edit: 'editusergroup',
        del: 'delusergroup',
        batchDel: 'batchDelusergroup',
    },
    searchField: 'n_name',
    /* 系统内置组（管理员组）置顶，其余按权重倒序 */
    sort: [['n_builtin', 'desc'], ['n_sort', 'desc']],
    /* 系统内置组不可编辑（改名前端已隐藏入口，此处兜底防止改名/改默认标记） */
    beforeEdit: async (data, pre, reply) => {
        const builtin = await findBuiltinGroups(pre.id);
        if (builtin.length) {
            global.sendMsg(reply, 201, '管理员组为系统内置，不可编辑');
            return false;
        }
    },
    /* 系统内置组不可删除，删除前拦截并清理其余组的关联数据 */
    beforeDelete: async (ids, pre, reply) => {
        const builtin = await findBuiltinGroups(ids);
        if (builtin.length) {
            global.sendMsg(reply, 201, '管理员组为系统内置，不可删除');
            return false;
        }
        await removeUserGroups(ids);
    },
});

/* n_usergroup_price：用户组价格 CRUD，按 n_gid 过滤 */
const usergroupPriceCrud = createCrudController({
    table: 'n_usergroup_price',
    fields: USERGROUP_PRICE_FIELDS,
    keys: {
        list: 'usergroup_price',
        add: 'addusergroup_price',
        edit: 'editusergroup_price',
        del: 'delusergroup_price',
        batchDel: 'batchDelusergroup_price',
    },
    searchField: null,
    sort: ['n_sort', 'desc'],
    conditions: (builder, pre) => builder.add('n_gid', pre.n_gid),
});

export default {
    ...usersCrud,
    ...usergroupCrud,
    ...usergroupPriceCrud,
    /* 批量封禁用户：n_status=0，并撤销其已签发的 user 令牌强制下线 */
    banuser: (request, reply) => global.Fun(reply, async () => {
        const ids = parseBatchUserIds(request, reply, '请选择要封禁的用户');
        if (!ids) return;

        const { targets, skipped } = await withoutAdminUsers(ids);
        if (!targets.length) return global.sendMsg(reply, 201, '管理员账号不可被封禁');

        await batchUpdateUsers(targets, 'UPDATE n_users SET n_status = 0');
        /* 鉴权中间件无状态、不查库，被封禁用户的有效 token 仍能通过校验，故逐账号撤销 user 令牌强制下线 */
        await Promise.all(targets.map(id => global.Tools.revokeToken('user', id)));

        global.sendMsg(reply, 200, skipped ? `已封禁 ${targets.length} 个用户（跳过 ${skipped} 个管理员）` : '封禁成功');
    }),

    /* 批量解除封禁：n_status=1 */
    unbanuser: (request, reply) => global.Fun(reply, async () => {
        const ids = parseBatchUserIds(request, reply, '请选择要解封的用户');
        if (!ids) return;

        await batchUpdateUsers(ids, 'UPDATE n_users SET n_status = 1');
        global.sendMsg(reply, 200, '解封成功');
    }),

    /* 批量禁言：写 n_mute_end = 当前时间 + days 天（按站点时区），到期自动失效 */
    muteuser: (request, reply) => global.Fun(reply, async () => {
        const days = Number(request.body?.days);
        if (!Number.isInteger(days) || days <= 0 || days > 3650) {
            return global.sendMsg(reply, 201, '禁言天数必须为 1 - 3650 的整数');
        }
        const ids = parseBatchUserIds(request, reply, '请选择要禁言的用户');
        if (!ids) return;

        const { targets, skipped } = await withoutAdminUsers(ids);
        if (!targets.length) return global.sendMsg(reply, 201, '管理员账号不可被禁言');

        /* 到期时间在 SQL 侧计算，格式与库内时间串一致（'YYYY-MM-DD HH:mm:ss'） */
        await batchUpdateUsers(
            targets,
            `UPDATE n_users SET n_mute_end = datetime('now', ?, ?)`,
            [global.Tools.sqlTimezoneModifier(), `+${days} days`]
        );
        global.sendMsg(reply, 200, skipped ? `已禁言 ${targets.length} 个用户（跳过 ${skipped} 个管理员）` : '禁言成功');
    }),

    /* 批量解除禁言：清空 n_mute_end */
    unmuteuser: (request, reply) => global.Fun(reply, async () => {
        const ids = parseBatchUserIds(request, reply, '请选择要解除禁言的用户');
        if (!ids) return;

        await batchUpdateUsers(ids, 'UPDATE n_users SET n_mute_end = NULL');
        global.sendMsg(reply, 200, '解除禁言成功');
    }),

    /* 设置默认用户组 */
    deftusergroup: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;

        /* 缺少 id 时 CASE 全不命中，会把所有用户组置为非默认，导致系统无默认用户组 */
        if (pre?.id === undefined || pre?.id === null || pre?.id === '') {
            return global.sendMsg(reply, 201, '参数错误');
        }
        const target = await global.db.query('SELECT id, n_builtin FROM n_usergroup WHERE id = ?', [pre.id]);
        if (target.length === 0) {
            return global.sendMsg(reply, 201, '用户组不存在');
        }
        /* 系统内置组（管理员组）不允许设为默认 */
        if (Number(target[0].n_builtin) === 1) {
            return global.sendMsg(reply, 201, '管理员组为系统内置，不可设为默认用户组');
        }

        /* 单条语句原子完成：目标行置 1、其余置 0，避免两步之间出现「无默认组」的中间态 */
        await global.db.run('UPDATE `n_usergroup` SET `n_deft` = CASE WHEN `id` = ? THEN 1 ELSE 0 END', [pre.id])
        global.sendMsg(reply, 200, '设置成功');
    }),
}
