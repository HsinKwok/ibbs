<template>
    <div>
        <div>
            <UserHeader title="我的动态"></UserHeader>
        </div>
        <div class="PageTop">
            <div class="Pagecontent">
                <div class="useravatar">
                    <UserAvatar :src="UserInfo.$state.UserInfo.n_avatar"
                        :seed="UserInfo.$state.UserInfo.id || UserInfo.$state.UserInfo.n_nickname" />
                </div>
                <div class="userinfo">
                    <p class="userinfoname">{{ UserInfo.$state.UserInfo.n_nickname }}</p>
                    <p class="usersignature">{{ UserInfo.$state.UserInfo.n_signature }}</p>
                </div>
            </div>
            <NavBox :Item="[
                {
                    value: '1',
                    name: `帖子（${TBBSInfo.posts}）`
                },
                {
                    value: '2',
                    name: `回复（${TBBSInfo.n_comment}）`
                },
                {
                    value: '3',
                    name: `粉丝（${TBBSInfo.followers}）`
                },
                {
                    value: '4',
                    name: `关注（${TBBSInfo.following}）`
                },
            ]" v-model:modelValue="ShowIndex" style="margin-top: 20px;"></NavBox>
            <!-- 底部区域 n_balance -->

        </div>
        <div class="Page">
            <!-- 我的帖子 -->
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
            <!-- 我的评论 -->
            <div v-if="ShowIndex === '2'">
                <FlexBox :data="CommentList" :columns="2" :gap="8" :loading="CommentLoading">
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
            <!-- 我的粉丝 -->
            <div v-if="ShowIndex === '3'">
                <FlexBox :data="FollowerList" :columns="3" :gap="8" :loading="FollowerLoading">
                    <template #item="{ item }">
                        <UserBox :info="item" @reload="GetFollowerList">
                        </UserBox>
                    </template>
                </FlexBox>
                <div class="PageNav">
                    <ListPager v-model:current="FollowFrom.page" v-model:pageSize="FollowFrom.pagesize"
                        :total="FollowFrom.total" @load="GetFollowerList" />
                </div>
            </div>
            <!-- 我的关注 -->
            <div v-if="ShowIndex === '4'">
                <FlexBox :data="FollowingList" :columns="3" :gap="8" :loading="FollowingLoading">
                    <template #item="{ item }">
                        <UserBox :info="item" @reload="GetFollowingList">
                        </UserBox>
                    </template>
                </FlexBox>
                <div class="PageNav">
                    <ListPager v-model:current="FollowingFrom.page" v-model:pageSize="FollowingFrom.pagesize"
                        :total="FollowingFrom.total" @load="GetFollowingList" />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { Message } from '@arco-design/web-vue';
const UserInfo = useUserInfo()

/* 论坛详情 */
const TBBSInfo = ref({})

const getinfo = async () => {
    const res = await useApiFetch().post('/api/GetUser', {
        id: 'me'
    })
    if (res.code === 200) {
        TBBSInfo.value = res.data
    }
}

const CommentLoading = ref(false)
const FollowerLoading = ref(false)
const FollowingLoading = ref(false)


/* 主列表：我的帖子，复用 useList */
const { list, query, loading, load } = useList({
    api: '/api/GetThreads',
    extraQuery: { pagesize: 10, ismy: 1 },
    /* 加载后批量预取作者信息，避免每个 ItemA 各自发起请求 */
    onLoad: (data) => useUserProfile().prefetchUsers(data.map((i) => i.n_uid)),
})

/* 获取评论列表 */
const GetCommentsFrom = ref({
    page: 1,
    pagesize: 20,
    ismy: 1,
    total: 0
})
const CommentList = ref([])
const GetCommentList = async () => {
    try {
        CommentLoading.value = true
        const res = await useApiFetch().post('/api/GetComments', GetCommentsFrom.value)
        if (res.code == 200) {
            CommentList.value = res.data
            GetCommentsFrom.value.total = res.total
        } else {
        }
    } catch (error) {
        Message.error(error.message)
    } finally {
        CommentLoading.value = false
    }
}

