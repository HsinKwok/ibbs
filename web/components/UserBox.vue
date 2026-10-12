<template>
    <div class="">

        <div class="UserInfo" @click="Users.id && !Users.isCancelled && navigateTo('/upinfo/' + Users.id)">
            <div :style="{ backgroundImage: `url(${Users?.n_userback})` }" class="UserBack">

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
const props = defineProps(['id', 'info'])
let id = props.id
const Users = ref({})


/* 获取用户信息 GetUser */
const GetUser = async () => {
    try {
        const res = await useApiFetch().post('/api/GetUser', {
            id: id
        })
        if (res.code == 200) {
            Users.value = res.data
        } else if (res.code == 404) {
            /* 用户已注销：帖子保留，展示占位信息 */
            Users.value = { id: id, n_nickname: '该用户已被注销', isCancelled: true }
        } else {
            Message.error(res.msg || '获取用户信息失败')
        }
    } catch (error) {
        Message.error(error.message)
    }
}


/* 监听id（id 为纯量，无需深度侦听） */
watch(() => props.id, (newVal, oldVal) => {
    id = newVal
    if (newVal) {
        GetUser()
    }
}, { immediate: true })

/* 监听info（info 通常整体替换引用，浅监听即可，避免深度遍历大对象） */
watch(() => props.info, (newVal, oldVal) => {
    if (newVal) {
        Users.value = newVal
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
            GetUser()
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