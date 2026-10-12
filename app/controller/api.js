export default {
    webinfo: (request, reply) => global.Fun(reply, async () => {
        const info = await global.Tools.getConfig();
        /* 使用浅拷贝，避免脱敏删除字段时污染 getConfig 的共享缓存对象 */
        const row = info[0] ? { ...info[0] } : null;
        /* 配置表为空时直接返回空对象，避免 info[0].x 抛 TypeError */
        if (!row) return global.sendMsg(reply, 200, '成功', {});

        /* 邮件配置与小程序 secret 属敏感字段，公开接口不下发。
           注意：n_admin_path 需保留——前端 SSR 路由依赖它改写自定义后台入口。 */
        for (const key of ['n_email_host', 'n_email_port', 'n_email_secure', 'n_email_user', 'n_email_pass', 'n_email_from', 'n_wechat_miniProgram_secret']) {
            delete row[key];
        }
        global.sendMsg(reply, 200, '成功', row);
    })
}