/* 获取粉丝列表 */
const FollowFrom = ref({
    page: 1,
    pagesize: 9,
    total: 0,
    followers: 1,
    uid: 'me'
})
const FollowerList = ref([])
const GetFollowerList = async () => {
    try {
        FollowerLoading.value = true
        const res = await useApiFetch().post('/api/GetUser', FollowFrom.value)
        if (res.code == 200) {
            FollowerList.value = res.data
            FollowFrom.value.total = res.total
        } else {
        }
    } catch (error) {
        Message.error(error.message)
    } finally {
        FollowerLoading.value = false
    }
}

/* 获取关注列表 */
const FollowingFrom = ref({
    page: 1,
    pagesize: 9,
    total: 0,
    following: 1,
    uid: 'me'
})
const FollowingList = ref([])
const GetFollowingList = async () => {
    try {
        FollowingLoading.value = true
        const res = await useApiFetch().post('/api/GetUser', FollowingFrom.value)
        if (res.code == 200) {
            FollowingList.value = res.data
            FollowingFrom.value.total = res.total
        } else {

        }
    } catch (error) {
        Message.error(error.message)
    } finally {
        FollowingLoading.value = false
    }
}
onMounted(() => {
    /* 首屏仅请求 Tab 标签计数；其余列表按需懒加载，避免并发请求不可见 Tab 的数据 */
    getinfo()
})


/* 查看页面 */
const ShowIndex = ref('1')

/* 按 Tab 懒加载：仅在首次切换到对应 Tab 时请求一次，避免 mount 时并发 4 个请求 */
const tabLoaded = { '2': false, '3': false, '4': false }
const loadTab = (tab) => {
    if (tabLoaded[tab]) return
    if (tab === '2') { tabLoaded[tab] = true; GetCommentList() }
    else if (tab === '3') { tabLoaded[tab] = true; GetFollowerList() }
    else if (tab === '4') { tabLoaded[tab] = true; GetFollowingList() }
}
watch(ShowIndex, loadTab)
</script>

<style lang="scss" scoped>
.PageTop {
    width: 100%;
    background-color: #fff;
    padding: 10px 20px;
    border-radius: 20px;
    margin-bottom: 12px;

    .Pagecontent {
        width: calc(100%);
        background-color: #fff;
        display: flex;
        position: relative;
        margin: 5px auto;

        .useravatar {
            width: 80px;
            height: 80px;

            img {
                width: 100%;
                height: 100%;
                border-radius: 50%;
                border: 1px solid #ccc;
            }
        }

        .userinfo {
            margin-left: 30px;
            margin-top: 10px;

            .userinfoname {
                font-size: 24px;
                font-weight: 800;
                color: #000;
            }

            .usersignature {
                font-size: 14px;
                color: #666;
                margin-top: 10px;
                line-height: 20px;
                max-width: 300px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
        }

        .right-buttons {
            position: absolute;
            right: 0px;
            top: 0px;
            border-radius: 20px;
            overflow: hidden;
        }
    }





    @media (max-width: 780px) {

        /* 视口小于 780px 时*/
        .Content {
            // flex-direction: column;
            flex-wrap: wrap;

            .VipBox {
                width: calc(100% - 40px);
            }

            .BanBox {
                margin-left: 0px;
                margin-top: 5px;
                width: calc(50% - 42.5px);

                &:last-child {
                    margin-left: 5px;
                }

                .BanBoxButtons {

                    display: none;
                }
            }
        }

        .Infobox,
        .ActiveBox {
            grid-template-columns: 1fr !important;

        }
    }

}

.Page {
    .content-box {
        width: calc(100%);
        margin-top: 10px;
        column-count: 2;
        column-gap: 10px;

        :deep(.Itemlist) {
            margin-bottom: 10px;
            break-inside: avoid;
        }
    }

    .PageNav {
        width: 100%;
        margin-top: 12px;
        display: flex;
        padding: 8px;
        border-radius: 10px;
        background-color: #fff;
        justify-content: center;
    }

    /* 帖子列表卡片紧凑化 */
    :deep(.Itemlist) {
        padding: 8px;

        .UserInfo {
            .UserDetail {
                padding-top: 4px;
            }
        }

        .Content {
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

}
</style>
