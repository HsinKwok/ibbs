<template>
    <div class="Pageas">
        <div class="PageContent">
            <UserHeader title="我的购买记录"></UserHeader>


            <FlexBox :data="list" :columns="2" :gap="10" :loading="loading">
                <template #item="{ item }">
                    <ItemA :data="item"></ItemA>
                </template>
            </FlexBox>
            <div class="PageNav">
                <ListPager v-model:current="query.page" v-model:pageSize="query.pagesize" :total="query.total"
                    @load="load" />
            </div>

        </div>
    </div>
</template>

<script setup>
const SiteConfig = useSiteConfig()
useSeoSet({
    title: '我购买的 - ' + SiteConfig.$state.Config.n_web_title,
})

/* 购买记录：纯查询列表，复用 useList。
   /user/** 为按请求渲染（swr:false）且 SSR 携带登录态，首屏直接在服务端取到 */
const ListQuery = { pagesize: 10, isMyBuy: '1' }
const initial = await useApiSsr('Buylog:threads:1', '/api/GetThreads', { page: 1, ...ListQuery })
const { list, query, loading, load } = useList({
    api: '/api/GetThreads',
    extraQuery: ListQuery,
    initial,
})
</script>

<style lang="scss" scoped>
.PageNav {
    width: 100%;
    margin-top: 12px;
    display: flex;
    padding: 8px;
    border-radius: 10px;
    background-color: #fff;
    justify-content: center;
}
</style>
