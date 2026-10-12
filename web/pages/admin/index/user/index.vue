<template>
    <div>
        <AdminTable title="用户管理" :columns="columns" :list="list" :loading="loading" :query="query"
            v-model:selectedKeys="selectedKeys" :row-selection="rowSelection" :batch-deleting="batchDeleting"
            @search="load" @batch-delete="batchDelete">
            <template #toolbar-extra>
                <a-button type="primary" @click="openAdminDrawer">后台账号管理</a-button>
            </template>
            <template #n_avatar="{ record }">
                <a-avatar :size="24">
                    <UserAvatar alt="avatar" :src="record.n_avatar" :seed="record.id || record.n_nickname"
                        :size="24" />
                </a-avatar>
            </template>
            <template #n_group="{ record }">
                <a-tag v-if="isAdminGroup(record.n_group_id)" color="#165DFF">管理员</a-tag>
                <span v-else>{{ groupName(record.n_group_id) || '-' }}</span>
            </template>
            <template #n_status="{ record }">
                <a-tag v-if="isBanned(record)" color="red">已封禁</a-tag>
                <a-tooltip v-else-if="isMuted(record)" :content="`禁言至 ${record.n_mute_end}`">
                    <a-tag color="orange">禁言中</a-tag>
                </a-tooltip>
                <a-tag v-else color="green">正常</a-tag>
            </template>
            <template #console="{ record }">
                <a-space>
                    <a-button size="mini" @click="openEdit(record)" type="primary">编辑</a-button>
                    <a-button size="mini" type="primary" status="danger" @click="del(record.id)">删除</a-button>
                    <a-dropdown trigger="click" @select="(v) => handleManage(v, record)">
                        <a-button size="mini">管理</a-button>
                        <template #content>
                            <a-doption value="ban" v-if="!isBanned(record)">封禁</a-doption>
                            <a-doption value="unban" v-else>解除封禁</a-doption>
                            <a-doption value="mute" v-if="!isMuted(record)">禁言</a-doption>
                            <a-doption value="unmute" v-else>解除禁言</a-doption>
                        </template>
                    </a-dropdown>
                </a-space>
            </template>
        </AdminTable>

        <a-drawer :width="540" :visible="visible" @ok="submit" @cancel="() => {
            visible = false
        }" unmountOnClose title="用户详情信息">
            <div>
                <a-form style="margin: 0 auto;" :model="info">
                    <a-form-item field="name" label="头像">
                        <Upimg :src="info.n_avatar" width="100" height="100" @success="(e) => {
                            info.n_avatar = e
                        }"></Upimg>
                    </a-form-item>
                    <a-form-item field="name" label="背景">
                        <Upimg :src="info.n_userback" width="300" height="100" @success="(e) => {
                            info.n_userback = e
                        }"></Upimg>
                    </a-form-item>
                    <a-form-item field="name" label="昵称">
                        <a-input v-model="info.n_nickname" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="签名">
                        <a-input v-model="info.n_signature" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="邮箱">
                        <a-input v-model="info.n_username" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="密码">
                        <a-input v-model="info.n_password" placeholder="留空则不修改" type="password" />
                    </a-form-item>
                    <a-form-item field="post" label="积分">
                        <a-input v-model="info.n_points" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="余额">
                        <a-input v-model="info.n_balance" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="编码">
                        <a-input v-model="info.n_encoding" placeholder="请输入" />
                    </a-form-item>
                    <a-form-item field="post" label="会员">
                        <a-select class="road" v-model="info.n_group_id" placeholder="请选择">
                            <a-option :value="value.id" v-for="value in usergroupList" :key="value.id">{{ value.n_name }}</a-option>
                        </a-select>
                    </a-form-item>
                    <a-form-item field="post" label="到期时间">
                        <a-date-picker show-time :time-picker-props="{ defaultValue: '09:09:06' }" v-model="info.n_group_time"
                            format="YYYY-MM-DD HH:mm:ss" />
                    </a-form-item>
                </a-form>
            </div>
        </a-drawer>

        <a-drawer :width="540" :visible="adminVisible" @ok="submitAdmin" @cancel="() => {
            adminVisible = false
        }" unmountOnClose title="后台账号管理">
            <div>
                <a-form style="margin: 0 auto;" :model="adminForm">
                    <a-form-item field="username" label="后台账号">
                        <a-input v-model="adminForm.username" placeholder="留空则不修改账号" />
                    </a-form-item>
                    <a-form-item field="password" label="后台密码">
                        <a-input v-model="adminForm.password" placeholder="请输入后台登录密码" type="password" />
                    </a-form-item>
                    <a-form-item>
                        <a-alert type="info">密码需至少 6 位，且同时包含大小写字母和数字。</a-alert>
                    </a-form-item>
                </a-form>
            </div>
        </a-drawer>

        <a-modal v-model:visible="banVisible" title="封禁用户" :ok-loading="submitting" @ok="submitBan">
            <a-alert type="warning">
                封禁后该用户将无法登录，且其当前登录状态会被强制下线。确定要封禁「{{ banTarget?.n_nickname || banTarget?.n_username }}」吗？
            </a-alert>
        </a-modal>

        <a-modal v-model:visible="muteVisible" title="禁言用户" :ok-loading="submitting" @ok="submitMute">
            <a-form :model="{ days: muteDays }">
                <a-form-item label="禁言天数">
                    <a-input-number v-model="muteDays" :min="1" :max="3650" :precision="0" placeholder="请输入禁言天数" />
                </a-form-item>
                <a-alert type="info">禁言期间该用户无法发帖和评论，到期后自动解除。目标：{{ muteTarget?.n_nickname || muteTarget?.n_username }}</a-alert>
            </a-form>
        </a-modal>

    </div>
