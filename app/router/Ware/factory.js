// Token 校验中间件工厂：消除 UTokenVar / ATokenVar / NoMestUTokenVar 的重复逻辑
// @param {string} tokenType 'user' | 'admin'
// @param {object} [options] { optional } 可选模式：未携带 token 时静默放行为游客；携带但校验失败则明确报错
export default function createTokenMiddleware(tokenType, { optional = false } = {}) {
    return async function (request, reply) {
        const config = global.CONFIG[tokenType === 'admin' ? 'adminToken' : 'userToken'];
        const token = request.headers[config.HeadersKey];

        if (!token) {
            if (optional) return;
            return global.sendMsg(reply, 401, '缺少token');
        }

        try {
            const verifyResult = await global.AuthVerifyAuthCode(token, config.secretKey);
            if (verifyResult.code !== 200) {
                /* 可选鉴权只在「完全未携带 token」时降级为游客（见上方分支）；
                   一旦携带了 token 却校验失败（过期/伪造），必须明确报错，
                   否则会把已失效身份的请求静默当作游客处理，造成身份混淆 */
                return global.sendMsg(reply, verifyResult.code, verifyResult.msg);
            }

            /* 令牌类型校验：载荷内 tokenType 必须与当前接口要求的类型一致，
               防止用户令牌与管理员令牌混用（如用户令牌调用管理员接口）造成越权。
               当前签发流程会为所有令牌写入 tokenType，故不再放行缺失该字段的旧令牌。 */
            const data = verifyResult.data;
            if (data.tokenType !== tokenType) {
                return global.sendMsg(reply, 401, '令牌类型不匹配');
            }

            /* token 撤销校验：账号改密/被强制下线后，签发时间（iat）早于撤销时间戳的旧 token 立即失效。
               KV 不可用时由 Tools 层退化为实例内内存校验。 */
            if (await global.Tools.isTokenRevoked(tokenType, data)) {
                return global.sendMsg(reply, 401, '登录状态已失效，请重新登录');
            }

            request.Ware = data;
        } catch (error) {
            /* 携带了 token 时发生异常不能再降级为游客，否则会掩盖校验失败、造成身份混淆 */
            console.error('Token验证中间件错误:', error);
            return global.sendMsg(reply, 500, '服务器内部错误');
        }
    };
}
