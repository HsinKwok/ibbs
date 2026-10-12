<template>
    <div>
        <div>
            <UserHeader title="消息中心"></UserHeader>
        </div>
        <div class="Page">
            <a-tabs v-model:active-key="activeTab" type="rounded">
                <!-- 系统消息 -->
                <a-tab-pane key="msg">
                    <template #title>
                        系统消息
                        <a-badge v-if="unread > 0" :count="unread" :max-count="99" />
                    </template>

                    <div class="msg-toolbar">
                        <span class="msg-summary">共 {{ msgQuery.total }} 条<template v-if="unread > 0">，{{ unread }} 条未读</template></span>
                        <a-button size="small" :disabled="unread === 0" @click="readAll">全部已读</a-button>
                    </div>

                    <div v-if="msgList.length > 0" class="msg-list">
                        <div v-for="item in msgList" :key="item.id" class="msg-item"
                            :class="{ unread: item.n_read !== '1', open: expanded === item.id }" @click="toggleMsg(item)">
                            <span class="msg-dot" v-if="item.n_read !== '1'"></span>
                            <div class="msg-main">
                                <div class="msg-head">
                                    <span class="msg-name">{{ item.n_name }}</span>
                                    <span class="msg-time">{{ item.n_time }}</span>
                                </div>
                                <div v-if="expanded === item.id" class="msg-body">
                                    <RichHtml :html="item.n_html" />
                                </div>
                                <div v-else class="msg-preview">{{ item.n_html }}</div>
                            </div>
                        </div>
                    </div>
                    <div v-else class="empty-state">
                        <div class="empty-icon">🔔</div>
                        <p>暂无消息</p>
                    </div>

                    <ListPager v-model:current="msgQuery.page" v-model:pageSize="msgQuery.pagesize"
                        :total="msgQuery.total" show-page-size :page-size-options="[10, 20, 50]" class="pagination"
                        @load="loadMsgs" />
                </a-tab-pane>

                <!-- 公告 -->
                <a-tab-pane key="notice" title="公告">
                    <div v-if="noticeList.length > 0" class="msg-list">
                        <div v-for="item in noticeList" :key="item.id" class="msg-item"
                            :class="{ open: noticeExpanded === item.id }" @click="toggleNotice(item)">
                            <img v-if="item.n_image" :src="item.n_image" class="notice-thumb" alt="" />
                            <div class="msg-main">
                                <div class="msg-head">
                                    <span class="msg-name"><span v-if="item.n_top == 1" class="notice-top">置顶</span>{{ item.n_name }}</span>
                                    <span class="msg-time">{{ item.n_time }}</span>
                                </div>
                                <div v-if="noticeExpanded === item.id" class="msg-body">
                                    <RichHtml :html="item.n_html" />
                                </div>
                                <div v-else-if="item.n_desc" class="msg-preview">{{ item.n_desc }}</div>
                                <div v-if="isAdmin" class="notice-actions" @click.stop>
                                    <a-button size="mini" type="primary" @click="openEditNotice(item)">编辑</a-button>
                                    <a-popconfirm content="确认要删除此公告？删除后将无法恢复" type="error" position="bottom"
                                        @ok="delNotice(item.id)">
                                        <a-button size="mini" type="primary" status="danger">删除</a-button>
                                    </a-popconfirm>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div v-else class="empty-state">
                        <div class="empty-icon">📢</div>
                        <p>暂无公告</p>
                    </div>

                    <ListPager v-model:current="noticeQuery.page" v-model:pageSize="noticeQuery.pagesize"
                        :total="noticeQuery.total" show-page-size :page-size-options="[10, 20, 50]" class="pagination"
                        @load="loadNotices" />
                </a-tab-pane>

                <!-- 私信 -->
                <a-tab-pane key="chat">
                    <template #title>
                        私信
                        <a-badge v-if="chatUnread > 0" :count="chatUnread" :max-count="99" />
                    </template>

                    <div class="chat-wrap">
                        <!-- 会话列表 -->
                        <div class="chat-side">
                            <div v-if="conversations.length > 0" class="conv-list">
                                <div v-for="c in conversations" :key="c.id" class="conv-item"
                                    :class="{ active: chatPeer && chatPeer.id === c.id }" @click="openChat(c)">
                                    <UserAvatar :src="c.n_avatar" :seed="c.id" :size="40" class="conv-avatar" />
                                    <div class="conv-main">
                                        <div class="conv-head">
                                            <span class="conv-name">{{ c.n_nickname }}</span>
                                            <span class="conv-time">{{ c.n_time }}</span>
                                        </div>
                                        <div class="conv-preview">{{ c.n_recall === '1' ? '[消息已撤回]' : c.n_content }}</div>
                                    </div>
                                    <a-badge v-if="c.unread > 0" :count="c.unread" :max-count="99" class="conv-badge" />
                                </div>
                            </div>
                            <div v-else class="empty-state">
                                <div class="empty-icon">💬</div>
                                <p>暂无私信</p>
                            </div>
                        </div>

                        <!-- 聊天窗口 -->
                        <div class="chat-main">
                            <template v-if="chatPeer">
                                <div class="chat-header">
                                    <UserAvatar :src="chatPeer.n_avatar" :seed="chatPeer.id" :size="28" />
                                    <span class="chat-title">{{ chatPeer.n_nickname }}</span>
                                    <a-popconfirm content="确认删除该私信会话？" type="error" position="bottom"
                                        @ok="delChat">
                                        <a-button size="mini" status="danger" type="text">删除会话</a-button>
                                    </a-popconfirm>
                                </div>
                                <div ref="chatBodyRef" class="chat-body">
                                    <template v-for="m in chatMsgs" :key="m.id">
                                        <div v-if="m.n_recall === '1'" class="chat-recall">
                                            {{ m.n_from === myId ? '你撤回了一条消息' : '对方撤回了一条消息' }}
                                        </div>
                                        <div v-else class="chat-row" :class="{ mine: m.n_from === myId }">
                                            <UserAvatar :src="chatPeer.n_avatar" :seed="chatPeer.id" :size="32"
                                                class="chat-avatar" />
                                            <div class="chat-content">
                                                <div class="chat-bubble">{{ m.n_content }}</div>
                                                <div v-if="m.n_from === myId" class="chat-meta">
                                                    <span class="chat-state">{{ m.n_read === '1' ? '已读' : '未读' }}</span>
                                                    <a-popconfirm v-if="canRecall(m)" content="确认撤回这条私信？" position="bottom"
                                                        @ok="recallChat(m)">
                                                        <a-button class="chat-recall-btn" type="text" size="mini">撤回</a-button>
                                                    </a-popconfirm>
                                                </div>
                                            </div>
                                        </div>
                                    </template>
                                </div>
                                <div class="chat-input">
                                    <a-textarea v-model="chatInput" :auto-size="{ minRows: 2, maxRows: 4 }"
                                        placeholder="输入私信内容..." @keydown.enter.exact.prevent="sendChat" />
                                    <a-button type="primary" :loading="sending" @click="sendChat">发送</a-button>
                                </div>
                            </template>
                            <div v-else class="empty-state">
                                <div class="empty-icon">✉️</div>
                                <p>选择一个会话开始聊天</p>
                            </div>
                        </div>
                    </div>
                </a-tab-pane>
            </a-tabs>
        </div>

        <!-- 管理员编辑公告 -->
        <a-drawer :width="720" :visible="noticeVisible" @ok="submitNotice" @cancel="() => { noticeVisible = false }"
            unmountOnClose title="编辑公告">
            <a-form :model="noticeInfo">
                <a-form-item label="图标">
                    <Upimg :src="noticeInfo.n_image" width="100" height="100"
                        @success="(e) => { noticeInfo.n_image = e }"></Upimg>
                </a-form-item>
                <a-form-item label="名称">
                    <a-input v-model="noticeInfo.n_name" placeholder="请输入" />
                </a-form-item>
                <a-form-item label="置顶">
                    <a-switch v-model="noticeInfo.n_top" :checked-value="1" :unchecked-value="0" />
                </a-form-item>
                <a-form-item label="关键词">
                    <a-input v-model="noticeInfo.n_keys" placeholder="请输入" />
                </a-form-item>
                <a-form-item label="简介">
                    <a-input v-model="noticeInfo.n_desc" placeholder="请输入" />
                </a-form-item>
                <a-form-item label="阅读次数">
                    <a-input v-model="noticeInfo.n_read" placeholder="请输入" />
                </a-form-item>
                <a-form-item label="详情">
                    <RichInput v-model:modelValue="noticeInfo.n_html"></RichInput>
                </a-form-item>
            </a-form>
        </a-drawer>
    </div>
