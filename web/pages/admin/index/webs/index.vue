<template>
    <div>
        <div class="Page">
            <a-page-header title="站点信息管理" :show-back="false"></a-page-header>
            <div class="Pagecontent">
                <a-tabs default-active-key="1">
                    <a-tab-pane key="1" title="基础配置">
                        <a-form :model="form" :style="{ width: '600px' }">
                            <a-form-item field="name" label="站点ICO">
                                <Upimg :src="form.n_web_icon" width="100" height="100" @success="(e) => {
                                    form.n_web_icon = e
                                }"></Upimg>
                            </a-form-item>
                            <a-form-item field="name" label="站点logo">
                                <Upimg :src="form.n_web_logo" width="200" height="100" @success="(e) => {
                                    form.n_web_logo = e
                                }"></Upimg>
                            </a-form-item>
                            <a-form-item field="name" label="站点名称">
                                <a-input v-model="form.n_web_title" />
                            </a-form-item>
                            <a-form-item field="name" label="站点简介">
                                <a-input v-model="form.n_web_desc" />
                            </a-form-item>
                            <a-form-item field="name" label="站点关键词">
                                <a-input v-model="form.n_web_keys" />
                            </a-form-item>
                            <a-form-item field="name" label="版权标注">
                                <a-input v-model="form.n_web_copyright" />
                            </a-form-item>
                            <a-form-item>
                                <a-button type="primary" @click="editwebinfo()">确认修改</a-button>
                            </a-form-item>
                        </a-form>
                    </a-tab-pane>
                    <a-tab-pane key="4" title="联系方式">
                        <a-form :model="form" :style="{ width: '600px' }">
                            <a-form-item field="name" label="联系QQ">
                                <a-input v-model="form.n_contact_qqnumber" />
                            </a-form-item>
                            <a-form-item field="name" label="联系微信">
                                <a-input v-model="form.n_contact_wxnumber" />
                            </a-form-item>
                            <a-form-item field="name" label="联系手机">
                                <a-input v-model="form.n_contact_phone" />
                            </a-form-item>
                            <a-form-item field="name" label="联系邮箱">
                                <a-input v-model="form.n_contact_email" />
                            </a-form-item>
                            <a-form-item>
                                <a-button type="primary" @click="editwebinfo()">确认修改</a-button>
                            </a-form-item>
                        </a-form>
                    </a-tab-pane>
                    <a-tab-pane key="2" title="上传配置">
                        <a-form :model="form" :style="{ width: '600px' }">
                            <a-form-item field="name" label="上传功能">
                                <a-radio-group v-model="form.n_upload_enable" type="button">
                                    <a-radio value="1">开启</a-radio>
                                    <a-radio value="0">关闭</a-radio>
                                </a-radio-group>
                                <template #extra>
                                    <div>关闭后前台用户将无法上传文件；前台头像上传将改为选择系统默认头像。后台管理员上传不受影响。</div>
                                </template>
                            </a-form-item>
                            <a-form-item field="name" label="图片大小">
                                <a-input v-model="form.n_upload_image_size" placeholder="请输入">
                                    <template #append>
                                        MB
                                    </template>
                                </a-input>
                            </a-form-item>
                            <a-form-item field="name" label="文件大小">
                                <a-input v-model="form.n_upload_file_size" placeholder="请输入">
                                    <template #append>
                                        MB
                                    </template>
                                </a-input>
                            </a-form-item>
                            <a-form-item field="name" label="图片后缀">
                                <a-textarea v-model="form.n_upload_image_suffix" cols="30" rows="20" allow-clear />
                            </a-form-item>
                            <a-form-item field="name" label="文件后缀">
                                <a-textarea v-model="form.n_upload_file_suffix" cols="30" rows="20" allow-clear />
                            </a-form-item>
                            <a-form-item>
                                <a-button type="primary" @click="editwebinfo()">确认修改</a-button>
                            </a-form-item>
                        </a-form>
                    </a-tab-pane>
                    <a-tab-pane key="3" title="安全配置">
                        <a-form :model="form" :style="{ width: '600px' }">
                            <a-form-item field="name" label="后台入口">
                                <a-input v-model="form.n_admin_path" placeholder="请输入自定义后台入口，如 admin"
                                    allow-clear />
                            </a-form-item>
                            <a-form-item>
                                <a-alert type="warning">
                                    <template #title>提示</template>
                                    <p>当前后台入口：<strong>{{ currentEntry }}</strong></p>
                                    <p>留空则使用默认后台入口 /admin，后台账号与密码亦为默认值。</p>
                                    <p>自定义后原 /admin 将失效（访问返回 404），请使用新入口访问后台并牢记该地址；保存后请刷新页面或重新登录以生效。</p>
                                    <p>仅支持字母、数字、下划线、连字符；不能使用根目录下已有的目录名或文件名（如 login、user、class、market、follow、images、uplist、error、index、avatars、api 等），否则保存会被拒绝。</p>
                                </a-alert>
                            </a-form-item>
                            <a-form-item>
                                <a-button type="primary" @click="saveAdminPath()">确认修改</a-button>
                            </a-form-item>
                        </a-form>
                    </a-tab-pane>
                    <a-tab-pane key="5" title="推广配置">
                        <a-form :model="form" :style="{ width: '600px' }">
                            <a-form-item field="name" label="显示卡片">
                                <a-radio-group v-model="form.n_show_star" type="button">
                                    <a-radio value="1">显示</a-radio>
                                    <a-radio value="0">隐藏</a-radio>
                                </a-radio-group>
                            </a-form-item>
                            <a-form-item field="name" label="卡片内容">
                                <RichInput v-model="form.n_star_content" :height="300"
                                    placeholder="请编辑求Star卡片展示的内容"></RichInput>
                            </a-form-item>
                            <a-form-item>
                                <a-button type="primary" @click="editwebinfo()">确认修改</a-button>
                            </a-form-item>
                        </a-form>
                    </a-tab-pane>
                    <a-tab-pane key="6" title="时区设置">
                        <a-form :model="form" :style="{ width: '600px' }">
                            <a-form-item field="name" label="站点时区">
                                <a-select v-model="form.n_timezone" placeholder="请选择站点时区" allow-search>
                                    <a-option v-for="tz in timezoneOptions" :key="tz.value" :value="tz.value">
                                        {{ tz.label }}
                                    </a-option>
                                </a-select>
                                <template #extra>
                                    <div>用于签到、统计、私信撤回、时间展示等全站日期时间的计算，含夏令时自动换算；默认 Asia/Shanghai（UTC+8）。修改后全站按新时区生效。</div>
                                </template>
                            </a-form-item>
                            <a-form-item>
                                <a-button type="primary" @click="editwebinfo()">确认修改</a-button>
                            </a-form-item>
                        </a-form>
                    </a-tab-pane>
                </a-tabs>


            </div>

        </div>
    </div>
