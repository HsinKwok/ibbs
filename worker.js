// Cloudflare Workers 入口
// 将 Fastify 的 request/reply 模型适配为 Web 标准的 fetch(request, env, ctx)
import './shim.js';
import './global.js';
import { initDb, initRedisGlobals } from './app/imp/main.js';
import { loadController, middlewares } from './app/router/registry.js';
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

    // 控制器模块此刻不加载，仅登记路径与方法名，首次命中该路由时再初始化
    routes.push({
        method,
        path: basePath + subPath,
        middlewares: groupMiddlewares.map(resolveMiddleware),
        controllerPath,
        methodName,
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

// 建立 method → path 两级索引，避免每个请求拼接字符串 key 与线性遍历全部路由
const routeMap = new Map();
for (const r of routes) {
    let byPath = routeMap.get(r.method);
    if (!byPath) {
        byPath = new Map();
        routeMap.set(r.method, byPath);
    }
    if (!byPath.has(r.path)) byPath.set(r.path, r);
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

/* 业务实际读取的请求头白名单：逐个 get 比 entries() 全量遍历更省
   （浏览器请求头常达数十个，业务只用其中少数几个）。
   Token 头名直接取自配置，避免硬编码与配置不一致。 */
const PREFETCH_HEADER_KEYS = [
    'content-type', 'content-length', 'cf-connecting-ip',
    'wechatpay-timestamp', 'wechatpay-nonce', 'wechatpay-signature', 'wechatpay-serial',
    global.CONFIG.userToken.HeadersKey, global.CONFIG.adminToken.HeadersKey
];

/* 构造请求头视图：业务只读白名单内的头，全部预取进普通对象。
   原先用 Proxy 兜底任意键，每次属性读取都要进陷阱函数（固定 CPU 开销），
   且请求头名称是静态可枚举的，直接返回普通对象即可。 */
function buildHeaderView(request) {
    const headers = {};
    for (const key of PREFETCH_HEADER_KEYS) {
        const value = request.headers.get(key);
        if (value !== null) headers[key] = value;
    }
    return headers;
}

async function buildRequest(request, url, ctx) {
    const headers = buildHeaderView(request);

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

    const req = {
        raw: request,
        method: request.method.toUpperCase(),
        url: url.pathname,
        origin: url.origin,
        headers,
        body,
        rawBody,
        params: {},
        Ware: null,
        /* Workers ctx：控制器用它做 waitUntil（如阅读数自增、勋章结算等非关键路径写） */
        ctx,
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

    /* query 惰性解析：业务接口绝大多数为 POST JSON，不读 query，
       这里改成首次访问时才构造对象，避免每个请求都做一次 entries() 遍历 */
    let queryCache;
    Object.defineProperty(req, 'query', {
        enumerable: true,
        get() {
            return queryCache ??= Object.fromEntries(url.searchParams.entries());
        },
    });

    return req;
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

function withCors(response, origin) {
    /* 无 Origin（服务端/同源请求）不需要任何 CORS 头，直接返回原响应 */
    if (!origin) return response;
    /* 这里的响应均由 Worker 自行构造（Response.json / new Response），headers 可写，
       直接原地修改即可，无需 new Headers() + new Response() 克隆（会多包一层流） */
    const headers = response.headers;
    headers.set('Vary', 'Origin');
    /* 仅回显白名单内的来源，避免任意站点携带凭证读取响应 */
    if (isOriginAllowed(origin)) {
        headers.set('Access-Control-Allow-Origin', origin);
        headers.set('Access-Control-Allow-Credentials', 'true');
    }
    headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'usertoken,admintoken,Content-Type');
    return response;
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

// 从 R2 提供上传文件（带 Cache API 边缘缓存：上传内容不可变，文件名即版本）
async function serveUpload(request, path, url, origin, ctx) {
    const filename = path.replace('/public/upload/', '');
    if (!filename) return withCors(new Response('Not Found', { status: 404 }), origin);

    /* 仅 GET 走缓存；命中时省掉一次 R2 读 */
    const cache = request.method === 'GET' ? caches.default : null;
    const cacheKey = cache ? new Request(`${url.origin}${path}`, { method: 'GET' }) : null;

    if (cache) {
        /* 缓存读失败不影响主流程，直接回源 R2 */
        try {
            const hit = await cache.match(cacheKey);
            if (hit) {
                /* cache.match 返回的 Response headers 为 immutable，需重建后再追加 CORS 头 */
                return withCors(new Response(hit.body, {
                    status: hit.status,
                    headers: new Headers(hit.headers)
                }), origin);
            }
        } catch (error) {
            console.error('读取上传文件缓存失败:', error);
        }
    }

    const object = await global.R2.get(`upload/${filename}`);
    if (!object) return withCors(new Response('Not Found', { status: 404 }), origin);

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000');
    // 防止浏览器嗅探类型导致上传文件被当作 HTML 执行
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Content-Disposition', `inline; filename="${filename.replace(/["\\\r\n]/g, '')}"`);
    const response = new Response(object.body, { headers });

    /* 缓存「未加 CORS 头」的副本：不同 Origin 各自回显，避免跨源串味 */
    if (cache) ctx.waitUntil(cache.put(cacheKey, response.clone()).catch(() => {}));
    return withCors(response, origin);
}

export default {
    async fetch(request, env, ctx) {
        /* 只读取一次 Origin，后续 CORS 处理直接复用字符串 */
        const origin = request.headers.get('origin');
        try {
            await ensureInit(env);
        } catch (error) {
            console.error('初始化失败:', error);
            return withCors(Response.json({ code: 500, msg: '服务器内部错误', data: {}, total: 0 }), origin);
        }

        // CORS 预检（必须在 ensureInit 之后，确保冷启动时 global.CORS_ORIGINS 已注入）
        if (request.method.toUpperCase() === 'OPTIONS') {
            return withCors(new Response(null, { status: 204 }), origin);
        }

        const method = request.method.toUpperCase();
        /* URL 只解析一次，同时供路由匹配与 buildRequest 使用 */
        const url = new URL(request.url);
        const path = url.pathname;

        // 上传文件走 R2（读取 R2 可能失败，需兜底为统一错误响应，避免异常外泄）
        if (path.startsWith('/public/upload/')) {
            try {
                return await serveUpload(request, path, url, origin, ctx);
            } catch (error) {
                console.error('读取上传文件失败:', error);
                return withCors(Response.json({ code: 500, msg: '服务器内部错误', data: {}, total: 0 }), origin);
            }
        }

        const byPath = routeMap.get(method);
        const route = byPath && byPath.get(path);

        if (!route) {
            return withCors(Response.json({ code: 400, msg: '访问路径错误', data: {}, total: 0 }, { status: 404 }), origin);
        }

        const reply = new Reply();

        try {
            const req = await buildRequest(request, url, ctx);
            for (const mw of route.middlewares) {
                await mw(req, reply);
                if (reply.sent) return withCors(reply.response, origin);
            }

            // 中间件通过后再加载控制器模块：被鉴权拦下的请求不触发模块初始化
            const controller = await loadController(route.controllerPath);
            const handler = controller.default[route.methodName];
            if (!handler) throw new Error(`控制器方法不存在: ${route.controllerPath}@${route.methodName}`);
            await handler(req, reply);

            if (reply.sent) return withCors(reply.response, origin);
            return withCors(Response.json({ code: 500, msg: '服务器未返回响应', data: {}, total: 0 }), origin);
        } catch (error) {
            console.error('请求处理错误:', error);
            return withCors(Response.json({ code: 500, msg: '服务器内部错误', data: {}, total: 0 }), origin);
        }
    },
};
