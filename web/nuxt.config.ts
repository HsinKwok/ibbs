
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ArcoResolver } from 'unplugin-vue-components/resolvers'

export default defineNuxtConfig({
  imports: {
    dirs: ['composables']
  },
  compatibilityDate: '2025-05-15',
  compatibilityVersion: 4,
  devtools: false,
  devServer: {
    host: '0.0.0.0',
    port: 3000,
  },
  css: [
    '@arco-design/web-vue/dist/arco.css',  // Arco Design 官方样式
    '~/main.css',  // 自定义样式
  ],
  modules: ['@pinia/nuxt'],
  /* 插件由 Nuxt 自动扫描 plugins/ 目录注册（arco 图标等），无需显式列出避免重复注册 */
  /* 生产构建目标：Cloudflare Workers（SSR）。构建产物输出到 .output/，
     部署时由 nitro 基于 web/wrangler.jsonc 生成 .output/server/wrangler.json */
  nitro: {
    preset: 'cloudflare_module',
    cloudflare: {
      /* 本地构建也生成 wrangler 配置，便于直接 npx wrangler deploy */
      deployConfig: true,
    },
  },
  hooks: {
    /* nitro 在 Windows 上生成 wrangler 配置时用的是 node:path 的 relative()，
       会把路径分隔符写成反斜杠（如 ..\public），导致产物在 Linux/CI 部署时不可用。
       这里在 nitro 写完配置后统一转成正斜杠。 */
    'nitro:init'(nitro: any) {
      nitro.hooks.hook('compiled', (n: any) => {
        const normalize = (file: string, mutate: (cfg: any) => void) => {
          if (!existsSync(file)) return
          const cfg = JSON.parse(readFileSync(file, 'utf8'))
          mutate(cfg)
          writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n')
        }
        normalize(join(n.options.output.serverDir, 'wrangler.json'), (cfg) => {
          if (typeof cfg.assets?.directory === 'string') {
            cfg.assets.directory = cfg.assets.directory.replace(/\\/g, '/')
          }
        })
        normalize(join(n.options.rootDir, '.wrangler/deploy/config.json'), (cfg) => {
          if (typeof cfg.configPath === 'string') {
            cfg.configPath = cfg.configPath.replace(/\\/g, '/')
          }
        })
      })
    },
  },
  /* 边缘缓存：前台公开页内容数据均在 onMounted 拉取，SSR 产物是匿名壳，
     用 SWR 缓存可显著减少 Worker 渲染次数；用户中心 / 登录页不做缓存。
     注意：pages/index.vue 是根级父布局，前台页面的实际路径都挂在根下（如 /class、/threads/1） */
  routeRules: {
    '/_nuxt/**': {
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
    },
    '/': { swr: 60 },
    '/class': { swr: 60 },
    '/follow': { swr: 60 },
    '/images': { swr: 60 },
    '/market': { swr: 60 },
    '/uplist': { swr: 60 },
    '/threads/**': { swr: 60 },
    '/plate/**': { swr: 60 },
    '/topic/**': { swr: 60 },
    '/threadInfo/**': { swr: 60 },
    '/upinfo/**': { swr: 60 },
    '/user/**': { swr: false },
    '/login': { swr: false },
  },
  runtimeConfig: {
    public: {
      /* 后端 API 地址：部署时用环境变量 NUXT_PUBLIC_API_BASE 覆盖 */
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://127.0.0.1:8787',
      /* hCaptcha 站点密钥（公开值）：留空则不渲染验证码组件，部署时用 NUXT_PUBLIC_HCAPTCHA_SITE_KEY 覆盖 */
      hcaptchaSiteKey: process.env.NUXT_PUBLIC_HCAPTCHA_SITE_KEY || '',
    },
  },
  app: {
    pageTransition: {
      name: 'page',
      mode: 'out-in', // 等待当前页面过渡完成再进入新页面
    },
    head: {
      meta: [
        {
          name: 'viewport',
          content:
            'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
        }
      ]
    }
  },
  vite: {
    plugins: [
      AutoImport({
        // 这里可以配置你自动导入的内容
        imports: [
          'vue',
          'vue-router',
          'vue/macros',
          '@vueuse/core',
        ],
        resolvers: [ArcoResolver()],
        dts: 'auto-imports.d.ts', // 生成自动导入类型声明文件
      }),
      Components({
        resolvers: [
          ArcoResolver({
            sideEffect: true,
          }),
        ],
        dts: 'components.d.ts', // 生成组件类型声明文件
      }),
    ],
    ssr: {
      noExternal: ['vue-router']
    }
  },
  features: {
    inlineStyles: false
  }
})