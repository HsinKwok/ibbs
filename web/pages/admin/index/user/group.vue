<template>
    <div>
        <AdminTable title="用户组管理" :columns="columns" :list="list" :loading="loading" :query="query"
            v-model:selectedKeys="selectedKeys" :row-selection="rowSelection" :batch-deleting="batchDeleting"
            add-text="新增用户组" @search="load" @add="() => openAdd()" @batch-delete="handleBatchDelete">
            <template #n_icon="{ record }">
                <a-avatar :size="24">
                    <img alt="avatar" :src="record.n_icon" loading="lazy" />
                </a-avatar>
            </template>

            <template #n_deft="{ record }">
                <a-tag checkable color="#165DFF" v-if="isBuiltin(record)">系统内置</a-tag>
                <a-tag checkable color="#00b42a" v-else-if="record.n_deft == 1">默认用户组</a-tag>
                <a-tag checkable color="#0fc6c2" v-else @click="deftUserGroup(record.id)">非默认</a-tag>
            </template>

            <template #console="{ record }">
                <!-- 系统内置组（管理员组）不可编辑/删除，也不参与价格管理 -->
                <span v-if="isBuiltin(record)" style="color: #86909c;">系统内置，不可操作</span>
                <a-space v-else>
                    <a-button size="mini" style="background-color: #0fc6c2;"
                        @click="info = record, GetPriceList(), PriceShow = true" type="primary">价格管理</a-button>
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
        }" unmountOnClose title="用户组信息管理">
            <div>
                <a-form style="margin: 0 auto;" :model="info">
                    <a-form-item field="name" label="图标">
                        <Upimg :src="info.n_icon" width="100" height="100" @success="(e) => {
                            info.n_icon = e
                        }"></Upimg>
                    </a-form-item>
                    <a-form-item field="name" label="名侧小图标">
                        <Upimg :src="info.n_mini_icon" width="100" height="100" @success="(e) => {
                            info.n_mini_icon = e
                        }"></Upimg>
                    </a-form-item>
                    <a-form-item field="name" label="信侧大图标">
                        <Upimg :src="info.n_info_icon" width="100" height="100" @success="(e) => {
                            info.n_info_icon = e
                        }"></Upimg>
                    </a-form-item>
                    <a-form-item field="name" label="背景图片">
                        <Upimg :src="info.n_back_image" width="300" height="100" @success="(e) => {
                            info.n_back_image = e
                        }"></Upimg>
                    </a-form-item>


                    <a-form-item field="name" label="名称">
                        <a-input v-model="info.n_name" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="手续费(%)">
                        <a-input v-model="info.n_withdrawal_fee" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="提现单笔最小">
                        <a-input v-model="info.n_withdrawal_min" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="提现单笔最大">
                        <a-input v-model="info.n_withdrawal_max" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="积分兑余额比例">
                        <a-input v-model="info.n_points_ratio" placeholder="请输入，如 100 表示 100 积分兑 1 元" />
                    </a-form-item>
                    <a-form-item field="post" label="增加QPS数量">
                        <a-input v-model="info.n_qps" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="价格折扣(%)">
                        <a-input v-model="info.n_discount" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="背景颜色">
                        <a-color-picker defaultValue="#165DFF" showHistory showPreset v-model="info.n_back" />
                    </a-form-item>
                    <a-form-item field="post" label="字体颜色">
                        <a-color-picker defaultValue="#FFFFFF" showHistory showPreset v-model="info.n_text_color" />
                    </a-form-item>
                    <a-form-item field="post" label="简介">
                        <a-input v-model="info.n_note" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="权重">
                        <a-input v-model="info.n_sort" placeholder="请输入" />
                    </a-form-item>
                </a-form>
            </div>
        </a-drawer>


        <a-drawer :width="1240" :visible="PriceShow" @ok="() => { PriceShow = false }" @cancel="() => {
            PriceShow = false
        }" unmountOnClose title="价格管理">
            <div>
                <!-- 添加价格 -->
                <a-button type="primary" @click="addPrice()">添加价格</a-button>
                <a-button type="primary" status="danger" :disabled="!priceSelectedKeys.length"
                    :loading="priceBatchDeleting" @click="priceBatchDelete()">批量删除</a-button>
                <a-table :columns="Pricecolumns" :data="PriceList" :pagination="false" :loading="Priceloading"
                    row-key="id" v-model:selectedKeys="priceSelectedKeys" :row-selection="priceRowSelection">
                    <template #n_price="{ record }">
                        <a-input v-model="record.n_price" placeholder="请输入" />
                    </template>
                    <template #n_strikethroughprice="{ record }">
                        <a-input v-model="record.n_strikethroughprice" placeholder="请输入" />
                    </template>
                    <template #n_points="{ record }">
                        <a-input v-model="record.n_points" placeholder="请输入" />
                    </template>
                    <template #n_give="{ record }">
                        <a-input v-model="record.n_give" placeholder="请输入" />
                    </template>
                    <template #n_day="{ record }">
                        <a-input v-model="record.n_day" placeholder="请输入" />
                    </template>
                    <template #n_sort="{ record }">
                        <a-input v-model="record.n_sort" placeholder="请输入" />
                    </template>
                    <template #console="{ record, rowIndex }">
                        <a-space>
                            <!-- 确定编辑 -->
                            <a-button size="mini" @click="editPrice(rowIndex)" type="primary">确定</a-button>

                            <a-popconfirm content="确认要删除此数据？删除后将无法恢复" type="error" @ok="() => { delPrice(record.id) }"
                                position="bottom">
                                <a-button size="mini" type="primary" status="danger">删除</a-button>
                            </a-popconfirm>
                        </a-space>
                    </template>
                    <template #footer>

                    </template>
                </a-table>
            </div>
        </a-drawer>
    </div>
