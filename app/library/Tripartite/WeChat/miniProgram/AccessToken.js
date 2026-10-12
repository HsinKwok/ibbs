/* 获取AccessToken */
/* access_token 有效期 7200s，缓存 7000s（留 200s 刷新余量）复用，
   避免每次调用都请求微信接口，降低延迟与配额消耗。
   返回值统一为：成功返回字符串 token，失败返回 null（调用方只需判空） */
const ACCESS_TOKEN_CACHE_KEY = 'wechat:miniProgram:access_token'
const ACCESS_TOKEN_CACHE_TTL = 7000

export const getAccessToken = async () => {
    try {
        /* 获取系统配置（缓存 key 需按 appid 隔离，避免多小程序配置切换时 token 串号） */
        const config = await global.Tools.getConfig()
        const appid = config[0].n_wechat_miniProgram_appid
        const secret = config[0].n_wechat_miniProgram_secret
        const cacheKey = `${ACCESS_TOKEN_CACHE_KEY}:${appid}`

        /* 优先读取缓存；KV 未就绪（global.RedisUtils 为空）时降级为直接请求 */
        if (global.RedisUtils) {
            const cached = await global.RedisUtils.getCache(cacheKey)
            if (cached && cached.access_token) return cached.access_token
        }

        const res = await fetch(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`)
        const data = await res.json()
        if (data.access_token) {
            /* 仅在成功后写入缓存，失败结果不缓存，避免错误长时间滞留 */
            if (global.RedisUtils) {
                await global.RedisUtils.setCache(cacheKey, { access_token: data.access_token }, ACCESS_TOKEN_CACHE_TTL)
            }
            return data.access_token
        }
        /* 未返回 access_token：记录微信侧错误码/原因，返回 null 以保持返回类型一致 */
        console.log('获取AccessToken失败:', data && (data.errmsg || `errcode=${data.errcode}`))
        return null
    } catch (error) {
        console.log('获取AccessToken失败:', error instanceof Error ? error.message : String(error))
        return null
    }
}
