<template>
    <a-pagination v-model:current="current" v-model:pageSize="pageSize" :total="total" size="mini" show-total
        @change="triggerLoad" @page-size-change="triggerLoad" v-bind="$attrs" />
</template>

<script setup>
/*
 * 公共分页器：统一「页码 / 每页条数双向绑定 + 翻页触发重新加载」。
 * 固定 size="mini" show-total；其余属性（show-page-size / page-size-options / class 等）
 * 通过 $attrs 透传给 a-pagination。
 * 用法：<ListPager v-model:current="query.page" v-model:pageSize="query.pagesize" :total="query.total" @load="load" />
 */
defineOptions({ inheritAttrs: false })

const current = defineModel('current', { type: Number, default: 1 })
const pageSize = defineModel('pageSize', { type: Number, default: 20 })
defineProps({ total: { type: Number, default: 0 } })
const emit = defineEmits(['load'])

/*
 * Arco 分页在「切换每页条数」时会同时触发 change 与 page-size-change，
 * 这里在同一微任务内合并为一次 load，避免重复请求；延迟到微任务执行，
 * 确保 v-model 绑定已更新，load 读到的是最新页码/每页条数。
 */
let pending = false
const triggerLoad = () => {
    if (pending) return
    pending = true
    Promise.resolve().then(() => {
        pending = false
        emit('load')
    })
}
</script>
