// Cloudflare Workers 入口
// 将 Fastify 的 request/reply 模型适配为 Web 标准的 fetch(request, env, ctx)
import './shim.js';
import './global.js';
import { initDb, initRedisGlobals } from './app/imp/main.js';
import { controllers, middlewares } from './app/router/registry.js';
import registerRoutes from './app/router/index.js';

// ---------- 路由收集（复用 app/router/index.js 中的路由定义） ----------
const routes = [];

function resolveMiddleware(name) {
    const mw = middlewares.get(name);
    if (!mw) throw new Error(`中间件未注册: ${name}`);
    return mw;
}

function addRoute(method, basePath, subPath, groupMiddlewares, controllerStr) {
    const [controllerPath, methodName] = controllerStr.split('@');
    const controller = controllers.get(controllerPath);
    if (!controller) throw new Error(`控制器未注册: ${controllerPath}`);
    const handler = controller[methodName];
    if (!handler) throw new Error(`控制器方法不存在: ${controllerStr}`);

    routes.push({
        method,
        path: basePath + subPath,
        middlewares: groupMiddlewares.map(resolveMiddleware),
        handler,
    });
}

function makeOpen(basePath, groupMiddlewares) {
    return {
        async post(subPath, controllerStr) { addRoute('POST', basePath, subPath, groupMiddlewares, controllerStr); },
        async get(subPath, controllerStr) { addRoute('GET', basePath, subPath, groupMiddlewares, controllerStr); },
    };
}

const router = {
    async group(basePath, middlewaresOrCallback, maybeCallback) {
        let groupMiddlewares = [];
        let callback;
        if (typeof middlewaresOrCallback === 'function') {
            callback = middlewaresOrCallback;
        } else {
            groupMiddlewares = middlewaresOrCallback;
            callback = maybeCallback;
        }
        await callback(makeOpen(basePath, groupMiddlewares));
    },
};

await registerRoutes(router);

// 建立 method+path 索引，避免每个请求线性遍历全部路由
const routeMap = new Map();
for (const r of routes) {
    const key = `${r.method} ${r.path}`;
    if (!routeMap.has(key)) routeMap.set(key, r);
}

// ---------- 请求/响应适配 ----------
class Reply {
    constructor() {
        this.sent = false;
        this.response = null;
        this.statusCode = 200;
    }

