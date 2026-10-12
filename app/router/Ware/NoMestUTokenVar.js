import createTokenMiddleware from './factory.js';

// 可选用户 token 校验中间件（游客与登录用户均可访问）
export default createTokenMiddleware('user', { optional: true });
