<template>
    <div class="MainBox">
        <div class="Left">
            <CategoryHeader :info="Info" />

            <div class="threads">
                <div class="content-box">
                    <ItemA v-for="value in list" :key="value.id" :data="value"></ItemA>
                </div>
                <div class="Isno" style="  width: 100%;
                background-color: #fff;
                border-radius: 10px;" v-if="list.length == 0">
                    <a-result :status="null" title="无内容" subtitle="哎呀，没有内容了">
                        <template #icon>
                            <IconFaceSmileFill />
                        </template>
                    </a-result>
                </div>
                <div class="PageNav">
                    <ListPager v-model:current="query.page" v-model:pageSize="query.pagesize" :total="query.total"
                        @load="load" />
                </div>
            </div>

        </div>
        <div class="Right">
            <div class="NavBar">
                <BoxTitle>热门话题</BoxTitle>
                <TopicItem v-for="value in TopicList" :key="value.id" :data="value"></TopicItem>
            </div>
        </div>
    </div>
</template>

<script setup>
const route = useRoute()
const id = route.params.id


const Info = ref({})
/* 板块信息与首屏帖子互不依赖，合并为一次并发预取，省掉一段串行往返。
   列表内容与登录身份无关，可随 HTML 下发（客户端不再重复请求） */
const ListQuery = { pagesize: 10, cid: id }
const [res, initial] = await Promise.all([
    useApiSsr('GetCategoryInfo' + id, '/api/GetCategory', { id: id }),
    useApiSsr('plate:threads:' + id, '/api/GetThreads', { page: 1, ...ListQuery })
])
if (res.code === 200) {
    Info.value = res.data
} else {
    navigateTo('/error')
}

/* 主列表：板块帖子，复用 useList */
const { list, query, load } = useList({
    api: '/api/GetThreads',
    extraQuery: ListQuery,
    initial,
})

/* 右侧栏：热门话题，复用 useSidebar */
const { TopicList } = useSidebar()
</script>


<style lang="scss" scoped>
@use '../../../assets/scss/category-page' as *;

@include category-page-layout($mobile-padding-top: 70px, $mobile-box-width: calc(100% - 20px));
</style>
