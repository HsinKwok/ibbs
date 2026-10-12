<template>
    <!-- 板块 / 话题 顶部信息卡（背景图 + 图标 + 名称 + 简介 + 统计标签） -->
    <div class="MainContent" :style="{
        backgroundImage: `url(${info.n_icon || '/default-banner.jpg'})`
    }">
        <div class="ThreadInfo">
            <div class="TopBoxbACS"></div>
            <div class="TopBox">
                <div class="Icon">
                    <img :src="info.n_icon" alt="">
                </div>
                <div class="Info">
                    <h1>{{ info.n_name }}</h1>
                    <p>{{ info.n_note }}</p>
                    <a-space wrap class="Category">
                        <div class="Tag">
                            <span>贴子：{{ info.n_threads }}</span>
                        </div>
                        <div class="Tag">
                            <span>热度：{{ info.n_hotnum }}</span>
                        </div>
                    </a-space>
                </div>
            </div>
            <!-- 页面自定义扩展（如话题页右上角操作按钮） -->
            <slot></slot>
        </div>
    </div>
</template>

<script setup>
/*
 * 分类页（板块 plate / 话题 topic）共享顶部信息卡。
 * 用法：<CategoryHeader :info="Info" />，需要额外按钮时放入默认插槽。
 */
defineProps({
    info: {
        type: Object,
        default: () => ({})
    }
})
</script>

<style lang="scss" scoped>
.MainContent {
    background-color: #fff;
    border-radius: 10px;
    margin-bottom: 12px;
    background-repeat: no-repeat;
    background-size: 100%;
    background-position: center;
    backdrop-filter: blur(10px);
    overflow: hidden;

    .ThreadInfo {
        position: relative;

        .TopBoxbACS {
            width: 100%;
            height: 100px;
            background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgb(255, 255, 255) 100%);
        }

        .TopBox {
            display: flex;
            gap: 10px;
            width: 100%;
            padding: 20px;
            background-color: #fff;

            .Icon {
                width: 100px;
                height: 100px;

                img {
                    width: 100%;
                    height: 100%;
                    border-radius: 10px;
                }
            }
        }

        h1 {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
            margin-top: 5px;
        }

        .Category {
            margin-top: 10px;

            .Tag {
                border-radius: 20px;
                padding: 5px 10px;
                font-size: 12px;
                background-color: #ecf7fc;
                display: inline-block;
                color: #1890ff;
            }
        }
    }
}

/* 视口小于768px时样式 */
@media (max-width: 768px) {
    .MainContent {
        .ThreadInfo {
            .TopBox {
                width: calc(100% - 40px);
            }
        }
    }
}
</style>
