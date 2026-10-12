<template>
    <div class="MainBox">
        <div class="MobShows">
        <UserHeader :title="Info.n_name " ></UserHeader>

        </div>
        <div class="Left">
            <div class="Breadcrumb" v-if="BreadcrumbList.length > 0">
                <a-breadcrumb>
                    <a-breadcrumb-item>
                        <NuxtLink to="/">首页</NuxtLink>
                    </a-breadcrumb-item>
                    <a-breadcrumb-item v-for="item in BreadcrumbList" :key="item.id">
                        <NuxtLink :to="(item.n_type == 2 ? '/topic/' : '/plate/') + item.id">{{ item.n_name }}</NuxtLink>
                    </a-breadcrumb-item>
                </a-breadcrumb>
            </div>
            <div class="MainContent">

                <div class="ThreadInfo">
                    <h1>{{ Info.n_name }}</h1>
                    <div>
                        <a-space wrap>
                            <p class="User">
                                <UserAvatar :src="Info.user?.n_avatar" :seed="Info.user?.id || Info.user?.n_nickname"
                                    alt="用户头像" />
                                <span>{{ Info.user?.n_nickname }}</span>
                            </p>
                            <p class="Time">{{ Info.n_time }}</p>
                            <p class="Read">
                                <icon-eye class="icon" />
                                <span>{{ formatNumber(Info.n_read || 0) }}</span>
                            </p>
                        </a-space>
                    </div>
                    <div class="Category" v-if="Info.category && Info.category.length > 0">
                        <a-space wrap>
                            <div class="Tag" v-for="value in Info.category" :key="value.id ?? value.n_name">
                                <span v-if="value.n_type == 2">#</span>
                                {{ value.n_name }}
                            </div>
                        </a-space>
                    </div>
                    <!-- 按钮部分 -->
                    <div class="ButtonSection" @click="PopShow = true">
                        <a-button>
                            <template #icon>
                                <icon-more />
                            </template>
                        </a-button>
                    </div>
                </div>
                <div class="Buy" v-if="!Info.IsBuy">
                    <a-result status="error" title="请先购买">
                        <template #icon>
                            <IconFaceFrownFill />
                        </template>
                        <template #subtitle> 当前铁子需要支付{{ Info.n_price || 0 }}{{ Info.n_permission == '2' ? '积分' : '元' }}
                        </template>

                        <template #extra>
                            <a-button :loading="buyLoading" type="primary" @click="handleSubmit()">立即购买</a-button>
                        </template>
                        <a-typography style="background: var(--color-fill-2); padding: 24px;">
                            <a-typography-paragraph>说明:</a-typography-paragraph>
                            <ul>
                                <li>购买后即可查看内容</li>

                                <li>如有问题请联系管理员</li>
                            </ul>
                        </a-typography>
                    </a-result>
                </div>
                <div v-else>
                    <RichHtml :html="Info.n_html"></RichHtml>
                </div>

                <div class="CommentSection">
                    <div :class="['Item', { active: Info.isLiked }]" @click="LikeThreads()">
                        <icon-thumb-up class="icon" />
                        <span>{{ Info.n_starts || 0 }}</span>
                    </div>
                    <div class="Item">
                        <icon-message class="icon" />
                        <span>{{ Info.n_msgs || 0 }}</span>
                    </div>
                    <div class="Item" @click="ShareShow = true">
                        <icon-share-internal class="icon" />
                        <span>分享</span>
                    </div>
                </div>
            </div>
            <div class="comment">
                <BoxTitle>我有话要说</BoxTitle>
                <div class="content">
                    <a-textarea class="road" v-model="form.n_html" placeholder="请输入评论" :max-length="100" allow-clear
                        show-word-limit />
                    <div class="ButtonSection">

                        <a-button type="primary" class="send-btn" :loading="commentSubmitting" @click="CommentThreads()">
                            <template #icon>
                                <icon-send />
                            </template>
                            <template #default>发送</template>
                        </a-button>
                    </div>
                </div>
            </div>
            <div class="comment">
                <BoxTitle>大家都再说</BoxTitle>
                <a-spin :loading="loading" tip="正在加载" style="width: 100%;height: 100%;">

                    <CommentItem v-for="value in CommentList" :key="value.id" :data="value"
                        :isAuthor="value.n_uid == Info.n_uid" @reload="GetCommentList"></CommentItem>

                    <div class="Isno" style="  width: 100%;
                background-color: #fff;
                border-radius: 10px;" v-if="CommentList.length == 0 && !loading">
                        <a-result :status="null" title="无内容" subtitle="哎呀，没有内容了">
                            <template #icon>
                                <IconFaceSmileFill />
                            </template>
                        </a-result>
                    </div>
                </a-spin>

                <div class="PageNav">
                    <ListPager v-model:current="GetCommentsFrom.page" v-model:pageSize="GetCommentsFrom.pagesize"
                        :total="GetCommentsFrom.total" @load="GetCommentList" />
                </div>
            </div>

        </div>
        <div class="Right">

            <div class="UserInfo">
                <UserBox :id="Info.n_uid"></UserBox>
            </div>
            <div class="NavBar">
                <NeedStar></NeedStar>
            </div>
            <div class="NavBar">
                <BoxTitle>热门话题</BoxTitle>

                <TopicItem v-for="value in TopicList" :key="value.id" :data="value"></TopicItem>
            </div>
        </div>

        <!-- 操作框 -->
        <popupMob v-model:modelValue="PopShow" :Title="'操作'" Nook>
            <template #content>
                <a-space wrap>
                    <a-button @click="navigateTo('/threadInfo/' + id)" v-if="UserInfo.$state.UserInfo?.id == Info.n_uid"
                        style="border-radius: 20px;">
                        <template #icon>
                            <icon-edit />
                        </template>
                        编辑贴贴
                    </a-button>

                    <a-button status="warning" style="border-radius: 20px;" @click="reportThreadsShow = true">
                        <template #icon>
                            <icon-info-circle />
                        </template>
                        举报帖子
                    </a-button>
                    <a-popconfirm @ok="DelThreads()" content="确定删除吗?" type="error"
                        v-if="UserInfo.$state.UserInfo?.id == Info.n_uid">
                        <a-button status="danger" style="border-radius: 20px;">
                            <template #icon>
                                <icon-delete />
                            </template>
                            删除贴贴
                        </a-button>
                    </a-popconfirm>

                </a-space>

            </template>
        </popupMob>

        <!-- 举报 -->
        <popupMob v-model:modelValue="reportThreadsShow" :Title="'举报'" Nook>
            <template #content>
                <a-form :model="form" :layout="'vertical'">

                    <a-form-item field="post" label="举报原因">
                        <a-textarea class="road" v-model="reportThreadsFrom.n_html" placeholder="请输入举报原因"
                            :max-length="200" allow-clear show-word-limit />
                    </a-form-item>
                    <a-form-item field="post" label="">
                        <a-button type="primary" class="road" :loading="reportSubmitting" @click="reportThreads()">提交</a-button>
                    </a-form-item>

                </a-form>

            </template>
        </popupMob>
        <popupMob v-model:modelValue="ShareShow" :Title="'分享'" Nook>
            <template #content>
                <Share :data="Info"></Share>
            </template>
        </popupMob>
        <!-- 分享海报 Share -->
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue';
import { formatNumber } from '@/utils/format'
const route = useRoute()
const UserInfo = useUserInfo()
UserInfo.init()
const id = route.params.id
const SiteConfig = useSiteConfig()