</template>

<script setup>
import { Message } from '@arco-design/web-vue';
/* 统一列表页封装：查询 + 分页 + 删除 + 批量删除 + 新增/编辑抽屉 */
const { list, query, loading, load, del, selectedKeys, rowSelection, batchDeleting, batchDelete, visible, info, openAdd, openEdit, submit } = useAdminTable({
    api: '/api/usergroup',
    remove: '/api/delusergroup',
    batchRemove: '/api/batchDelusergroup',
    addApi: '/api/addusergroup',
    editApi: '/api/editusergroup',
    label: '用户组',
})

const columns = [
    {
        title: '图标',
        slotName: 'n_icon',
    },
    {
        title: '名称',
        dataIndex: 'n_name',
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '默认',
        slotName: 'n_deft',
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
    },
    {
        title: '操作',
        dataIndex: 'console',
        slotName: 'console',
        width: 220,
        fixed: 'right',
    },
];

/* 是否为系统内置组（管理员组）：不可编辑/删除/设为默认 */
const isBuiltin = (record) => Number(record?.n_builtin) === 1

/* 系统内置组不参与批量删除：调用前从勾选集合剔除，避免「全选」导致整批删除失败 */
const handleBatchDelete = () => {
    const builtinIds = new Set(list.value.filter(isBuiltin).map((r) => r.id))
    if (builtinIds.size) {
        selectedKeys.value = selectedKeys.value.filter((key) => !builtinIds.has(key))
    }
    batchDelete()
}

/* 设置默认用户组 deftusergroup */
const deftUserGroup = async (id) => {
    const res = await useApiFetch().post('/api/deftusergroup', {
        id
    })
    if (res.code === 200) {
        Message.success('设置成功')
        load()
    } else {
        Message.error(res.msg)
    }
}


const PriceShow = ref(false)
const Pricecolumns = [
    {
        title: '价格',
        slotName: 'n_price',
    },

    {
        title: '划线价',
        slotName: 'n_strikethroughprice',
    },
    {
        title: '积分价格',
        slotName: 'n_points',
    },
    {
        title: '赠送积分',
        slotName: 'n_give',
    },
    {
        title: '时长(天)',
        slotName: 'n_day',
    },
    {
        title: '权重',
        slotName: 'n_sort',
    },
    {
        title: '操作',
        dataIndex: 'console',
        slotName: 'console',
        width: 220,
        fixed: 'right',
    },
];

/* 获取价格列表信息 */
const PriceList = ref([])
const GetPriceFrom = ref({
    page: 1,
    pagesize: 999,
})
const Priceloading = ref(false)
const GetPriceList = async () => {
    Priceloading.value = true
    GetPriceFrom.value.n_gid = info.value.id
    const res = await useApiFetch().post('/api/usergroup_price', GetPriceFrom.value)
    if (res.code === 200) {
        PriceList.value = res.data
    } else {
        Message.error(res.msg)
    }
    Priceloading.value = false
}

/* 删除价格信息 delusergroup_price */
const delPrice = async (id) => {
    const res = await useApiFetch().post('/api/delusergroup_price', {
        id
    })
    if (res.code === 200) {
        Message.success('删除成功')
        GetPriceList()
    } else {
        Message.error(res.msg)
    }
}

/* 批量删除价格 */
const removeUserGroupPrice = (id) => useApiFetch().post('/api/delusergroup_price', { id })
const {
    selectedKeys: priceSelectedKeys,
    rowSelection: priceRowSelection,
    batchDeleting: priceBatchDeleting,
    batchDelete: priceBatchDelete,
} = useBatchDelete(removeUserGroupPrice, {
    batchRemove: (ids) => useApiFetch().post('/api/batchDelusergroup_price', { ids }),
    label: '价格',
    reload: () => GetPriceList(),
})

/* 编辑、添加价格信息 editusergroup_price */
const editPrice = async (record) => {
    const res = await useApiFetch().post('/api/editusergroup_price', PriceList.value[record])
    if (res.code === 200) {
        Message.success('编辑成功')
        GetPriceList()
    } else {
        Message.error(res.msg)
    }
}

/* 添加价格信息 addusergroup_price */
const addPrice = async () => {
    const res = await useApiFetch().post('/api/addusergroup_price', {
        n_gid: info.value.id
    })
    if (res.code === 200) {
        Message.success('添加成功')
        GetPriceList()
    } else {
        Message.error(res.msg)
    }
}
</script>
