<template>
    <div class="site-page">
        <!-- 固定毛玻璃头部 -->
        <header class="site-header">
            <div class="site-header-inner">
                <div class="site-logo" @click="navigateTo('/')">
                    <img class="site-logo-img" :src="SiteConfig.$state.Config.n_web_logo" alt="">
                </div>
                <nav class="site-nav-main">
                    <NuxtLink class="site-nav-link" to="/">首页</NuxtLink>
                    <NuxtLink class="site-nav-link" to="/follow">我的关注</NuxtLink>
                    <NuxtLink class="site-nav-link" to="/class">热门圈子</NuxtLink>
                    <NuxtLink class="site-nav-link" to="/images">视频图片</NuxtLink>
                    <NuxtLink class="site-nav-link" to="/market">跳蚤市场</NuxtLink>
                    <NuxtLink class="site-nav-link" to="/uplist">热门UP主</NuxtLink>
                </nav>
                <div class="site-header-actions">
                    <a-dropdown v-if="UserInfo.$state.UserInfo.id" trigger="click" position="br">
                        <div class="site-header-user">
                            <UserAvatar class="site-avatar" :src="UserInfo.$state.UserInfo?.n_avatar"
                                :seed="UserInfo.$state.UserInfo?.id || UserInfo.$state.UserInfo?.n_nickname" alt="" />
                            <span class="site-nickname">{{ UserInfo.$state.UserInfo?.n_nickname }}</span>
                        </div>
                        <template #content>
                            <a-doption @click="navigateTo('/user')">
                                <template #icon><icon-user /></template>
                                个人中心
                            </a-doption>
                            <a-doption @click="navigateTo('/user/message')">
                                <template #icon><icon-notification /></template>
                                <span class="msg-entry">消息中心<span v-if="unreadCount > 0" class="msg-entry-dot"></span></span>
                            </a-doption>
                            <a-doption v-if="isAdmin" @click="enterAdmin">
                                <template #icon><icon-settings /></template>
                                进入后台
                            </a-doption>
                            <a-doption @click="logout">
                                <template #icon><icon-export /></template>
                                退出登录
                            </a-doption>
                        </template>
                    </a-dropdown>
                    <div v-else class="site-header-user" @click="navigateTo('/login')">
                        <UserAvatar class="site-avatar" fallback="/favicon.ico" alt="" />
                        <span class="site-nickname">登录</span>
                    </div>
                    <button class="site-menu-btn" @click="MobShow = true" aria-label="菜单">
                        <span></span>
                        <span></span>
                        <span></span>
                    </button>
                </div>
            </div>
        </header>

        <!-- 移动端侧边栏 -->
        <div class="site-sidebar" :class="{ show: MobShow }">
            <div class="site-sidebar-head">
                <img class="site-logo-img" :src="SiteConfig.$state.Config.n_web_logo" alt="">
                <button class="site-sidebar-close" @click="MobShow = false" aria-label="关闭">
                    <span></span>
                    <span></span>
                </button>
            </div>
            <nav class="site-sidebar-nav">
                <NuxtLink class="site-sidebar-link" to="/" @click="MobShow = false">首页</NuxtLink>
                <NuxtLink class="site-sidebar-link" to="/follow" @click="MobShow = false">我的关注</NuxtLink>
                <NuxtLink class="site-sidebar-link" to="/class" @click="MobShow = false">热门圈子</NuxtLink>
                <NuxtLink class="site-sidebar-link" to="/images" @click="MobShow = false">视频图片</NuxtLink>
                <NuxtLink class="site-sidebar-link" to="/market" @click="MobShow = false">跳蚤市场</NuxtLink>
                <NuxtLink class="site-sidebar-link" to="/uplist" @click="MobShow = false">热门UP主</NuxtLink>
                <NuxtLink v-if="UserInfo.$state.UserInfo.id" class="site-sidebar-link" to="/user/message"
                    @click="MobShow = false">
                    消息中心<span v-if="unreadCount > 0" class="msg-entry-dot"></span>
                </NuxtLink>
                <button v-if="isAdmin" class="site-sidebar-link site-sidebar-action"
                    @click="enterAdmin">进入后台</button>
                <button v-if="UserInfo.$state.UserInfo.id" class="site-sidebar-link site-sidebar-action"
                    @click="logout">退出登录</button>
            </nav>
        </div>
        <div class="site-sidebar-overlay" v-if="MobShow" @click="MobShow = false"></div>

        <!-- 页面内容 -->
        <div class="site-page-container">
            <NuxtPage />
        </div>

        <!-- 右侧快捷栏 -->
        <div class="site-layout-rail" aria-label="快捷操作">
            <button class="site-layout-rail__btn" @click="navigateTo('/threadInfo/add')" title="快速发帖" aria-label="快速发帖">
                <icon-edit />
            </button>
            <div v-if="UserInfo.$state.UserInfo.id" class="site-layout-rail__wrap">
                <button class="site-layout-rail__btn" @click="navigateTo('/user/activity/sign')" title="每日签到" aria-label="每日签到">
                    <icon-calendar />
                </button>
                <span v-if="notCheckedIn" class="sign-bubble" @click="navigateTo('/user/activity/sign')">今日未签到，点我签到</span>
            </div>
            <button class="site-layout-rail__btn" @click="scrollToTop" title="返回顶部" aria-label="返回顶部">
                <icon-arrow-up />
            </button>
        </div>

        <!-- 页脚 -->
        <Footer />
    </div>
