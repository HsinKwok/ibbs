<template>
    <div class="Page">
        <a-page-header :title="title" :show-back="false">
            <template #subtitle>
                <a-space>
                    <slot name="toolbar">
                        <a-input v-if="showSearch" v-model="query.search" :placeholder="searchPlaceholder"
                            allow-clear @press-enter="onSearch" />
                        <a-button v-if="showSearch" type="primary" @click="onSearch">检索</a-button>
                        <a-button v-if="addText" type="primary" @click="emit('add')">{{ addText }}</a-button>
                        <slot name="toolbar-extra" />
                        <a-button v-if="showBatchDelete" type="primary" status="danger"
                            :disabled="!selectedKeys.length" :loading="batchDeleting"
                            @click="emit('batch-delete')">批量删除</a-button>
                    </slot>
                </a-space>
            </template>
        </a-page-header>
        <div class="Pagecontent">
            <slot name="before-table" />
            <a-table :columns="columns" :data="list" :pagination="false" :loading="loading" :row-key="rowKey"
                v-model:selectedKeys="selected" :row-selection="rowSelection" :scroll="scroll"
                :draggable="draggable ? { type: 'handle', width: 40 } : undefined"
                @change="(...args) => emit('change', ...args)" @row-click="(...args) => emit('row-click', ...args)">
                <!-- 动态转发所有列插槽（console / 自定义 slotName 等），排除本组件自用插槽 -->
                <template v-for="name in forwardSlots" :key="name" #[name]="slotProps">
                    <slot :name="name" v-bind="slotProps || {}" />
                </template>
                <template #footer>
                    <slot name="footer">
                        <ListPager v-if="showPagination" v-model:current="query.page" v-model:pageSize="query.pagesize"
                            :total="query.total" show-page-size :page-size-options="[50, 100, 200, 500, 1000]"
                            @load="emit('search')" />
                    </slot>
                </template>
            </a-table>
        </div>
    </div>
</template>

<script setup>
import { computed, useSlots } from 'vue'

/*
 * 后台列表页脚手架：统一「页头 + 工具条 + 表格 + 分页」布局与样式。
 * 页面只需传入列表数据与列配置，删除/新增/批量删除等逻辑仍由 useAdminTable 提供。
 *
 * 事件：search(检索/翻页) / add(新增) / batch-delete(批量删除) / change / row-click
 * 插槽：toolbar(整体覆盖工具条) / toolbar-extra(追加按钮) / before-table(表格上方内容) 
 *       footer(自定义页脚，默认分页)；其余具名插槽全部转发给 a-table（列插槽 console 等）
 */
const props = defineProps({
    title: { type: String, default: '' },
    columns: { type: Array, default: () => [] },
    list: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    query: { type: Object, default: () => ({}) },
    selectedKeys: { type: Array, default: () => [] },
    rowSelection: { type: Object, default: undefined },
    batchDeleting: { type: Boolean, default: false },
    showSearch: { type: Boolean, default: true },
    searchPlaceholder: { type: String, default: '模糊搜索' },
    addText: { type: String, default: '' },
    showBatchDelete: { type: Boolean, default: true },
    showPagination: { type: Boolean, default: true },
    draggable: { type: Boolean, default: false },
    rowKey: { type: String, default: 'id' },
    scroll: { type: Object, default: () => ({ y: 'calc(100vh - 190px)', x: '100%' }) },
})

const emit = defineEmits(['update:selectedKeys', 'search', 'add', 'batch-delete', 'change', 'row-click'])

const selected = computed({
    get: () => props.selectedKeys,
    set: (v) => emit('update:selectedKeys', v),
})

/* 检索：重置到第一页再查询，避免停留在旧页码上导致结果为空/错位 */
const onSearch = () => {
    if (props.query && props.query.page !== undefined) props.query.page = 1
    emit('search')
}

const RESERVED_SLOTS = ['toolbar', 'toolbar-extra', 'before-table', 'footer']
const slots = useSlots()
const forwardSlots = computed(() => Object.keys(slots).filter((name) => !RESERVED_SLOTS.includes(name)))
</script>

<style lang="scss" scoped>
.Page {
    background-color: #fff;
    margin: 1px;
    width: calc(100% - 2px);

    .Pagecontent {
        width: calc(100% - 20px);
        padding: 10px;
    }
}
</style>
