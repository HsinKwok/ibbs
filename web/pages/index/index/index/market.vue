<template>
    <div class="MainBox">
        <div class="MainContent">
            <SwiperBox :pos="5" />
            <div class="Tbox">
                <BoxTitle>跳蚤市场</BoxTitle>
                <div class="TopBox">
                    <a-input class="search-input" placeholder="搜索商品" allow-clear v-model="query.search"
                        @press-enter="search">
                        <template #prefix>
                            <icon-search />
                        </template>
                    </a-input>
                </div>
            </div>

            <a-spin :loading="loading" style="width: 100%">
                <div class="market-list" v-if="list.length">
                    <div class="market-card" v-for="item in list" :key="item.id" @click="openDetail(item)">
                        <div class="market-head">
                            <span class="market-name">{{ item.n_name }}</span>
                            <span class="market-price">¥{{ item.n_price }}</span>
                        </div>
                        <div class="market-meta">
                            <span v-if="item.n_category" class="market-category">分类：<span class="market-category-link"
                                    @click.stop="openCategory(item.n_category)">{{ item.n_category }}</span></span>
                            <span v-if="item.n_validity">有效期：{{ item.n_validity }}</span>
                            <span v-if="item.n_original_price"
                                :class="{ 'is-struck': Number(item.n_original_price) > Number(item.n_price) }">原价 ¥{{ item.n_original_price }}</span>
                        </div>
                        <div class="market-foot">
                            <div class="market-desc" v-if="item.n_description">{{ item.n_description }}</div>
                            <div class="market-contact" v-if="item.n_contact">
                                <ContactText :text="item.n_contact" @mention="openMention" />
                            </div>
                        </div>
                    </div>
                </div>
                <a-empty v-else description="暂无在售商品" />
            </a-spin>

            <div class="PageNav">
                <ListPager v-model:current="query.page" v-model:pageSize="query.pagesize" :total="query.total"
                    @load="load" />
            </div>
        </div>

        <div class="SidebarRight">
            <div class="NavBar">
                <BoxTitle>说明</BoxTitle>
                <div class="desc-box">
                    <p v-for="(line, i) in marketDescLines" :key="i">· {{ line }}</p>
                </div>
            </div>
            <div class="NavBar">
                <BoxTitle>热门圈子</BoxTitle>
                <ClassItem v-for="value in CategoryList" :key="value.id" :data="value"></ClassItem>
            </div>
            <div class="NavBar">
                <BoxTitle>热门话题</BoxTitle>
                <TopicItem v-for="value in TopicList" :key="value.id" :data="value"></TopicItem>
            </div>
            <div class="NavBar">
                <NeedStar></NeedStar>
            </div>
        </div>

        <!-- 商品详情弹窗：展示该商品全部可见信息 -->
        <a-modal v-model:visible="detailVisible" title="商品详情" :footer="false" width="min(520px, 92vw)"
            unmount-on-close>
            <div class="market-detail" v-if="detailItem">
                <div class="detail-row">
                    <span class="detail-label">商品名称</span>
                    <span class="detail-value">{{ detailItem.n_name }}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">售价</span>
                    <span class="detail-value detail-price">¥{{ detailItem.n_price }}</span>
                </div>
                <div class="detail-row" v-if="detailItem.n_original_price">
                    <span class="detail-label">原价</span>
                    <span class="detail-value">¥{{ detailItem.n_original_price }}</span>
                </div>
                <div class="detail-row" v-if="detailItem.n_category">
                    <span class="detail-label">分类</span>
                    <span class="detail-value">{{ detailItem.n_category }}</span>
                </div>
                <div class="detail-row" v-if="detailItem.n_validity">
                    <span class="detail-label">有效期</span>
                    <span class="detail-value">{{ detailItem.n_validity }}</span>
                </div>
                <div class="detail-row" v-if="detailItem.n_contact">
                    <span class="detail-label">联系方式</span>
                    <span class="detail-value">
                        <ContactText :text="detailItem.n_contact" @mention="openMention" />
                    </span>
                </div>
                <div class="detail-row" v-if="detailItem.n_description">
                    <span class="detail-label">商品描述</span>
                    <span class="detail-value">{{ detailItem.n_description }}</span>
                </div>
            </div>
        </a-modal>

        <!-- 同分类商品弹窗：布局与跳蚤市场列表一致 -->
        <a-modal v-model:visible="categoryVisible" :title="`分类：${categoryName}`" :footer="false"
            width="min(680px, 92vw)" unmount-on-close>
            <a-spin :loading="categoryLoading" style="width: 100%">
                <div class="market-list" v-if="categoryList.length">
                    <div class="market-card" v-for="item in categoryList" :key="item.id" @click="openDetail(item)">
                        <div class="market-head">
                            <span class="market-name">{{ item.n_name }}</span>
                            <span class="market-price">¥{{ item.n_price }}</span>
                        </div>
                        <div class="market-meta">
                            <span v-if="item.n_category">分类：{{ item.n_category }}</span>
                            <span v-if="item.n_validity">有效期：{{ item.n_validity }}</span>
                            <span v-if="item.n_original_price"
                                :class="{ 'is-struck': Number(item.n_original_price) > Number(item.n_price) }">原价 ¥{{ item.n_original_price }}</span>
                        </div>
                        <div class="market-foot">
                            <div class="market-desc" v-if="item.n_description">{{ item.n_description }}</div>
                            <div class="market-contact" v-if="item.n_contact">
                                <ContactText :text="item.n_contact" @mention="openMention" />
                            </div>
                        </div>
                    </div>
                </div>
                <a-empty v-else description="该分类暂无在售商品" />
            </a-spin>

            <div class="PageNav">
                <ListPager v-model:current="categoryQuery.page" v-model:pageSize="categoryQuery.pagesize"
                    :total="categoryQuery.total" @load="loadCategory" />
            </div>
        </a-modal>
    </div>
