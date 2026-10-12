<template>
    <div>
        <AdminTable title="支付方式配置" :columns="columns" :list="list" :loading="loading" :query="query"
            v-model:selectedKeys="selectedKeys" :row-selection="rowSelection" :batch-deleting="batchDeleting"
            add-text="新增方式" :show-pagination="false" @search="load" @add="() => openAdd()"
            @batch-delete="batchDelete">
            <template #n_icon="{ record }">
                <a-image alt="avatar" width="30" :src="record.n_icon"></a-image>
            </template>
            <template #n_off="{ record }">
                <a-tag v-if="record.n_off === '1'" color="arcoblue">正常</a-tag>
                <a-tag v-else color="red">禁用</a-tag>
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
        }" unmountOnClose title="支付配置详情">
            <div>
                <a-form style="margin: 0 auto;" :model="info">
                    <a-form-item label="图标">
                        <Upimg :src="info.n_icon" width="50px" height="50px" @success="(e) => {
                            info.n_icon = e
                        }"></Upimg>
                    </a-form-item>
                    <a-form-item label="名称">
                        <a-input v-model="info.n_name" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item label="编码">
                        <a-input v-model="info.n_code" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item label="权限">
                        <a-input v-model="info.n_index" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item label="状态">
                        <a-radio-group v-model="info.n_off">
                            <a-radio value="1">正常</a-radio>
                            <a-radio value="0">禁用</a-radio>
                        </a-radio-group>
                    </a-form-item>
                </a-form>
            </div>
        </a-drawer>

    </div>
</template>

<script setup>
/* 统一列表页封装：查询 + 分页 + 删除 + 批量删除 + 新增/编辑抽屉 */
const { list, query, loading, load, del, selectedKeys, rowSelection, batchDeleting, batchDelete, visible, info, openAdd, openEdit, submit } = useAdminTable({
    api: '/api/GetPayMethodAdmin',
    remove: '/api/delPayMethod',
    batchRemove: '/api/batchDelPayMethod',
    addApi: '/api/addPaymethod',
    editApi: '/api/editPayMethod',
    label: '支付方式',
    extraQuery: { xu_exstatus: 2 },
})

const columns = [
    {
        title: '图标',
        slotName: 'n_icon',
        width: 150,
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '名称',
        dataIndex: 'n_name',
        width: 150,
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '编码',
        dataIndex: 'n_code',
        width: 150,
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '权重',
        dataIndex: 'n_index',
        width: 150,
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '状态',
        slotName: 'n_off',
        width: 150,
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '操作',
        dataIndex: 'console',
        slotName: 'console',
        width: 130,
        fixed: 'right',
    },
];
</script>