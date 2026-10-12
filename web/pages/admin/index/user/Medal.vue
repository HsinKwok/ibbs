<template>
    <div>
        <AdminTable title="勋章管理" :columns="columns" :list="list" :loading="loading" :query="query"
            v-model:selectedKeys="selectedKeys" :row-selection="rowSelection" :batch-deleting="batchDeleting"
            add-text="新增勋章" :draggable="true" @search="load" @add="() => openAdd()"
            @batch-delete="batchDelete" @change="handleSecondNavChange">
            <template #n_icon="{ record }">
                    <img alt="avatar" :src="record.n_src" style="height:  30px;" loading="lazy" />
            </template>
            <template #n_type="{ record }">
                <a-tag v-if="record.n_type === '1'" color="arcoblue">发帖数</a-tag>
                <a-tag v-if="record.n_type === '2'" color="orange">获赞数</a-tag>
                <a-tag v-if="record.n_type === '3'" color="green">评论数</a-tag>
                <a-tag v-if="record.n_type === '4'" color="purple">粉丝数</a-tag>
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

        <a-drawer :width="740" :visible="visible" @ok="submit" @cancel="() => {
            visible = false
        }" unmountOnClose title="新增勋章信息">
            <div>
                <a-form style="margin: 0 auto;" :model="info">
                    <a-form-item field="name" label="图标">
                        <Upimg :src="info.n_src" width="100" height="100" @success="(e) => {
                            info.n_src = e
                        }"></Upimg>
                    </a-form-item>
                    <a-form-item field="name" label="阈值">
                        <a-input v-model="info.n_threshold" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="name" label="依据">
                        <a-select class="road" v-model="info.n_type" placeholder="请选择">
                            <a-option value="1">发帖数</a-option>
                            <a-option value="2">获赞数</a-option>
                            <a-option value="3">评论数</a-option>
                            <a-option value="4">粉丝数</a-option>
                        </a-select>
                    </a-form-item>
                    <a-form-item field="post" label="名称">
                        <a-input v-model="info.n_name" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="权重">
                        <a-input v-model="info.n_sort" placeholder="请输入" />
                    </a-form-item>
                </a-form>
            </div>
        </a-drawer>

    </div>
</template>

<script setup>
/* 统一列表页封装：查询 + 分页 + 删除 + 批量删除 + 新增/编辑抽屉 */
const { list, query, loading, load, del, selectedKeys, rowSelection, batchDeleting, batchDelete, visible, info, openAdd, openEdit, submit } = useAdminTable({
    api: '/api/getMedal',
    remove: '/api/delMedal',
    batchRemove: '/api/batchDelMedal',
    addApi: '/api/addMedal',
    editApi: '/api/editMedal',
    label: '勋章',
})

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
        title: '阈值',
        dataIndex: 'n_threshold',
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '依据',
        slotName: 'n_type',
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

const handleSecondNavChange = useDragSort({ list, api: '/api/editMedal', field: 'n_sort', reload: load })
</script>