</template>

<script setup>
import { Message } from '@arco-design/web-vue'

/* 主列表：跳蚤市场，复用 useList（仅查看） */
const { list, query, loading, load } = useList({
    api: '/api/GetMarketList',
    extraQuery: { pagesize: 10 },
})

/* 搜索后回到第一页再查询，避免停留在过滤前的越界页码导致空列表 */
const search = () => {
    query.value.page = 1
    load()
}

/* 右侧栏：热门圈子 + 热门话题，复用 useSidebar */
const { CategoryList, TopicList } = useSidebar()

/* 右侧栏「说明」：内容由后台「市场管理 → 商品列表 → 编辑说明」维护，
   存于站点配置 n_market_desc（纯文本、每行一条）；未配置时回退系统默认文案 */
const DEFAULT_MARKET_DESC = ['跳蚤市场用于交易虚拟商品', '商品由管理员统一发布与维护', '价格单位：元（人民币）']
const SiteConfig = useSiteConfig()
const marketDescLines = computed(() => {
    const lines = String(SiteConfig.$state.Config?.n_market_desc ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    return lines.length ? lines : DEFAULT_MARKET_DESC
})

/* 商品详情弹窗 */
const detailVisible = ref(false)
const detailItem = ref(null)
const openDetail = (item) => {
    detailItem.value = item
    detailVisible.value = true
}

/* 同分类商品弹窗：独立 useList 实例，按分类精确筛选（autoLoad 关闭，点击分类时再加载） */
const categoryVisible = ref(false)
const categoryName = ref('')
const { list: categoryList, query: categoryQuery, loading: categoryLoading, load: loadCategory } = useList({
    api: '/api/GetMarketList',
    extraQuery: { pagesize: 10, n_category: '' },
    autoLoad: false,
})
const openCategory = (name) => {
    categoryName.value = name
    categoryQuery.value.page = 1
    categoryQuery.value.n_category = name
    categoryVisible.value = true
    loadCategory()
}

/* 联系方式中的 @昵称 点击后跳转私信页：
   通过 GetUser 模糊搜索，再按昵称/用户名精确匹配取得 uid */
const openMention = async (name) => {
    const res = await useApiFetch().post('/api/GetUser', { search: name, pagesize: 50 })
    if (res?.code !== 200) {
        Message.warning(res?.msg || '未找到该用户')
        return
    }
    const user = (res.data || []).find((u) => u.n_nickname === name || u.n_username === name)
    if (!user) {
        Message.warning('未找到该用户')
        return
    }
    navigateTo({ path: '/user/message', query: { to: user.id } })
}
</script>

<style lang="scss" scoped>
@media (min-width: 768px) {
    .MainBox {
        display: flex;
        width: 100%;

        .MainContent {
            width: calc(100% - var(--sidebar-right-w));

            .Tbox {
                width: 100%;
                padding: 10px;
                background-color: #fff;
                border-radius: 10px;
                margin-bottom: 10px;
            }

            .TopBox {
                display: flex;

                .search-input {
                    width: 100%;
                    border-radius: 7px;
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
        }

        .SidebarRight {
            overflow-y: auto;
            margin-left: 10px;

            &::-webkit-scrollbar {
                display: none;
            }

            .NavBar {
                width: calc(var(--sidebar-right-w) - 20px);
                padding: 8px;
                border-radius: var(--radius);
                background-color: #fff;
                margin-bottom: 10px;

                .desc-box {
                    padding: 6px 0;
                    font-size: 13px;
                    color: var(--color-text-light);

                    p {
                        line-height: 1.9;
                    }
                }
            }
        }
    }

    /* 商品列表与卡片：主列表与弹窗共用同一套样式，保证布局一致 */
    .market-list {
        width: 100%;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
    }

    .market-card {
        background: #fff;
        border-radius: var(--radius);
        padding: 16px;
        border: var(--border);
        transition: box-shadow 0.2s;
        cursor: pointer;

        &:hover {
            box-shadow: var(--shadow-md);
        }

        .market-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;

            .market-name {
                font-size: 17px;
                font-weight: 600;
                color: var(--color-text);
            }

            .market-price {
                font-size: 18px;
                font-weight: 700;
                color: var(--color-primary);
            }
        }

        .market-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            font-size: 13px;
            color: var(--color-text-light);
            margin-bottom: 6px;

            .market-category {
                .market-category-link {
                    color: var(--color-primary);
                    cursor: pointer;

                    &:hover {
                        text-decoration: underline;
                    }
                }
            }

            .is-struck {
                text-decoration: line-through;
            }
        }

        .market-foot {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 10px;

            .market-desc {
                flex: 1;
                min-width: 0;
                font-size: 13px;
                color: var(--color-text-light);
                word-break: break-word;
            }

            .market-contact {
                flex-shrink: 0;
                margin-left: auto;
                font-size: 13px;
                font-weight: 600;
                color: var(--color-primary);
                text-align: right;
                white-space: nowrap;
            }
        }
    }

    /* 商品详情弹窗内容 */
    .market-detail {
        .detail-row {
            display: flex;
            gap: 12px;
            padding: 8px 0;
            font-size: 14px;

            & + .detail-row {
                border-top: 1px dashed rgba(0, 0, 0, 0.08);
            }

            .detail-label {
                flex-shrink: 0;
                width: 72px;
                color: var(--color-text-light);
            }

            .detail-value {
                flex: 1;
                min-width: 0;
                color: var(--color-text);
                word-break: break-word;
            }

            .detail-price {
                font-size: 18px;
                font-weight: 700;
                color: var(--color-primary);
            }
        }
    }
}

@media (max-width: 768px) {
    .MainBox {
        display: flex;
        width: 100%;

        .MainContent {
            width: calc(100%);

            .Tbox {
                width: calc(100% - 20px);
                padding: 10px;
                background-color: #fff;
                border-radius: 10px;
                margin-bottom: 5px;
            }

            .TopBox {
                display: flex;

                .search-input {
                    width: 100%;
                    border-radius: 7px;
                }
            }

            /* 主列表保留原有左右留白；弹窗内列表由下方通用样式占满 */
            .market-list {
                width: calc(100% - 20px);
            }

            .PageNav {
                width: calc(100% - 20px);
                margin-top: 12px;
                display: flex;
                padding: 8px;
                border-radius: 10px;
                background-color: #fff;
                justify-content: center;
            }
        }

        .SidebarRight {
            display: none;
        }
    }

    /* 商品列表与卡片：主列表与弹窗共用同一套样式，保证布局一致 */
    .market-list {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .market-card {
        background: #fff;
        border-radius: var(--radius);
        padding: 14px;
        border: var(--border);
        cursor: pointer;

        .market-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;

            .market-name {
                font-size: 16px;
                font-weight: 600;
            }

            .market-price {
                font-size: 17px;
                font-weight: 700;
                color: var(--color-primary);
            }
        }

        .market-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            font-size: 12px;
            color: var(--color-text-light);

            .market-category {
                .market-category-link {
                    color: var(--color-primary);
                    cursor: pointer;

                    &:hover {
                        text-decoration: underline;
                    }
                }
            }

            .is-struck {
                text-decoration: line-through;
            }
        }

        .market-foot {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 10px;
            margin-top: 4px;

            .market-desc {
                flex: 1;
                min-width: 0;
                font-size: 12px;
                color: var(--color-text-light);
                word-break: break-word;
            }

            .market-contact {
                flex-shrink: 0;
                margin-left: auto;
                font-size: 12px;
                font-weight: 600;
                color: var(--color-primary);
                text-align: right;
                white-space: nowrap;
            }
        }
    }

    /* 商品详情弹窗内容 */
    .market-detail {
        .detail-row {
            display: flex;
            gap: 10px;
            padding: 8px 0;
            font-size: 14px;

            & + .detail-row {
                border-top: 1px dashed rgba(0, 0, 0, 0.08);
            }

            .detail-label {
                flex-shrink: 0;
                width: 64px;
                color: var(--color-text-light);
            }

            .detail-value {
                flex: 1;
                min-width: 0;
                color: var(--color-text);
                word-break: break-word;
            }

            .detail-price {
                font-size: 17px;
                font-weight: 700;
                color: var(--color-primary);
            }
        }
    }
}
</style>
