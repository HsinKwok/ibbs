import Config from '../app-config.js'

/*
 * 站点配置（/api/webinfo）统一入口。
 *
 * 一次 SSR 渲染里，router.options 解析路由和 app.vue 挂载都会需要站点配置，
 * 两处各自请求会产生重复的子请求。这里用模块级短缓存 + 并发去重，
 * 让同一次渲染（以及紧接着的请求）复用同一份结果。
 *
 * 站点配置是全站公共数据、不含用户态，短时缓存安全；
 * 后端自身也有 10s 配置缓存，这里保持同样的 10s 让配置改动及时生效。
 */
const CACHE_TTL = 10 * 1000

let cache = { data: null, time: 0 }
let inflight = null

export async function loadWebInfo() {
  const now = Date.now()
  if (cache.data && now - cache.time < CACHE_TTL) return cache.data
  if (inflight) return inflight

  inflight = (async () => {
    try {
      const res = await $fetch(Config.apiBase + '/api/webinfo', { method: 'POST' })
      if (res && res.code === 200) {
        cache = { data: res, time: Date.now() }
      }
      return res
    } catch (e) {
      /* 拉取失败时沿用最后一次成功结果，避免整站因瞬时错误跳错误页 */
      return cache.data || null
    } finally {
      inflight = null
    }
  })()

  return inflight
}
