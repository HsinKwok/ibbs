import { DEFAULT_ADMIN_SEGMENT, adminBaseFromSegment, setAdminBase } from '../utils/adminPath.js'
import { loadWebInfo } from '../utils/siteConfig.js'

/*
 * 运行时后台入口：在路由初始化时读取站点配置中的 n_admin_path，
 * 把文件路由里的 /admin 前缀改写成自定义前缀；留空时保持默认 /admin。
 * 改写后原 /admin 不再存在，访问将得到 404。
 */

const BASE = '/' + DEFAULT_ADMIN_SEGMENT

/* 读取后台入口段；请求本身由 siteConfig 统一缓存/去重，避免与 app.vue 重复拉取 */
async function fetchAdminSegment() {
  try {
    const res = await loadWebInfo()
    return (res && res.code === 200 && res.data && res.data.n_admin_path) || ''
  } catch (e) {
    return ''
  }
}

function rewritePath(path, base, custom) {
  if (typeof path !== 'string' || !path) return path
  if (path === base) return custom
  if (path.startsWith(base + '/')) return custom + path.slice(base.length)
  return path
}

function isAdminPath(path, base) {
  return path === base || (typeof path === 'string' && path.startsWith(base + '/'))
}

/*
 * 返回改写后的路由副本。
 * 注意：_routes 是模块级单例、跨请求共享，绝不能原地修改，
 * 否则自定义入口一旦写入就无法再还原为默认 /admin。
 */
function transform(routes, base, custom) {
  return routes.map((route) => {
    const next = { ...route }
    const original = route.path
    if (isAdminPath(original, base)) {
      next.meta = { ...(route.meta || {}), admin: true }
      // 登录页放行标记，供鉴权中间件识别
      if (original === base + '/login') {
        next.meta.adminLogin = true
      }
    }
    if (next.path) {
      next.path = rewritePath(next.path, base, custom)
    }
    if (next.alias) {
      const list = Array.isArray(route.alias) ? route.alias : [route.alias]
      next.alias = list.map((alias) => rewritePath(alias, base, custom))
    }
    if (typeof next.redirect === 'string') {
      next.redirect = rewritePath(next.redirect, base, custom)
    }
    if (next.children && next.children.length) {
      next.children = transform(next.children, base, custom)
    }
    return next
  })
}

export default {
  async routes(_routes) {
    const segment = await fetchAdminSegment()
    const custom = adminBaseFromSegment(segment)
    setAdminBase(custom)
    // 始终基于原始 _routes 生成副本：默认时保留 /admin，自定义时改写前缀
    return transform(_routes, BASE, custom)
  }
}
