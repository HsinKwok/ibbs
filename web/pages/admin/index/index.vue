<template>
    <div class="dashboard-container">
        <!-- 项目信息卡片 -->
        <div class="project-info-banner">
            <div class="project-info-content">
                <div class="project-title">
                    <icon-github class="github-icon" />
                    <span>{{ SiteConfig.$state.Config.n_web_title }}</span>
                </div>
                <div class="project-desc">
                    {{ SiteConfig.$state.Config.n_web_desc }}
                </div>
            </div>
            <div class="project-links">
                <a-button type="outline" size="small" @click="openGitee">
                    <template #icon>
                        <icon-github />
                    </template>
                    Gitee
                </a-button>
                <a-button type="outline" size="small" @click="openGithub">
                    <template #icon>
                        <icon-github />
                    </template>
                    GitHub
                </a-button>
            </div>
        </div>

        <!-- 页面标题 -->
        <div class="page-header">
            <div>
                <h1 class="page-title">数据概览</h1>
                <p class="page-subtitle">实时监控您的应用数据表现</p>
            </div>
            <div class="header-actions">
                <a-button type="primary" @click="handleRefresh">
                    <template #icon>
                        <icon-refresh />
                    </template>
                    刷新数据
                </a-button>
            </div>
        </div>

        <!-- 数据统计卡片 -->
        <div class="data-section">
            <div class="data-grid">
                <!-- 总用户数 -->
                <a-card class="data-card" hoverable>
                    <div class="card-content">
                        <div class="card-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                            <icon-user />
                        </div>
                        <div class="card-info">
                            <div class="card-title">总用户数</div>
                            <div class="card-value">
                                {{ WebInfo.total?.users || 0 }}
                            </div>
                            <div class="card-trend"
                                :class="{ 'up': getTrend(WebInfo.total?.users, WebInfo.today?.register, WebInfo.yesterday?.register) >= 0, 'down': getTrend(WebInfo.total?.users, WebInfo.today?.register, WebInfo.yesterday?.register) < 0 }">
                                今日新增 <span>{{ WebInfo.today?.register || 0 }}</span>
                                <template v-if="WebInfo.yesterday?.register !== undefined">
                                    <icon-arrow-up v-if="(WebInfo.today?.register ?? 0) >= (WebInfo.yesterday?.register ?? 0)" />
                                    <icon-arrow-down v-else />
                                    <span>{{ Math.abs((WebInfo.today?.register ?? 0) - (WebInfo.yesterday?.register ?? 0)) }}</span>
                                </template>
                            </div>
                        </div>
                    </div>
                </a-card>

                <!-- 总帖子数 -->
                <a-card class="data-card" hoverable>
                    <div class="card-content">
                        <div class="card-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
                            <icon-file />
                        </div>
                        <div class="card-info">
                            <div class="card-title">总帖子数</div>
                            <div class="card-value">
                                {{ WebInfo.total?.threads || 0 }}
                            </div>
                            <div class="card-trend"
                                :class="{ 'up': (WebInfo.today?.threads ?? 0) >= (WebInfo.yesterday?.threads ?? 0), 'down': (WebInfo.today?.threads ?? 0) < (WebInfo.yesterday?.threads ?? 0) }">
                                今日新增 <span>{{ WebInfo.today?.threads || 0 }}</span>
                                <template v-if="WebInfo.yesterday?.threads !== undefined">
                                    <icon-arrow-up v-if="(WebInfo.today?.threads ?? 0) >= (WebInfo.yesterday?.threads ?? 0)" />
                                    <icon-arrow-down v-else />
                                    <span>{{ Math.abs((WebInfo.today?.threads ?? 0) - (WebInfo.yesterday?.threads ?? 0)) }}</span>
                                </template>
                            </div>
                        </div>
                    </div>
                </a-card>

                <!-- 总评论数 -->
                <a-card class="data-card" hoverable>
                    <div class="card-content">
                        <div class="card-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
                            <icon-message />
                        </div>
                        <div class="card-info">
                            <div class="card-title">总评论数</div>
                            <div class="card-value">
                                {{ WebInfo.total?.comments || 0 }}
                            </div>
                            <div class="card-trend"
                                :class="{ 'up': (WebInfo.today?.comments ?? 0) >= (WebInfo.yesterday?.comments ?? 0), 'down': (WebInfo.today?.comments ?? 0) < (WebInfo.yesterday?.comments ?? 0) }">
                                今日新增 <span>{{ WebInfo.today?.comments || 0 }}</span>
                                <template v-if="WebInfo.yesterday?.comments !== undefined">
                                    <icon-arrow-up v-if="(WebInfo.today?.comments ?? 0) >= (WebInfo.yesterday?.comments ?? 0)" />
                                    <icon-arrow-down v-else />
                                    <span>{{ Math.abs((WebInfo.today?.comments ?? 0) - (WebInfo.yesterday?.comments ?? 0)) }}</span>
                                </template>
                            </div>
                        </div>
                    </div>
                </a-card>

                <!-- 今日流水 -->
                <a-card class="data-card" hoverable>
                    <div class="card-content">
                        <div class="card-icon" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
                            <icon-safe />
                        </div>
                        <div class="card-info">
                            <div class="card-title">今日流水</div>
                            <div class="card-value">
                                ¥{{ WebInfo.today?.revenue?.toFixed(2) || '0.00' }}
                            </div>
                            <div class="card-trend"
                                :class="{ 'up': (WebInfo.today?.revenue ?? 0) >= (WebInfo.yesterday?.revenue ?? 0), 'down': (WebInfo.today?.revenue ?? 0) < (WebInfo.yesterday?.revenue ?? 0) }">
                                昨日流水 <span>¥{{ WebInfo.yesterday?.revenue?.toFixed(2) || '0.00' }}</span>
                                <template v-if="WebInfo.yesterday?.revenue !== undefined">
                                    <icon-arrow-up v-if="(WebInfo.today?.revenue ?? 0) >= (WebInfo.yesterday?.revenue ?? 0)" />
                                    <icon-arrow-down v-else />
                                    <span>¥{{ Math.abs((WebInfo.today?.revenue ?? 0) - (WebInfo.yesterday?.revenue ?? 0)).toFixed(2)
                                        }}</span>
                                </template>
                            </div>
                        </div>
                    </div>
                </a-card>
            </div>
        </div>

        <!-- 趋势图表 -->
        <div class="chart-section">
            <a-card class="chart-card" title="综合趋势">
                <template #extra>
                    <a-radio-group v-model="chartDays" type="button" size="small" @change="handleDaysChange">
                        <a-radio :value="7">7天</a-radio>
                        <a-radio :value="30">30天</a-radio>
                        <a-radio :value="90">90天</a-radio>
                    </a-radio-group>
                </template>
                <div class="chart-container">
                    <div ref="trendChartRef" style="width: 100%; height: 100%;"></div>
                </div>
            </a-card>
        </div>
    </div>
