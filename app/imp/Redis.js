// 缓存层（Cloudflare Workers KV）
// 接口签名与旧版保持一致，上层调用无需改动；底层从 Redis 切换为 Workers KV。
let kvInstance = null;

// 初始化 KV（传入 Workers KV 绑定 env.KV）
export async function initRedis(kvBinding) {
    if (!kvBinding) {
        throw new Error('未提供 KV 绑定（env.KV）');
    }
    kvInstance = kvBinding;
    return kvInstance;
}

// 获取 KV 实例
export function getRedis() {
    if (!kvInstance) {
        throw new Error('KV 尚未初始化，请先调用 initRedis()');
    }
    return kvInstance;
}

// KV 的 expirationTtl 最小为 60 秒
function normalizeTtl(ttlSeconds) {
    const t = Math.floor(ttlSeconds);
    /* NaN/Infinity 或小于最小值时统一回落到 60，避免写入非法 expirationTtl */
    return (!Number.isFinite(t) || t < 60) ? 60 : t;
}

/**
 * 获取或设置缓存
 */
export async function getOrSetCache(key, ttlSeconds, fetchFunction) {
    const kv = getRedis();
    /* 读缓存失败不影响主流程，降级为直接取源数据 */
    try {
        const cached = await kv.get(key);
        if (cached !== null && cached !== undefined) {
            return JSON.parse(cached);
        }
    } catch (error) {
        console.error(`读取缓存失败 [key: ${key}]:`, error);
    }

    /* fetchFunction 只执行一次；其结果无论写入是否成功都作为返回值 */
    const freshData = await fetchFunction();
    try {
        await kv.put(key, JSON.stringify(freshData), { expirationTtl: normalizeTtl(ttlSeconds) });
    } catch (error) {
        console.error(`写入缓存失败 [key: ${key}]:`, error);
    }
    return freshData;
}

/* ===== 进程内内存缓存 =====
 * 热点只读接口（分类 / 轮播 / 公告）每次请求都查 KV 或 D1 成本较高：
 * KV 有每日写入额度，D1 有读行额度。Worker isolate 内复用内存可把
 * 大部分读请求挡在回源之前，且不产生任何外部调用。
 * 说明：仅缓存全站公共数据，不含用户态；isolate 回收后自动失效。 */
const memoryCache = new Map();
const memoryInflight = new Map();
const MEMORY_MAX_ENTRIES = 500;

/**
 * 获取或设置内存缓存（并发未命中时合并为一次回源）
 * @param {string} key 缓存键
 * @param {number} ttlSeconds 有效期（秒）
 * @param {() => Promise<any>} fetchFunction 回源函数
 */
export async function getOrSetMemoryCache(key, ttlSeconds, fetchFunction) {
    const now = Date.now();
    const hit = memoryCache.get(key);
    if (hit && hit.expire > now) return hit.value;

    const pending = memoryInflight.get(key);
    if (pending) return pending;

    const promise = (async () => {
        try {
            const value = await fetchFunction();
            memoryCache.set(key, { value, expire: Date.now() + ttlSeconds * 1000 });
            /* 简单容量保护：超限时按插入顺序淘汰最早的一条 */
            if (memoryCache.size > MEMORY_MAX_ENTRIES) {
                const oldest = memoryCache.keys().next().value;
                memoryCache.delete(oldest);
            }
            return value;
        } finally {
            memoryInflight.delete(key);
        }
    })();
    memoryInflight.set(key, promise);
    return promise;
}

/**
 * 按前缀清理内存缓存（写操作后调用，避免后台改完仍读到旧数据）
 */
export function clearMemoryCache(prefix = '') {
    let removed = 0;
    for (const key of memoryCache.keys()) {
        if (!prefix || key.startsWith(prefix)) {
            memoryCache.delete(key);
            removed++;
        }
    }
    return removed;
}

/**
 * 设置缓存
 */
export async function setCache(key, value, ttlSeconds = 3600) {
    const kv = getRedis();
    try {
        await kv.put(key, JSON.stringify(value), { expirationTtl: normalizeTtl(ttlSeconds) });
        return true;
    } catch (error) {
        console.error(`设置缓存失败 [key: ${key}]:`, error);
        return false;
    }
}

/**
 * 获取缓存
 */
export async function getCache(key) {
    const kv = getRedis();
    try {
        const cached = await kv.get(key);
        return cached !== null && cached !== undefined ? JSON.parse(cached) : null;
    } catch (error) {
        console.error(`获取缓存失败 [key: ${key}]:`, error);
        return null;
    }
}

/**
 * 删除缓存
 */
export async function deleteCache(keys) {
    const kv = getRedis();
    try {
        const keyList = Array.isArray(keys) ? keys : [keys];
        await Promise.all(keyList.map(k => kv.delete(k)));
        return keyList.length;
    } catch (error) {
        console.error(`删除缓存失败 [keys: ${keys}]:`, error);
        return 0;
    }
}

/**
 * 检查缓存是否存在
 */
export async function existsCache(key) {
    const kv = getRedis();
    try {
        return (await kv.get(key)) !== null;
    } catch (error) {
        console.error(`检查缓存存在性失败 [key: ${key}]:`, error);
        return false;
    }
}

/**
 * 设置缓存过期时间（KV 无单独改 TTL 的能力，需重新写入）
 */
export async function expireCache(key, ttlSeconds) {
    const kv = getRedis();
    try {
        const value = await kv.get(key);
        if (value === null) return false;
        await kv.put(key, value, { expirationTtl: normalizeTtl(ttlSeconds) });
        return true;
    } catch (error) {
        console.error(`设置过期时间失败 [key: ${key}]:`, error);
        return false;
    }
}

/**
 * 获取缓存剩余过期时间（KV 不直接暴露 TTL）
 */
export async function getCacheTTL(key) {
    const kv = getRedis();
    try {
        return (await kv.get(key)) !== null ? -1 : -2;
    } catch (error) {
        console.error(`获取缓存TTL失败 [key: ${key}]:`, error);
        return -2;
    }
}

/**
 * 清空所有缓存（KV 无整体清空，需列出并逐个删除）
 */
export async function flushDatabase() {
    const kv = getRedis();
    try {
        let cursor;
        do {
            const list = await kv.list(cursor ? { cursor } : {});
            await Promise.all(list.keys.map(k => kv.delete(k.name)));
            cursor = list.list_complete ? undefined : list.cursor;
        } while (cursor);
        return true;
    } catch (error) {
        console.error('清空缓存失败:', error);
        return false;
    }
}

// 默认导出初始化函数
export default initRedis;
