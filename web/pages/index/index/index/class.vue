<template>
    <div class="MainBox">
        <!-- 主要内容区域 -->
        <div class="MainContent">
            <SwiperBox :pos="3" />
            <div>
                <BoxTitle>热门圈子</BoxTitle>
            </div>
            <div class="ListBox">
                <ClassItem v-for="value in list" :key="value.id" :data="value"></ClassItem>
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
/* 主列表：热门圈子，复用 useList */
const { list, query, loading, load } = useList({
    api: '/api/GetCategory',
    extraQuery: { pagesize: 10 },
})

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
            padding: 10px;
            background-color: #fff;
            border-radius: 10px;

            .ListBox {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
                gap: 10px;
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
            width: calc(100% - 20px);
            padding: 10px;
            background-color: #fff;
            border-radius: 10px;

            .ListBox {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
                gap: 10px;
            }
        }

        .SidebarRight {
            display: none;
        }
    }
}
</style>
