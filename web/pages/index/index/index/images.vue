<template>
    <div class="MainBox">
        <div class="MainContent">
            <SwiperBox :pos="4" />
            <div class="TopB">
                <BoxTitle>视频图片</BoxTitle>
                <div class="TopBox">
                    <a-input class="search-input" v-model="query.search" placeholder="请输入搜索内容" allow-clear @press-enter="search">
                        <template #prefix>
                            <icon-search />
                        </template>
                    </a-input>
                    <a-button type="primary" class="send-btn" @click="navigateTo('/threadInfo/add')">
                        <template #icon>
                            <icon-send />
                        </template>
                        <template #default>我有瓜要曝</template>
                    </a-button>
                </div>
                <div class="select">
                    <NavBox :Item="[
                        {
                            value: 'id',
                            name: '最新贴子'
                        },
                        {
                            value: 'n_msglastTime',
                            name: '最新回复'
                        },
                        {
                            value: 'n_starts',
                            name: '点赞最多'
                        },
                        {
                            value: 'n_read',
                            name: '阅读最多'
                        },
                    ]" v-model:modelValue="query.sort" @change="search"></NavBox>
                    <NavBox :Item="[
                        {
                            value: '1',
                            name: '只看视频'
                        },
                        {
                            value: '2',
                            name: '只看图片'
                        },

                    ]" v-model:modelValue="video" @change="search"></NavBox>
                </div>
            </div>
            <FlexBox :data="list" :columns="2" :gap="8" :loading="loading">
                <template #item="{ item }">
                    <ItemA :data="item"></ItemA>
                </template>
            </FlexBox>
            <div class="PageNav">
                <ListPager v-model:current="query.page" v-model:pageSize="query.pagesize" :total="query.total"
                    @load="load" />
            </div>
        </div>
        <div class="SidebarRight">
            <div class="NavBar">
                <BoxTitle>热门圈子</BoxTitle>
                <ClassItem v-for="value in CategoryList" :key="value.id" :data="value"></ClassItem>
            </div>
            <div class="NavBar">
                <BoxTitle>热门话题</BoxTitle>
                <TopicItem v-for="value in TopicList" :key="value.id" :data="value"></TopicItem>
            </div>
             <div class="NavBar">
                <NeedStar></NeedStar>
            </div>
        </div>
    </div>
</template>

<script setup>
/* 主列表：视频图片帖子，复用 useList（视频/图片筛选在 load 前写入 query） */
const video = ref('1')
const { list, query, loading, load: loadList } = useList({
    api: '/api/GetThreads',
    extraQuery: { pagesize: 10, search: '', sort: 'id' },
    autoLoad: false,
    /* 加载后批量预取作者信息，避免每个 ItemA 各自发起请求 */
    onLoad: (data) => useUserProfile().prefetchUsers(data.map((i) => i.n_uid)),
})

const load = () => {
    if (video.value == '') {
        delete query.value.video
        delete query.value.image
    }
    if (video.value == '1') {
        query.value.video = 1
        delete query.value.image
    }
    if (video.value == '2') {
        query.value.image = 1
        delete query.value.video
    }
    loadList()
}

/* 搜索/排序/筛选变更后回到第一页再查询，避免停留在过滤前的越界页码导致空列表 */
const search = () => {
    query.value.page = 1
    load()
}

onMounted(load)

/* 右侧栏：热门圈子 + 热门话题，复用 useSidebar */
const { CategoryList, TopicList } = useSidebar()
</script>


<style lang="scss" scoped>

