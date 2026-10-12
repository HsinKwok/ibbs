global.CONFIG = {
    port: 9999,
    wsPort: 9888,
    userToken: {
        HeadersKey: 'usertoken',
        /* 必须通过 Worker 环境变量 USER_TOKEN_SECRET 注入（见 worker.js）；
           未配置时留空，认证将 fail-closed（拒绝签发/校验，返回 401），不再使用可公开的固定回退密钥 */
        secretKey: '',
        expiresIn: 60 * 60 * 24 * 30
    },
    adminToken: {
        HeadersKey: 'admintoken',
        /* 必须通过 Worker 环境变量 ADMIN_TOKEN_SECRET 注入（见 worker.js）；
           未配置时留空，认证将 fail-closed（拒绝签发/校验，返回 401），不再使用可公开的固定回退密钥 */
        secretKey: '',
        expiresIn: 60 * 60 * 24 * 30
    }
};
