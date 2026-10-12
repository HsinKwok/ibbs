<template>
    <div class="MainBox">
        <div class="MainContent">
            <SwiperBox :pos="2" />
            <div class="Tbox">
                <BoxTitle>我关注的</BoxTitle>
                <div class="TopBox">

                    <a-input class="search-input" v-model="query.search" placeholder="请输入搜索内容" allow-clear @press-enter="search">
                        <template #prefix>
                            <icon-search />
                        </template>
                    </a-input>
                    <a-button type="primary" class="send-btn" @click="search()">
                        <template #icon>
                            <icon-search />
                        </template>
                        <template #default>搜一下</template>
                    </a-button>
                </div>
            </div>
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
/* 主列表：我关注的帖子，复用 useList */
const { list, query, loading, load } = useList({
    api: '/api/GetThreads',
    extraQuery: { pagesize: 10, isMyLike: 1 },
    /* 加载后批量预取作者信息，避免每个 ItemA 各自发起请求 */
    onLoad: (data) => useUserProfile().prefetchUsers(data.map((i) => i.n_uid)),
})

/* 搜索后回到第一页再查询，避免停留在过滤前的越界页码导致空列表 */
const search = () => {
    query.value.page = 1
    load()
}

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

            .Tbox {
                width: 100%;
                padding: 10px;
                background-color: #fff;
                border-radius: 10px;
                margin-bottom: 10px;
            }

            .TopBox {

                display: flex;

                .search-input {
                    width: calc(100% - 100px);
                    border-radius: 7px;
                }

                .send-btn {
                    border-radius: 7px;
                    margin-left: 10px;
                    background-color: var(--color-primary);
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

            .Tbox {
                width: calc(100% - 20px);
                padding: 10px;
                background-color: #fff;
                border-radius: 10px;
                margin-bottom: 5px;
            }

            .TopBox {

                display: flex;

                .search-input {
                    width: calc(100% - 100px);
                    border-radius: 7px;
                }

                .send-btn {
                    border-radius: 7px;
                    margin-left: 10px;
                    background-color: var(--color-primary);
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