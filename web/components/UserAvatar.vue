<template>
    <img class="user-avatar" :src="resolved" :alt="alt" :width="size" :height="size"
        :loading="lazy ? 'lazy' : 'eager'" @error="handleError" />
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import Config from '../app-config.js'

/* 本地默认头像组合的数量，与 public/avatars/1.png ~ 30.png 对应 */
const DEFAULT_COUNT = 30

const props = defineProps({
    /* 真实头像地址：为空 / 加载失败时回退到本地默认图 */
    src: {
        type: String,
        default: '',
    },
    /* 分配默认图用的种子：优先传用户 id，退化用昵称 */
    seed: {
        type: [String, Number],
        default: '',
    },
    /* 兜底图地址：如未登录用站点图标；为空时按 seed 映射到本地默认头像 */
    fallback: {
        type: String,
        default: '',
    },
    /* 默认尺寸（HTML 属性，可被父级 CSS 覆盖） */
    size: {
        type: [String, Number],
        default: 40,
    },
    alt: {
        type: String,
        default: '',
    },
    lazy: {
        type: Boolean,
        default: true,
    },
})

/* djb2 哈希：同一 seed 恒定映射到同一张默认图 */
function hashCode(str) {
    let h = 5381
    const s = String(str ?? '')
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
    }
    return h
}

/* 默认图：优先用传入的兜底图，否则按 seed 映射到本地默认头像 */
const defaultSrc = computed(() => {
    if (props.fallback) return props.fallback
    return `/avatars/${(hashCode(props.seed) % DEFAULT_COUNT) + 1}.png`
})

/* 真实头像加载失败标记，避免在默认图与真实图间反复回退 */
const failed = ref(false)
watch(() => props.src, () => { failed.value = false })

/* 相对路径补后端前缀；绝对地址 / 根路径 / data / blob 原样返回 */
function resolveUrl(url) {
    const u = String(url || '').trim()
    if (!u) return ''
    if (/^(https?:)?\/\//i.test(u) || u.startsWith('/') || u.startsWith('data:') || u.startsWith('blob:')) {
        return u
    }
    return `${Config.apiBase}/${u.replace(/^\.?\//, '')}`
}

const resolved = computed(() => {
    const real = resolveUrl(props.src)
    if (real && !failed.value) return real
    return defaultSrc.value
})

function handleError() {
    if (!failed.value) failed.value = true
}
</script>

<style scoped>
.user-avatar {
    object-fit: cover;
    background-color: #f2f3f5;
    flex-shrink: 0;
}
</style>
