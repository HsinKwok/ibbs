<template>
    <div class="MainBox">
        <div class="Left">
            <CategoryHeader :info="Info">
                <!-- 右上角操作按钮 -->
                <div class="ButtonSection">
                    <a-button>
                        <template #icon>
                            <icon-more />
                        </template>
                    </a-button>
                </div>
            </CategoryHeader>

            <div class="NavLisbox">
                <div :class="['Item', { active: active === 1 }]" @click="active = 1">
                    <span>最新帖子</span>
                </div>
                <div :class="['Item', { active: active === 2 }]" @click="active = 2">
                    <span>热门帖子</span>
                </div>
                <div :class="['Item', { active: active === 3 }]" @click="active = 3">
                    <span>图片</span>
                </div>
                <div :class="['Item', { active: active === 4 }]" @click="active = 4">
                    <span>视频</span>
                </div>
            </div>
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
const active = ref(1)


const Info = ref({})
const res = await useApiSsr('GetCategoryInfo' + id, '/api/GetCategory', {
    id: id
})
if (res.code === 200) {
    Info.value = res.data
} else {
    navigateTo('/error')
}

/* 主列表：话题帖子，复用 useList */
const { list, query, load } = useList({
    api: '/api/GetThreads',
    extraQuery: { pagesize: 10, cidt: id },
    /* 加载后批量预取作者信息，避免每个 ItemA 各自发起请求 */
    onLoad: (data) => useUserProfile().prefetchUsers(data.map((i) => i.n_uid)),
})

/* Tab 切换：更新筛选条件并回到第一页重新加载
 * 1=最新(id) 2=热门(n_starts) 3=图片(n_haveimage) 4=视频(n_havevideo) */
watch(active, (tab) => {
    const q = query.value
    delete q.image
    delete q.video
    q.sort = 'id'
    q.sortType = 'desc'
    if (tab === 2) q.sort = 'n_starts'
    else if (tab === 3) q.image = 1
    else if (tab === 4) q.video = 1
    q.page = 1
    load()
})

/* 右侧栏：热门话题，复用 useSidebar */
const { TopicList } = useSidebar()
</script>


<style lang="scss" scoped>
@use '../../../assets/scss/category-page' as *;

@include category-page-layout($left-padding: 10px 0 20px);

/* 顶部右上角操作按钮（插槽内容，位于本页作用域） */
.ButtonSection {
    position: absolute;
    right: 20px;
    top: 20px;
}
</style>
