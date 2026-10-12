// 前台需登录路由鉴权：未登录时直接跳转到登录页
// 避免进入页面后在校验回调里调用客户端 API（如 Message.error，SSR 无 document 会报错）
const PROTECTED_PREFIXES = ['/user', '/threadInfo']

export default defineNuxtRouteMiddleware((to) => {
  // 后台路由由 admin-auth.global.js 处理
  if (to.matched.some((r) => r.meta?.admin)) return

  const needAuth = PROTECTED_PREFIXES.some(
    (p) => to.path === p || to.path.startsWith(p + '/')
  )
  if (!needAuth) return

  const token = useCookie('UToken').value
  if (!token) {
    return navigateTo('/login')
  }
})
