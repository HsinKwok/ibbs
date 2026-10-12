<template>
    <div class="Pageas">
        <div class="PageContent">
            <div class="UserInfo">
                <div class="TopBox">
                    <div class="TopBoxbACS" :style="{
                        backgroundImage: `url(${Users.n_userback || '/default-banner.jpg'})`
                    }">
                        <div class="BackgroundImage">
                        </div>
                    </div>

                    <div class="UserInfoBox">
                        <div class="TInfo">
                            <div class="n_avatar">
                                <UserAvatar :src="Users.n_avatar" :seed="Users.id || Users.n_nickname" alt="" />
                            </div>
                            <div class="UserInfos">
                                <div class="UserInfoBox">
                <p class="nickname">
                    {{ Users?.n_nickname }}
                </p>
                <a-tooltip v-for="(value, index) in Users?.medals || []" :key="value.n_src || index" :content="value.n_name"
                    position="bottom">
                    <img :src="value.n_src" alt="勋章" class="medal-icon" loading="lazy" />
                </a-tooltip>
            </div>
                                <p class="signature">{{ Users.n_signature }}</p>
                                <!-- 关注 / 发私信 -->
                                <div class="Follow" v-if="UserInfo.$state.UserInfo?.id !== Users.id">
                                    <a-button :loading="followLoading" @click.stop="LikeUser()"
                                        :class="['FollowBtn', { 'Close': Users.isLiked }]" type="primary">
                                        {{ Users.isLiked ? '取消关注' : '关注' }}
                                    </a-button>
                                    <a-button class="FollowBtn MsgBtn" @click.stop="goChat()">发私信</a-button>
                                </div>
                            </div>
                        </div>
                        <div class="stats">
                            <div class="Item">
                                <p class="Value">{{ Users?.posts || 0 }}</p>
                                <p class="Label">发帖数</p>
                            </div>
                            <div class="Item">
                                <p class="Value">{{ Users?.n_comment || 0 }}</p>
                                <p class="Label">评论数</p>
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

                    </div>


                </div>
                <div class="NavBox">
                    <NavBox :Item="[
                        {
                            value: '1',
                            name: '他的帖子'
                        },
                        {
                            value: '2',
                            name: '他的评论'
                        }
                    ]" v-model:modelValue="ShowIndex"></NavBox>
                </div>
                <div v-if="ShowIndex === '1'">
                    <FlexBox :data="list" :columns="2" :gap="8" :loading="loading">
                        <template #item="{ item }">
                            <ItemA :data="item"></ItemA>
                        </template>
                    </FlexBox>
                    <div class="PageNav">
                        <ListPager v-model:current="query.page" v-model:pageSize="query.pagesize" :total="query.total"
                            @load="load" />
                    </div>
                </div>
                <div v-if="ShowIndex === '2'">
                    <FlexBox :data="CommentList" :columns="2" :gap="8" :loading="commentLoading">
                        <template #item="{ item }">
                            <CommentItem :data="item" @reload="GetCommentList">
                            </CommentItem>
                        </template>
                    </FlexBox>
                    <div class="PageNav">
                        <ListPager v-model:current="GetCommentsFrom.page" v-model:pageSize="GetCommentsFrom.pagesize"
                            :total="GetCommentsFrom.total" @load="GetCommentList" />
                    </div>
                </div>
            </div>
            <div class="Right">
                <div class="NavBar">
                    <BoxTitle>热门圈子</BoxTitle>
                    <ClassItem v-for="value in CategoryList" :key="value.id" :data="value"></ClassItem>
                </div>
                <div class="NavBar">
                    <BoxTitle>热门话题</BoxTitle>
                    <TopicItem v-for="value in TopicList" :key="value.id" :data="value"></TopicItem>
                </div>
            </div>

        </div>

    </div>
</template>

<script setup>
import { Message } from '@arco-design/web-vue';
const route = useRoute()
const id = route.params.id
const SiteConfig = useSiteConfig()
const UserInfo = useUserInfo()
const Users = ref({})

/* 获取用户信息 GetUser */
const res = await useApiSsr('GetUser' + id, '/api/GetUser', {
    id: id
})
if (res.code == 200) {
    Users.value = res.data
} else if (import.meta.client) {
    /* 仅在客户端提示，避免 SSR 调用 Arco Message 报错 */
    Message.error(res.msg || '获取用户信息失败')
}

useSeoSet({
    title: Users.value.n_nickname + ' - ' + SiteConfig.$state.Config.n_web_title,
})
/* 右侧栏：热门圈子 + 热门话题，复用 useSidebar */
const { CategoryList, TopicList } = useSidebar()

