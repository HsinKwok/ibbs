<template>
  <div>
    <NuxtPage />
  </div>
</template>


<script setup>
const route = useRoute()
const SiteConfig = useSiteConfig()

/* 仅前台路由拉取站点配置，后台路由（meta.admin）跳过 */
if (!route.matched.some((r) => r.meta?.admin)) {
  const res = await useApiSsr('config', '/api/webinfo')
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
