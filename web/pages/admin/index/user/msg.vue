<template>
    <div>
        <AdminTable title="系统消息" :columns="columns" :list="list" :loading="loading" :query="query"
            :show-batch-delete="false" row-key="key" add-text="发布系统消息" @search="load" @add="openPublish">
            <template #n_html="{ record }">
                {{ stripHtml(record.n_html) }}
            </template>

            <template #read="{ record }">
                {{ record.read_count || 0 }} / {{ record.total || 0 }}
            </template>

            <template #console="{ record }">
                <a-space>
                    <a-popconfirm content="确认删除该批次消息？删除后所有用户的此条消息都会被移除" type="error"
                        @ok="() => delBatch(record)" position="bottom">
                        <a-button size="mini" type="primary" status="danger">删除</a-button>
                    </a-popconfirm>
                </a-space>
            </template>
        </AdminTable>

        <a-drawer :width="740" :visible="publishVisible" @ok="submitPublish" @cancel="() => {
            publishVisible = false
        }" unmountOnClose title="发布系统消息">
            <div>
                <a-form style="margin: 0 auto;" :model="publishInfo">
                    <a-form-item field="n_name" label="标题">
                        <a-input v-model="publishInfo.n_name" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="n_html" label="内容">
                        <RichInput v-model:modelValue="publishInfo.n_html"></RichInput>
                    </a-form-item>
                    <a-form-item field="tip">
                        <span style="color: #86909c;">该消息将发送给全部用户。</span>
                    </a-form-item>
                </a-form>
            </div>
        </a-drawer>
    </div>
</template>

<script setup>
import { Message } from '@arco-design/web-vue'

/* 列表：按发布批次聚合（每行代表一次群发），不支持批量删除与编辑 */
const { list, query, loading, load } = useList({ api: '/api/getMsgBatch' })

const stripHtml = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

/* 发布 */
const publishVisible = ref(false)
const publishing = ref(false)
const publishInfo = ref({ n_name: '', n_html: '' })

const openPublish = () => {
    publishInfo.value = { n_name: '', n_html: '' }
    publishVisible.value = true
}

const submitPublish = async () => {
    if (publishing.value) return
    publishing.value = true
    try {
        const res = await useApiFetch().post('/api/addMsg', publishInfo.value)
        if (res.code === 200) {
            Message.success(res.msg || '发布成功')
            publishVisible.value = false
            load()
        } else {
            Message.error(res.msg || '发布失败')
        }
    } catch (e) {
        Message.error('发布失败，请稍后重试')
    } finally {
        publishing.value = false
    }
}

/* 删除批次 */
const delBatch = async (record) => {
    try {
        const res = await useApiFetch().post('/api/delMsg', {
            n_name: record.n_name,
            n_html: record.n_html,
            n_time: record.n_time,
        })
        if (res.code === 200) {
            Message.success('删除成功')
            load()
        } else {
            Message.error(res.msg || '删除失败')
        }
    } catch (e) {
        Message.error('删除失败，请稍后重试')
    }
}

const columns = [
    {
        title: '标题',
        dataIndex: 'n_name',
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '内容',
        dataIndex: 'n_html',
        slotName: 'n_html',
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '发布时间',
        dataIndex: 'n_time',
        width: 180,
    },
    {
        title: '已读 / 触达',
        slotName: 'read',
        width: 120,
    },
    {
        title: '操作',
        dataIndex: 'console',
        slotName: 'console',
        width: 120,
        fixed: 'right',
    },
]
</script>
