/* 用户不存在时用于等比消耗一次 PBKDF2 计算的占位哈希（格式合法但永不匹配）：
   登录失败路径若因「用户不存在」而跳过密码校验，响应会明显快于「用户存在但密码错误」，
   攻击者可据此枚举有效管理员用户名。此占位哈希用于抹平该时间差。 */
const DUMMY_PASSWORD_HASH = 'pbkdf2$10$00000000000000000000000000000000$' + '0'.repeat(128);

/* 登录失败频控阈值：账号+IP 维度与纯 IP 维度（防单 IP 遍历大量用户名） */
const ADMIN_LOGIN_FAIL_LIMIT = 10;
const ADMIN_LOGIN_IP_FAIL_LIMIT = 30;
const ADMIN_LOGIN_FAIL_TTL = 900;

export default {
    /* 登录 */
    login: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;

        /* 验证字段 */
        if (global.Tools.VerifyField(reply,pre, [
            ['username', '用户名', 'required'],
            ['password', '密码', 'required']
        ])) return false;

        /* 登录失败频控：同一用户名 + IP 15 分钟内失败 10 次即锁定，缓解暴力破解。
           加入 IP 维度，避免攻击者用他人已知用户名连续失败将其锁定（账号锁定 DoS）。
           额外维护纯 IP 维度计数，限制同一来源 IP 遍历大量用户名。 */
        const clientIp = global.Tools.getClientIp(request);
        const lockKey = `adminlogin:fail:${pre.username}:${clientIp}`;
        const ipKey = `adminlogin:fail:ip:${clientIp}`;
        if (await global.Tools.isRateLimited(lockKey, ADMIN_LOGIN_FAIL_LIMIT)
            || await global.Tools.isRateLimited(ipKey, ADMIN_LOGIN_IP_FAIL_LIMIT)) {
            global.sendMsg(reply, 201, '失败次数过多，请15分钟后再试');
            return;
        }

        /* 管理员即「属于内置管理员组（n_usergroup.n_builtin = 1）的前台用户」，不再使用独立 n_admins 表。
           非管理员账号即使存在也查不到行，与「用户不存在」走同一分支，文案与耗时保持一致。 */
        const users = await global.db.query(
            `SELECT u.* FROM n_users u
             INNER JOIN n_usergroup g ON g.id = u.n_group_id
             WHERE u.n_username = ? AND g.n_builtin = 1`,
            [pre.username]
        );

        /* 用户不存在与密码错误统一文案，避免通过返回信息枚举有效用户名 */
        if (users.length === 0) {
            /* 用户不存在时也执行一次等价的 PBKDF2 计算，抹平「用户名是否存在」的响应时间差 */
            await global.Hash.verifyBcryptStyle(pre.password, DUMMY_PASSWORD_HASH);
            await global.Tools.incrRateCount(lockKey, ADMIN_LOGIN_FAIL_TTL);
            await global.Tools.incrRateCount(ipKey, ADMIN_LOGIN_FAIL_TTL);
            global.sendMsg(reply, 201, '用户名或密码错误');
            return;
        }

        if (!(await global.Hash.verifyBcryptStyle(pre.password, users[0].n_password))) {
            await global.Tools.incrRateCount(lockKey, ADMIN_LOGIN_FAIL_TTL);
            await global.Tools.incrRateCount(ipKey, ADMIN_LOGIN_FAIL_TTL);
            global.sendMsg(reply, 201, '用户名或密码错误');
            return;
        }

        /* 登录成功清除失败计数 */
        if (global.RedisUtils) {
            await global.RedisUtils.deleteCache(lockKey);
            await global.RedisUtils.deleteCache(ipKey);
        }

        let Token = await global.AuthGenerateToken({
            ...users[0], n_password: ''
        }, global.CONFIG.adminToken.secretKey, global.CONFIG.adminToken.expiresIn, 'admin')

        global.sendMsg(reply, 200, '登录成功', Token);
    }),
}

