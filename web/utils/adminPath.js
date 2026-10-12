/* 后台入口路径工具：统一后台路径前缀的校验与获取 */

/* 默认后台入口段（与 pages/admin 目录一致） */
export const DEFAULT_ADMIN_SEGMENT = 'admin'

/* 基础校验：去空格、去首尾斜杠、去除非字母数字/下划线/连字符的字符，得到单段安全路径 */
export function normalizeAdminSegment(input) {
  if (!input) return ''
  const value = String(input).trim()
  // 兼容历史数据：空值可能被存为字符串 "null"/"undefined"，一律视为默认入口
  if (value === 'null' || value === 'undefined') return ''
  return value
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
}

/*
 * 根路径已被占用的段名：框架内置路径、public 静态资源、前台已有顶级路由。
 * 后台入口不可与之重名，否则会与现有页面/资源冲突导致访问异常。
 */
const RESERVED_SEGMENTS = new Set([
  // 框架/构建内置
  '_nuxt', '_ipx', '__nuxt', 'api',
  // public 静态资源目录
  'avatars',
  // 前台已有顶级路由（pages 目录）
  'login', 'user', 'class', 'market', 'follow', 'images', 'uplist', 'error', 'index'
])

/* 判断归一化后的入口段是否与根路径已有名称冲突 */
export function isReservedAdminSegment(input) {
  const seg = normalizeAdminSegment(input)
  if (!seg) return false
  return RESERVED_SEGMENTS.has(seg.toLowerCase())
}

/* 由配置段得到后台访问前缀：留空或与已有路径冲突时回退默认 /admin */
export function adminBaseFromSegment(segment) {
  const seg = normalizeAdminSegment(segment)
  if (!seg || isReservedAdminSegment(seg)) return '/' + DEFAULT_ADMIN_SEGMENT
  return '/' + seg
}

/* 当前运行时后台前缀，由 router.options 在路由重建时写入，供各组件/中间件读取 */
let currentAdminBase = '/' + DEFAULT_ADMIN_SEGMENT

export function setAdminBase(base) {
  currentAdminBase = base || '/' + DEFAULT_ADMIN_SEGMENT
}

export function getAdminBase() {
  return currentAdminBase
}
