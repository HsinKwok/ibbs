<template>
    <AdminTable title="文件管理" :columns="columns" :list="list" :loading="loading"
        v-model:selectedKeys="selectedKeys" :row-selection="rowSelection" :batch-deleting="batchDeleting"
        :show-search="false" :show-pagination="false" row-key="key" :scroll="{ y: 'calc(100vh - 250px)', x: '100%' }"
        @batch-delete="() => batchDelete()">
        <template #toolbar-extra>
            <a-button type="primary" @click="refresh()">刷新</a-button>
        </template>
        <template #preview="{ record }">
            <a-image v-if="isImage(record)" width="80" height="48" :src="record.url" fit="cover" />
            <icon-file v-else class="file-icon" />
        </template>
        <template #size="{ record }">
            {{ formatSize(record.size) }}
        </template>
        <template #uploadTime="{ record }">
            {{ formatTime(record.uploadTime) }}
        </template>
        <template #console="{ record }">
            <a-space>
                <a-button size="mini" @click="copyUrl(record)">复制链接</a-button>
                <a-button size="mini" type="primary" status="danger" @click="openDel(record)">删除</a-button>
            </a-space>
        </template>
        <template #footer>
            <a-space>
                <a-button size="mini" :disabled="page <= 1" @click="prevPage">上一页</a-button>
                <span>第 {{ page }} 页</span>
                <a-button size="mini" :disabled="!truncated" @click="nextPage">下一页</a-button>
            </a-space>
        </template>
    </AdminTable>

    <!-- 删除确认弹窗 -->
    <a-modal v-model:visible="delVisible" title="删除确认" :width="400" :ok-loading="delLoading" ok-text="确认删除"
        cancel-text="取消" @ok="confirmDel" @cancel="closeDel">
        <div class="del-modal">
            <icon-exclamation-circle-fill class="del-modal__icon" />
            <div class="del-modal__body">
                <p>确认要删除以下文件？删除后将无法恢复。</p>
                <p class="del-modal__name">{{ currentFile?.filename }}</p>
            </div>
        </div>
    </a-modal>
</template>

<script setup>
import { Message } from '@arco-design/web-vue';
import { getSiteDateParts } from '@/utils/format'

const SiteConfig = useSiteConfig()

/* 列表：游标分页 + 批量删除，复用 useAdminTable */
const { list, loading, load, refresh, reload, nextPage, prevPage, page, truncated, selectedKeys, rowSelection, batchDeleting, batchDelete } = useAdminTable({
    api: '/api/getUploadFileList',
    remove: (filename) => useApiFetch().post('/api/delUploadFile', { filename }),
    batchRemove: (filenames) => useApiFetch().post('/api/batchDelUploadFile', { filenames }),
    label: '文件',
    pagination: 'cursor',
    extraQuery: { limit: 50 },
})

/* 删除确认弹窗 */
const delVisible = ref(false)
const delLoading = ref(false)
const currentFile = ref(null)

const openDel = (record) => {
    currentFile.value = record
    delVisible.value = true
}

const closeDel = () => {
    delVisible.value = false
    currentFile.value = null
}

const confirmDel = async () => {
    if (!currentFile.value) return
    delLoading.value = true
    const res = await useApiFetch().post('/api/delUploadFile', {
        filename: currentFile.value.key,
    })
    delLoading.value = false
    if (res.code === 200) {
        Message.success(res.msg)
        closeDel()
        /* 删除当前页最后一条时回退一页，避免空白页 */
        if (list.value.length === 1 && page.value > 1) {
            prevPage()
        } else {
            reload()
        }
    } else {
        Message.error(res.msg)
    }
}

const copyUrl = async (record) => {
    try {
        await navigator.clipboard.writeText(record.url)
        Message.success('链接已复制')
    } catch (e) {
        Message.error('复制失败，请手动复制：' + record.url)
    }
}

const isImage = (record) => (record.mimetype || '').startsWith('image/')

const formatSize = (size) => {
    if (!size && size !== 0) return '-'
    if (size < 1024) return size + ' B'
    if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB'
    return (size / 1024 / 1024).toFixed(2) + ' MB'
}

const formatTime = (time) => {
    if (!time) return '-'
    const d = new Date(time)
    if (isNaN(d.getTime())) return '-'
    /* 统一按站点配置时区展示（uploadTime 为 UTC ISO 字符串） */
    const p = getSiteDateParts(SiteConfig.Config.n_timezone, d)
    const pad = (n) => String(n).padStart(2, '0')
    return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`
}

const columns = [
    {
        title: '预览',
        dataIndex: 'preview',
        slotName: 'preview',
        width: 120,
    },
    {
        title: '文件名',
        dataIndex: 'filename',
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '大小',
        dataIndex: 'size',
        slotName: 'size',
        width: 120,
    },
    {
        title: '上传时间',
        dataIndex: 'uploadTime',
        slotName: 'uploadTime',
        width: 180,
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

<style lang="scss" scoped>
.file-icon {
    font-size: 28px;
    color: #86909c;
}

.del-modal {
    display: flex;
    align-items: flex-start;
    gap: 10px;

    &__icon {
        font-size: 22px;
        color: #f53f3f;
        flex-shrink: 0;
        margin-top: 2px;
    }

    &__body p {
        margin: 0;
        line-height: 1.6;
        color: #4e5969;
    }

    &__name {
        margin-top: 6px !important;
        font-weight: 600;
        color: #1d2129;
        word-break: break-all;
    }
}
</style>
