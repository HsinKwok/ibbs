/* 站点配置中不应下发明文的敏感字段（邮箱密码、小程序密钥等） */
const SENSITIVE_CONFIG_FIELDS = ['n_email_pass', 'n_wechat_miniProgram_secret'];

/* 获取 n_configuration 的真实可写列（用于过滤请求体中不存在的字段，避免写入未知列）
   每次实时读取：若做过一次性缓存，worker 运行期内新增列（如执行迁移）后缓存会陈旧，
   导致新字段被静默过滤而保存看似成功却不落库 */
async function getConfigColumns() {
    const columns = await global.db.query('PRAGMA table_info(`n_configuration`)');
    return new Set(columns.map(col => col.name).filter(name => name !== 'id'));
}

export default {
    /* 编辑站点信息 */
    editweb: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;
        const id = pre.id;

        /* 缺少 id 时若直接跳过更新会静默返回成功，误导调用方，故明确报错 */
        if (id === undefined || id === null || id === '') {
            return global.sendMsg(reply, 201, '缺少 id');
        }

        /* 仅保留数据库真实存在的配置列 */
        const allowed = await getConfigColumns();
        const data = {};
        for (const key of Object.keys(pre)) {
            if (key !== 'id' && allowed.has(key)) data[key] = pre[key];
        }

        /* 敏感字段为空时视为「保持不变」，避免前端回显空值覆盖原有密钥 */
        for (const field of SENSITIVE_CONFIG_FIELDS) {
            if (data[field] === '' || data[field] === null || data[field] === undefined) {
                delete data[field];
            }
        }

        if (Object.keys(data).length === 0) {
            return global.sendMsg(reply, 200, '编辑成功');
        }

        await global.db.update('n_configuration', data, 'id = ?', [id])
        /* 配置已变更，立即失效内存缓存（含邮件服务自身的配置缓存） */
        global.Tools.clearConfigCache();
        global.EmailService.clearConfigCache();
        global.sendMsg(reply, 200, '编辑成功');
    }),

    /* 修改当前登录管理员自己的账号 / 密码（管理员即 n_users 中属于管理员组的用户） */
    changeadminpass: (request, reply) => global.Fun(reply, async () => {
        const pre = request.body;

        /* 复用统一校验：密码必填、长度≥6 且需包含大小写字母与数字 */
        if (global.Tools.VerifyField(reply, pre, [
            ['password', '密码', 'required|password']
        ])) return false;

        const data = { n_password: await global.Hash.bcryptStyle(pre.password) };
        /* 仅在显式传入非空用户名时才更新，避免空值清空登录名 */
        if (typeof pre.username === 'string' && pre.username.trim()) {
            const username = pre.username.trim();
            /* 用户名与昵称共用全站唯一命名空间，与用户表比对（排除自身） */
            const conflict = await global.Tools.findUserIdentifierConflict({ username, excludeId: request.Ware.id });
            if (conflict) {
                return global.sendMsg(reply, 201, conflict.field === 'username' ? '该用户名已被占用' : '该用户名已被他人用作昵称');
            }
            data.n_username = username;
        }
        try {
            await global.db.update('n_users', data, 'id = ?', [request.Ware.id])
        } catch (e) {
            /* 数据库触发器兜底：并发下用户名被他处占用 */
            return global.sendMsg(reply, 201, '该用户名已被占用，请更换后重试');
        }
        /* 改密后撤销该账号此前签发的 admin / user 令牌（含当前会话），强制重新登录 */
        await global.Tools.revokeToken('admin', request.Ware.id);
        await global.Tools.revokeToken('user', request.Ware.id);
        global.sendMsg(reply, 200, '编辑成功');
    }),
    /* 获取站点信息 */
    getweb: (request, reply) => global.Fun(reply, async () => {
        const info = await global.Tools.getConfig();
        /* 使用浅拷贝，避免脱敏改写污染 getConfig 的共享缓存对象 */
        const row = info[0] ? { ...info[0] } : {};
        /* 脱敏：不下发密钥明文，前端留空表示「不修改」 */
        for (const field of SENSITIVE_CONFIG_FIELDS) {
            if (row[field]) {
                row[field] = '';
            }
        }
        global.sendMsg(reply, 200, '成功', row);
    })


}

