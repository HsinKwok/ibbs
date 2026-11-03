<template>
    <div class="">

        <div class="UserInfo" @click="Users.id && !Users.isCancelled && navigateTo('/upinfo/' + Users.id)">
            <!-- 无背景图时不绑定 style：直接拼 url(null) 会让浏览器发起 GET /null 的无效请求 -->
            <div :style="Users?.n_userback ? { backgroundImage: `url(${Users.n_userback})` } : null" class="UserBack">

            </div>
            <UserAvatar class="avatar" :src="Users.n_avatar" :seed="Users.id || Users.n_nickname" alt="用户头像" />
            <div class="UserInfoBox">
                <p class="nickname">
                    {{ Users?.n_nickname }}
                </p>
                <a-tooltip v-for="(value, index) in Users?.medals || []" :key="value.n_src || index" :content="value.n_name"
                    position="bottom">
                    <img :src="value.n_src" alt="勋章" class="medal-icon" loading="lazy" />
                </a-tooltip>
            </div>
            <div class="UserDetail">
                <div class="Item">
                    <p class="Value">{{ Users?.posts || 0 }}</p>
                    <p class="Label">发帖数</p>
                </div>
                <div class="Item">
                    <p class="Value">{{ Users?.followers || 0 }}</p>
                    <p class="Label">粉丝数</p>
                </div>
                <div class="Item">
                    <p class="Value">{{ Users?.following || 0 }}</p>
                    <p class="Label">关注数</p>
                </div>
            </div>

            <!-- 关注按钮 -->
            <div class="Follow" v-if="!Users.isCancelled && UserInfo.$state.UserInfo?.id !== Users.id">
                <a-button :loading="loading" @click.stop="LikeUser()" :class="['FollowBtn', { 'Close': Users.isLiked }]"
                    type="primary">
                    {{ Users.isLiked ? '取消关注' : '关注' }}
                </a-button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { Message } from '@arco-design/web-vue';
const UserInfo = useUserInfo()
/* 其他用户信息缓存：同一 uid 一次会话只请求一次，并与列表项等调用方共享结果 */
const Profile = useUserProfile()
const props = defineProps(['id', 'info'])
let id = props.id
const Users = ref({})


/* 获取用户信息 GetUser（走 Profile 缓存 + 并发去重） */
const GetUser = async () => {
    try {
        const data = await Profile.fetchUser(id)
        if (data) {
            /* 合并而非整体替换：上方 info 可能只带昵称/头像等部分字段 */
            Users.value = { ...Users.value, ...data }
        } else {
            Message.error('获取用户信息失败')
        }
    } catch (error) {
        Message.error(error.message)
    }
}


/* 监听id（id 为纯量，无需深度侦听） */
watch(() => props.id, (newVal, oldVal) => {
    id = newVal
    /* SSR 阶段的请求不会被等待、结果也进不了页面，纯属浪费一次子请求；
       交给客户端挂载后拉取（此时会带上登录态，直接拿到 isLiked） */
    if (newVal && import.meta.client) {
        GetUser()
    }
}, { immediate: true })

/* 监听info（info 通常整体替换引用，浅监听即可，避免深度遍历大对象） */
watch(() => props.info, (newVal, oldVal) => {
    if (newVal) {
        /* 合并：详情页下发的作者信息只含 id/昵称/头像，不能覆盖已取回的统计与关注态 */
        Users.value = { ...Users.value, ...newVal }
        id = newVal.id
    }
}, { immediate: true })

const loading = ref(false)

/* 关注用户 LikeUser：后端为切换式（关注/取消关注），成功后重拉以同步真实状态 */
const LikeUser = async () => {
    try {
        loading.value = true
        const res = await useApiFetch().post('/api/LikeUser', {
            id: Users.value.id
        })
        if (res.code == 200) {
            Message.success(res.msg)
            /* 关注态是缓存的：先清掉该用户缓存再拉取，才能拿到最新 isLiked */
            delete Profile.users[String(Users.value.id)]
            await GetUser()
        } else {
            Message.error(res.msg || '关注失败')
        }
    } catch (error) {
        Message.error(error.message)
    } finally {
        loading.value = false
    }
}   
</script>


<style lang="scss" scoped>
.UserInfo {
    border-radius: 10px;
    background-color: #fff;
    overflow: hidden;
    width: 100%;

    .UserBack {
        width: 100%;
        height: 150px;
        background-size: cover;
        background-position: center;
    }

    .avatar {
        width: 70px;
        height: 70px;
        border-radius: 50%;
        margin: 0 auto;
        margin-top: -35px;
        border: 2px solid #fff;
        display: block;
    }

    .UserInfoBox {
        display: flex;
        gap:3px;
        justify-content: center;
            margin-top: 10px;
        .nickname {
            text-align: center;
            font-size: 15px;
            color: #333;
        }

        .medal-icon {
            height: 20px;
        }
    }


    .UserDetail {
        display: flex;
        gap: 10px;
        margin-top: 10px;
        background-color: #f5f9fc;
        border-radius: 10px;
        width: calc(100% - 40px);
        margin: 10px;
        padding: 10px;
        justify-content: center;

        .Item {
            text-align: center;
            width: 100%;

            .Value {
                font-size: 14px;
                color: #333;
            }

            .Label {
                font-size: 12px;
                color: #666;
                margin-top: 7px;
            }
        }
    }

    .Follow {
        width: calc(100% - 20px);
        padding: 10px;

        .FollowBtn {
            width: 100%;
            border-radius: 20px;
        }

        .Close {
            background-color: #999999;
        }
    }
}
</style>