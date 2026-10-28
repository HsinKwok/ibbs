export default {
    webinfo: (request, reply) => global.Fun(reply, async () => {
        /* 全站公共配置，所有访客返回一致：isolate 内缓存已序列化文本 60s，
           命中时零反序列化直接作为 body 返回。后台改配置时 Tools.clearConfigCache 会一并清理 */
        const bodyText = await global.RedisUtils.getOrSetMemoryCache('webinfo:v1', 60, async () => {
            const info = await global.Tools.getConfig();
            /* 使用浅拷贝，避免脱敏删除字段时污染 getConfig 的共享缓存对象 */
            const row = info[0] ? { ...info[0] } : null;
            /* 配置表为空时直接返回空对象，避免 info[0].x 抛 TypeError */
            if (!row) return JSON.stringify({ code: 200, msg: '成功', data: {}, total: 0 });

            /* 邮件配置与小程序 secret 属敏感字段，公开接口不下发。
               注意：n_admin_path 需保留——前端 SSR 路由依赖它改写自定义后台入口。 */
            for (const key of ['n_email_host', 'n_email_port', 'n_email_secure', 'n_email_user', 'n_email_pass', 'n_email_from', 'n_wechat_miniProgram_secret']) {
                delete row[key];
            }
            return JSON.stringify({ code: 200, msg: '成功', data: row, total: 0 });
        });
        reply.sendJsonText(bodyText);
    })
}