const Info = ref({})
const res = await useApiSsr('GetThreadsInfo' + id, '/api/GetThreads', {
    id: id
})
if (res.code === 200) {
    Info.value = res.data
} else {
    navigateTo('/threads/404')
}
useSeoSet({
    title: Info.value.n_name + '-' + SiteConfig.$state.Config.n_web_title,
    description: Info.value.n_profile
})
/* 帖子分类完整路径：首页 > 板块 > 话题 */
const BreadcrumbList = computed(() => {
    const list = Info.value.category || []
    return [
        ...list.filter(item => item.n_type != 2),
        ...list.filter(item => item.n_type == 2)
    ]
})
/* 右侧栏：热门话题（复用 useSidebar，仅用 TopicList） */
const { TopicList } = useSidebar()

/* 删除帖子 DelThreads */
const DelThreads = async () => {
    try {
        const res = await useApiFetch().post('/api/DelThreads', {
            id: id
        })
        if (res.code == 200) {
            Message.success('删除成功')
            navigateTo('/')
        } else {
            Message.error(res.msg || '删除失败')
        }
    } catch (error) {
        Message.error(error.message)
    }
}
const PopShow = ref(false)


const form = ref({
    id: id,
    n_html: '',
    n_cid: 0,
})
/* 评论 CommentThreads */
const commentSubmitting = ref(false)
const CommentThreads = async () => {
    if (commentSubmitting.value) return
    commentSubmitting.value = true
    try {
        const res = await useApiFetch().post('/api/CommentThreads', form.value)
        if (res.code == 200) {
            Message.success('评论成功')
            form.value.n_html = ''
            GetCommentList()
        } else if (res.code == 401) {
            navigateTo('/login')
        } else {
            Message.error(res.msg || '评论失败')
        }
    } catch (error) {
        Message.error(error.message)
    } finally {
        commentSubmitting.value = false
    }
}