</template>

<script setup>
import { Message } from '@arco-design/web-vue';
import { DEFAULT_STAR_CONTENT, isBlankStarContent } from '@/Tools/starDefault';
import { normalizeAdminSegment, isReservedAdminSegment, adminBaseFromSegment } from '@/utils/adminPath';
import { resolveTimezone } from '@/utils/format';
const form = ref({})

/* 常见时区（IANA 名称）：value 用于存储与计算（支持夏令时），label 便于识别 */
const timezoneOptions = [
    { value: 'Asia/Shanghai', label: 'Asia/Shanghai　中国标准时间 (UTC+8)' },
    { value: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong　香港时间 (UTC+8)' },
    { value: 'Asia/Taipei', label: 'Asia/Taipei　台北时间 (UTC+8)' },
    { value: 'Asia/Singapore', label: 'Asia/Singapore　新加坡时间 (UTC+8)' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo　日本标准时间 (UTC+9)' },
    { value: 'Asia/Seoul', label: 'Asia/Seoul　韩国标准时间 (UTC+9)' },
    { value: 'Asia/Bangkok', label: 'Asia/Bangkok　曼谷时间 (UTC+7)' },
    { value: 'Asia/Kolkata', label: 'Asia/Kolkata　印度标准时间 (UTC+5:30)' },
    { value: 'Asia/Dubai', label: 'Asia/Dubai　迪拜时间 (UTC+4)' },
    { value: 'Europe/Moscow', label: 'Europe/Moscow　莫斯科时间 (UTC+3)' },
    { value: 'Europe/London', label: 'Europe/London　伦敦时间 (UTC+0/+1)' },
    { value: 'Europe/Paris', label: 'Europe/Paris　巴黎时间 (UTC+1/+2)' },
    { value: 'Europe/Berlin', label: 'Europe/Berlin　柏林时间 (UTC+1/+2)' },
    { value: 'America/New_York', label: 'America/New_York　纽约时间 (UTC-5/-4)' },
    { value: 'America/Los_Angeles', label: 'America/Los_Angeles　洛杉矶时间 (UTC-8/-7)' },
    { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo　圣保罗时间 (UTC-3)' },
    { value: 'Australia/Sydney', label: 'Australia/Sydney　悉尼时间 (UTC+10/+11)' },
    { value: 'Pacific/Auckland', label: 'Pacific/Auckland　奥克兰时间 (UTC+12/+13)' },
    { value: 'UTC', label: 'UTC　协调世界时 (UTC+0)' },
]

/* 当前生效的后台入口：留空或与根路径已有名称冲突时回退默认 /admin，与实际生效值保持一致 */
const currentEntry = computed(() => adminBaseFromSegment(form.value.n_admin_path))

/* 获取配置信息 getwebinfo */
const getwebinfo = async () => {
    try {
        const res = await useApiFetch().post('/api/getweb')
        if (res.code == 200) {
            const data = res.data || {}
            // 未配置推广内容时预填默认卡片内容，方便直接用编辑器修改
            if (isBlankStarContent(data.n_star_content)) {
                data.n_star_content = DEFAULT_STAR_CONTENT
            }
            // 后台入口默认值与当前生效入口保持一致：空值/历史脏值(如 "null")/保留字统一回退默认段，避免显示脏值或与现有路径冲突
            data.n_admin_path = adminBaseFromSegment(data.n_admin_path).slice(1)
            // 时区兜底：未配置/非法值回退默认，保证下拉有选中项，与后端 getConfig 口径一致
            data.n_timezone = resolveTimezone(data.n_timezone)
            form.value = data
        } else {
            Message.error(res.msg)
        }
    } catch (e) {
        Message.error('获取配置失败，请稍后重试')
    }
}
/* 编辑配置信息 editwebinfo */
const editwebinfo = async () => {
    try {
        const res = await useApiFetch().post('/api/editweb', form.value)
        if (res.code == 200) {
            Message.success(res.msg)
        } else {
            Message.error(res.msg)
        }
    } catch (e) {
        Message.error('保存失败，请稍后重试')
    }
}

/* 保存后台入口（基础校验：去除空格与非法字符，且不能与根路径已有目录/文件名冲突） */
const saveAdminPath = async () => {
    const segment = normalizeAdminSegment(form.value.n_admin_path)
    if (segment && isReservedAdminSegment(segment)) {
        Message.error(`「${segment}」是系统已有的目录名或文件名，请换一个后台入口`)
        return
    }
    form.value.n_admin_path = segment
    try {
        const res = await useApiFetch().post('/api/editweb', form.value)
        if (res.code == 200) {
            Message.success(form.value.n_admin_path
                ? `保存成功，后台入口已改为 ${currentEntry.value}，请使用新地址访问后台`
                : '保存成功，后台入口已恢复为默认 /admin')
        } else {
            Message.error(res.msg)
        }
    } catch (e) {
        Message.error('保存失败，请稍后重试')
    }
}

onMounted(() => {
    getwebinfo()
})

</script>

<style lang="scss" scoped>
.Page {
    background-color: #fff;
    margin: 1px;
    width: calc(100% - 2px);

    .Pagecontent {
        width: calc(100% - 20px);
        padding: 10px;
        padding-top: 20px;

        /* 推广配置：加宽 wangEditor 工具栏（仅作用于本页编辑器） */
        :deep(.w-e-toolbar) {
            width: 700px;
        }
    }

}
</style>