</template>

<script setup>
import { Message } from '@arco-design/web-vue';
/* 按需引入 echarts：仅折线图 + 图表所需基础组件，避免打包全量 echarts */
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

useSeoSet({
    title: '后台管理系统'
})

/* 后台路由未在 app.vue 预加载站点配置，这里统一拉取，供顶部项目信息卡片使用 */
const SiteConfig = useSiteConfig()
await SiteConfig.init()

/* 获取综合数据 */
const WebInfo = ref({
    total: {},
    today: {},
    yesterday: {}
})
const GetWebInfo = async () => {
    const res = await useApiFetch().post('/api/GetIndexStatistics')
    if (res.code === 200) {
        WebInfo.value = res.data
    } else {
        Message.error(res.msg)
    }
}

/* 趋势数据 */
const trendData = ref([])
const chartDays = ref(30)
const trendChartRef = ref(null)
let trendChart = null

const GetTrend = async (days = 30) => {
    try {
        const res = await useApiFetch().post('/api/GetComprehensiveTrend', { days })
        if (res.code === 200) {
            trendData.value = res.data
            initChart()
        } else {
            Message.error(res.msg)
        }
    } catch (error) {
        Message.error('获取趋势数据失败')
    }
}

/* 初始化图表 */
const initChart = () => {
    if (!trendChartRef.value || !trendData.value.length) return

    if (trendChart) {
        trendChart.dispose()
    }

    trendChart = echarts.init(trendChartRef.value)

    const dates = trendData.value.map(item => item.date.slice(5))
    const registerData = trendData.value.map(item => item.register)
    const threadsData = trendData.value.map(item => item.threads)
    const commentsData = trendData.value.map(item => item.comments)
    const revenueData = trendData.value.map(item => item.revenue)

    const option = {
        backgroundColor: '#fff',
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'cross',
                label: {
                    backgroundColor: '#6a7985'
                }
            }
        },
        legend: {
            data: ['新增用户', '新增帖子', '新增评论', '流水'],
            top: 10,
            left: 'center'
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            top: '15%',
            containLabel: true
        },
        xAxis: [
            {
                type: 'category',
                boundaryGap: false,
                data: dates,
                axisLabel: {
                    rotate: 45,
                    interval: Math.ceil(dates.length / 10)
                }
            }
        ],
        yAxis: [
            {
                type: 'value',
                name: '数量',
                position: 'left',
                axisLabel: {
                    formatter: '{value}'
                },
                splitLine: {
                    lineStyle: {
                        type: 'dashed'
                    }
                }
            },
            {
                type: 'value',
                name: '金额(元)',
                position: 'right',
                axisLabel: {
                    formatter: '¥{value}'
                },
                splitLine: {
                    show: false
                }
            }
        ],
        series: [
            {
                name: '新增用户',
                type: 'line',
                data: registerData,
                smooth: true,
                yAxisIndex: 0,
                itemStyle: {
                    color: '#667eea'
                },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(102, 126, 234, 0.3)' },
                        { offset: 1, color: 'rgba(102, 126, 234, 0.05)' }
                    ])
                }
            },
            {
                name: '新增帖子',
                type: 'line',
                data: threadsData,
                smooth: true,
                yAxisIndex: 0,
                itemStyle: {
                    color: '#f5576c'
                },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(245, 87, 108, 0.3)' },
                        { offset: 1, color: 'rgba(245, 87, 108, 0.05)' }
                    ])
                }
            },
            {
                name: '新增评论',
                type: 'line',
                data: commentsData,
                smooth: true,
                yAxisIndex: 0,
                itemStyle: {
                    color: '#4facfe'
                },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(79, 172, 254, 0.3)' },
                        { offset: 1, color: 'rgba(79, 172, 254, 0.05)' }
                    ])
                }
            },
            {
                name: '流水',
                type: 'line',
                data: revenueData,
                smooth: true,
                yAxisIndex: 1,
                itemStyle: {
                    color: '#43e97b'
                },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: 'rgba(67, 233, 123, 0.3)' },
                        { offset: 1, color: 'rgba(67, 233, 123, 0.05)' }
                    ])
                }
            }
        ]
    }

    trendChart.setOption(option)
}