</template>

<script setup>
import { Message } from '@arco-design/web-vue'
import { getTimezoneOffsetMinutes } from '@/utils/format'

/* 消息中心：系统消息（n_msg）+ 公告（n_notices）双 Tab，各自复用 useList 分页 */
const activeTab = ref('msg')

/* 管理员判定：当前用户所属用户组为系统内置管理员组（VipInfo.n_builtin == 1，/api/myinfo 下发），
   且需持有管理员令牌（AToken）。公告编辑/删除接口挂载在 ATokenVar 路由组，须携带 AToken 才能调用；
   未登录后台的管理员不展示操作入口 */
const UserInfo = useUserInfo()
const SiteConfig = useSiteConfig()
const adminToken = useCookie('AToken')
const isAdmin = computed(() => !!adminToken.value && UserInfo.$state.UserInfo.VipInfo?.n_builtin == 1)

/* 系统消息 */
const { list: msgList, query: msgQuery, load: loadMsgs } = useList({
    api: '/api/GetMsgs',
    extraQuery: { pagesize: 20 },
})

const expanded = ref(0)
const unread = ref(0)

const loadUnread = async () => {
    const res = await useApiFetch().post('/api/GetUnreadCount')
    if (res.code === 200) unread.value = res.data.total
}

const toggleMsg = async (item) => {
    if (expanded.value === item.id) {
        expanded.value = 0
        return
    }
    expanded.value = item.id
    if (item.n_read !== '1') {
        const res = await useApiFetch().post('/api/ReadMsg', { id: item.id })
        if (res.code === 200) {
            item.n_read = '1'
            unread.value = Math.max(0, unread.value - 1)
        }
    }
}

