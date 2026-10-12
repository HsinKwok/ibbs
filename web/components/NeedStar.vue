<template>
    <div class="star-content" v-if="SiteConfig.$state.Config.n_show_star !== '0'" v-html="content"></div>
</template>

<script setup>
import { computed } from 'vue'
import { DEFAULT_STAR_CONTENT, isBlankStarContent } from '@/Tools/starDefault'
import { sanitizeHtml } from '@/utils/sanitize'

const SiteConfig = useSiteConfig()

const content = computed(() => {
    const value = SiteConfig.$state.Config.n_star_content
    // 未配置或内容为空时回退到默认卡片文案，与后台编辑器预填保持一致
    return sanitizeHtml(isBlankStarContent(value) ? DEFAULT_STAR_CONTENT : value)
})
</script>

<style lang="scss" scoped>
.star-content {
    line-height: 1.6;
    color: #333;
    word-break: break-word;

    :deep(img) {
        max-width: 100%;
        height: auto;
        border-radius: 10px;
    }

    :deep(video) {
        max-width: 100%;
        border-radius: 10px;
    }

    :deep(a) {
        color: var(--color-primary);
    }

    :deep(pre) {
        padding: 10px;
        border-radius: 8px;
        background: #f5f5f5;
        overflow-x: auto;
    }

    :deep(table) {
        width: 100%;
        border-collapse: collapse;

        th,
        td {
            padding: 6px 10px;
            border: 1px solid #e0e0e0;
        }
    }
}
</style>
