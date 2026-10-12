<template>
    <div>
        <div class="page">
            <a-page-header title="邮件配置管理" :show-back="false"></a-page-header>
            <a-tabs :active-key="activeKey" @change="gopage">
                <a-tab-pane :key="`${base}/webs/email/config`" title="基础配置">
                </a-tab-pane>
                <a-tab-pane :key="`${base}/webs/email/test`" title="发信测试">
                </a-tab-pane>
                <a-tab-pane :key="`${base}/webs/email/template`" title="模板管理">
                </a-tab-pane>
            </a-tabs>
            <div class="page-container">
                <NuxtPage />
            </div>
        </div>
    </div>
</template>

<script setup>
import { getAdminBase } from '@/utils/adminPath'
const base = getAdminBase()

const route = useRoute()
/* 受控高亮：直接进入 email/config|test|template 子路由时同步选中项 */
const activeKey = computed(() => route.path)

const gopage = (path) => {
    navigateTo(path)
}
</script>

<style lang="scss" scoped>
.page {
    width: 100%;
    height: 100vh;
    position: relative;
    overflow: hidden;
    background-color: #fff;
    .page-container{
        margin-top: 20px;
    }
}
</style>