const readAll = async () => {
    const res = await useApiFetch().post('/api/ReadMsg')
    if (res.code === 200) {
        msgList.value.forEach((item) => { item.n_read = '1' })
        unread.value = 0
    }
}

/* 公告 */
const { list: noticeList, query: noticeQuery, load: loadNotices } = useList({
    api: '/api/noticeList',
    extraQuery: { pagesize: 20 },
})

const noticeExpanded = ref(0)

const toggleNotice = (item) => {
    noticeExpanded.value = noticeExpanded.value === item.id ? 0 : item.id
}

/* 管理员：编辑 / 删除公告 */
const noticeVisible = ref(false)
const noticeInfo = ref({})

const openEditNotice = (item) => {
    noticeInfo.value = { ...item }
    noticeVisible.value = true
}

const submitNotice = async () => {
    const res = await useApiFetch({ admin: true }).post('/api/EditNotices', { ...noticeInfo.value })
    if (res.code === 200) {
        Message.success('保存成功')
        noticeVisible.value = false
        loadNotices()
    } else {
        Message.error(res.msg || '操作失败')
    }
}

const delNotice = async (id) => {
    const res = await useApiFetch({ admin: true }).post('/api/DelNotices', { id })
    if (res.code === 200) {
        Message.success('删除成功')
        loadNotices()
    } else {
        Message.error(res.msg || '操作失败')
    }
}

/* 私信 */
const route = useRoute()
const myId = computed(() => UserInfo.$state.UserInfo.id)
const conversations = ref([])
const chatUnread = ref(0)
const chatPeer = ref(null)
const chatMsgs = ref([])
const chatInput = ref('')
const sending = ref(false)
const chatBodyRef = ref(null)

const loadConversations = async () => {
    const res = await useApiFetch().post('/api/GetConversations')
    if (res.code === 200) conversations.value = res.data || []
}

const loadChatUnread = async () => {
    const res = await useApiFetch().post('/api/GetChatUnread')
    if (res.code === 200) chatUnread.value = res.data.total
}

const scrollChatToBottom = async () => {
    await nextTick()
    if (chatBodyRef.value) chatBodyRef.value.scrollTop = chatBodyRef.value.scrollHeight
}

/* 打开会话：加载消息并标记已读 */
const openChat = async (conv) => {
    chatPeer.value = conv
    chatInput.value = ''
    startChatPolling()
    const res = await useApiFetch().post('/api/GetChatMsgs', { id: conv.id, page: 1, pagesize: 50 })
    if (res.code === 200) {
        /* 接口按 id 倒序返回，前端反转为时间正序展示 */
        chatMsgs.value = (res.data || []).slice().reverse()
        scrollChatToBottom()
    }
    if (conv.unread > 0) {
        const r = await useApiFetch().post('/api/ReadChat', { id: conv.id })
        if (r.code === 200) {
            conv.unread = 0
            loadChatUnread()
            loadConversations()
        }
    }
}