/* 主列表：UP 主帖子，复用 useList */
const { list, query, loading, load } = useList({
    api: '/api/GetThreads',
    extraQuery: { pagesize: 10, uid: id },
    /* 加载后批量预取作者信息，避免每个 ItemA 各自发起请求 */
    onLoad: (data) => useUserProfile().prefetchUsers(data.map((i) => i.n_uid)),
})

/* 获取评论列表 */
const GetCommentsFrom = ref({
    page: 1,
    pagesize: 20,
    uid: id,
    total: 0
})
const CommentList = ref([])
const commentLoading = ref(false)
const GetCommentList = async () => {
    try {
        commentLoading.value = true
        const res = await useApiFetch().post('/api/GetComments', GetCommentsFrom.value)
        if (res.code == 200) {
            CommentList.value = res.data
            GetCommentsFrom.value.total = res.total
        } else {
        }
    } catch (error) {
        Message.error(error.message)
    } finally {
        commentLoading.value = false
    }
}

onMounted(() => {
    GetCommentList()
})


const ShowIndex = ref('1')

/* 关注用户 LikeUser：后端为切换式（关注/取消关注），成功后重新拉取以同步真实状态 */
const followLoading = ref(false)
const LikeUser = async () => {
    try {
        followLoading.value = true
        const res = await useApiFetch().post('/api/LikeUser', { id: Users.value.id })
        if (res.code == 200) {
            Message.success(res.msg)
            const info = await useApiFetch().post('/api/GetUser', { id: id })
            if (info.code == 200) Users.value = info.data
        } else {
            Message.error(res.msg || '关注失败')
        }
    } catch (error) {
        Message.error(error.message)
    } finally {
        followLoading.value = false
    }
}

/* 发私信：跳转消息中心并自动打开与该用户的会话 */
const goChat = () => {
    navigateTo({ path: '/user/message', query: { to: Users.value.id } })
}
</script>

