// composables/useAdminWebConfig.js

/* 后台配置页共用的 /api/getweb：
   站点配置整行有几十个字段，站点/邮件/用户/小程序/市场说明等页面都各自整行重拉一次；
   后台是同一会话内的 SPA 切换，首次拉取后复用即可。
   - 并发去重：多页同时请求只发一次
   - 保存配置后调用 invalidate()，下次进入配置页重新拉取
   - 仅客户端缓存：调用方都在 onMounted，避免 Worker 模块级缓存跨请求复用 */

let cache = null
let inflight = null

export function useAdminWebConfig() {
  const fetchConfig = async () => {
    const res = await useApiFetch().post('/api/getweb')
    if (res.code !== 200) return { code: res.code, msg: res.msg }
    cache = res.data || {}
    /* 返回浅拷贝：调用方会直接改动表单，不能污染缓存 */
    return { code: 200, msg: res.msg, data: { ...cache } }
  }

  const loadConfig = async () => {
    if (!import.meta.client) return fetchConfig()
    if (cache) return { code: 200, data: { ...cache } }
    if (!inflight) inflight = fetchConfig().finally(() => { inflight = null })
    return await inflight
  }

  /* 配置已被修改：让下一次进入配置页重新拉取 */
  const invalidate = () => { cache = null }

  return { loadConfig, invalidate }
}
