<template>
    <div>
        <AdminTable title="活动管理" :columns="columns" :list="list" :loading="loading" :query="query"
            v-model:selectedKeys="selectedKeys" :row-selection="rowSelection" :batch-deleting="batchDeleting"
            add-text="新增活动" :draggable="true" @search="load" @add="() => openAdd()"
            @batch-delete="batchDelete" @change="handleSecondNavChange">
            <template #n_icon="{ record }">
                <a-avatar :size="24">
                    <img alt="avatar" :src="record.n_icon" loading="lazy" />
                </a-avatar>
            </template>
            <template #n_off="{ record }">
                <a-tag v-if="record.n_off === '1'" color="arcoblue">正常</a-tag>
                <a-tag v-if="record.n_off === '2'" color="red">已关闭</a-tag>
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
        }" unmountOnClose title="新增活动信息">
            <div>
                <a-form style="margin: 0 auto;" :model="info">
                    <a-form-item field="name" label="图标">
                        <Upimg :src="info.n_icon" width="100" height="100" @success="(e) => {
                            info.n_icon = e
                        }"></Upimg>
                    </a-form-item>
                    <a-form-item field="name" label="名称">
                        <a-input v-model="info.n_name" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="编码">
                        <a-input v-model="info.n_code" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="简介">
                        <a-input v-model="info.n_note" placeholder="请输入" />
                    </a-form-item>

                    <a-form-item field="post" label="活动路径">
                        <a-input v-model="info.n_path" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="按钮文字">
                        <a-input v-model="info.n_buttext" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item label="状态">
                        <a-radio-group v-model="info.n_off">
                            <a-radio value="1">开启</a-radio>
                            <a-radio value="2">关闭</a-radio>
                        </a-radio-group>
                    </a-form-item>

                    <a-divider orientation="center">奖励设置</a-divider>
                    <a-form-item label="类型">
                        <a-radio-group v-model="info.n_reward_type">
                            <a-radio value="1">积分</a-radio>
                            <a-radio value="2">余额</a-radio>
                        </a-radio-group>
                    </a-form-item>
                    <a-form-item label="配置信息">
                        <a-button type="primary" @click="() => {
                            if (info.n_reward_config) {
                                info.n_reward_config.push({})
                            } else {
                                info.n_reward_config = [{}]
                            }
                        }">新增配置</a-button>
                    </a-form-item>
                    <a-table :columns="columnsConfig" :data="info.n_reward_config" :pagination="false"
                        :loading="loading" :scroll="{
                            x: '100%'
                        }">
                        <template #min="{ record }">
                            <a-input v-model="record.min" placeholder="请输入" />
                        </template>
                        <template #max="{ record }">
                            <a-input v-model="record.max" placeholder="请输入" />
                        </template>
                        <template #price="{ record }">
                            <a-input v-model="record.price" placeholder="请输入" />
                        </template>
                        <template #float="{ record }">
                            <a-input v-model="record.float" placeholder="请输入" />
                        </template>
                        <template #console="{ record, rowIndex }">
                            <a-space>
                                <a-popconfirm content="确认要删除此数据？删除后将无法恢复" type="error"
                                    @ok="() => { info.n_reward_config.splice(rowIndex, 1) }" position="bottom">
                                    <a-button size="mini" type="primary" status="danger">删除</a-button>
                                </a-popconfirm>
                            </a-space>
                        </template>
                        <template #footer>

                        </template>
                    </a-table>
                </a-form>
            </div>
        </a-drawer>

    </div>
</template>

<script setup>
/* 统一列表页封装：查询 + 分页 + 删除 + 批量删除 + 新增/编辑抽屉 */
const { list, query, loading, load, del, selectedKeys, rowSelection, batchDeleting, batchDelete, visible, info, openAdd, openEdit, submit, submitting } = useAdminTable({
    api: '/api/getActivityList',
    remove: '/api/deleActivity',
    batchRemove: '/api/batchDelActivity',
    addApi: '/api/addActivity',
    editApi: '/api/editActivity',
    label: '活动',
    /* n_reward_config 需序列化为 JSON 字符串（返回载荷，不改动抽屉表单） */
    beforeSubmit: (info) => ({ ...info, n_reward_config: JSON.stringify(info.n_reward_config) }),
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
        width: 150,
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '编码',
        dataIndex: 'n_code',
        width: 120,
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '状态',
        slotName: 'n_off',
        width: 80,
    },
    {
        title: '简介',
        dataIndex: 'n_note',
        width: 200,
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '活动路径',
        dataIndex: 'n_path',
        width: 150,
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '按钮文字',
        dataIndex: 'n_buttext',
        width: 100,
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

const handleSecondNavChange = useDragSort({
    list,
    api: '/api/editActivity',
    field: 'n_index',
    payload: (row) => ({ n_reward_config: JSON.stringify(row.n_reward_config) }),
    reload: load,
})

const columnsConfig = [
    {
        title: '次/天范围(小)',
        slotName: 'min',
        width: 100,
    },
    {
        title: '次/天范围(大)',
        slotName: 'max',
        width: 100,
    },
    {
        title: '金额',
        slotName: 'price',
        width: 100,
    },
    {
        title: '金额浮动',
        slotName: 'float',
        width: 100,
    },
    {
        title: '操作',
        dataIndex: 'console',
        slotName: 'console',
        width: 70,
        fixed: 'right',
    },
];
</script>