/* 发送私信 */
const sendChat = async () => {
    if (!chatPeer.value || sending.value) return
    const content = chatInput.value.trim()
    if (!content) return
    sending.value = true
    const res = await useApiFetch().post('/api/SendChat', { to: chatPeer.value.id, n_content: content })
    sending.value = false
    if (res.code === 200) {
        chatInput.value = ''
        const r2 = await useApiFetch().post('/api/GetChatMsgs', { id: chatPeer.value.id, page: 1, pagesize: 50 })
        if (r2.code === 200) {
            chatMsgs.value = (r2.data || []).slice().reverse()
            scrollChatToBottom()
        }
        loadConversations()
    } else {
        Message.error(res.msg || '发送失败')
    }
}

/* 删除会话（仅对当前用户） */
const delChat = async () => {
    if (!chatPeer.value) return
    const res = await useApiFetch().post('/api/DelChat', { id: chatPeer.value.id })
    if (res.code === 200) {
        Message.success('删除成功')
        chatPeer.value = null
        chatMsgs.value = []
        stopChatPolling()
        loadConversations()
    } else {
        Message.error(res.msg || '操作失败')
    }
}

/* 撤回：仅本人发送、未撤回、且在 2 分钟窗口内可撤回 */
const RECALL_WINDOW = 2 * 60 * 1000
/* n_time 为站点配置时区字符串，按同一基准解析为时间戳 */
const parseSiteTime = (s) => {
    const t = Date.parse(String(s || '').replace(' ', 'T') + 'Z')
    return isNaN(t) ? 0 : t
}
const canRecall = (m) =>
    m.n_from === myId.value && m.n_recall !== '1' &&
    (Date.now() + getTimezoneOffsetMinutes(SiteConfig.Config.n_timezone) * 60 * 1000 - parseSiteTime(m.n_time)) <= RECALL_WINDOW

const recallChat = async (m) => {
    const res = await useApiFetch().post('/api/RecallChat', { id: m.id })
    if (res.code === 200) {
        m.n_recall = '1'
        Message.success('已撤回')
        loadConversations()
    } else {
        Message.error(res.msg || '撤回失败')
    }
}

/* 已读回执：会话打开期间轮询，及时同步对方的已读状态 */
let chatTimer = null
const stopChatPolling = () => {
    if (chatTimer) {
        clearInterval(chatTimer)
        chatTimer = null
    }
}
const startChatPolling = () => {
    stopChatPolling()
    chatTimer = setInterval(async () => {
        if (activeTab.value !== 'chat' || !chatPeer.value) return
        const res = await useApiFetch().post('/api/GetChatMsgs', { id: chatPeer.value.id, page: 1, pagesize: 50 })
        if (res.code === 200) {
            const list = (res.data || []).slice().reverse()
            const grew = list.length > chatMsgs.value.length
            chatMsgs.value = list
            if (grew) scrollChatToBottom()
        }
    }, 5000)
}

onMounted(async () => {
    loadUnread()
    loadChatUnread()
    await loadConversations()
    /* 从用户主页带 ?to=<uid> 进入：自动打开对应会话 */
    const to = route.query.to
    if (to) {
        activeTab.value = 'chat'
        const existing = conversations.value.find((c) => String(c.id) === String(to))
        if (existing) {
            openChat(existing)
        } else {
            const res = await useApiFetch().post('/api/GetUser', { id: to })
            if (res.code === 200) {
                openChat({ id: res.data.id, n_nickname: res.data.n_nickname, n_avatar: res.data.n_avatar, unread: 0 })
            }
        }
    }
})

onUnmounted(stopChatPolling)
</script>

<style lang="scss" scoped>
.Page {
    width: calc(100% - 30px);
    background-color: #fff;
    padding: 15px;
    border-radius: 20px;
    min-height: 400px;
}

.msg-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 15px;

    .msg-summary {
        font-size: 13px;
        color: #6d6d6d;
    }
}

