<template>
    <div>
        <div class="Page">
            <a-page-header title="我的账单" :show-back="false">
                <template #subtitle>
                    <a-space>
                        <a-input v-model="billQuery.search" placeholder="模糊搜索" allow-clear />
                        <a-button type="primary" @click="billLoad()">检索</a-button>
                    </a-space>
                </template>

            </a-page-header>
            <div class="Pagecontent">
                <a-tabs v-model:active-key="billQuery.status" @change="handleTabChange">
                    <a-tab-pane key="1" title="积分账单"></a-tab-pane>
                    <a-tab-pane key="2" title="余额账单"></a-tab-pane>
                    <a-tab-pane key="3" title="提现记录"></a-tab-pane>
                </a-tabs>
                <!-- 积分/余额账单 -->
                <a-table v-if="billQuery.status != '3'" style="height: calc(100vh - 230px);" :columns="columns" :data="billList" :pagination="false"
                    :loading="billLoading" class="bill-table">
                    <template #n_type="{ record }">
                        <a-tag v-if="record.n_type == 1" color="arcoblue">
                            <template #icon>
                                <icon-arrow-rise />
                            </template>
                            收入
                        </a-tag>
                        <a-tag v-else color="orangered">
                            <template #icon>
                                <icon-arrow-fall />
                            </template>
                            支出
                        </a-tag>
                    </template>
                    <template #n_amount="{ record }">
                        <span :class="record.n_type == 1 ? 'amount-income' : 'amount-expense'">
                            {{ record.n_type == 1 ? '+' : '-' }}{{ record.n_amount }}
                        </span>
                    </template>
                    <template #footer>
                        <ListPager v-model:current="billQuery.page" v-model:pageSize="billQuery.pagesize"
                            :total="billQuery.total" show-page-size :page-size-options="[50, 100, 200, 500, 1000]"
                            @load="billLoad" />
                    </template>
                </a-table>

                <!-- 提现记录 -->
                <a-table v-if="billQuery.status == '3'" style="height: calc(100vh - 230px);" :columns="withdrawColumns" :data="withdrawList" :pagination="false"
                    :loading="withdrawLoading" class="bill-table">
                    <template #n_type="{ record }">
                        <a-tag v-if="record.n_type == '1'" color="blue">待审核</a-tag>
                        <a-tag v-else-if="record.n_type == '2'" color="green">已打款</a-tag>
                        <a-tag v-else-if="record.n_type == '3'" color="red">已驳回</a-tag>
                        <a-tag v-else color="gray">未知</a-tag>
                    </template>
                    <template #footer>
                        <ListPager v-model:current="withdrawQuery.page" v-model:pageSize="withdrawQuery.pagesize"
                            :total="withdrawQuery.total" show-page-size :page-size-options="[20, 50, 100]"
                            @load="withdrawLoad" />
                    </template>
                </a-table>
            </div>
        </div>

    </div>
</template>

<script setup>
/* 账单列表（积分/余额）与提现记录：纯查询，复用 useList
   注意：useList 返回的均为 ref，模板中作为普通对象属性访问不会自动解包，须解构后使用 */
const route = useRoute()
/* 从 URL 参数 ?type= 初始化：1=积分账单 2=余额账单 3=提现记录，默认积分账单 */
const initType = ['1', '2', '3'].includes(String(route.query.type)) ? String(route.query.type) : '1'

const {
    list: billList,
    query: billQuery,
    loading: billLoading,
    load: billLoad,
} = useList({ api: '/api/getuserbill', extraQuery: { status: initType }, autoLoad: false })
const {
    list: withdrawList,
    query: withdrawQuery,
    loading: withdrawLoading,
    load: withdrawLoad,
} = useList({ api: '/api/GetWithdrawList', autoLoad: false })

/* 仅加载当前 Tab 对应列表，避免多打一次无用请求 */
onMounted(() => {
    if (initType === '3') withdrawLoad()
    else billLoad()
})

const columns = [

    {
        title: '时间',
        dataIndex: 'n_time',
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '金额',
        dataIndex: 'n_amount',
    },
    {
        title: '去向',
        dataIndex: 'n_name',
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '权重',
        slotName: 'n_type',
    },

];

// 提现记录表格列
const withdrawColumns = [
    {
        title: '申请时间',
        dataIndex: 'n_time',
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '订单号',
        dataIndex: 'n_no',
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '提现金额',
        dataIndex: 'n_amount',
    },
    {
        title: '手续费',
        dataIndex: 'n_handling_fee',
    },
    {
        title: '实际到账',
        dataIndex: 'n_received',
    },
    {
        title: '收款账号',
        dataIndex: 'n_acc',
        ellipsis: true,
        tooltip: true,
    },
    {
        title: '状态',
        slotName: 'n_type',
    },
    {
        title: '到账时间',
        dataIndex: 'n_oktime',
        ellipsis: true,
        tooltip: true,
    },
];

// 切换 tab
const handleTabChange = (key) => {
    billQuery.value.status = key
    if (key === '3') {
        withdrawLoad()
    } else {
        billQuery.value.page = 1
        billLoad()
    }
}
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
    }
}

// 表格样式优化
:deep(.bill-table) {
    .arco-table {
        border-radius: 12px;
        overflow: hidden;

        thead {
            background: linear-gradient(135deg, #f5f7fa, #ffffff);

            .arco-table-th {
                background-color: transparent;
                font-weight: 600;
                color: #333;
                padding: 16px 12px;

                &:first-child {
                    border-top-left-radius: 12px;
                }

                &:last-child {
                    border-top-right-radius: 12px;
                }
            }
        }

        tbody {
            tr {
                transition: all 0.3s ease;

                &:hover {
                    background-color: #f5f7fa;
                    transform: scale(1.005);
                }

                td {
                    padding: 14px 12px;
                    border-bottom: 1px solid #f0f0f0;
                }

                &:last-child {
                    td {
                        border-bottom: none;
                    }
                }
            }
        }

        .arco-table-empty {
            padding: 60px 20px;
            color: #999;
            font-size: 14px;

            .arco-empty-icon {
                font-size: 48px;
                margin-bottom: 16px;
                opacity: 0.3;
            }
        }
    }
}

// 金额样式
.amount-income {
    color: #00b42a;
    font-weight: 600;
    font-size: 15px;
}

.amount-expense {
    color: #f53f3f;
    font-weight: 600;
    font-size: 15px;
}
</style>