/* 获取评论列表 */
const GetCommentsFrom = ref({
    page: 1,
    pagesize: 20,
    id: id
})
const CommentList = ref([])
const GetCommentList = async () => {
    try {
        loading.value = true
        const res = await useApiFetch().post('/api/GetComments', GetCommentsFrom.value)
        if (res.code == 200) {
            CommentList.value = res.data
            GetCommentsFrom.value.total = res.total
        }
    } catch (error) {
        Message.error(error.message)
    } finally {
        loading.value = false
    }
}
onMounted(() => {
    GetCommentList()
})


/* 点赞帖子 LikeThreads */
const likeSubmitting = ref(false)
const LikeThreads = async () => {
    if (likeSubmitting.value) return
    likeSubmitting.value = true
    try {
        const res = await useApiFetch().post('/api/LikeThreads', {
            id: id
        })
        if (res.code == 200) {
            Message.success(res.msg)
            /* 点赞后需拿到最新数据（含是否已赞状态）；useApiSsr 的 key 与首屏一致会命中缓存，
               这里直接用 useApiFetch 重新请求，避免读到旧数据。noread=1 表示仅刷新、不自增阅读量 */
            const data = await useApiFetch().post('/api/GetThreads', {
                id: id,
                noread: 1
            })
            if (data.code === 200) {
                Info.value = data.data
            } else {
                navigateTo('/threads/404')
            }
        } else if (res.code == 401) {
            navigateTo('/login')
        } else {
            Message.error(res.msg || '点赞失败')
        }
    } catch (error) {
        Message.error(error.message)
    } finally {
        likeSubmitting.value = false
    }
}

/* 购买帖子  */
const from = ref({
    price: Info.value.n_price,
    type: 3,
    id: Info.value.id
})
/* 获取当前页面地址 */

// 提交充值
const loading = ref(false)
const buyLoading = ref(false)
const handleSubmit = async () => {
    if (buyLoading.value) return
    buyLoading.value = true
    try {
        const res = await useApiFetch().post('/api/CreateOrder', {
            from: JSON.stringify([from.value]),
            path: window.location.href
        })
        if (res.code === 200) {
            navigateTo('/user/order/' + res.data.order + '?return=/threads/' + Info.value.id)
        } else {
            Message.error(res.msg || '下单失败')
        }
    } catch (error) {
        Message.error(error.message)
    } finally {
        buyLoading.value = false
    }
}



/* 举报帖子 ReportThreads */
const reportThreadsFrom = ref({
    n_tid: Info.value.id,
    n_html: ''
})
const reportThreadsShow = ref(false)
const reportSubmitting = ref(false)
const reportThreads = async () => {
    if (reportSubmitting.value) return
    reportSubmitting.value = true
    try {
        const res = await useApiFetch().post('/api/ReportThreads', reportThreadsFrom.value)
        if (res.code === 200) {
            reportThreadsShow.value = false
            Message.success(res.msg)
        } else if (res.code == 401) {
            navigateTo('/login')
        } else {
            Message.error(res.msg || '举报失败')
        }
    } catch (error) {
        Message.error(error.message)
    } finally {
        reportSubmitting.value = false
    }
}

/* 分享帖子 ShareShow */
const ShareShow = ref(false)
</script>


