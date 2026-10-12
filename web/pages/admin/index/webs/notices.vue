<template>
    <div>
        <AdminTable title="公告管理" :columns="columns" :list="list" :loading="loading" :query="query"
            v-model:selectedKeys="selectedKeys" :row-selection="rowSelection" :batch-deleting="batchDeleting"
            add-text="新增公告" @search="load" @add="() => openAdd()" @batch-delete="batchDelete">
            <template #n_image="{ record }">
                <a-avatar :size="24">
                    <img alt="avatar" :src="record.n_image" loading="lazy" />
                </a-avatar>
            </template>

            <template #n_top="{ record }">
                <a-switch :model-value="record.n_top == 1" :loading="topLoadingId === record.id"
                    @change="(v) => toggleTop(record, v)" />
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

        <a-drawer :width="940" :visible="visible" @ok="submit" @cancel="() => {
            visible = false
        }" unmountOnClose title="公告信息管理">
            <div>
                <a-form style="margin: 0 auto;" :model="info">
                    <a-form-item field="name" label="图标">
                        <Upimg :src="info.n_image" width="100" height="100" @success="(e) => {
                            info.n_image = e
                        }"></Upimg>
                    </a-form-item>
                    <a-form-item field="name" label="名称">
                        <a-input v-model="info.n_name" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="置顶">
                        <a-switch v-model="info.n_top" :checked-value="1" :unchecked-value="0" />
                    </a-form-item>
                    <a-form-item field="post" label="关键词">
                        <a-input v-model="info.n_keys" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="简介">
                        <a-input v-model="info.n_desc" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="阅读次数">
                        <a-input v-model="info.n_read" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="详情">
                        <RichInput v-model:modelValue="info.n_html"></RichInput>
                    </a-form-item>
                </a-form>
            </div>
        </a-drawer>

    </div>
</template>

<script setup>
import { Message } from '@arco-design/web-vue'

/* 统一列表页封装：查询 + 分页 + 删除 + 批量删除 + 新增/编辑抽屉 */
const { list, query, loading, load, del, selectedKeys, rowSelection, batchDeleting, batchDelete, visible, info, openAdd, openEdit, submit } = useAdminTable({
    api: '/api/noticeList',
    remove: '/api/delnotices',
    batchRemove: '/api/batchDelnotices',
    addApi: '/api/addnotices',
    editApi: '/api/editnotices',
    label: '公告',
})

/* 列表内快速切换置顶状态 */
const topLoadingId = ref(0)

const toggleTop = async (record, value) => {
    topLoadingId.value = record.id
    try {
        const res = await useApiFetch().post('/api/editnotices', { id: record.id, n_top: value ? 1 : 0 })
        if (res.code === 200) {
            Message.success(value ? '已置顶' : '已取消置顶')
            load()
        } else {
            Message.error(res.msg || '操作失败')
        }
    } catch (e) {
        Message.error('操作失败，请稍后重试')
    } finally {
        topLoadingId.value = 0
    }
}

const columns = [
    {
        title: '图标',
        dataIndex: 'n_image',
        slotName: 'n_image',
    },
    {
        title: '名称',
        dataIndex: 'n_name',
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '置顶',
        dataIndex: 'n_top',
        slotName: 'n_top',
        width: 90,
    },
    {
        title: '关键词',
        dataIndex: 'n_keys',
    },
    {
        title: '简介',
        dataIndex: 'n_desc',
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '发布时间',
        dataIndex: 'n_time',
    },
    {
        title: '阅读次数',
        dataIndex: 'n_read',
    },
    {
        title: '操作',
        dataIndex: 'console',
        slotName: 'console',
        width: 220,
        fixed: 'right',
    },
];
</script>
