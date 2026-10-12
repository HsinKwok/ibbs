<template>
    <template v-for="(seg, i) in parts" :key="i">
        <span v-if="seg.type === 'mention'" class="mention" @click.stop="emit('mention', seg.value)">@{{ seg.value }}</span>
        <template v-else>{{ seg.value }}</template>
    </template>
</template>

<script setup>
/*
 * 联系方式文本渲染：把内容中的 “@昵称” 渲染为可点击的站内用户引用。
 * 解析规则与后端 resolveMentionIds 保持一致：@ 需位于行首或空白/分隔符之后，
 * 避免把邮箱（如 a@b.com）误判为提及。
 * 点击提及派发 mention 事件，由父组件解析为 uid 后跳转私信。
 */
const props = defineProps({
    /* 联系方式原文（可能含 @昵称） */
    text: {
        type: String,
        default: '',
    },
})

const emit = defineEmits(['mention'])

/* 与后端保持一致：@ 前为行首或空白/分隔符 */
const MENTION_RE = /(?:^|[\s,，、;；])@([^\s@,，、;；]+)/g

/* 将原文拆分为「纯文本 / 提及」片段，保序渲染 */
const parts = computed(() => {
    const text = props.text || ''
    if (!text) return []
    const result = []
    MENTION_RE.lastIndex = 0
    let last = 0
    let m
    while ((m = MENTION_RE.exec(text)) !== null) {
        /* m[0] 含前导分隔符（位于行首时为空），减去 “@ + 名称” 的长度即得 @ 下标 */
        const atIndex = m.index + m[0].length - 1 - m[1].length
        if (atIndex > last) result.push({ type: 'text', value: text.slice(last, atIndex) })
        result.push({ type: 'mention', value: m[1] })
        last = m.index + m[0].length
    }
    if (last < text.length) result.push({ type: 'text', value: text.slice(last) })
    return result
})
</script>

<style scoped>
.mention {
    color: var(--color-primary, #5b8c5a);
    font-weight: 600;
    cursor: pointer;
}

.mention:hover {
    text-decoration: underline;
}
</style>
