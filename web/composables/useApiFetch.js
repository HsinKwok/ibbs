// composables/useApiFetch.js
import Config from '../app-config.js'
import { getAdminBase } from '../utils/adminPath'

/* 判定当前是否处于后台路由：
   在 setup / 生命周期钩子内组件实例存在，优先用 useRoute() 精确判断；
   在事件回调、await 之后等脱离组件实例的场景，useRoute()（inject）会失效并返回 undefined，
   此时回退为按当前 URL 是否位于后台前缀下判断，避免 isAdmin 误判为 false 而丢失 admintoken */
function isAdminRoute() {
  if (getCurrentInstance()) {
    const route = useRoute()
    return route?.matched?.some((r) => r.meta?.admin) ?? false
  }
  if (typeof window === 'undefined') return false
  const base = getAdminBase()
  const path = window.location.pathname
  return path === base || path.startsWith(base + '/')
}

export function useApiFetch(options = {}) {
  /* options.admin === true 时强制使用管理员令牌（AToken）：
     用于前台页面调用挂载在 ATokenVar 路由组的管理员接口（如公告编辑/删除） */
  const isAdmin = options.admin === true ? true : isAdminRoute()
  const token = useCookie(isAdmin ? 'AToken' : 'UToken').value
  const apiBase = Config.apiBase

  const toUrlEncoded = (obj) =>
    Object.keys(obj)
      /* 跳过 null/undefined，避免把 'undefined' 当作业务值发送 */
      .filter((key) => obj[key] !== undefined && obj[key] !== null)
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`)
      .join('&')

  const request = async (method, url, data = {}, headers = {}) => {
    /* 统一处理 401：
       后台一律回登录页；
       前台仅在「本次请求带了 token 但仍被拒绝」时判定为凭证失效，清理并回登录页；
       匿名访问公开接口的 401 属正常情况，保留给调用方决定（如提示登录）。
       返回 navigateTo 的 Promise 并由调用方 await，保证 SSR 下重定向能真正完成。 */
    const handleUnauthorized = () => {
      if (isAdmin) {
        return navigateTo(getAdminBase() + '/login')
      } else if (token && typeof window !== 'undefined') {
        /* 仅客户端处理，避免 SSR 期间 navigateTo 中断整页渲染 */
        useCookie('UToken').value = null
        return navigateTo('/login')
      }
    }

    let res
    try {
      res = await $fetch(apiBase + url, {
        method,
        query: method === 'GET' ? data : undefined,
        body: method === 'POST' ? toUrlEncoded(data) : undefined,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...(token ? { [isAdmin ? 'admintoken' : 'usertoken']: token } : {}),
          ...headers,
        }
      })
    } catch (e) {
      if (e?.response?.status === 401) {
        await handleUnauthorized()
      }
      return e?.data ?? e
    }
    /* body 中携带的 401（HTTP 200）需在 try 之外处理：
       handleUnauthorized 内的 navigateTo 在 SSR 下会抛出重定向异常，
       若留在 try 内会被上面的 catch 吞掉，导致后台页以空数据继续渲染 */
    if (res && res.code == 401) {
      await handleUnauthorized()
    }
    return res
  }

  return {
    get: (url, data = {}, headers = {}) => request('GET', url, data, headers),
    post: (url, data = {}, headers = {}) => request('POST', url, data, headers),
  }
}
