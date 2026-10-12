<template>
    <div class="SwiperBox" v-if="list.length">
        <a-carousel class="swiper" animation-name="slide" indicator-type="dot" indicator-position="bottom"
            show-arrow="hover" :auto-play="list.length > 1 ? { interval: 4000 } : false" :move-speed="500">
            <a-carousel-item v-for="item in list" :key="item.id">
                <div class="swiper-item" :class="{ 'is-link': !!item.n_url }" @click="handleClick(item)">
                    <video v-if="isVideo(item.n_src)" class="media" :src="item.n_src" muted autoplay loop
                        playsinline></video>
                    <img v-else class="media" :src="item.n_src" :alt="item.n_name || '轮播图'" loading="lazy">
                    <div class="caption" v-if="item.n_name || item.n_dosc">
                        <p class="caption-name" v-if="item.n_name">{{ item.n_name }}</p>
                        <p class="caption-dosc" v-if="item.n_dosc">{{ item.n_dosc }}</p>
                    </div>
                </div>
            </a-carousel-item>
        </a-carousel>
    </div>
</template>

<script setup>
/* 轮播位置：1=首页、2=我的关注、3=热门圈子、4=视频图片、5=跳蚤市场、6=热门UP主 */
const props = defineProps({
    pos: { type: [Number, String], default: 1 },
})

/* 拉取指定位置的数据，按接口权重倒序展示；无数据时整块不渲染 */
const { list } = useList({
    api: '/api/swipers',
    extraQuery: { pagesize: 20, pos: props.pos },
})

/* 依据扩展名判定是否为视频（后台字段允许图/视频） */
const isVideo = (src = '') => /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(src)

/* 有跳转地址才可点击：外链新开标签，站内地址走路由 */
const handleClick = (item) => {
    if (!item.n_url) return
    if (/^https?:\/\//i.test(item.n_url)) {
        window.open(item.n_url, '_blank')
    } else {
        navigateTo(item.n_url)
    }
}
</script>

<style lang="scss" scoped>
.SwiperBox {
    width: 100%;
    margin-bottom: 12px;
}

.swiper {
    width: 100%;
    height: 180px;
    border-radius: var(--radius);
    overflow: hidden;
    background-color: #fff;
}

.swiper-item {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;

    &.is-link {
        cursor: pointer;
    }

    .media {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    .caption {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        padding: 24px 16px 14px;
        background: linear-gradient(to top, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0));
        color: #fff;

        .caption-name {
            font-size: 16px;
            font-weight: 600;
        }

        .caption-dosc {
            margin-top: 2px;
            font-size: 12px;
            opacity: 0.85;
        }
    }
}

/* 视口大于768px时的样式 */
@media (min-width: 768px) {
    .swiper {
        height: 240px;
    }
}

/* 视口小于768px时的样式：与首页其它卡片保持一致的内边距 */
@media (max-width: 768px) {
    .SwiperBox {
        width: calc(100% - 20px);
    }
}
</style>
