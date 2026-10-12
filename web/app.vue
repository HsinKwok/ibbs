<template>
  <div>
    <NuxtPage />
  </div>
</template>


<script setup>
import { loadWebInfo } from './utils/siteConfig.js'

const route = useRoute()
const SiteConfig = useSiteConfig()

/* 仅前台路由拉取站点配置，后台路由（meta.admin）跳过 */
if (!route.matched.some((r) => r.meta?.admin)) {
  /* 结果写入 payload：SSR 期间与 router.options 共用一次请求，客户端 hydration 直接复用 */
  const siteConfig = useState('site-config')
  if (!siteConfig.value) {
    siteConfig.value = await loadWebInfo()
  }
  const res = siteConfig.value
  if (res && res.code == 200) {
    SiteConfig.increment(res.data)
  } else if (route.path !== '/error') {
    navigateTo('/error')
  }
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
}
</style>