</template>

<script setup>
import { Message } from '@arco-design/web-vue';
/* 统一列表页封装：查询 + 分页 + 删除（带「同时删除帖子」选项）+ 编辑（仅编辑无新增） */
const { list, query, loading, load, del, selectedKeys, rowSelection, batchDeleting, batchDelete, visible, info, openEdit, submit } = useAdminTable({
    api: '/api/userlist',
    remove: (id, delContent) => useApiFetch().post('/api/deluser', delContent ? { id, delContent: 1 } : { id }),
    batchRemove: (ids, delContent) => useApiFetch().post('/api/batchDeluser', delContent ? { ids, delContent: 1 } : { ids }),
    editApi: '/api/edituser',
    label: '用户',
    deleteOption: { label: '同时删除其发表的所有帖子和上传的文件' },
})

const columns = [
    {
        title: '头像',
        slotName: 'n_avatar',
        width: 60,
    },
    {
        title: '名称',
        dataIndex: 'n_nickname',
        width: 150,
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '邮箱',
        dataIndex: 'n_username',
        width: 150,
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '用户组',
        slotName: 'n_group',
        width: 120,
    },
    {
        title: '状态',
        slotName: 'n_status',
        width: 90,
    },
    {
        title: '注册时间',
        dataIndex: 'n_registertime',
        width: 150,
    },
    {
        title: '用户积分',
        dataIndex: 'n_points',
        width: 150,
    },
    {
        title: '编码',
        dataIndex: 'n_encoding',
        width: 150,
    },
    {
        title: '操作',
        dataIndex: 'console',
        slotName: 'console',
        width: 210,
        fixed: 'right',
    },
];



/* 获取用户会员列表 */
const usergroupList = ref([])

const usergroup = async () => {
    const res = await useApiFetch().post('/api/usergroup', {
        page: 1,
        pagesize: 999,
    })
    if (res.code === 200) {
        usergroupList.value = res.data
    } else {
        Message.error(res.msg)
    }
}

/* 用户组 id → 名称（用于列表「用户组」列展示） */
const groupName = (id) => usergroupList.value.find((g) => String(g.id) === String(id))?.n_name || ''

/* 是否属于系统内置管理员组（n_builtin == 1）：管理员身份即由用户组判定 */
const isAdminGroup = (id) => usergroupList.value.find((g) => String(g.id) === String(id))?.n_builtin == 1

/* 后台账号管理抽屉：修改当前登录管理员的账号（n_users）与密码，复用 /api/changeadminpass */
const adminVisible = ref(false)
const adminForm = ref({ username: '', password: '' })
const adminSubmitting = ref(false)

const openAdminDrawer = () => {
    adminForm.value = { username: '', password: '' }
    adminVisible.value = true
}

const submitAdmin = async () => {
    if (adminSubmitting.value) return
    adminSubmitting.value = true
    try {
        const res = await useApiFetch().post('/api/changeadminpass', adminForm.value)
        if (res.code === 200) {
            Message.success(res.msg)
            adminVisible.value = false
        } else {
            Message.error(res.msg)
        }
    } finally {
        adminSubmitting.value = false
    }
}

/* 封禁 / 禁言状态判定（n_status：1 正常 / 0 已封禁；n_mute_end 为禁言到期时间） */
const isBanned = (record) => Number(record.n_status) === 0
const isMuted = (record) => {
    if (!record.n_mute_end) return false
    /* 'YYYY-MM-DD HH:mm:ss' 统一替换为 '/' 分隔，避免部分浏览器按 UTC 解析导致时区偏差 */
    return new Date(String(record.n_mute_end).replace(/-/g, '/')).getTime() > Date.now()
}

const submitting = ref(false)
const banVisible = ref(false)
const banTarget = ref(null)
const muteVisible = ref(false)
const muteTarget = ref(null)
const muteDays = ref(7)

/* 管理菜单分发：封禁 / 解封 / 禁言 / 解除禁言 */
const handleManage = (value, record) => {
    if (value === 'ban') {
        banTarget.value = record
        banVisible.value = true
    } else if (value === 'mute') {
        muteTarget.value = record
        muteDays.value = 7
        muteVisible.value = true
    } else if (value === 'unban') {
        submitAction('/api/unbanuser', { ids: [record.id] })
    } else if (value === 'unmute') {
        submitAction('/api/unmuteuser', { ids: [record.id] })
    }
}

/* 统一提交封禁/解封/禁言/解除禁言，成功后就地刷新列表 */
const submitAction = async (url, body) => {
    if (submitting.value) return
    submitting.value = true
    try {
        const res = await useApiFetch().post(url, body)
        if (res.code === 200) {
            Message.success(res.msg)
            banVisible.value = false
            muteVisible.value = false
            load()
        } else {
            Message.error(res.msg)
        }
    } finally {
        submitting.value = false
    }
}

const submitBan = () => submitAction('/api/banuser', { ids: [banTarget.value.id] })

const submitMute = () => {
    const days = Number(muteDays.value)
    if (!Number.isInteger(days) || days <= 0) {
        Message.error('请输入正确的禁言天数')
        return
    }
    submitAction('/api/muteuser', { ids: [muteTarget.value.id], days })
}

onMounted(() => {
    usergroup()
})
</script>
