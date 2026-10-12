// utils/sanitize.js
/**
 * 前端统一 HTML 清洗。
 * 用于所有 v-html / innerHTML 富文本出口，防止存储型 XSS。
 * - 客户端：DOMPurify（浏览器原生 DOM，强度最高）。
 * - 服务端（SSR / Cloudflare Workers）：无原生 DOM，回落零依赖白名单消毒器
 *   utils/sanitize-ssr.js（与后端 app/imp/Sanitize.js 逻辑一致），
 *   不引入 jsdom / linkedom 等 DOM 模拟依赖。
 * 两端白名单保持一致，避免前后端渲染差异。
 */
import DOMPurify from 'dompurify'
import Sanitize from './sanitize-ssr.js'

/* 允许保留的标签白名单（与后端一致） */
const ALLOWED_TAGS = [
  'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'cite', 'code', 'col',
  'colgroup', 'dd', 'del', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'ins', 'kbd', 'li',
  'mark', 'ol', 'p', 'pre', 'q', 's', 'small', 'span', 'strong', 'sub', 'sup',
  'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
  'audio', 'video', 'source',
]

/* 允许保留的属性白名单（与后端一致）
   注意：rel 不在此列——_blank 外链的安全 rel 由 harden 钩子统一写入，
   与 SSR 消毒器 filterAttrs 的处理保持一致，避免两端输出差异导致水合不一致 */
const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'class', 'style',
  'width', 'height', 'colspan', 'rowspan', 'align', 'valign',
  'target', 'type', 'start', 'cite', 'datetime',
  'controls', 'poster', 'preload', 'loop', 'muted', 'autoplay',
]

const CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  KEEP_CONTENT: true,
  /* 仅允许安全协议；data: 只放行图片，避免 data:text/html 之类的伪协议，白名单与 SSR 对齐 */
  ALLOWED_URI_REGEXP: /^(?:(?:https?|ftp|mailto|tel|callto|sms):|data:image\/(?:png|jpe?g|gif|webp|bmp|avif|ico|x-icon)[;,]|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
}

/* 新窗口打开的外链补 rel，避免反向 tabnabbing */
function harden(purify) {
  purify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
      node.setAttribute('rel', 'noopener noreferrer')
    }
  })
  return purify
}

/* 客户端 DOMPurify 实例（仅在浏览器、且 DOMPurify 可用时启用） */
let clientPurifier = null
function pickClientPurifier() {
  if (typeof window !== 'undefined' && DOMPurify.isSupported) {
    if (!clientPurifier) clientPurifier = harden(DOMPurify)
    return clientPurifier
  }
  return null
}

/**
 * 清洗 HTML 字符串
 * @param {string} html 原始 HTML
 * @returns {string} 清洗后的 HTML
 */
export function sanitizeHtml(html) {
  if (typeof html !== 'string' || html === '') return html ?? ''
  const purify = pickClientPurifier()
  /* 客户端用 DOMPurify；SSR / 无 DOM 环境回落零依赖消毒器 */
  if (purify) return purify.sanitize(html, CONFIG)
  return Sanitize(html)
}
