<template>
    <div>
        <AdminTable title="跳蚤市场管理" :columns="columns" :list="list" :loading="loading"
            :query="query" v-model:selectedKeys="selectedKeys" :row-selection="rowSelection"
            :batch-deleting="batchDeleting" add-text="发布商品" @search="load" @add="() => openAdd({ n_status: '1' })"
            @batch-delete="batchDelete">
            <template #toolbar-extra>
                <a-button type="primary" status="success" @click="openDesc">编辑说明</a-button>
            </template>

            <template #n_status="{ record }">
                <a-tag :color="record.n_status === '1' ? 'green' : 'gray'">
                    {{ record.n_status === '1' ? '已上架' : '已下架' }}
                </a-tag>
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
        }" unmountOnClose title="商品信息管理">
            <div>
                <a-form style="margin: 0 auto;" :model="info">
                    <a-form-item field="n_name" label="商品名称">
                        <a-input v-model="info.n_name" placeholder="请输入商品名称" />
                    </a-form-item>
                    <a-form-item field="n_price" label="售价（元）">
                        <a-input-number v-model="info.n_price" model-event="input" :min="0" placeholder="售价" style="width: 100%" />
                    </a-form-item>
                    <a-form-item field="n_original_price" label="原价（元）">
                        <a-input-number v-model="info.n_original_price" model-event="input" :min="0" placeholder="原价" style="width: 100%" />
                    </a-form-item>
                    <a-form-item field="n_category" label="分类">
                        <a-select v-model="info.n_category" placeholder="选择或输入新分类" allow-create allow-search allow-clear>
                            <a-option v-for="c in categoryOptions" :key="c.id" :value="c.n_name">{{ c.n_name }}</a-option>
                        </a-select>
                    </a-form-item>
                    <a-form-item field="n_validity" label="有效期">
                        <a-input v-model="info.n_validity" placeholder="例如 2026-12-31 / 长期有效" />
                    </a-form-item>
                    <a-form-item field="n_contact" label="联系方式">
                        <MentionInput v-model="info.n_contact" placeholder="QQ / 微信 / Email，输入 @ 可引用本站用户" />
                    </a-form-item>
                    <a-form-item field="n_description" label="商品描述">
                        <a-textarea v-model="info.n_description" placeholder="商品描述" :max-length="80" allow-clear
                            :textarea-attrs="{ style: { height: '300px' } }" />
                    </a-form-item>
                    <a-form-item field="n_status" label="状态">
                        <a-select v-model="info.n_status" placeholder="Please select ...">
                            <a-option value="1">上架</a-option>
                            <a-option value="0">下架</a-option>
                        </a-select>
                    </a-form-item>
                </a-form>
            </div>
        </a-drawer>

        <a-drawer :width="640" :visible="descVisible" @ok="saveDesc" @cancel="() => {
            descVisible = false
        }" unmountOnClose title="市场说明编辑">
            <div>
                <a-form :model="descForm">
                    <a-form-item field="n_market_desc" label="说明内容">
                        <a-textarea v-model="descForm.n_market_desc" placeholder="每行一条说明" allow-clear
                            :auto-size="{ minRows: 8, maxRows: 20 }" />
                        <template #extra>
                            <div>每行一条，前台「跳蚤市场」右侧栏的「说明」将按行展示；留空则展示系统默认文案。</div>
                        </template>
                    </a-form-item>
                </a-form>
            </div>
        </a-drawer>
    </div>
</template>

<script setup>
import { Message } from '@arco-design/web-vue'

/* 市场分类在分类表 n_class 中的类型标识（1=帖子分类，2=话题，3=跳蚤市场分类） */
const MARKET_CATEGORY_TYPE = '3'

/* 统一列表页封装：查询 + 分页 + 删除 + 批量删除 + 新增/编辑抽屉 */
const { list, query, loading, load, del, selectedKeys, rowSelection, batchDeleting, batchDelete, visible, info, openAdd, openEdit, submit } = useAdminTable({
    api: '/api/GetMarketListAdmin',
    remove: '/api/DelMarketAdmin',
    batchRemove: '/api/batchDelMarketAdmin',
    addApi: '/api/AddMarketAdmin',
    editApi: '/api/EditMarketAdmin',
    label: '商品',
})

/* 分类下拉选项：供商品表单选择；新分类由后端在保存商品时自动收敛入库 */
const categoryOptions = ref([])
const loadCategoryOptions = async () => {
    const res = await useApiFetch().post('/api/getCategoryList', { type: MARKET_CATEGORY_TYPE, page: 1, pagesize: 200 })
    if (res.code === 200) categoryOptions.value = res.data || []
}
onMounted(loadCategoryOptions)
/* 商品抽屉关闭（保存/取消）后刷新选项，使自动收敛的新分类立即可选 */
watch(visible, (v) => { if (!v) loadCategoryOptions() })

/* 市场说明编辑：内容存于站点配置 n_market_desc（纯文本、每行一条），
   前台「跳蚤市场」右侧栏的「说明」据此渲染 */
const descVisible = ref(false)
const descForm = ref({ id: 1, n_market_desc: '' })

const openDesc = async () => {
    const res = await useApiFetch().post('/api/getweb')
    if (res.code === 200) {
        descForm.value = { id: res.data?.id, n_market_desc: res.data?.n_market_desc ?? '' }
        descVisible.value = true
    } else {
        Message.error(res.msg)
    }
}

const saveDesc = async () => {
    const res = await useApiFetch().post('/api/editweb', {
        id: descForm.value.id,
        n_market_desc: descForm.value.n_market_desc,
    })
    if (res.code === 200) {
        Message.success(res.msg)
        descVisible.value = false
    } else {
        Message.error(res.msg)
    }
}

const columns = [
    {
        title: '商品名称',
        dataIndex: 'n_name',
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '售价',
        dataIndex: 'n_price',
    },
    {
        title: '原价',
        dataIndex: 'n_original_price',
    },
    {
        title: '分类',
        dataIndex: 'n_category',
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '有效期',
        dataIndex: 'n_validity',
    },
    {
        title: '状态',
        dataIndex: 'n_status',
        slotName: 'n_status',
        width: 100,
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
