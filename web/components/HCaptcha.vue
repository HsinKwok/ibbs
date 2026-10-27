<template>
    <div v-if="enabled" ref="shell" class="hc-box">
        <label v-if="label" class="hc-label">{{ label }}</label>
        <div class="hc-stage" :style="stageStyle">
            <div ref="container" class="hc-widget" :style="widgetStyle"></div>
            <div v-if="!ready" class="hc-placeholder">
                <span v-if="!failed" class="hc-spinner"></span>
                <template v-if="failed">
                    <span>验证码加载失败</span>
                    <button type="button" class="hc-retry" @click="retry">重试</button>
                </template>
                <span v-else>正在加载人机验证…</span>
            </div>
        </div>
        <p v-if="hint" class="hc-hint">{{ hint }}</p>
    </div>
</template>

<script setup>
/*
 * hCaptcha 组件（显式渲染）。
 * - 未配置 NUXT_PUBLIC_HCAPTCHA_SITE_KEY 时不渲染、不加载脚本，等同该防护未启用
 * - 脚本按需加载且全局仅加载一次，避免每个页面都插入 <script>
 * - 控件固定 303×78，按容器宽度等比缩放，避免窄屏（如 310px 侧栏）溢出
 * - 通过 ref 暴露 getToken() / reset() 供表单提交与重试使用
 */
const props = defineProps({
    theme: { type: String, default: 'light' },
    /* 控件上方的标题文字，留空则不显示 */
    label: { type: String, default: '' },
    /* 控件下方的说明文字，留空则不显示 */
    hint: { type: String, default: '' },
    /* 控件水平对齐：left / center */
    align: { type: String, default: 'left' },
    /* 控件语言，默认简体中文；传空串则由 hCaptcha 按浏览器语言自动判断 */
    hl: { type: String, default: 'zh-CN' }
})
const emit = defineEmits(['verify', 'expire', 'error'])

/* hCaptcha 普通尺寸控件的固定宽高 */
const WIDGET_WIDTH = 303
const WIDGET_HEIGHT = 78

const siteKey = useRuntimeConfig().public.hcaptchaSiteKey || ''
const enabled = computed(() => !!siteKey)

const shell = ref(null)
const container = ref(null)
const scale = ref(1)
const ready = ref(false)
const failed = ref(false)
let widgetId = null
let scriptPromise = null
let resizeObserver = null

/* 按容器可用宽度缩放控件，保证在 310px 侧栏与手机上都不溢出 */
const stageStyle = computed(() => ({
    width: `${Math.round(WIDGET_WIDTH * scale.value)}px`,
    height: `${Math.round(WIDGET_HEIGHT * scale.value)}px`,
    margin: props.align === 'center' ? '0 auto' : '0'
}))

const widgetStyle = computed(() => ({
    width: `${WIDGET_WIDTH}px`,
    height: `${WIDGET_HEIGHT}px`,
    transform: `scale(${scale.value})`
}))

function measure() {
    if (!shell.value) return
    const width = shell.value.clientWidth
    if (width > 0) scale.value = Math.min(1, width / WIDGET_WIDTH)
}

function loadScript() {
    if (typeof window === 'undefined') return Promise.reject(new Error('hCaptcha 仅支持浏览器环境'))
    if (window.hcaptcha) return Promise.resolve()
    if (scriptPromise) return scriptPromise
    scriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit'
        script.async = true
        script.defer = true
        script.onload = () => resolve()
        script.onerror = () => {
            /* 失败后清空缓存，允许下次挂载或点击重试 */
            scriptPromise = null
            reject(new Error('hCaptcha 脚本加载失败'))
        }
        document.head.appendChild(script)
    })
    return scriptPromise
}

async function renderWidget() {
    if (!enabled.value || !container.value || widgetId !== null) return
    try {
        await loadScript()
        if (widgetId !== null) return
        const options = {
            sitekey: siteKey,
            theme: props.theme,
            callback: (token) => emit('verify', token),
            'expired-callback': () => emit('expire'),
            'error-callback': () => emit('error')
        }
        /* 指定控件语言；留空时交给 hCaptcha 按浏览器语言自动判断 */
        if (props.hl) options.hl = props.hl
        widgetId = window.hcaptcha.render(container.value, options)
        ready.value = true
    } catch (error) {
        console.error(error)
        failed.value = true
        emit('error')
    }
}

function retry() {
    failed.value = false
    scriptPromise = null
    renderWidget()
}

onMounted(() => {
    measure()
    if (typeof ResizeObserver !== 'undefined' && shell.value) {
        resizeObserver = new ResizeObserver(measure)
        resizeObserver.observe(shell.value)
    }
    renderWidget()
})

onBeforeUnmount(() => {
    if (resizeObserver) {
        resizeObserver.disconnect()
        resizeObserver = null
    }
    if (widgetId !== null && typeof window !== 'undefined' && window.hcaptcha) {
        try { window.hcaptcha.remove(widgetId) } catch (e) { /* 脚本已被卸载时忽略 */ }
    }
    widgetId = null
})

defineExpose({
    enabled,
    /* 取当前验证令牌；未完成验证时为空串 */
    getToken: () => (widgetId !== null && typeof window !== 'undefined' && window.hcaptcha
        ? (window.hcaptcha.getResponse(widgetId) || '')
        : ''),
    /* 令牌一次性使用，提交后需重置才能再次验证 */
    reset: () => {
        if (widgetId !== null && typeof window !== 'undefined' && window.hcaptcha) {
            window.hcaptcha.reset(widgetId)
        }
    }
})
</script>

<style lang="scss" scoped>
.hc-box {
    width: 100%;
}

.hc-label {
    display: block;
    margin-bottom: 6px;
    font-size: 12px;
    line-height: 1.5;
    color: #86909c;
}

.hc-stage {
    position: relative;
    max-width: 100%;
}

/* hCaptcha 控件按 303×78 渲染，这里等比缩放以适配窄容器 */
.hc-widget {
    position: absolute;
    left: 0;
    top: 0;
    transform-origin: top left;
}

.hc-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 12px;
    color: #86909c;
    background-color: #fafbfc;
    border: 1px dashed #e5e6eb;
    border-radius: 6px;
}

.hc-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid #e5e6eb;
    border-top-color: var(--color-primary, #5b8c5a);
    border-radius: 50%;
    animation: hc-spin 0.8s linear infinite;
}

.hc-retry {
    padding: 0;
    border: none;
    background: none;
    font-size: 12px;
    color: var(--color-primary, #5b8c5a);
    cursor: pointer;
}

.hc-hint {
    margin: 6px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: #86909c;
}

@keyframes hc-spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