<style lang="scss" scoped>
/* 视口大于768px */
@media (min-width: 768px) {
    .Pageas {
        width: calc(100%);
        height: calc(100%);
        position: relative;

        .PageContent {
            width: 100%;
            position: relative;
            z-index: 12;
            max-width: 1280px;
            margin: 0 auto;
            display: flex;

            .UserInfo {
                width: calc(100% - var(--sidebar-right-w));

                .TopBox {
                    width: calc(100%);
                    border-radius: 10px;
                    background-color: #fff;
                    overflow: hidden;

                    .TopBoxbACS {
                        width: 100%;
                        height: 130px;
                        background-repeat: no-repeat;
                        background-size: 100%;
                        background-position: center;

                        .BackgroundImage {
                            width: calc(100%);
                            background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgb(255, 255, 255) 100%);

                            height: 100%;
                        }
                    }
                }

                .UserInfoBox {
                    width: calc(100% - 30px);
                    padding: 15px;
                    position: relative;

                    .TInfo {
                        display: flex;

                        .n_avatar {
                            width: 80px;
                            height: 80px;
                            margin-top: -20px;

                            img {
                                width: 100%;
                                border: 5px solid #fff;
                                height: 100%;
                                border-radius: 50%;
                            }
                        }

                        .UserInfos {
                            margin-left: 10px;
                            position: relative;
                            width: calc(100% - 90px);

                              .UserInfoBox {
                                display: flex;
                                gap: 3px;
                                margin-top: 10px;

                                .nickname {
                                    font-weight: 800;
                                font-size: 19px;
                                }

                                .medal-icon {
                                    height: 20px;
                                }
                            }


                            .signature {
                                margin-top: 5px;
                                color: #333;
                            }

                            .Follow {
                                width: calc(100px);
                                position: absolute;
                                bottom: 10px;
                                right: 10px;
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



                    }

                    .stats {
                        width: 100%;
                        display: flex;
                        margin-top: 20px;

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

                .NavBox {
                    margin-top: 10px;
                    margin-bottom: 12px;
                    padding: 0px 20px;
                    background-color: #fff;
                    border-radius: 10px;

                }

                .content-box {
                    width: calc(100%);
                    margin-top: 10px;
                    column-count: 2;
                    column-gap: 10px;

                    :deep(.Itemlist) {
                        break-inside: avoid;
                        margin-bottom: 10px;
                    }
                }

                /* 帖子列表卡片紧凑化 */
                :deep(.Itemlist) {
                    width: 100%;
                    padding: 8px;

                    .UserInfo {
                        .UserDetail {
                            padding-top: 4px;
                        }
                    }

                    .Content {
                        width: 100%;
                        margin-right: 0;
                        padding: 0;

                        .PostContent {
                            margin-top: 6px;

                            .word {
                                margin-top: 6px;
                            }
                        }

                        .ImageList {
                            margin-top: 6px;
                        }

                        .PostActions {
                            margin-top: 8px;
                        }

                        .Interactions {
                            margin-top: 6px;
                            margin-bottom: 0;
                        }
                    }
                }


                .PageNav {
                    width: calc(100%);
                    margin-top: 12px;
                    display: flex;
                    padding: 8px;
                    border-radius: 10px;
                    background-color: #fff;
                    justify-content: center;
                }

            }

            .Right {
                margin-left: 10px;



                .NavBar {
                    width: calc(var(--sidebar-right-w) - 20px);
                    padding: 8px;
                    border-radius: var(--radius);
                    background-color: #fff;
                    margin-bottom: 10px;

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
}

/* 视口小于768px */
@media (max-width: 768px) {
    .Pageas {
        width: calc(100%);
        height: calc(100%);
        position: relative;

        .PageContent {
            width: 100%;
            position: relative;
            z-index: 12;
            max-width: 1280px;
            margin: 0 auto;

            .UserInfo {
                width: calc(100% - 20px);
                margin: 0 auto;

                .TopBox {
                    width: calc(100%);
                    border-radius: 10px;
                    background-color: #fff;
                    overflow: hidden;

                    .TopBoxbACS {
                        width: 100%;
                        height: 130px;
                        background-repeat: no-repeat;
                        background-size: 100%;
                        background-position: center;

                        .BackgroundImage {
                            width: calc(100%);
                            background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgb(255, 255, 255) 100%);

                            height: 100%;
                        }
                    }
                }

                .UserInfoBox {
                    width: calc(100% - 30px);
                    padding: 15px;
                    position: relative;

                    .TInfo {
                        display: flex;

                        .n_avatar {
                            width: 60px;
                            height: 60px;
                            margin-top: -10px;

                            img {
                                width: 100%;
                                border: 5px solid #fff;
                                height: 100%;
                                border-radius: 50%;
                            }
                        }

                        .UserInfos {
                            margin-left: 10px;
                            position: relative;
                            width: calc(100% - 70px);

                            .nickname {
                                font-weight: 800;
                                font-size: 19px;
                            }

                            .signature {
                                margin-top: 5px;
                                color: #333;
                            }

                            .Follow {
                                width: calc(100px);
                                position: absolute;
                                bottom: 20px;
                                right: 0px;
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



                    }

                    .stats {
                        width: 100%;
                        display: flex;
                        margin-top: 20px;

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

                .NavBox {
                    margin-top: 10px;
                    margin-bottom: 12px;
                    padding: 0px 20px;
                    background-color: #fff;
                    border-radius: 10px;

                }

                .content-box {
                    width: calc(100%);
                    margin-top: 10px;
                    column-count: 1;
                    column-gap: 10px;

                    :deep(.Itemlist) {
                        break-inside: avoid;
                        margin-bottom: 10px;
                    }
                }

                /* 帖子列表卡片紧凑化 */
                :deep(.Itemlist) {
                    width: 100%;
                    padding: 8px;

                    .UserInfo {
                        .UserDetail {
                            padding-top: 4px;
                        }
                    }

                    .Content {
                        width: 100%;
                        margin-right: 0;
                        padding: 0;

                        .PostContent {
                            margin-top: 6px;

                            .word {
                                margin-top: 6px;
                            }
                        }

                        .ImageList {
                            margin-top: 6px;
                        }

                        .PostActions {
                            margin-top: 8px;
                        }

                        .Interactions {
                            margin-top: 6px;
                            margin-bottom: 0;
                        }
                    }
                }


                .PageNav {
                    width: calc(100%);
                    margin-top: 12px;
                    display: flex;
                    padding: 8px;
                    border-radius: 10px;
                    background-color: #fff;
                    justify-content: center;
                }

            }

            .Right {
                margin-left: 10px;
                width: calc(100% - 20px);
                margin: 10px auto;


                .NavBar {
                    width: calc(100% - 20px);
                    padding: 8px;
                    border-radius: var(--radius);
                    background-color: #fff;
                    margin-bottom: 10px;

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
}

.road {
    border-radius: 10px !important;
    overflow: hidden;
}

/* 发私信按钮与关注按钮上下排布 */
.MsgBtn {
    margin-top: 8px;
}
</style>