</template>

<script setup>
import { Message } from '@arco-design/web-vue'
import { getAdminBase } from '../utils/adminPath'
import { getSiteDate } from '../utils/format'

const UserInfo = useUserInfo()
UserInfo.init()
const SiteConfig = useSiteConfig()

/* 是否管理员：/api/myinfo 下发 VipInfo，其中 n_builtin == 1 表示属于内置管理员组 */
const isAdmin = computed(() => UserInfo.$state.UserInfo.VipInfo?.n_builtin == 1)

const MobShow = ref(false)

/* 进入后台：仅管理员可见。跳转后台入口，未登录后台（无 AToken）时由 admin-auth 中间件拦到后台登录页，完成二次登录 */
const enterAdmin = () => {
    MobShow.value = false
    navigateTo(getAdminBase())
}

/* 退出登录：清除本地登录态并跳转首页 */
const logout = () => {
    useCookie('UToken').value = null
    UserInfo.$state.UserInfo = {}
    UserInfo.$state.loaded = false
    MobShow.value = false
    Message.success('已退出登录')
    navigateTo('/')
}

const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
}

/* 每日签到提醒：登录后查询今日是否已签到，未签到则在快捷栏显示气泡 */
const notCheckedIn = ref(false)

const getTodayDate = () => {
    /* 与后端保持一致：统一按站点配置时区计算“今天”，避免浏览器时区不同导致今日是否已签到误判 */
    return getSiteDate(SiteConfig.Config.n_timezone)
}

const checkTodaySignIn = async () => {
    if (!UserInfo.$state.UserInfo.id) {
        notCheckedIn.value = false
        return
    }
    try {
        const res = await useApiFetch().post('/api/checkInList')
        if (res.code === 200) {
            const today = getTodayDate()
            notCheckedIn.value = !(res.data || []).some((item) => item.n_time === today)
        }
    } catch (e) {
        notCheckedIn.value = false
    }
}

watch(() => UserInfo.$state.UserInfo.id, checkTodaySignIn, { immediate: true })

/* 未读站内消息数量：系统消息 + 私信，用于顶部/侧边栏入口红点 */
const unreadCount = ref(0)

const loadUnreadCount = async () => {
    if (!UserInfo.$state.UserInfo.id) {
        unreadCount.value = 0
        return
    }
    try {
        const [sys, chat] = await Promise.all([
            useApiFetch().post('/api/GetUnreadCount'),
            useApiFetch().post('/api/GetChatUnread'),
        ])
        unreadCount.value =
            (sys.code === 200 ? sys.data.total : 0) + (chat.code === 200 ? chat.data.total : 0)
    } catch (e) {
        unreadCount.value = 0
    }
}

watch(() => UserInfo.$state.UserInfo.id, loadUnreadCount, { immediate: true })

/* 从签到/消息页返回时刷新气泡与未读红点；
   仅在进出这两个页面时刷新，避免每次路由跳转都产生 2 次未读请求 */
const route = useRoute()
const isRelevantPath = (p) => !!p && (p.startsWith('/user/message') || p.startsWith('/user/activity/sign'))
watch(() => route.path, (to, from) => {
    if (!isRelevantPath(to) && !isRelevantPath(from)) return
    if (notCheckedIn.value) checkTodaySignIn()
    loadUnreadCount()
})
</script>

<style lang="scss" scoped>
.site-page {
    width: 100%;
    background: var(--color-bg);
}

.site-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: var(--header-h);
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    z-index: 100;
}

.site-header-inner {
    max-width: 1350px;
    margin: 0 auto;
    padding: 0 20px;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 32px;
}

.site-logo {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    cursor: pointer;
}

.site-logo-img {
    max-height: 36px;
    width: auto;
    max-width: 200px;
    object-fit: contain;
    display: block;
}

