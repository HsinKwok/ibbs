/* 用户邀请逻辑 */
const InviteFun = async (uid, inv) => {
    const users = await global.db.query('SELECT * FROM n_users where n_encoding = ?', [inv]);
    if (users.length > 0) {
        await global.db.insert('n_activity_useracquisition_log', {
            n_uid: uid,
            n_time: new Date(),
            n_superior: users[0].id
        })
    }
}

/* 登录失败频控：账号+IP 组合 10 次 / 15 分钟；单 IP 全局限 30 次 / 15 分钟（缓解跨账号撞库/喷洒） */
const LOGIN_FAIL_LIMIT = 10;
const LOGIN_IP_FAIL_LIMIT = 30;
const LOGIN_FAIL_TTL = 900;

/* 注册 IP 频控：单 IP 每小时最多发起 10 次注册请求，遏制脚本批量造号。
   正常用户极少在同一小时内反复注册；若出口为 NAT 共享 IP 需放宽，调大此上限即可。 */
const REGISTER_IP_LIMIT = 10;
const REGISTER_IP_TTL = 3600;

/* 用户不存在时用于等比消耗一次 PBKDF2 计算的占位哈希（格式合法但永不匹配）：
   登录失败路径若因「用户不存在」而跳过密码校验，响应会明显快于「用户存在但密码错误」，
   攻击者可据此枚举有效用户名。此占位哈希用于抹平该时间差。 */
const DUMMY_PASSWORD_HASH = 'pbkdf2$10$00000000000000000000000000000000$' + '0'.repeat(128);

/* 昵称净化：先按上限截断再转义，避免注册/微信登录时注入脚本或写入超长内容（与 info.js 字段上限保持一致） */
const NICKNAME_MAX_LEN = 30;
const cleanNickname = (value) => {
    const raw = (typeof value === 'string' && value.trim() !== '') ? value.slice(0, NICKNAME_MAX_LEN) : '无名氏';
    return global.Sanitize(raw);
};

/* 取默认用户组 id（用户组管理中被标记为默认的组，n_deft = 1），新注册用户自动归属该组；
   排除系统内置的管理员组；未配置默认组时返回 null，保持与历史数据一致 */
const getDefaultGroupId = async () => {
    const rows = await global.db.query(
        'SELECT id FROM n_usergroup WHERE n_deft = 1 AND (n_builtin IS NULL OR n_builtin != 1) ORDER BY id ASC LIMIT 1'
    );
    return rows.length ? rows[0].id : null;
}