.msg-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.msg-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 12px 15px;
    border-radius: 14px;
    background-color: #f8f8f8;
    border: 1px solid #fff;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
        border-color: #00ce90;
        background-color: #fff;
    }

    &.unread .msg-name {
        font-weight: 700;
        color: #1d1d1f;
    }

    .msg-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: #f53f3f;
        flex-shrink: 0;
        margin-top: 6px;
    }

    .notice-thumb {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        object-fit: cover;
        flex-shrink: 0;
    }

    .notice-top {
        display: inline-block;
        margin-right: 6px;
        padding: 0 6px;
        font-size: 12px;
        line-height: 18px;
        color: #fff;
        background-color: #f53f3f;
        border-radius: 4px;
        vertical-align: 1px;
    }

    .notice-actions {
        display: flex;
        gap: 8px;
        margin-top: 8px;
    }

    .msg-main {
        flex: 1;
        min-width: 0;
    }

    .msg-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;

        .msg-name {
            font-size: 14px;
            color: #4e5969;
        }

        .msg-time {
            font-size: 12px;
            color: #a9a9a9;
            flex-shrink: 0;
        }
    }

    .msg-preview {
        margin-top: 6px;
        font-size: 13px;
        color: #86909c;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .msg-body {
        margin-top: 8px;
        font-size: 14px;
        color: #333;
    }
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 20px;
    color: #86868b;

    .empty-icon {
        font-size: 64px;
        margin-bottom: 16px;
    }

    p {
        font-size: 16px;
        margin: 0;
    }
}

.pagination {
    display: flex;
    justify-content: center;
    margin-top: 20px;
}

/* 私信 */
.chat-wrap {
    display: flex;
    gap: 12px;
    height: 520px;
}

.chat-side {
    width: 260px;
    flex-shrink: 0;
    border-right: 1px solid #f0f0f0;
    overflow-y: auto;

    .empty-state {
        padding: 40px 20px;

        .empty-icon {
            font-size: 40px;
            margin-bottom: 10px;
        }
    }
}

.conv-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.conv-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px;
    border-radius: 12px;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
        background-color: #f8f8f8;
    }

    &.active {
        background-color: #e8fbf3;
    }

    .conv-avatar {
        border-radius: 50%;
    }

    .conv-main {
        flex: 1;
        min-width: 0;
    }

    .conv-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;

        .conv-name {
            font-size: 14px;
            color: #1d1d1f;
        }

        .conv-time {
            font-size: 12px;
            color: #a9a9a9;
            flex-shrink: 0;
        }
    }

    .conv-preview {
        margin-top: 4px;
        font-size: 12px;
        color: #86909c;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .conv-badge {
        flex-shrink: 0;
    }
}

.chat-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;

    .empty-state {
        padding: 40px 20px;

        .empty-icon {
            font-size: 40px;
            margin-bottom: 10px;
        }
    }
}

.chat-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 10px;
    border-bottom: 1px solid #f0f0f0;

    .chat-title {
        font-size: 15px;
        font-weight: 600;
        color: #1d1d1f;
        flex: 1;
    }
}

.chat-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px 4px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.chat-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;

    .chat-avatar {
        border-radius: 50%;
    }

    .chat-content {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        max-width: 70%;
    }

    .chat-bubble {
        max-width: 100%;
        padding: 8px 12px;
        border-radius: 12px;
        background-color: #f2f3f5;
        color: #333;
        font-size: 14px;
        line-height: 1.5;
        word-break: break-word;
        white-space: pre-wrap;
    }

    .chat-meta {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 2px;
        font-size: 12px;
        color: #a9a9a9;
    }

    .chat-recall-btn {
        opacity: 0;
        padding: 0;
        height: auto;
        font-size: 12px;
        color: #86909c;
        transition: opacity 0.2s;
    }

    &:hover .chat-recall-btn {
        opacity: 1;
    }

    &.mine {
        flex-direction: row-reverse;

        .chat-bubble {
            background-color: #00ce90;
            color: #fff;
        }

        .chat-avatar {
            display: none;
        }

        .chat-content {
            align-items: flex-end;
        }
    }
}

.chat-recall {
    align-self: center;
    padding: 2px 12px;
    font-size: 12px;
    color: #a9a9a9;
    background-color: #f7f7f7;
    border-radius: 10px;
}

.chat-input {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding-top: 10px;
    border-top: 1px solid #f0f0f0;
}

@media (max-width: 768px) {
    .chat-wrap {
        flex-direction: column;
        height: auto;
    }

    .chat-side {
        width: 100%;
        border-right: none;
        border-bottom: 1px solid #f0f0f0;
        max-height: 220px;
    }

    .chat-main {
        height: 420px;
    }
}
</style>
