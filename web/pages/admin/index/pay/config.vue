<template>
    <div>
        <AdminTable title="支付配置" :columns="columns" :list="list" :loading="loading" :query="query"
            v-model:selectedKeys="selectedKeys" :row-selection="rowSelection" :batch-deleting="batchDeleting"
            add-text="新增配置" :show-pagination="false" @search="load" @add="() => openAdd()"
            @batch-delete="batchDelete">
            <template #toolbar-extra>
                <a-button type="primary" status="success" :loading="refreshing" @click="refreshWechatCert()">刷新微信平台证书</a-button>
            </template>
            <template #n_icon="{ record }">
                <a-image alt="avatar" width="30" :src="record.n_icon"></a-image>
            </template>
            <template #n_off="{ record }">
                <a-tag v-if="record.n_off === '1'" color="arcoblue">正常</a-tag>
                <a-tag v-else color="red">禁用</a-tag>
            </template>
            <template #n_qq="{ record }">
                <a-tag v-if="record.n_qq === '1'" color="arcoblue">正常</a-tag>
                <a-tag v-else color="red">禁用</a-tag>
            </template>
            <template #n_wx="{ record }">
                <a-tag v-if="record.n_wx === '1'" color="arcoblue">正常</a-tag>
                <a-tag v-else color="red">禁用</a-tag>
            </template>
            <template #n_ali="{ record }">
                <a-tag v-if="record.n_ali === '1'" color="arcoblue">正常</a-tag>
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

        <a-drawer :width="740" :visible="visible" @ok="submit" @cancel="() => {
            visible = false
        }" unmountOnClose title="支付配置详情">
            <div>
                <a-form style="margin: 0 auto;" :model="info">
                    <a-form-item label="名称">
                        <a-input v-model="info.n_name" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item label="编码">
                        <a-input v-model="info.n_code" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item label="状态">
                        <a-radio-group v-model="info.n_off">
                            <a-radio value="1">正常</a-radio>
                            <a-radio value="0">禁用</a-radio>
                        </a-radio-group>
                    </a-form-item>
                    <a-form-item label="qq支付">
                        <a-radio-group v-model="info.n_qq">
                            <a-radio value="1">正常</a-radio>
                            <a-radio value="0">禁用</a-radio>
                        </a-radio-group>
                    </a-form-item>
                    <a-form-item label="微信支付">
                        <a-radio-group v-model="info.n_wx">
                            <a-radio value="1">正常</a-radio>
                            <a-radio value="0">禁用</a-radio>
                        </a-radio-group>
                    </a-form-item>
                    <a-form-item label="支付宝支付">
                        <a-radio-group v-model="info.n_ali">
                            <a-radio value="1">正常</a-radio>
                            <a-radio value="0">禁用</a-radio>
                        </a-radio-group>
                    </a-form-item>
                    <a-divider orientation="center">配置信息</a-divider>
                    <a-form-item label="配置信息">
                        <a-button type="primary" @click="()=>{
                            if(info.n_config){
                                info.n_config.push({})
                            }else{
                                info.n_config = [{}]
                            }
                        }">新增配置</a-button>
                    </a-form-item>
                    <a-table :columns="columnsConfig" :data="info.n_config" :pagination="false" :loading="loading"
                        :scroll="{
                            x: '100%'
                        }">
                        <template #name="{ record }">
                              <a-input v-model="record.name" placeholder="请输入" />
                        </template>
                         <template #key="{ record }">
                              <a-input v-model="record.key" placeholder="请输入" />
                        </template>
                         <template #value="{ record }">
                              <a-input v-model="record.value" placeholder="请输入" />
                        </template>
                        <template #console="{ record,rowIndex }">
                            <a-space>
                                <a-popconfirm content="确认要删除此数据？删除后将无法恢复" type="error"
                                    @ok="() => { info.n_config.splice(rowIndex, 1)}" position="bottom">
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
import { Message } from '@arco-design/web-vue';
/* 统一列表页封装：查询 + 分页 + 删除 + 批量删除 + 新增/编辑抽屉 */
const { list, query, loading, load, del, selectedKeys, rowSelection, batchDeleting, batchDelete, visible, info, openAdd, openEdit, submit, submitting } = useAdminTable({
    api: '/api/getPayConfig',
    remove: '/api/delPayConfig',
    batchRemove: '/api/batchDelPayConfig',
    addApi: '/api/addPayConfig',
    editApi: '/api/editPayConfig',
    label: '支付配置',
    extraQuery: { xu_exstatus: 2 },
    /* n_config 需序列化为 JSON 字符串（返回载荷，不改动抽屉表单） */
    beforeSubmit: (info) => ({ ...info, n_config: JSON.stringify(info.n_config) }),
})

const columns = [
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
        title: '修改时间',
        dataIndex: 'n_time',
        width: 150,
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '是否启用',
        slotName: 'n_off',
        width: 150,
        ellipsis: true,
        tooltip: true,
    },
    {
        title: 'QQ启用',
        slotName: 'n_qq',
        width: 150,
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '微信启用',
        slotName: 'n_wx',
        width: 150,
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '支付宝启用',
        slotName: 'n_ali',
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



const columnsConfig = [
    {
        title: '显示名称',
        slotName: 'name',
        width: 100,
    },
    {
        title: '参数名',
        slotName: 'key',
        width: 100,
    },
    {
        title: '参数值',
        slotName: 'value',
        width: 200,
    },
    {
        title: '操作',
        dataIndex: 'console',
        slotName: 'console',
        width: 70,
        fixed: 'right',
    },
];

/* 刷新微信平台证书 */
const refreshing = ref(false)
const refreshWechatCert = async () => {
    if (refreshing.value) return
    refreshing.value = true
    try {
        const res = await useApiFetch().post('/api/refreshWechatCert')
        if (res.code == 200) {
            Message.success(res.msg)
            load()
        } else {
            Message.error(res.msg)
        }
    } catch (e) {
        Message.error('刷新失败，请稍后重试')
    } finally {
        refreshing.value = false
    }
}
</script>