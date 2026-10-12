<template>
    <div>
        <UserHeader title="我的信息编辑"></UserHeader>
        <div class="Page">
            <div class="Pagecontent">
                <a-tabs default-active-key="1">
                    <a-tab-pane key="1" title="我的基础信息">
                        <a-form :model="form" :style="{ width: '600px' }">
                            <a-form-item field="name" label="我的头像">
                                <Upimg v-if="uploadEnable" :src="form.n_avatar" width="100" height="100" @success="(e) => {
                                    form.n_avatar = e
                                }"></Upimg>
                                <div v-else class="avatar-picker" @click="avatarVisible = true">
                                    <UserAvatar :src="form.n_avatar" :seed="form.id" :size="100" />
                                    <div class="avatar-picker-mask">
                                        <icon-edit />
                                        <span>选择默认头像</span>
                                    </div>
                                </div>
                            </a-form-item>
                            <a-form-item field="name" label="我的背景">
                                <Upimg v-if="uploadEnable" :src="form.n_userback" width="200" height="100" @success="(e) => {
                                    form.n_userback = e
                                }"></Upimg>
                                <div v-else class="back-disabled">
                                    <img v-if="form.n_userback" :src="form.n_userback" alt="" />
                                    <span v-else>上传功能已关闭</span>
                                </div>
                            </a-form-item>
                            <a-form-item field="name" label="我的昵称">
                                <a-input v-model="form.n_nickname" />
                            </a-form-item>
                            <a-form-item field="name" label="我的签名">
                                <a-input v-model="form.n_signature" />
                            </a-form-item>
                            <a-form-item field="name" label="QQ号码">
                                <a-input v-model="form.n_qqnumber" />
                            </a-form-item>
                            <a-form-item field="name" label="微信号码">
                                <a-input v-model="form.n_wxnumber" />
                            </a-form-item>
                            <a-form-item>
                                <a-button type="primary" :loading="editing" @click="editwebinfo()">确认修改</a-button>
                            </a-form-item>
                        </a-form>
                    </a-tab-pane>
                    <a-tab-pane key="2" title="重置密码">
                        <a-form :model="form" :style="{ width: '600px' }">
                            <a-form-item field="name" label="我的邮箱">
                                <a-input v-model="form.n_username" disabled />
                            </a-form-item>
                            <!-- 验证码 -->
                            <a-form-item field="name" label="邮件验证码">
                                <a-input v-model="form.n_captcha" placeholder="请输入验证码" />
                                <a-button type="text" :loading="loading" @click="SendVerificationCode"
                                    :disabled="countdown > 0">{{ countdownText }}</a-button>
                            </a-form-item>
                            <a-form-item field="password" label="新密码">
                                <a-input v-model="form.n_password" placeholder="请输入新密码" type="password" />
                            </a-form-item>
                            <a-form-item>
                                <a-button type="primary" :loading="resetting" @click="restuserpass()">确认修改</a-button>
                            </a-form-item>
                        </a-form>
                    </a-tab-pane>
                </a-tabs>


            </div>

        </div>
        <AvatarDrawer v-model:visible="avatarVisible" :current="form.n_avatar" @success="(e) => {
            form.n_avatar = e
        }" />
    </div>
</template>

<script setup>
import { Message } from '@arco-design/web-vue';
const form = ref({})
const UserInfo = useUserInfo()
const SiteConfig = useSiteConfig()

/* 上传功能总开关：仅当配置为 '0' 时关闭 */
const uploadEnable = computed(() => SiteConfig.Config.n_upload_enable !== '0')

/* 默认头像选择抽屉 */
const avatarVisible = ref(false)

UserInfo.init()
SiteConfig.init()
/* 获取用户信息 getuserinfo */
const getuserinfo = async () => {
    const res = await useApiFetch().post('/api/myinfo')
    if (res.code == 200) {
        form.value = res.data
    } else {
        Message.error(res.msg)
    }
}
/* 编辑配置信息 editwebinfo */
const editing = ref(false)
const editwebinfo = async () => {
    if (editing.value) return
    editing.value = true
    try {
        delete form.value.VipInfo
        const res = await useApiFetch().post('/api/editinfo', form.value)
        if (res.code == 200) {
            Message.success(res.msg)
            UserInfo.init(() => { }, true)
        } else {
            Message.error(res.msg || '修改失败')
        }
    } catch (e) {
        Message.error('修改失败，请稍后重试')
    } finally {
        editing.value = false
    }
}

/* 发送验证码函数 */
const loading = ref(false)
const SendVerificationCode = async () => {
    if (countdown.value > 0) {
        Message.warning(`请等待 ${countdown.value} 秒后重试`)
        return
    }

    if (!form.value.n_username || form.value.n_username.length < 1) {
        Message.warning('请输入邮箱')
        return
    }
    loading.value = true
    try {
        const res = await useApiFetch().post('/api/sendVerificationCode', {
            to: form.value.n_username
        })
        if (res.code == 200) {
            Message.success('发送成功')
            startCountdown()
        } else {
            Message.error(res.msg || '发送失败')
        }
    } catch (e) {
        Message.error('发送失败，请稍后重试')
    } finally {
        loading.value = false
    }
}

const countdown = ref(0)
const countdownText = ref('获取验证码')

let countdownTimer = null
const startCountdown = () => {
    clearInterval(countdownTimer)
    countdown.value = 60
    countdownTimer = setInterval(() => {
        countdown.value--
        if (countdown.value <= 0) {
            clearInterval(countdownTimer)
            countdownTimer = null
            countdownText.value = '获取验证码'
        } else {
            countdownText.value = `${countdown.value}秒后重试`
        }
    }, 1000)
}

onUnmounted(() => clearInterval(countdownTimer))


/* 重置用户密码 */
const resetting = ref(false)
const restuserpass = async () => {
    if (resetting.value) return
    resetting.value = true
    try {
        const res = await useApiFetch().post('/api/RetrievePassword', {
            username: form.value.n_username,
            code: form.value.n_captcha,
            password: form.value.n_password
        })
        if (res.code == 200) {
            Message.success(res.msg)
            getuserinfo()
        } else {
            Message.error(res.msg || '重置失败')
        }
    } catch (e) {
        Message.error('重置失败，请稍后重试')
    } finally {
        resetting.value = false
    }
}
onMounted(() => {
    getuserinfo()
})

</script>

<style lang="scss" scoped>
.Page {
    background-color: #fff;
    margin: 1px;
    width: calc(100% - 2px);
    border-radius: 20px;

    .Pagecontent {
        width: calc(100% - 20px);
        padding: 10px;
        padding-top: 20px;
    }

    .avatar-picker {
        position: relative;
        width: 100px;
        height: 100px;
        border-radius: 5px;
        overflow: hidden;
        cursor: pointer;
        background-color: #f2f3f5;

        .avatar-picker-mask {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 4px;
            color: #fff;
            font-size: 12px;
            background-color: #00000059;
            opacity: 0;
            transition: all 0.3s;
        }

        &:hover .avatar-picker-mask {
            opacity: 1;
        }
    }

    .back-disabled {
        width: 200px;
        height: 100px;
        border-radius: 5px;
        background-color: #f2f3f5;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        color: #86909c;
        font-size: 13px;

        img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
    }

}
</style>