<style lang="scss" scoped>
/* 视口大于768px时的样式 */
@media (min-width: 768px) {
    .MainBox {
        width: 100%;
        display: flex;
        height: 100%;
        width: calc(100% - 20px);
        margin: 0 auto;
        max-width: 1280px;
        display: flex;
        padding-top: 20px;
        padding-bottom: 20px;

        .Left {
            width: calc(100% - 300px);
            margin: 0 auto;
            overflow-y: auto;

            /* 隐藏滚动条 */
            &::-webkit-scrollbar {
                display: none;
            }

            .Breadcrumb {
                margin-bottom: 10px;
                padding: 10px 14px;
                background-color: #fff;
                border-radius: 10px;

                :deep(.arco-breadcrumb) {
                    font-size: 13px;
                }

                :deep(a) {
                    color: var(--color-primary);
                    text-decoration: none;
                    transition: color 0.2s, opacity 0.2s;

                    &:hover {
                        color: var(--color-primary);
                        opacity: 0.7;
                    }
                }
            }

            .MainContent {
                padding: 20px;
                background-color: #fff;
                border-radius: 10px;
                margin-bottom: 10px;

                .ThreadInfo {
                    position: relative;

                    h1 {
                        font-size: 24px;
                        font-weight: bold;
                        margin-bottom: 10px;
                        margin-top: 0;
                    }

                    .Category {
                        margin-top: 10px;

                        .Tag {
                            border-radius: 20px;
                            padding: 5px 10px;
                            font-size: 12px;
                            background-color: #ecf7fc;
                            display: inline-block;
                            color: #1890ff;
                        }
                    }

                    padding-bottom: 10px;
                    margin-bottom: 10px;
                    border-bottom: 1px solid #ebeff3;

                    .User {
                        display: flex;
                        align-items: center;
                        gap: 5px;

                        img {
                            width: 20px;
                            height: 20px;
                            border-radius: 50%;
                        }

                        span {
                            font-size: 12px;
                            color: #444;
                            line-height: 20px;
                        }
                    }

                    .Read {
                        display: flex;
                        align-items: center;
                        gap: 5px;
                        color: #444;
                    }

                    .Time {
                        font-size: 12px;
                        color: #444;
                        line-height: 20px;
                    }

                    .ButtonSection {
                        position: absolute;
                        right: 0px;
                        top: 0px;
                    }
                }

                .CommentSection {
                    padding-top: 10px;
                    margin-top: 10px;
                    border-top: 1px solid #ebeff3;
                    display: flex;
                    justify-content: center;

                    .Item {
                        padding: 10px 30px;
                        text-align: center;
                        margin: 5px;
                        border-radius: 100px;

                        &:hover {
                            background-color: #f0f0f0;
                            cursor: pointer;
                        }

                        .icon {
                            font-size: 25px;
                            color: #666;
                            margin-bottom: 5px;
                        }

                        span {
                            display: block;
                            color: #666;
                        }
                    }

                    .active {

                        .icon,
                        span {
                            color: #ff5100;

                        }
                    }
                }
            }

            .comment {
                padding: 20px;
                background-color: #fff;
                border-radius: 10px;
                margin-bottom: 10px;

                .ButtonSection {
                    margin-top: 10px;
                    position: relative;

                    .send-btn {
                        border-radius: 7px;
                        background-color: var(--color-primary);

                    }
                }

                .road {
                    border-radius: 10px;
                }
            }

        }

        .Right {
            margin-left: 10px;
            width: var(--sidebar-right-w);

            .UserInfo {
                width: calc(100% - 20px);
                border-radius: 10px;
                background-color: #fff;
                overflow: hidden;

                .UserBack {
                    width: 100%;
                    height: 150px;
                    background-size: cover;
                    background-position: center;
                }

                img {
                    width: 70px;
                    height: 70px;
                    border-radius: 50%;
                    margin: 0 auto;
                    margin-top: -35px;
                    border: 2px solid #fff;
                    display: block;
                }

                .nickname {
                    text-align: center;
                    font-size: 15px;
                    color: #333;
                    margin-top: 10px;
                }

                .UserDetail {
                    display: flex;
                    gap: 10px;
                    padding: 10px;
                    margin-top: 10px;
                    background-color: #f5f9fc;
                    border-radius: 10px;
                    width: calc(100% - 40px);
                    margin: 10px;
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
            }

            .NavBar {
                width: calc(100% - 20px);
                padding: 8px;
                border-radius: 10px;
                background-color: #fff;
                margin-top: 10px;

                .Item {
                    width: calc(100% - 20px);
                    padding: 10px 0;
                    cursor: pointer;

                    p {
                        font-size: 16px;
                        color: #333;
                    }
                }
            }
        }
    }
}
.MobShows{
    display: none!important;
}
/* 视口小于768px时的样式 */
@media (max-width: 768px) {
    .MobShows{
        display: flex;
    }
    .MainBox {
        width: calc(100% - 20px);
        height: 100%;
        padding-top: 70px;
        margin: 0 auto;

        .Left {
            width: calc(100%);
            margin: 0 auto;

            /* 隐藏滚动条 */
            &::-webkit-scrollbar {
                display: none;
            }

            .Breadcrumb {
                margin-bottom: 10px;
                padding: 10px 14px;
                background-color: #fff;
                border-radius: 10px;

                :deep(.arco-breadcrumb) {
                    font-size: 12px;
                }

                :deep(a) {
                    color: var(--color-primary);
                    text-decoration: none;
                    transition: color 0.2s, opacity 0.2s;

                    &:hover {
                        color: var(--color-primary);
                        opacity: 0.7;
                    }
                }
            }

            .MainContent {
                padding: 20px 20px 0px;
                background-color: #fff;
                border-radius: 10px;
                margin-bottom: 10px;

                .ThreadInfo {
                    position: relative;

                    h1 {
                        font-size: 24px;
                        font-weight: bold;
                        margin-bottom: 10px;
                        margin-top: 0;
                    }

                    .Category {
                        margin-top: 10px;

                        .Tag {
                            border-radius: 20px;
                            padding: 5px 10px;
                            font-size: 12px;
                            background-color: #ecf7fc;
                            display: inline-block;
                            color: #1890ff;
                        }
                    }

                    padding-bottom: 10px;
                    margin-bottom: 10px;
                    border-bottom: 1px solid #ebeff3;

                    .User {
                        display: flex;
                        align-items: center;
                        gap: 5px;

                        img {
                            width: 20px;
                            height: 20px;
                            border-radius: 50%;
                        }

                        span {
                            font-size: 12px;
                            color: #444;
                            line-height: 20px;
                        }
                    }

                    .Read {
                        display: flex;
                        align-items: center;
                        gap: 5px;
                        color: #444;
                    }

                    .Time {
                        font-size: 12px;
                        color: #444;
                        line-height: 20px;
                    }

                    .ButtonSection {
                        position: absolute;
                        right: 0px;
                        top: 0px;
                    }
                }

                .CommentSection {
                    padding-top: 10px;
                    margin-top: 10px;
                    border-top: 1px solid #ebeff3;
                    display: flex;

                    .Item {
                        width: 100%;
                        padding: 10px 30px;
                        text-align: center;
                        margin: 5px;
                        border-radius: 100px;

                        &:hover {
                            background-color: #f0f0f0;
                            cursor: pointer;
                        }

                        .icon {
                            font-size: 20px;
                            color: #666;
                            margin-bottom: 5px;
                        }

                        span {
                            display: block;
                            color: #666;
                            font-size: 12px;
                        }
                    }

                    .active {

                        .icon,
                        span {
                            color: #ff5100;

                        }
                    }
                }
            }

            .comment {
                padding: 20px;
                background-color: #fff;
                border-radius: 10px;
                margin-bottom: 10px;

                .ButtonSection {
                    margin-top: 10px;
                    position: relative;

                    .send-btn {
                        border-radius: 7px;
                        background-color: var(--color-primary);


                    }
                }

                .road {
                    border-radius: 10px;
                }
            }

        }

        .Right {
            width: calc(100%);
            margin: 10px auto 0;

            .UserInfo {
                width: calc(100% - 20px);
                border-radius: 10px;
                background-color: #fff;
                overflow: hidden;

                .UserBack {
                    width: 100%;
                    height: 150px;
                    background-size: cover;
                    background-position: center;
                }

                img {
                    width: 70px;
                    height: 70px;
                    border-radius: 50%;
                    margin: 0 auto;
                    margin-top: -35px;
                    border: 2px solid #fff;
                    display: block;
                }

                .nickname {
                    text-align: center;
                    font-size: 15px;
                    color: #333;
                    margin-top: 10px;
                }

                .UserDetail {
                    display: flex;
                    gap: 10px;
                    padding: 10px;
                    margin-top: 10px;
                    background-color: #f5f9fc;
                    border-radius: 10px;
                    width: calc(100% - 40px);
                    margin: 10px;
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
            }

            .NavBar {
                width: calc(100% - 20px);
                padding: 8px;
                border-radius: 10px;
                background-color: #fff;
                margin-top: 10px;

                .Item {
                    width: calc(100% - 20px);
                    padding: 10px 0;
                    cursor: pointer;

                    p {
                        font-size: 16px;
                        color: #333;
                    }
                }
            }
        }
    }
}

/* 最后一块内容不携带尾部外边距，使 footer 与上方容器间距与首页一致 */
@media (min-width: 768px) {
    .MainBox > .Left > :last-child {
        margin-bottom: 0;
    }
}
</style>