/* 计算趋势 */
const getTrend = (total, today, yesterday) => {
    if (today === undefined || yesterday === undefined) return 0
    return today - yesterday
}

/* 刷新数据 */
const handleRefresh = async () => {
    await Promise.all([
        GetWebInfo(),
        GetTrend(chartDays.value)
    ])
    Message.success('数据已刷新')
}

/* 打开 Gitee */
const openGitee = () => {
    window.open(SiteConfig.$state.Config.n_gitee_url, '_blank')
}

/* 打开 GitHub */
const openGithub = () => {
    window.open(SiteConfig.$state.Config.n_github_url, '_blank')
}

/* 切换天数 */
const handleDaysChange = (value) => {
    chartDays.value = value
    GetTrend(value)
}

/* 窗口大小改变时重新渲染图表 */
const handleResize = () => {
    trendChart?.resize()
}

onMounted(() => {
    GetWebInfo()
    GetTrend(chartDays.value)
    window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize)
    if (trendChart) {
        trendChart.dispose()
        trendChart = null
    }
})


</script>

<style lang="scss" scoped>
.dashboard-container {
    padding: 24px;
    background-color: #f7f7f8;
    overflow-y: auto;

    .project-info-banner {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 12px;
        padding: 20px 24px;
        margin-bottom: 24px;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;

        .project-info-content {
            display: flex;
            flex-direction: column;
            gap: 6px;

            .project-title {
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 20px;
                font-weight: 700;
                color: white;

                .github-icon {
                    font-size: 24px;
                }
            }

            .project-desc {
                font-size: 14px;
                color: rgba(255, 255, 255, 0.85);
            }
        }

        .project-links {
            display: flex;
            gap: 12px;

            :deep(.arco-btn) {
                background: rgba(255, 255, 255, 0.15);
                border-color: rgba(255, 255, 255, 0.3);
                color: white;
                backdrop-filter: blur(10px);
                transition: all 0.3s ease;

                &:hover {
                    background: rgba(255, 255, 255, 0.25);
                    border-color: rgba(255, 255, 255, 0.5);
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                }

                .arco-btn-icon {
                    color: white;
                }
            }
        }
    }

    .page-header {
        background: white;
        border-radius: 12px;
        padding: 24px;
        margin-bottom: 24px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        border: 1px solid #f0f0f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;

        .page-title {
            font-size: 24px;
            font-weight: 700;
            margin: 0;
            color: #1f2937;
        }

        .page-subtitle {
            font-size: 14px;
            color: #6b7280;
            margin: 4px 0 0 0;
        }

        .header-actions {
            :deep(.arco-btn) {
                border-radius: 8px;
                font-weight: 600;
                transition: all 0.3s ease;

                &:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                }
            }
        }
    }

    .data-section {
        margin-bottom: 24px;

        .data-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;

            .data-card {
                border-radius: 12px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
                transition: all 0.3s ease;
                border: 1px solid #f0f0f0;

                &:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
                }

                :deep(.arco-card-body) {
                    padding: 20px;
                }

                .card-content {
                    display: flex;
                    align-items: center;

                    .card-icon {
                        width: 48px;
                        height: 48px;
                        border-radius: 12px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-right: 16px;
                        font-size: 24px;
                        color: white;
                    }

                    .card-info {
                        flex: 1;

                        .card-title {
                            font-size: 14px;
                            color: #6b7280;
                            margin-bottom: 8px;
                        }

                        .card-value {
                            font-size: 28px;
                            font-weight: 700;
                            color: #1f2937;
                            line-height: 1;
                            margin-bottom: 8px;
                        }

                        .card-trend {
                            font-size: 12px;
                            display: flex;
                            align-items: center;
                            gap: 4px;

                            span {
                                font-weight: 600;
                            }

                            &.up {
                                color: #00b42a;
                            }

                            &.down {
                                color: #f53f3f;
                            }
                        }
                    }
                }
            }
        }
    }

    .chart-section {
        .chart-card {
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
            border: 1px solid #f0f0f0;

            :deep(.arco-card-header) {
                border-bottom: 1px solid #f0f0f0;
                padding: 20px 20px 0;

                .arco-card-title {
                    font-size: 18px;
                    font-weight: 600;
                }
            }

            .chart-container {
                padding: 20px;
                height: 400px;
            }
        }
    }
}

// 响应式设计
@media (max-width: 768px) {
    .dashboard-container {
        padding: 16px;
    height: calc(100vh - 150px);

        .project-info-banner {
            padding: 16px 20px;
            flex-direction: column;
            align-items: flex-start;

            .project-links {
                width: 100%;
                justify-content: center;

                :deep(.arco-btn) {
                    flex: 1;
                }
            }
        }

        .page-header {
            padding: 20px;
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;

            .header-actions {
                width: 100%;

                :deep(.arco-btn) {
                    width: 100%;
                }
            }
        }

        .data-grid {
            grid-template-columns: 1fr;
        }
    }
}

@media (max-width: 480px) {
    .dashboard-container {
        padding: 12px;

        .page-header {
            padding: 16px;

            .page-title {
                font-size: 20px;
            }
        }

        .data-grid .data-card .card-content {
            padding: 16px;

            .card-icon {
                width: 40px;
                height: 40px;
                font-size: 20px;
            }

            .card-info .card-value {
                font-size: 24px;
            }
        }
    }
}
</style>
