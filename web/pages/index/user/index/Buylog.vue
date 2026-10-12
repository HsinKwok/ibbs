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

/* 购买记录：纯查询列表，复用 useList */
const { list, query, loading, load } = useList({
    api: '/api/GetThreads',
    extraQuery: { pagesize: 10, isMyBuy: '1' },
    /* 加载后批量预取作者信息，避免每个 ItemA 各自发起请求 */
    onLoad: (data) => useUserProfile().prefetchUsers(data.map((i) => i.n_uid)),
})

const ShowIndex = ref('1')
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
