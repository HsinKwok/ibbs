/**
 * 轻量 HTML 白名单消毒器（零依赖，可在 Cloudflare Workers / Node 运行）
 * 用于净化用户提交的富文本（帖子正文、评论、举报内容等），防止存储型 XSS。
 * 说明：这不是 DOMPurify 的完全替代品，仅覆盖论坛富文本所需的常见标签与属性。
 */

/* 允许保留的标签白名单 */
const ALLOWED_TAGS = new Set([
    'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'cite', 'code', 'col',
    'colgroup', 'dd', 'del', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'ins', 'kbd', 'li',
    'mark', 'ol', 'p', 'pre', 'q', 's', 'small', 'span', 'strong', 'sub', 'sup',
    'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
    'audio', 'video', 'source'
]);

/* 允许保留的属性白名单 */
const ALLOWED_ATTRS = new Set([
    'href', 'src', 'alt', 'title', 'class', 'style',
    'width', 'height', 'colspan', 'rowspan', 'align', 'valign',
    /* 注意：rel 不在白名单内——用户自带的 rel（如 rel="opener"）会被丢弃，
       _blank 外链的安全 rel 由 filterAttrs 在 target 分支统一写入，避免重复属性被浏览器取首个而绕过 noopener */
    'target', 'type', 'start', 'cite', 'datetime',
    'controls', 'poster', 'preload', 'loop', 'muted', 'autoplay'
]);

/* 需要校验协议（防止 javascript: 等）的属性 */
const URL_ATTRS = new Set(['href', 'src', 'poster', 'cite']);

/* 直接删除（连同内容）的危险标签 */
const DROP_WITH_CONTENT = 'script|style|iframe|object|embed|applet|meta|link|base|noscript|template|svg|math|form|input|button|textarea|select|option';

/* 预编译危险标签正则：避免每次消毒都 new RegExp 构造（replace 会重置 lastIndex，可安全复用） */
const DROP_WITH_CONTENT_RE = new RegExp(`<\\s*(${DROP_WITH_CONTENT})\\b[\\s\\S]*?<\\s*\\/\\s*\\1\\s*>`, 'gi');
const DROP_TAG_RE = new RegExp(`<\\s*\\/?\\s*(${DROP_WITH_CONTENT})\\b[^>]*>`, 'gi');

/* 校验 URL 是否安全 */
function isUnsafeUrl(url) {
    const v = String(url)
        .replace(/[\u0000-\u0020\u00a0\u2028\u2029]/g, '')
        .toLowerCase();
    if (v.startsWith('javascript:') || v.startsWith('vbscript:')) return true;
    /* data: 仅允许位图类型，避免 data:text/html、data:image/svg+xml（可通过 <a> 点击执行脚本）等伪协议 */
    if (v.startsWith('data:')) return !/^data:image\/(?:png|jpe?g|gif|webp|bmp|avif|ico|x-icon)[;,]/i.test(v);
    return false;
}

/* HTML 命名实体映射（仅覆盖可能用于绕过协议校验的符号与控制字符） */
const NAMED_ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
    colon: ':', tab: '\t', newline: '\n', sol: '/', lpar: '(', rpar: ')',
    num: '#', percnt: '%', quest: '?', equals: '=', period: '.', comma: ','
};

function fromCodePoint(code) {
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
}

/* 解码 HTML 实体：属性值由 HTML 解析器做实体解码，需先还原再校验协议，避免 `javascript&#58;` 绕过 */
function decodeEntities(str) {
    return String(str)
        .replace(/&#x([0-9a-f]{1,6});?/gi, (_, hex) => fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d{1,7});?/g, (_, dec) => fromCodePoint(parseInt(dec, 10)))
        .replace(/&([a-z]+);/gi, (m, name) => {
            const key = name.toLowerCase();
            return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, key) ? NAMED_ENTITIES[key] : m;
        });
}

/* 转义属性值，避免破坏标签结构；先转义 & 以中和残留的实体编码 */
function escapeAttr(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/* 过滤单个标签上的属性串 */
function filterAttrs(attrStr) {
    let result = '';
    const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    let m;
    while ((m = re.exec(attrStr)) !== null) {
        const name = m[1].toLowerCase();
        const raw = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : '';
        /* 先解码实体，再做安全校验与输出转义（解码后重新转义，可保证合法 URL 往返一致） */
        const value = decodeEntities(raw);

        if (name.startsWith('on')) continue;          /* 事件处理器一律丢弃 */
        if (!ALLOWED_ATTRS.has(name)) continue;       /* 非白名单属性丢弃 */
        if (URL_ATTRS.has(name) && isUnsafeUrl(value)) continue;
        if (name === 'style' && /expression\s*\(|javascript:|vbscript:/i.test(value)) continue;
        if (name === 'target' && value !== '_blank' && value !== '_self') continue;

        result += ` ${name}="${escapeAttr(value)}"`;
        /* 新窗口打开的外链补 noopener */
        if (name === 'target' && value === '_blank') result += ' rel="noopener noreferrer"';
    }
    return result;
}

/**
 * 消毒 HTML 字符串
 * @param {string} html 原始 HTML
 * @returns {string} 消毒后的 HTML
 */
export default function Sanitize(html) {
    if (typeof html !== 'string' || html === '') return html;

    let out = html;

    /* 1. 去掉 HTML 注释（含条件注释），覆盖 HTML5 的多种闭合形式：
       --> 、--!> 以及突兀闭合的 <!--> 与 <!---> */
    out = out.replace(/<!--(?:>|->|[\s\S]*?(?:--!?>|$))/g, '');

    /* 2. 删除危险标签及其内容 */
    out = out.replace(DROP_WITH_CONTENT_RE, '');

    /* 3. 删除残留的自闭合/未闭合危险标签 */
    out = out.replace(DROP_TAG_RE, '');

    /* 4. 按白名单处理剩余标签（非白名单标签仅去除标签、保留文本）
       注意：
       - 结尾允许 `>` 或字符串结束，确保未闭合标签（如 <img src=x onerror=alert(1)）也能进入属性过滤，
         否则浏览器在 EOF 自动补齐标签会导致 on* 事件/伪协议绕过白名单。
       - 属性段允许“成对引号”（使引号内可含 `>`）或“任意非 `>` 字符”（容纳孤立引号，如 <img src=x' onerror=...>）。
         若只接受成对引号，攻击者用未配对引号即可让整条正则匹配失败、属性过滤被跳过。 */
    out = out.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>])*(?:>|$))/g, (match, slash, tagName, attrStr) => {
        const tag = tagName.toLowerCase();
        if (!ALLOWED_TAGS.has(tag)) return '';
        if (slash === '/') return `</${tag}>`;
        return `<${tag}${filterAttrs(attrStr)}>`;
    });

    return out;
}
