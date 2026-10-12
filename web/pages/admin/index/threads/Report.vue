<!-- GetReportAdmin -->
 <!-- GetCommentsAdmin -->
 <template>
    <div>
        <AdminTable title="举报列表" :columns="columns" :list="list" :loading="loading" :query="query"
            v-model:selectedKeys="selectedKeys" :row-selection="rowSelection" :batch-deleting="batchDeleting"
            @search="load" @batch-delete="batchDelete">
            <template #n_html="{ record }">
                <div class="comment-content" v-html="sanitizeHtml(record.n_html)" />
            </template>
            <template #thread_name="{ record }">
                <div class="thread-info">
                    <div class="thread-name">{{ record.thread?.n_name }}</div>
                    <div class="thread-meta">
                        <span>阅读: {{ record.thread?.n_read }}</span>
                        <span>回复: {{ record.thread?.n_msgs }}</span>
                        <span>点赞: {{ record.thread?.n_starts }}</span>
                    </div>
                </div>
            </template>
            <template #n_permission="{ record }">
                <a-tag color="arcoblue" v-if="record.thread?.n_permission === '1'">免费</a-tag>
                <a-tag color="arcoblue" v-if="record.thread?.n_permission === '2'">积分</a-tag>
                <a-tag color="orange" v-if="record.thread?.n_permission === '3'">余额</a-tag>
                <a-tag v-if="!record.thread?.n_permission">-</a-tag>
            </template>
            <template #n_price="{ record }">
                {{ record.thread?.n_price ? `¥${record.thread.n_price}` : '-' }}
            </template>
            <template #console="{ record }">
                <a-space>
                    <a-popconfirm content="确认要删除此举报？删除后将无法恢复" type="error" @ok="() => { del(record.id) }"
                        position="bottom">
                        <a-button size="mini" type="primary" status="danger">删除</a-button>
                    </a-popconfirm>
                </a-space>
            </template>
        </AdminTable>
    </div>
</template>

<script setup>
import { sanitizeHtml } from '@/utils/sanitize'
/* 统一列表页封装：查询 + 分页 + 删除 + 批量删除 */
const { list, query, loading, load, del, selectedKeys, rowSelection, batchDeleting, batchDelete } = useAdminTable({
    api: '/api/GetReportAdmin',
    remove: '/api/DelReportAdmin',
    batchRemove: '/api/batchDelReportAdmin',
    label: '举报',
})

const columns = [

    {
        title: '举报内容',
        slotName: 'n_html',
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '所属帖子',
        slotName: 'thread_name',
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '帖子类型',
        slotName: 'n_permission',
        width: 100,
    },
    {
        title: '帖子价格',
        slotName: 'n_price',
        width: 100,
    },
    {
        title: '举报时间',
        dataIndex: 'n_time',
        width: 180,
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

<style lang="scss" scoped>
.comment-content {
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    line-height: 1.5;
}

.thread-info {
    .thread-name {
        font-weight: 500;
        margin-bottom: 4px;
    }

    .thread-meta {
        font-size: 12px;
        color: #86909c;

        span {
            margin-right: 8px;
        }
    }
}
</style>