export default {
    /* 登录 */
    login: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;

        /* 验证字段；限制用户名最大长度（本项目用户名即邮箱，上限取 RFC 邮箱最大长度），
           同时避免超长输入生成超大 KV 频控键导致计数失效 */
        if (global.Tools.VerifyField(reply, pre, [
            ['username', '用户名', 'required|maxLength:254'],
            ['password', '密码', 'required']
        ])) return false;

        /* 登录失败频控：
           - 账号+IP 维度：15 分钟内失败 10 次锁定该组合，缓解针对单账号的暴力破解。
           - IP 维度：15 分钟内失败 30 次锁定该来源，缓解同一 IP 跨账号撞库/喷洒。
           加入 IP 维度，也避免攻击者用他人已知用户名连续失败将其锁定（账号锁定 DoS）。 */
        const clientIp = global.Tools.getClientIp(request);
        const lockKey = `login:fail:${pre.username}:${clientIp}`;
        const ipLockKey = `login:fail:ip:${clientIp}`;
        if (await global.Tools.isRateLimited(lockKey, LOGIN_FAIL_LIMIT)
            || await global.Tools.isRateLimited(ipLockKey, LOGIN_IP_FAIL_LIMIT)) {
            global.sendMsg(reply, 201, '失败次数过多，请15分钟后再试');
            return;
        }

        const users = await global.db.query('SELECT * FROM n_users where n_username = ?', [pre.username]);

        let user = null;
        const usernameExists = users.length > 0;

        if (users.length > 0 && (await global.Hash.verifyBcryptStyle(pre.password, users[0].n_password))) {
            user = users[0];
        }

        if (!user) {
            /* 用户名不存在时也执行一次等价的 PBKDF2 计算，抹平「用户名是否存在」的响应时间差，
               防止攻击者据响应耗时枚举有效用户名（时间侧信道） */
            if (!usernameExists) {
                await global.Hash.verifyBcryptStyle(pre.password, DUMMY_PASSWORD_HASH);
            }
            /* 同时累计账号+IP 与 IP 两个维度的失败次数 */
            await global.Tools.incrRateCount(lockKey, LOGIN_FAIL_TTL);
            await global.Tools.incrRateCount(ipLockKey, LOGIN_FAIL_TTL);
            /* 错误文案统一，不区分「用户名不存在」与「密码错误」，避免用户枚举 */
            global.sendMsg(reply, 201, '用户名或密码错误');
            return;
        }

        /* 登录成功清除该「账号+IP」组合的失败计数；IP 维度计数不清除，
           避免攻击者用自有账号成功登录一次即重置 IP 级限速 */
        await global.Tools.clearRateCount(lockKey);

        /* 封禁校验：n_status=0 表示账号已被封禁，拒绝登录并签发 token。
           被封禁账号即便此前 token 仍有效，也已在封禁时通过 revokeToken 强制失效。 */
        if (Number(user.n_status) === 0) {
            global.sendMsg(reply, 201, '账号已被封禁，请联系管理员');
            return;
        }

        let Token = await global.AuthGenerateToken({
            ...user, n_password: ''
        }, global.CONFIG.userToken.secretKey, global.CONFIG.userToken.expiresIn, 'user')

        global.sendMsg(reply, 200, '登录成功', Token);
    }),

    /* 注册 */
    register: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;

        /* 注册 IP 频控：单 IP 每小时最多发起 N 次注册请求，拦截脚本批量造号。
           键仅取客户端 IP，不含任何用户可控输入，避免超长/伪造输入撑大 KV 键。
           计数在字段校验前累加，使非法请求同样消耗配额，避免被无效负载绕过。 */
        const clientIp = global.Tools.getClientIp(request);
        const regIpKey = `register:ip:${clientIp}`;
        if (await global.Tools.isRateLimited(regIpKey, REGISTER_IP_LIMIT)) {
            global.sendMsg(reply, 201, '注册过于频繁，请稍后再试');
            return;
        }
        await global.Tools.incrRateCount(regIpKey, REGISTER_IP_TTL);

        /* 验证字段 */
        if (global.Tools.VerifyField(reply, pre, [
            ['username', '用户名', 'required|maxLength:254'],
            ['nickname', '昵称', 'required|maxLength:30'],
            ['password', '密码', 'required|password']
        ])) return false;

        /* 检查注册开关 */
        const regConfig = await global.Tools.getConfig();
        if (regConfig[0] && regConfig[0].n_allow_register === '0') {
            global.sendMsg(reply, 201, '暂未开放注册');
            return;
        }

        /* 用户名与昵称共用一个全站唯一命名空间（各自唯一 + 交叉唯一） */
        const nickname = cleanNickname(pre.nickname);
        const conflict = await global.Tools.findUserIdentifierConflict({ username: pre.username, nickname });
        if (conflict) {
            global.sendMsg(reply, 201, conflict.field === 'username' ? '用户名已存在' : '昵称已存在');
            return;
        }

        /* 验证码检验 */
        const verifyCode = await global.Tools.verifyCode(pre.code, pre.username);
        if (!verifyCode.status) {
            global.sendMsg(reply, 201, verifyCode.msg);
            return;
        }

        let From = {
            n_nickname: nickname,
            n_avatar: '',
            n_username: pre.username,
            n_password: await global.Hash.bcryptStyle(pre.password),
            n_userback: '',
            n_registertime: new Date(),
            n_points: 0,
            n_signature: '这家伙很懒，什么都没留下',
            n_encoding: await global.Tools.generateUniqueEncoding(5),
            n_balance: 0,
            /* 新用户直接归属用户组管理中的默认用户组，后台用户列表可正确显示其所属组 */
            n_group_id: await getDefaultGroupId()
        }

        /* 条件插入：用户名唯一性由 SQL 层原子保证，避免「先查后插」在并发下创建重复账号。
           昵称/交叉唯一性由数据库触发器兜底，并发冲突时抛出异常，转为友好提示。 */
        const cols = Object.keys(From);
        let meta;
        try {
            meta = await global.db.run(
                `INSERT INTO n_users (${cols.map((c) => `\`${c}\``).join(', ')})
                 SELECT ${cols.map(() => '?').join(', ')}
                 WHERE NOT EXISTS (SELECT 1 FROM n_users WHERE n_username = ?)`,
                [...Object.values(From), From.n_username]
            );
        } catch (e) {
            /* 触发器拦截：并发的用户名/昵称占用 */
            global.sendMsg(reply, 201, '用户名或昵称已被占用，请更换后重试');
            return;
        }
        if (!meta.changes) {
            global.sendMsg(reply, 201, '用户名已存在');
            return;
        }
        const insertId = meta.last_row_id;

        /* 处理邀请码 */
        if (pre.inv) {
            await InviteFun(insertId, pre.inv)
        }

        global.sendMsg(reply, 200, '注册成功');
    }),


    /* 找回密码 */
    RetrievePassword: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;

        /* 验证字段 */
        if (global.Tools.VerifyField(reply, pre, [
            ['username', '用户名', 'required'],
            ['password', '密码', 'required|password']
        ])) return false;


        /* 验证码校验前置到用户查询之前：验证码仅下发至用户名（邮箱）本人，
           攻击者无法读取他人邮箱即无法通过校验，从而关闭「用户名是否存在」的枚举面 */
        const verifyCode = await global.Tools.verifyCode(pre.code, pre.username, true);
        if (!verifyCode.status) {
            global.sendMsg(reply, 201, verifyCode.msg);
            return;
        }

        const users = await global.db.query('SELECT * FROM n_users where n_username = ?', [pre.username]);

        if (users.length == 0) {
            global.sendMsg(reply, 201, '用户名不存在');
            return;
        }

        let From = {
            n_password: await global.Hash.bcryptStyle(pre.password),
        }
        await global.db.update('n_users', From, 'id = ?', [users[0].id])
        /* 改密后撤销该用户此前签发的全部 token，强制旧登录态失效，需重新登录 */
        await global.Tools.revokeToken('user', users[0].id);
        global.sendMsg(reply, 200, '重置成功');
    }),


    /* 微信小程序登录 */
    WeChatMiniProgramLogin: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;
        /* 验证字段 */
        if (global.Tools.VerifyField(reply, pre, [
            ['code', 'code', 'required'],
        ])) return false;
        /* 请求微信 */
        let res = await global.ThirdParty.WeChatMiniProgramLogin(pre.code)
        /* 校验微信返回：失败时 res 为 {code, msg}，无 code 时也可能缺少 openid，须提前拦截 */
        if (res.code || !res.openid) {
            return global.sendMsg(reply, 201, res.msg || '微信登录失败');
        }

        /* 获取是否有用户存在 */
        let users = await global.db.query('SELECT * FROM n_users where n_MiniProgramOpenid = ?', [res.openid]);
        if (users.length == 0) {
            /* 用户不存在 就创建新用户。昵称需在全站命名空间内唯一，自动生成唯一昵称。 */
            let From = {
                n_nickname: await global.Tools.ensureUniqueNickname(cleanNickname(pre.nickname)),
                n_avatar: '',
                n_userback: '',
                n_registertime: new Date(),
                n_points: 0,
                n_signature: '这家伙很懒，什么都没留下',
                n_encoding: await global.Tools.generateUniqueEncoding(5),
                n_balance: 0,
                /* 同注册流程：新用户自动归属默认用户组 */
                n_group_id: await getDefaultGroupId(),
                n_MiniProgramOpenid: res.openid
            }

            /* 条件插入：微信 openid 唯一，避免同一用户并发登录时创建重复账号。
               昵称由触发器兜底，极少数并发冲突时重新生成唯一昵称后重试一次。 */
            const doInsert = async (data) => {
                const cols = Object.keys(data);
                return await global.db.run(
                    `INSERT INTO n_users (${cols.map((c) => `\`${c}\``).join(', ')})
                     SELECT ${cols.map(() => '?').join(', ')}
                     WHERE NOT EXISTS (SELECT 1 FROM n_users WHERE n_MiniProgramOpenid = ?)`,
                    [...Object.values(data), res.openid]
                );
            }

            let meta;
            try {
                meta = await doInsert(From);
            } catch (e) {
                From.n_nickname = await global.Tools.ensureUniqueNickname(cleanNickname(pre.nickname));
                meta = await doInsert(From);
            }

            /* 处理邀请码：仅在本次真正创建成功时处理，避免并发重复计入邀请 */
            if (meta.changes && pre.inv) {
                await InviteFun(meta.last_row_id, pre.inv)
            }

            /* 更新users：无论本次是否创建成功，统一重新查询以获取 user 记录 */
            users = await global.db.query('SELECT * FROM n_users where n_MiniProgramOpenid = ?', [res.openid]);
        }

        /* 封禁校验：已被封禁的账号拒绝登录并签发 token（同账号密码登录） */
        if (Number(users[0].n_status) === 0) {
            return global.sendMsg(reply, 201, '账号已被封禁，请联系管理员');
        }

        let Token = await global.AuthGenerateToken({
            ...users[0], n_password: ''
        }, global.CONFIG.userToken.secretKey, global.CONFIG.userToken.expiresIn, 'user')

        global.sendMsg(reply, 200, '登录成功', Token);
    })


}

