<template>
    <div>
        <AdminTable title="轮播图管理" :columns="columns" :list="list" :loading="loading" :query="query"
            v-model:selectedKeys="selectedKeys" :row-selection="rowSelection" :batch-deleting="batchDeleting"
            add-text="新增轮播图" @search="load" @add="() => openAdd()" @batch-delete="batchDelete">
            <template #n_src="{ record }">
                <a-image width="100" height="50" :src="record.n_src" />
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
        }" unmountOnClose title="轮播图信息管理">
            <div>
                <a-form style="margin: 0 auto;" :model="info">
                    <a-form-item field="name" label="图标">
                        <Upimg :src="info.n_src" width="100" height="100" @success="(e) => {
                            info.n_src = e
                        }"></Upimg>
                    </a-form-item>
                    <a-form-item field="name" label="名称">
                        <a-input v-model="info.n_name" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="介绍">
                        <a-input v-model="info.n_dosc" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="权重">
                        <a-input v-model="info.n_sort" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="地址">
                        <a-input v-model="info.n_url" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="name" label="位置">
                        <a-select v-model="info.n_pos" placeholder="Please select ...">
                            <a-option value="1">首页位置</a-option>
                            <a-option value="2">我的关注</a-option>
                            <a-option value="3">热门圈子</a-option>
                            <a-option value="4">视频图片</a-option>
                            <a-option value="5">跳蚤市场</a-option>
                            <a-option value="6">热门UP主</a-option>
                        </a-select>
                    </a-form-item>
                </a-form>
            </div>
        </a-drawer>

    </div>
</template>

<script setup>
/* 统一列表页封装：查询 + 分页 + 删除 + 批量删除 + 新增/编辑抽屉 */
const { list, query, loading, load, del, selectedKeys, rowSelection, batchDeleting, batchDelete, visible, info, openAdd, openEdit, submit } = useAdminTable({
    api: '/api/swipers',
    remove: '/api/delswipers',
    batchRemove: '/api/batchDelswipers',
    addApi: '/api/addswipers',
    editApi: '/api/editswipers',
    label: '轮播图',
})

const columns = [
    {
        title: '图/视频',
        dataIndex: 'n_src',
        slotName: 'n_src',
    },
    {
        title: '名称',
        dataIndex: 'n_name',
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '简介',
        dataIndex: 'n_dosc',
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '权重',
        dataIndex: 'n_sort',
    },
    {
        title: '跳转地址',
        dataIndex: 'n_url',
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
