<template>
    <div>
        <AdminTable title="市场分类管理" :columns="columns" :list="list" :loading="loading" :query="query"
            v-model:selectedKeys="selectedKeys" :row-selection="rowSelection" :batch-deleting="batchDeleting"
            add-text="新增分类" @search="load" @add="() => openAdd({ n_type: MARKET_CATEGORY_TYPE })"
            @batch-delete="batchDelete">
            <template #console="{ record }">
                <a-space>
                    <a-button size="mini" @click="openEdit(record)" type="primary">编辑</a-button>
                    <a-popconfirm content="确认要删除此分类？删除不影响已发布商品的分类文本" type="error"
                        @ok="() => { del(record.id) }" position="bottom">
                        <a-button size="mini" type="primary" status="danger">删除</a-button>
                    </a-popconfirm>
                </a-space>
            </template>
        </AdminTable>

        <a-drawer :width="480" :visible="visible" @ok="submit" @cancel="() => {
            visible = false
        }" unmountOnClose title="分类详情">
            <div>
                <a-form style="margin: 0 auto;" :model="info">
                    <a-form-item field="n_name" label="分类名称">
                        <a-input v-model="info.n_name" placeholder="请输入分类名称" />
                    </a-form-item>
                    <a-form-item field="n_sort" label="排序">
                        <a-input-number v-model="info.n_sort" :min="0" placeholder="数字越大越靠前" style="width: 100%" />
                    </a-form-item>
                </a-form>
            </div>
        </a-drawer>
    </div>
</template>

<script setup>
/* 市场分类在分类表 n_class 中的类型标识（1=帖子分类，2=话题，3=跳蚤市场分类） */
const MARKET_CATEGORY_TYPE = '3'

/* 统一列表页封装：查询 + 分页 + 删除 + 批量删除 + 新增/编辑抽屉 */
const { list, query, loading, load, del, selectedKeys, rowSelection, batchDeleting, batchDelete, visible, info, openAdd, openEdit, submit } = useAdminTable({
    api: '/api/getCategoryList',
    remove: '/api/delCategoryAdmin',
    batchRemove: '/api/batchDelCategoryAdmin',
    addApi: '/api/addCategoryAdmin',
    editApi: '/api/editCategoryAdmin',
    label: '分类',
    extraQuery: { type: MARKET_CATEGORY_TYPE },
    beforeSubmit: (data) => {
        if (data.n_sort === '' || data.n_sort == null || data.n_sort === 'null') data.n_sort = 0
    },
})

const columns = [
    {
        title: '分类名称',
        dataIndex: 'n_name',
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '排序',
        dataIndex: 'n_sort',
        width: 100,
    },
    {
        title: '操作',
        dataIndex: 'console',
        slotName: 'console',
        width: 200,
        fixed: 'right',
    },
];
</script>
