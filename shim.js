// Cloudflare Workers 运行时垫片：确保 `global` 可用（Node 风格全局对象）
if (typeof global === 'undefined') {
    globalThis.global = globalThis;
}