/* 视口大于768px时的样式 */
@media (min-width: 768px) {
    .MainBox {
        display: flex;
        width: 100%;

        .MainContent {
            width: calc(100% - var(--sidebar-right-w));

            .TopB {
                width: 100%;
                padding: 10px;
                background-color: #fff;
                border-radius: 10px;
                margin-bottom: 12px;

                .select {
                    margin-top: 10px;
                    margin-left: 4px;
                }

                .TopBox {

                    display: flex;

                    .search-input {
                        width: calc(100% - 120px);
                        border-radius: 7px;
                    }

                    .send-btn {
                        border-radius: 7px;
                        margin-left: 10px;
                        background-color: var(--color-primary);
                    }
                }

            }


          

            .PageNav {
                width: 100%;
                margin-top: 12px;
                display: flex;
                padding: 8px;
                border-radius: 10px;
                background-color: #fff;
                justify-content: center;
            }

            /* 帖子列表卡片紧凑化 */
            :deep(.Itemlist) {
                padding: 8px;

                .UserInfo {
                    .UserDetail {
                        padding-top: 4px;
                    }
                }

                .Content {
                    .PostContent {
                        margin-top: 6px;

                        .word {
                            margin-top: 6px;
                        }
                    }

                    .ImageList {
                        margin-top: 6px;
                    }

                    .PostActions {
                        margin-top: 8px;
                    }

                    .Interactions {
                        margin-top: 6px;
                        margin-bottom: 0;
                    }
                }
            }


        }

        .SidebarRight {
            overflow: hidden;
            overflow-y: auto;
            margin-left: 10px;

            /* 隐藏滚动条 */
            &::-webkit-scrollbar {
                display: none;
            }

            .NavBar {
                width: calc(var(--sidebar-right-w) - 20px);
                padding: 8px;
                border-radius: var(--radius);
                background-color: #fff;
                margin-bottom: 10px;

                .Item {
                    width: calc(100% - 20px);
                    padding: 10px 0;
                    cursor: pointer;

                    p {
                        font-size: 16px;
                        color: #333;
                    }
                }
            }
        }

    }
}

/* 视口小于768px时的样式 */
@media (max-width: 768px) {
    .MainBox {
        display: flex;
        width: 100%;

        .MainContent {
            width: calc(100%);

           .TopB {
                width: calc(100% - 20px);
                padding: 10px;
                background-color: #fff;
                border-radius: 10px;
                margin-bottom: 12px;

                .select {
                    margin-top: 5px;
                    margin-left: 4px;
                }

                .TopBox {

                    display: flex;

                    .search-input {
                        width: calc(100% - 120px);
                        border-radius: 7px;
                    }

                    .send-btn {
                        border-radius: 7px;
                        margin-left: 10px;
                        background-color: var(--color-primary);
                    }
                }

            }


        
            .PageNav {
                width: calc(100% - 20px);
                margin-top: 12px;
                display: flex;
                padding: 8px;
                border-radius: 10px;
                background-color: #fff;
                justify-content: center;
            }

            /* 帖子列表卡片紧凑化 */
            :deep(.Itemlist) {
                padding: 8px;

                .UserInfo {
                    .UserDetail {
                        padding-top: 4px;
                    }
                }

                .Content {
                    .PostContent {
                        margin-top: 6px;

                        .word {
                            margin-top: 6px;
                        }
                    }

                    .ImageList {
                        margin-top: 6px;
                    }

                    .PostActions {
                        margin-top: 8px;
                    }

                    .Interactions {
                        margin-top: 6px;
                        margin-bottom: 0;
                    }
                }
            }


        }

        .SidebarRight {
            overflow: hidden;
            overflow-y: auto;
            margin-left: 10px;
            display: none;

            /* 隐藏滚动条 */
            &::-webkit-scrollbar {
                display: none;
            }

            .NavBar {
                width: calc(var(--sidebar-right-w) - 20px);
                padding: 8px;
                border-radius: var(--radius);
                background-color: #fff;
                margin-bottom: 10px;

                .Item {
                    width: calc(100% - 20px);
                    padding: 10px 0;
                    cursor: pointer;

                    p {
                        font-size: 16px;
                        color: #333;
                    }
                }
            }
        }

    }
}
</style>