import { tryUseNuxtApp } from '#imports'

/* 本地开发默认后端地址（wrangler dev 默认端口） */
const DEFAULT_API_BASE = 'http://127.0.0.1:8787'

/*
 * 后端 API 地址：运行时读取 Nuxt runtimeConfig.public.apiBase，
 * 部署时通过环境变量 NUXT_PUBLIC_API_BASE 覆盖（见 nuxt.config.ts）。
 * 在无 Nuxt 上下文（如路由初始化早期）时回退到默认地址。
 * 注意：不能在此直接读 process.env，客户端不会内联该值且会导致 process 未定义。
 */
export default {
    get apiBase() {
        return tryUseNuxtApp()?.$config?.public?.apiBase || DEFAULT_API_BASE
    }
}
