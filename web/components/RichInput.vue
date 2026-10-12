<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { upimg, upfile } from '@/Tools/update' // 你的上传函数
const props = defineProps({
    modelValue: {
        type: String,
        default: '',
    },
    placeholder: {
        type: String,
        default: '请输入内容...',
    },
    height: {
        type: Number,
        default: 300,
    },
    /* 是否允许上传（受站点「上传功能」总开关约束，后台场景恒为 true） */
    uploadEnable: {
        type: Boolean,
        default: true,
    },
})

const emit = defineEmits(['update:modelValue', 'update:resources'])

const editorRef = ref(null)
const toolbarRef = ref(null)
let editorInstance = null

// 提取HTML中的资源链接
const extractResources = (html) => {
    const resources = []

    // 提取图片链接
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g
    let match
    while ((match = imgRegex.exec(html)) !== null) {
        resources.push({
            type: 1,
            url: match[1]
        })
    }

    // 提取视频链接
    const videoRegex = /<video[^>]*>\s*<source[^>]+src=["']([^"']+)["'][^>]*>\s*<\/video>/g
    while ((match = videoRegex.exec(html)) !== null) {
        resources.push({
            type: 2,
            url: match[1]
        })
    }

    return resources.sort((a, b) => b.type - a.type)
}

// 同步资源列表到父组件
const syncResources = () => {
    if (!editorInstance) return
    const html = editorInstance.getHtml()
    const resources = extractResources(html)
    emit('update:resources', resources)
}

onMounted(async () => {
    if (!process.client) return

    // 先保存容器引用：异步加载编辑器期间组件可能已被卸载（如未登录被重定向），
    // 卸载后 ref 会置空，此时不能再创建编辑器/工具栏，否则 createToolbar 会因 selector 为空抛错
    const editorDom = editorRef.value
    const toolbarDom = toolbarRef.value
    if (!editorDom || !toolbarDom) return

    // 编辑器样式与 JS 一同按需加载，避免未使用编辑器的页面也加载 wangEditor 样式
    const [, { createEditor, createToolbar }] = await Promise.all([
        import('@wangeditor/editor/dist/css/style.css'),
        import('@wangeditor/editor'),
    ])

    // 组件在等待加载期间已卸载，放弃初始化
    if (!editorDom.isConnected || !toolbarDom.isConnected) return

    editorInstance = createEditor({
        selector: editorDom,
        config: {
            placeholder: props.placeholder,
            onChange(editor) {
                const html = editor.getHtml()
                emit('update:modelValue', html)
                // 同步资源列表
                syncResources()
            },
            MENU_CONF: {
                // 可在这里配置上传图片等功能
                uploadImage: {
                    async customUpload(file, insertFn) {
                        if (!props.uploadEnable) {
                            Message.warning('上传功能已关闭')
                            return
                        }
                        try {
                            const res = await upimg(file, () => { })
                            if (res?.code !== 200) return
                            insertFn(res.data.url)
                            // 上传后同步资源列表
                            setTimeout(() => syncResources(), 100)
                        } catch (e) {
                            // upimg 内部已提示失败，这里仅避免未捕获异常
                        }
                    }
                },
                uploadVideo: {
                    async customUpload(file, insertFn) {
                        if (!props.uploadEnable) {
                            Message.warning('上传功能已关闭')
                            return
                        }
                        try {
                            const res = await upfile(file, () => { })
                            if (res?.code !== 200) return
                            insertFn(res.data.url)
                            // 上传后同步资源列表
                            setTimeout(() => syncResources(), 100)
                        } catch (e) {
                            // upfile 内部已提示失败，这里仅避免未捕获异常
                        }
                    }
                }
            },
        },
        html: props.modelValue || '',
        mode: 'default',
    })

    createToolbar({
        editor: editorInstance,
        selector: toolbarDom,
        config: {
            // 上传功能关闭时不展示上传入口（保留「插入链接」）
            excludeKeys: props.uploadEnable ? [] : ['uploadImage', 'uploadVideo'],
        },
        mode: 'default',
    })

    // 初始化时同步一次资源列表
    setTimeout(() => syncResources(), 100)
})

// 父组件异步加载数据后，将已有内容回显到编辑器
watch(() => props.modelValue, (val) => {
    if (!editorInstance) return
    // 与编辑器当前内容一致时无需更新，避免输入时光标跳动
    if (val === editorInstance.getHtml()) return
    editorInstance.setHtml(val || '')
})

onBeforeUnmount(() => {
    if (editorInstance) {
        editorInstance.destroy()
        editorInstance = null
    }
})
</script>

<template>
    <div class="sa">
        <div ref="toolbarRef" style="border-bottom: 1px solid #ccc;" />
        <!-- 固定高度：wangEditor 内部 .w-e-text-container{height:100%} 依赖父级确定高度；
             用 content-box 让 height 全部作为内容高，保证 .w-e-scroll ≥ 300px（否则会触发高度告警） -->
        <div ref="editorRef" :style="`height: ${height}px; box-sizing: content-box; padding: 10px;`" />
    </div>
</template>

<style>
    .sa{
        z-index: 289882;
        background-color: #fff;
        max-width: 1280px;
        left: 50%;
        top: 80px;
        /* s */
    }
</style>
