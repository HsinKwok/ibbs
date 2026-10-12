<template>
    <div class="PageBox">
        <div class="PageContent">
            <div class="Sidebar">
                <div class="NavBar">
                    <div :class="['Item', { active: IndexShow === 1 }]" @click="changeIndexShow(1, '/follow')">
                        <icon-heart class="icon" />
                        <p>我的关注</p>
                    </div>
                    <div :class="['Item', { active: IndexShow === 2 }]" @click="changeIndexShow(2, '/')">
                        <icon-fire class="icon" />
                        <p>热门瓜子</p>
                    </div>
                    <div :class="['Item', { active: IndexShow === 3 }]" @click="changeIndexShow(3, '/class')">
                        <icon-branch class="icon" />
                        <p>热门圈子</p>
                    </div>
                    <div :class="['Item', { active: IndexShow === 4 }]" @click="changeIndexShow(4, '/images')">
                        <icon-image class="icon" />
                        <p>视频图片</p>
                    </div>
                    <div :class="['Item', { active: IndexShow === 5 }]" @click="changeIndexShow(5, '/market')">
                        <icon-public class="icon" />
                        <p>跳蚤市场</p>
                    </div>
                    <div :class="['Item', { active: IndexShow === 6 }]" @click="changeIndexShow(6, '/uplist')">
                        <icon-user class="icon" />
                        <p>热门UP主</p>
                    </div>
                </div>

            </div>
            <div class="Content">
                <NuxtPage />
                <Tabbar></Tabbar>
            </div>
        </div>



    </div>
</template>

<script setup>
import { Message } from '@arco-design/web-vue';
const SiteConfig = useSiteConfig()

useSeoSet({
    title: SiteConfig.$state.Config.n_web_title,
    description: SiteConfig.$state.Config.n_web_desc,
    keywords: SiteConfig.$state.Config.n_web_keys,

})



const route = useRoute()
/* 侧栏高亮由当前路由派生，保证直接访问/刷新时也与实际页面一致 */
const INDEX_SHOW_MAP = {
    '/follow': 1,
    '/': 2,
    '/class': 3,
    '/images': 4,
    '/market': 5,
    '/uplist': 6,
}
const IndexShow = computed(() => INDEX_SHOW_MAP[route.path] ?? 0)
/* 切换页面 */
const changeIndexShow = (index, path) => {
    navigateTo(path)
}


</script>
<style lang="scss" scoped>
/* 视口小于768px时的样式 */
@media (min-width: 768px) {

    .PageBox {
        width: calc(100%);
        position: relative;

        .PageContent {
            margin: 0 auto;
            max-width: 1280px;
            display: flex;
            padding: 20px 0 20px;

            .Sidebar {
                overflow: hidden;
                overflow-y: auto;

                /* 隐藏滚动条 */
                &::-webkit-scrollbar {
                    display: none;
                }

                .NavBar {
                    width: calc(256px - 20px);
                    padding: 8px;
                    border-radius: var(--radius);
                    background-color: #fff;
                    margin-bottom: 10px;

                    .Item {
                        padding: 10px 0;
                        cursor: pointer;
                        display: flex;
                        line-height: 30px;
                        padding-left: 10px;
                        color: #888888;

                        .icon {
                            width: 17px;
                            height: 17px;
                            margin-right: 10px;
                            margin-top: 6.5px;
                        }

                        p {
                            font-size: 16px;
                            color: #333;
                        }
                    }

                    .active {
                        color: var(--color-primary);
                        background: var(--color-primary-soft);
                        position: relative;

                        &::after {
                            content: '';
                            position: absolute;
                            left: -10px;
                            top: 15px;
                            width: 5px;
                            height: calc(100% - 30px);

                            background-color: var(--color-primary);
                        }

                        p {
                            color: var(--color-primary);
                        }
                    }
                }
            }


            .Content {
                width: calc(100% - 256px);
                margin-left: 10px;
            }
        }


    }

}

/* 视口小于768px时的样式 */
@media (max-width: 768px) {

    .PageBox {
        width: calc(100%);
        position: relative;

        .PageContent {
            width: calc(100% - 20px);
            margin: 0 auto;
            max-width: 1280px;

            .Sidebar {
                overflow: hidden;
                overflow-y: auto;

                /* 隐藏滚动条 */
                &::-webkit-scrollbar {
                    display: none;
                }

                .NavBar {
                    width: calc(100% - 20px);
                    padding: 0 8px;
                    border-radius: 10px;
                    background-color: #fff;
                    margin-bottom: 5px;
                    white-space: nowrap;
                    overflow-x: auto;

                    .Item {
                        padding: 10px 0;
                        cursor: pointer;
                        display: inline-block;
                        line-height: 30px;
                        padding-left: 10px;
                        color: #888888;
                        margin-right: 10px;

                        .icon {
                            width: 17px;
                            height: 17px;
                            margin-right: 10px;
                            display: inline-block;
                            margin-top: 6.5px;
                        }

                        p {
                            font-size: 16px;
                            color: #333;
                            display: inline-block;
                        }
                    }

                    .active {
                        color: var(--color-primary);
                        position: relative;

                        &::after {
                            content: '';
                            position: absolute;
                            left: 25px;
                            bottom: 1px;
                            width: calc(100% - 30px);
                            height: 5px;

                            background-color: var(--color-primary);
                        }

                        p {
                            color: var(--color-primary);
                        }
                    }
                }
            }



            .Content {
                width: calc(100%);

                /* 隐藏滚动条 */
                &::-webkit-scrollbar {
                    display: none;
                }
            }
        }


    }

}
</style>