    send(payload) {
        /* 幂等：首次发送生效后忽略后续调用，避免 catch 分支把已返回的成功/失败响应覆盖掉 */
        if (this.sent) return this.response;
        this.sent = true;
        if (typeof payload === 'string') {
            this.response = new Response(payload, {
                status: this.statusCode,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
        } else {
            this.response = Response.json(payload, { status: this.statusCode });
        }
        return this.response;
    }

    /* 直接返回已序列化的 JSON 文本（如缓存命中的列表响应），避免二次 stringify */
    sendJsonText(text) {
        if (this.sent) return this.response;
        this.sent = true;
        this.response = new Response(text, {
            status: this.statusCode,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
        return this.response;
    }
}

async function buildRequest(request) {
    const url = new URL(request.url);
    const headers = {};
    for (const [k, v] of request.headers.entries()) headers[k.toLowerCase()] = v;

    const contentType = headers['content-type'] || '';
    let body = {};
    let rawBody = '';
    let formDataPromise = null;

    if (contentType.includes('application/json')) {
        try { rawBody = await request.text(); body = JSON.parse(rawBody); } catch { body = {}; }
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
        try { rawBody = await request.text(); body = Object.fromEntries(new URLSearchParams(rawBody)); } catch { body = {}; }
    } else if (contentType.includes('multipart/form-data')) {
        /* multipart 延迟解析：这里不读取 body，等控制器调用 request.file() 时再解析，
           便于上传接口先按 Content-Length 拒绝超大请求，避免无谓地整块缓冲进内存。 */
    }

    return {
        raw: request,
        method: request.method.toUpperCase(),
        url: url.pathname,
        origin: url.origin,
        headers,
        body,
        rawBody,
        query: Object.fromEntries(url.searchParams.entries()),
        params: {},
        Ware: null,
        // 读取 multipart 中的文件（兼容 Fastify 的 request.file()）
        async file() {
            /* 真正延迟解析：仅在首次调用 file() 时才读取整个 multipart body，
               这样上传接口可以先按 Content-Length 拒绝超大请求，再决定是否缓冲 */
            if (!formDataPromise) {
                formDataPromise = (async () => {
                    try {
                        const fd = await request.formData();
                        for (const [k, v] of fd.entries()) {
                            if (typeof v === 'string') body[k] = v;
                        }
                        return fd;
                    } catch { return null; }
                })();
            }
            const formData = await formDataPromise;
            if (!formData) return null;
            const file = formData.get('file');
            if (!file || typeof file === 'string') return null;
            const buffer = new Uint8Array(await file.arrayBuffer());
            return {
                filename: file.name,
                mimetype: file.type,
                fields: {},
                async toBuffer() { return buffer; },
            };
        },
    };
}

/* 默认放行的本地开发来源（生产环境请通过 Worker 环境变量 CORS_ORIGINS 配置前端域名，逗号分隔） */
const DEV_ORIGINS = [
    'http://localhost:3000', 'http://127.0.0.1:3000',
    'http://localhost:8787', 'http://127.0.0.1:8787'
];

function isOriginAllowed(origin) {
    if (!origin) return false;
    const configured = Array.isArray(global.CORS_ORIGINS) ? global.CORS_ORIGINS : [];
    /* 已配置生产来源时严格按白名单校验；仅当未配置（视为本地开发）才回退到本地来源，
       避免生产环境无条件信任 localhost/127.0.0.1 */
    if (configured.length > 0) return configured.includes(origin);
    return DEV_ORIGINS.includes(origin);
}

function withCors(response, request) {
    const origin = request.headers.get('origin');
    /* 无 Origin（服务端/同源请求）不需要任何 CORS 头，直接返回原响应，
       省掉每次 new Headers() + new Response() 的克隆开销 */
    if (!origin) return response;
    const headers = new Headers(response.headers);
    headers.set('Vary', 'Origin');
    /* 仅回显白名单内的来源，避免任意站点携带凭证读取响应 */
    if (isOriginAllowed(origin)) {
        headers.set('Access-Control-Allow-Origin', origin);
        headers.set('Access-Control-Allow-Credentials', 'true');
    }
    headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'usertoken,admintoken,Content-Type');
    return new Response(response.body, { status: response.status, headers });
}

// ---------- 懒初始化（首个请求时注入 env.DB） ----------
let initPromise = null;
async function ensureInit(env) {
    if (!initPromise) {
        initPromise = (async () => {
            global.R2 = env.R2;
            global.R2_PUBLIC_URL = env.R2_PUBLIC_URL || '';
            // 从环境变量注入 Token 签名密钥（必须配置 Worker 密钥 ADMIN_TOKEN_SECRET / USER_TOKEN_SECRET）
            // fail-closed：未配置时保持空密钥，认证将拒绝签发/校验（返回 401），不会回退到可公开的固定密钥
            if (env.ADMIN_TOKEN_SECRET) global.CONFIG.adminToken.secretKey = env.ADMIN_TOKEN_SECRET;
            else console.error('❌ 未配置 ADMIN_TOKEN_SECRET，管理员认证已禁用（fail-closed），请配置 Worker 密钥！');
            if (env.USER_TOKEN_SECRET) global.CONFIG.userToken.secretKey = env.USER_TOKEN_SECRET;
            else console.error('❌ 未配置 USER_TOKEN_SECRET，用户认证已禁用（fail-closed），请配置 Worker 密钥！');
            /* CORS 白名单（逗号分隔），未配置时仅放行本地开发来源 */
            global.CORS_ORIGINS = (env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
            /* Workers 原生限流绑定：未配置时对应项为 null，Tools.checkRateLimit 会降级到 KV/内存计数 */
            global.RATE_LIMITERS = {
                postUser: env.RATE_LIMITER_POST_USER || null,
                postUserNew: env.RATE_LIMITER_POST_NEW || null,
                postIp: env.RATE_LIMITER_POST_IP || null,
                commentUser: env.RATE_LIMITER_COMMENT_USER || null,
                commentUserNew: env.RATE_LIMITER_COMMENT_NEW || null,
                commentIp: env.RATE_LIMITER_COMMENT_IP || null
            };
            /* hCaptcha 服务端密钥：未配置时跳过人机验证（等同该防护未启用） */
            global.HCAPTCHA_SECRET = env.HCAPTCHA_SECRET || '';
            await initDb(env.DB);
            await initRedisGlobals(env.KV); // 失败不阻断
        })().catch((error) => {
            /* 初始化失败时重置，允许后续请求重试，避免该 isolate 持续 500 */
            initPromise = null;
            throw error;
        });
    }
    return initPromise;
}

// 从 R2 提供上传文件
async function serveUpload(path, request) {
    const filename = path.replace('/public/upload/', '');
    if (!filename) return withCors(new Response('Not Found', { status: 404 }), request);

    const object = await global.R2.get(`upload/${filename}`);
    if (!object) return withCors(new Response('Not Found', { status: 404 }), request);

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000');
    // 防止浏览器嗅探类型导致上传文件被当作 HTML 执行
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Content-Disposition', `inline; filename="${filename.replace(/["\\\r\n]/g, '')}"`);
    return withCors(new Response(object.body, { headers }), request);
}

export default {
    async fetch(request, env) {
        try {
            await ensureInit(env);
        } catch (error) {
            console.error('初始化失败:', error);
            return withCors(Response.json({ code: 500, msg: '服务器内部错误', data: {}, total: 0 }), request);
        }

        // CORS 预检（必须在 ensureInit 之后，确保冷启动时 global.CORS_ORIGINS 已注入）
        if (request.method.toUpperCase() === 'OPTIONS') {
            return withCors(new Response(null, { status: 204 }), request);
        }

        const method = request.method.toUpperCase();
        const path = new URL(request.url).pathname;

        // 上传文件走 R2（读取 R2 可能失败，需兜底为统一错误响应，避免异常外泄）
        if (path.startsWith('/public/upload/')) {
            try {
                return await serveUpload(path, request);
            } catch (error) {
                console.error('读取上传文件失败:', error);
                return withCors(Response.json({ code: 500, msg: '服务器内部错误', data: {}, total: 0 }), request);
            }
        }

        const route = routeMap.get(`${method} ${path}`);

        if (!route) {
            return withCors(Response.json({ code: 400, msg: '访问路径错误', data: {}, total: 0 }, { status: 404 }), request);
        }

        const reply = new Reply();

        try {
            const req = await buildRequest(request);
            for (const mw of route.middlewares) {
                await mw(req, reply);
                if (reply.sent) return withCors(reply.response, request);
            }

            await route.handler(req, reply);

            if (reply.sent) return withCors(reply.response, request);
            return withCors(Response.json({ code: 500, msg: '服务器未返回响应', data: {}, total: 0 }), request);
        } catch (error) {
            console.error('请求处理错误:', error);
            return withCors(Response.json({ code: 500, msg: '服务器内部错误', data: {}, total: 0 }), request);
        }
    },
};
