<template>
    <div>
        <AdminTable title="帖子列表" :columns="columns" :list="list" :loading="loading" :query="query"
            v-model:selectedKeys="selectedKeys" :row-selection="rowSelection" :batch-deleting="batchDeleting"
            @search="load" @batch-delete="batchDelete">
            <template #n_icon="{ record }">
                <a-avatar :size="24">
                    <img alt="avatar" :src="record.n_icon" loading="lazy" />
                </a-avatar>
            </template>
            <template #n_nickname="{ record }">
                {{ record.user?.n_nickname }}
            </template>
            <template #n_permission="{ record }">
                <a-tag color="arcoblue" v-if="record.n_permission === '1'">免费</a-tag>
                <a-tag color="arcoblue" v-if="record.n_permission === '2'">积分</a-tag>
                <a-tag color="orange" v-if="record.n_permission === '3'">余额</a-tag>
            </template>
            <template #category="{ record }">
                {{ getCname(record.category) }}
            </template>
            <template #console="{ record }">
                <a-space>
                    <a-button size="mini" @click="navigateTo(getAdminBase() + '/threads/info/' + record.id)" type="primary">编辑</a-button>
                    <a-popconfirm content="确认要删除此数据？删除后将无法恢复" type="error" @ok="() => { del(record.id) }"
                        position="bottom">
                        <a-button size="mini" type="primary" status="danger">删除</a-button>
                    </a-popconfirm>
                </a-space>
            </template>
        </AdminTable>
    </div>
</template>

<script setup>
import { getAdminBase } from '@/utils/adminPath';
/* 统一列表页封装：查询 + 分页 + 删除 + 批量删除（编辑走详情页跳转，无抽屉） */
const { list, query, loading, load, del, selectedKeys, rowSelection, batchDeleting, batchDelete } = useAdminTable({
    api: '/api/GetThreadsAdmin',
    remove: '/api/DelThreadsAdmin',
    batchRemove: '/api/batchDelThreadsAdmin',
    label: '帖子',
})
/* 获取分类：拼接分类名，过滤空值并用「、」分隔 */
const getCname = (res) => {
    if (!Array.isArray(res)) return ''
    return res.map((item) => item?.n_name).filter(Boolean).join('、')
}

const columns = [
    {
        title: '名称',
        dataIndex: 'n_name',
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '发布用户',
        slotName: 'n_nickname',
        ellipsis: true,
        tooltip: true,
    },
    /* category */
    {
        title: '分类',
        slotName: 'category',
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '类型',
        slotName: 'n_permission',
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '价格',
        dataIndex: 'n_price',
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '回复次数',
        dataIndex: 'n_msgs',
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '点赞数量',
        dataIndex: 'n_starts',
    },
    {
        title: '阅读次数',
        dataIndex: 'n_read',
    },
    {
        title: '发布时间',
        dataIndex: 'n_time',
        width: 200,
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
