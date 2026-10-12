// 后台路由鉴权：未登录时直接跳转到登录页，避免先渲染后台布局再跳转
import { getAdminBase } from '../utils/adminPath'

export default defineNuxtRouteMiddleware((to) => {
  // 后台路由由 router.options 注入 meta.admin 标记
  if (!to.matched.some((r) => r.meta?.admin)) return
  // 登录页本身放行
  if (to.matched.some((r) => r.meta?.adminLogin)) return

  const token = useCookie('AToken').value
  if (!token) {
    return navigateTo(getAdminBase() + '/login')
  }
})
