export default {
    /* 发送验证码邮件 */
    sendVerificationCode: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;

        // 验证字段
        if (global.Tools.VerifyField(reply, pre, [
            ['to', '收件人邮箱', 'required|email']
        ])) return false;

        /* 邮箱大小写不敏感：统一 trim + 小写。否则 User@x.com / user@X.com 等大小写变体会被视为不同标识，
           绕过日上限(10)与冷却(60s)限流；同时保证与校验端（Tools.verifyCode）使用一致的缓存键 */
        const to = String(pre.to).trim().toLowerCase();
        const ip = global.Tools.getClientIp(request);

        // Redis 未初始化时无法存储验证码，直接拒绝，避免发送无法校验的邮件
        if (!global.RedisUtils) {
            global.sendMsg(reply, 201, '验证服务暂不可用，请稍后再试');
            return;
        }

        // 频控：邮箱级日上限 + IP级小时上限 + 邮箱级冷却（60秒），防止邮件接口被滥用刷取。
        // 先做只读的上限判断，最后才写冷却锁，避免「拒绝时仍写入冷却锁」导致正常用户被误锁
        if (await global.Tools.isRateLimited(`email:send:day:${to}`, 10)) {
            global.sendMsg(reply, 201, '该邮箱今日发送次数已达上限');
            return;
        }
        if (await global.Tools.isRateLimited(`email:send:ip:${ip}`, 20)) {
            global.sendMsg(reply, 201, '当前网络发送过于频繁，请稍后再试');
            return;
        }
        if (!(await global.Tools.acquireCooldown(`email:send:cool:${to}`, 60))) {
            global.sendMsg(reply, 201, '发送过于频繁，请稍后再试');
            return;
        }
        await global.Tools.incrRateCount(`email:send:day:${to}`, 86400);
        await global.Tools.incrRateCount(`email:send:ip:${ip}`, 3600);

        // 生成6位验证码（密码学安全随机，避免可预测）
        const rand = new Uint32Array(1);
        crypto.getRandomValues(rand);
        const code = String(100000 + (rand[0] % 900000));
        const expiresIn = 10; // 10分钟过期

        // 将验证码存储到Redis中
        const redisKey = `email:verify:${to}`;
        await global.RedisUtils.setCache(redisKey, code, expiresIn * 60);
        // 重新下发验证码时清除失败计数，使新验证码拥有完整的尝试次数
        await global.RedisUtils.deleteCache(`email:verify:fail:${to}`);

        // 发送邮件
        const result = await global.EmailService.sendTemplate({
            to: to,
            subject: '邮箱验证码',
            template: 'verifyCode',
            data: { code, main_title: '验证码', user_name: to }
        });

        if (result.success) {
            global.sendMsg(reply, 200, '验证码发送成功', {
                expiresIn: expiresIn,
            });
        } else {
            global.sendMsg(reply, 201, '验证码发送失败，请稍后重试');
        }
    }),

    /* 测试发信模式（仅限后台管理员，防止被用于对外发信） */
    sendTest: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;

        if (!(await global.Tools.isAdminRequest(request))) {
            global.sendMsg(reply, 403, '无权限');
            return;
        }

        // 验证字段
        if (global.Tools.VerifyField(reply, pre, [
            ['to', '收件人邮箱', 'required|email']
        ])) return false;

        // 发送邮件
        const result = await global.EmailService.sendTemplate({
            to: pre.to,
            subject: '测试发信邮件',
            template: 'TestEmail',
            data: { main_title: '测试邮件', user_name: pre.to }
        });

        if (result.success) {
            global.sendMsg(reply, 200, '邮件发送成功');
        } else {
            global.sendMsg(reply, 201, '邮件发送失败，请稍后重试');
        }
    })
}