.site-nav-main {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    overflow-x: auto;
    scrollbar-width: none;

    &::-webkit-scrollbar {
        display: none;
    }
}

.site-nav-link {
    padding: 6px 14px;
    border-radius: 8px;
    color: var(--color-text-light);
    font-size: 15px;
    white-space: nowrap;
    transition: color 0.2s, background-color 0.2s;

    &:hover {
        color: var(--color-primary);
        background: var(--color-primary-soft);
    }

    &.router-link-active {
        color: var(--color-primary);
        font-weight: 600;
    }
}

.site-header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
}

.site-header-user {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 20px;
    transition: background-color 0.2s;

    &:hover {
        background: rgba(0, 0, 0, 0.04);
    }
}

.site-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    background: var(--color-primary-soft2);
}

.site-nickname {
    font-size: 14px;
    color: var(--color-text);
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* 未读消息红点 */
.msg-entry-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-left: 6px;
    border-radius: 50%;
    background-color: #f53f3f;
    vertical-align: middle;
}

.site-menu-btn {
    display: none;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    align-items: center;

    span {
        width: 18px;
        height: 2px;
        background: var(--color-text);
        border-radius: 2px;
    }
}

.site-page-container {
    padding-top: var(--header-h);
    padding-bottom: 20px;
}

/* 右侧快捷栏 */
.site-layout-rail {
    position: fixed;
    right: 20px;
    bottom: 120px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 90;
}

.site-layout-rail__btn {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid rgba(0, 0, 0, 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text);
    cursor: pointer;
    font-size: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    transition: color 0.2s, border-color 0.2s;

    &:hover {
        color: var(--color-primary);
        border-color: var(--color-primary);
    }
}

/* 签到按钮外层定位容器（用于挂载气泡） */
.site-layout-rail__wrap {
    position: relative;
    display: flex;
}

/* 未签到气泡提示 */
.sign-bubble {
    position: absolute;
    right: calc(100% + 12px);
    top: 50%;
    transform: translateY(-50%);
    white-space: nowrap;
    padding: 7px 12px;
    border-radius: 8px;
    background: var(--color-primary);
    color: #fff;
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: sign-bubble-in 0.25s ease, sign-bubble-float 1.8s ease-in-out 0.25s infinite;

    /* 指向按钮的小箭头 */
    &::after {
        content: '';
        position: absolute;
        left: 100%;
        top: 50%;
        margin-top: -5px;
        border: 5px solid transparent;
        border-left-color: var(--color-primary);
    }
}

@keyframes sign-bubble-in {
    from {
        opacity: 0;
        transform: translate(8px, -50%);
    }

    to {
        opacity: 1;
        transform: translate(0, -50%);
    }
}

@keyframes sign-bubble-float {

    0%,
    100% {
        transform: translate(0, -50%);
    }

    50% {
        transform: translate(0, calc(-50% - 4px));
    }
}

@media (max-width: 768px) {
    .site-layout-rail {
        right: 12px;
        bottom: 90px;
    }
}

/* 移动端侧边栏 */
.site-sidebar {
    position: fixed;
    top: 0;
    left: -280px;
    width: 260px;
    height: 100vh;
    background: var(--color-white);
    z-index: 120;
    transition: left 0.3s ease;
    box-shadow: 2px 0 12px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;

    &.show {
        left: 0;
    }
}

.site-sidebar-head {
    height: var(--header-h);
    padding: 0 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.site-sidebar-close {
    position: relative;
    width: 30px;
    height: 30px;

    span {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 18px;
        height: 2px;
        background: var(--color-text);
        border-radius: 2px;

        &:first-child {
            transform: translate(-50%, -50%) rotate(45deg);
        }

        &:last-child {
            transform: translate(-50%, -50%) rotate(-45deg);
        }
    }
}

.site-sidebar-nav {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow-y: auto;
}

.site-sidebar-link {
    padding: 12px 16px;
    border-radius: 10px;
    color: var(--color-text);
    font-size: 15px;

    &:hover {
        background: var(--color-bg);
        color: var(--color-primary);
    }

    &.router-link-active {
        background: var(--color-primary-soft);
        color: var(--color-primary);
        font-weight: 600;
    }
}

/* 侧边栏动作按钮（进入后台/退出登录）：重置 button 默认样式，与导航项保持一致 */
.site-sidebar-action {
    width: 100%;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    font-family: inherit;
}

.site-sidebar-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 110;
}

@media (max-width: 768px) {
    .site-nav-main {
        display: none;
    }

    .site-menu-btn {
        display: flex;
    }

    .site-nickname {
        display: none;
    }
}
</style>
