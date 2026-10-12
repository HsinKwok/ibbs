<template>
    <div>
        <AdminTable title="工具列表" :columns="columns" :list="list" :loading="loading" :query="query"
            v-model:selectedKeys="selectedKeys" :row-selection="rowSelection" :batch-deleting="batchDeleting"
            add-text="新增分类" @search="load" @add="() => openAdd({ n_type: query.type })" @batch-delete="batchDelete">
            <template #before-table>
                <a-tabs v-model:activeKey="query.type" @change="changeTab">
                    <a-tab-pane key="1" title="分类列表"></a-tab-pane>
                    <a-tab-pane key="2" title="话题列表"></a-tab-pane>
                </a-tabs>
            </template>
            <template #n_icon="{ record }">
                <a-avatar :size="24">
                    <img alt="avatar" :src="record.n_icon" loading="lazy" />
                </a-avatar>
            </template>
            <template #n_api_qps="{ record }">
                {{ record.n_api_qps }} / {{ record.n_api_qps_time }}s
            </template>
            <template #n_price_type="{ record }">
                <a-tag color="arcoblue" v-if="record.n_price_type === '1'">积分</a-tag>
                <a-tag color="orange" v-if="record.n_price_type === '2'">余额</a-tag>
            </template>
            <template #n_api_vip="{ record }">
                <a-tag color="arcoblue" v-if="record.n_api_vip === '1'">VIP</a-tag>
                <a-tag color="orange" v-else>无限制</a-tag>
            </template>
            <template #console="{ record }">
                <a-space>
                    <a-button size="mini" @click="openEdit(record)" type="primary">编辑</a-button>
                    <a-popconfirm content="确认要删除此数据？删除后将无法恢复" type="error" @ok="() => { del(record.id) }"
                        position="bottom">
                        <a-button size="mini" type="primary" status="danger">删除</a-button>
                    </a-popconfirm>
                </a-space>
            </template>
        </AdminTable>

        <a-drawer :width="540" :visible="visible" @ok="submit" @cancel="() => {
            visible = false
        }" unmountOnClose title="分类详情">
            <div>
                <a-form style="margin: 0 auto;" :model="info">
                    <a-form-item field="name" label="图标">
                        <Upimg :src="info.n_icon" width="100" height="100" @success="(e) => {
                            info.n_icon = e
                        }"></Upimg>
                    </a-form-item>
                    <a-form-item field="back" label="背景">
                        <Upimg :src="info.n_back" width="200" height="100" @success="(e) => {
                            info.n_back = e
                        }"></Upimg>
                    </a-form-item>
                    <a-form-item field="name" label="名称">
                        <a-input v-model="info.n_name" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="name" label="简介">
                        <a-input v-model="info.n_note" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="name" label="权重">
                        <a-input v-model="info.n_sort" placeholder="请输入" />
                    </a-form-item>
                </a-form>
            </div>
        </a-drawer>

    </div>
</template>

<script setup>
/* 统一列表页封装：查询 + 分页 + 删除 + 批量删除 + 新增/编辑抽屉（带分类/话题 tabs） */
const { list, query, loading, load, del, selectedKeys, rowSelection, batchDeleting, batchDelete, visible, info, openAdd, openEdit, submit } = useAdminTable({
    api: '/api/getCategoryList',
    remove: '/api/delCategoryAdmin',
    batchRemove: '/api/batchDelCategoryAdmin',
    addApi: '/api/addCategoryAdmin',
    editApi: '/api/editCategoryAdmin',
    label: '分类',
    extraQuery: { type: '1' },
    beforeSubmit: (info) => {
        if (info.n_sort == '' || info.n_sort == undefined || info.n_sort == null || info.n_sort == 'null') {
            info.n_sort = 0
        }
    },
})

/* 切换分类/话题 tab 后回到第一页再查询，避免停留在过滤前的越界页码导致空列表 */
const changeTab = () => {
    query.value.page = 1
    load()
}

const columns = [
    {
        title: '图标',
        slotName: 'n_icon',
        width: 60,
    },
    {
        title: '名称',
        dataIndex: 'n_name',
        ellipsis: true,
        tooltip: true,
    },
     {
        title: '简介',
        dataIndex: 'n_note',
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '权重',
        dataIndex: 'n_sort',
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '操作',
        dataIndex: 'console',
        slotName: 'console',
        width: 150,
        fixed: 'right',
    },
];
</script>
