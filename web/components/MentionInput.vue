<template>
    <div class="mention-wrap">
        <a-input ref="inputRef" v-model="modelValue" :placeholder="placeholder" v-bind="$attrs" @input="onInput"
            @keydown="onKeydown" @blur="close" />
        <div v-if="visible && users.length" class="mention-panel">
            <div v-for="(u, i) in users" :key="u.id" class="mention-item" :class="{ 'is-active': i === activeIndex }"
                @mousedown.prevent="choose(u)" @mouseenter="activeIndex = i">
                <UserAvatar :src="u.n_avatar" :seed="u.id || u.n_nickname" :size="24" :lazy="false" />
                <span class="mention-name">{{ displayName(u) }}</span>
                <span class="mention-id">ID:{{ u.id }}</span>
            </div>
        </div>
    </div>
</template>

<script setup>
/*
 * 带 @提及 的输入框：在文本中键入 “@ + 字符” 即可实时搜索全站用户并引用其本站 ID。
 * - 自 @ 后第一个字符起触发搜索，候选最多 5 个，逐字符实时收窄；
 * - 支持 ↑/↓ 选择、Enter 确认、Esc 关闭、鼠标点击选择；
 * - 仅当 @ 位于行首或空白之后才触发，避免把邮箱（如 a@b.com）误判为提及；
 * - 选中后以 “@昵称 ” 文本回填，交由后端按文本解析引用关系。
 */
defineOptions({ inheritAttrs: false })

const props = defineProps({
    /* 占位文案（其余属性经 $attrs 透传给 a-input） */
    placeholder: {
        type: String,
        default: '',
    },
})

const modelValue = defineModel('modelValue', { type: String, default: '' })

const inputRef = ref(null)
const users = ref([])
const visible = ref(false)
const activeIndex = ref(0)
/* 当前候选对应的 @ 起始下标（回填时用于定位替换区间） */
const mentionStart = ref(-1)

/* 防抖定时器与请求序号：序号用于丢弃过期响应，保证候选与最新输入一致 */
let timer = null
let seq = 0

/* 取内层原生 input：Arco 根节点可能是包裹用的元素，也可能是 input 本身 */
function nativeInput() {
    const root = inputRef.value?.$el
    if (!root) return null
    if (root.tagName === 'INPUT') return root
    return root.querySelector('input')
}

function displayName(u) {
    return u?.n_nickname || `用户${u?.id ?? ''}`
}

function close() {
    clearTimeout(timer)
    timer = null
    visible.value = false
    users.value = []
    activeIndex.value = 0
    mentionStart.value = -1
}

/* 依据光标位置解析当前是否处于 “@查询词” 语境；命中则触发搜索，否则关闭面板 */
function onInput(val, ev) {
    const el = ev?.target
    const cursor = typeof el?.selectionStart === 'number' ? el.selectionStart : String(val || '').length
    const before = String(val || '').slice(0, cursor)
    const at = before.lastIndexOf('@')

    if (at === -1) return close()
    /* @ 前必须是行首或分隔/空白，排除邮箱等场景 */
    if (at > 0 && !/[\s,，、;；]/.test(before[at - 1])) return close()

    const query = before.slice(at + 1)
    /* 查询词中不允许出现空白，出现即视为该提及已结束 */
    if (/\s/.test(query)) return close()

    mentionStart.value = at
    /* “@ 后第一个字符开始搜索”：空查询不请求 */
    if (query.length < 1) return close()

    fetchUsers(query)
}

function fetchUsers(query) {
    clearTimeout(timer)
    timer = setTimeout(async () => {
        const mySeq = ++seq
        try {
            const res = await useApiFetch().post('/api/GetUser', { search: query, page: 1, pagesize: 5 })
            /* 过期响应（期间又输入了新字符）直接丢弃 */
            if (mySeq !== seq) return
            const data = res && res.code == 200 && Array.isArray(res.data) ? res.data : []
            users.value = data.slice(0, 5)
            activeIndex.value = 0
            visible.value = users.value.length > 0
        } catch (e) {
            if (mySeq === seq) close()
        }
    }, 180)
}

/* 选中候选：用 “@昵称 ” 替换 [@, 光标) 区间，并把光标落到插入内容之后 */
function choose(u) {
    if (!u) return
    const el = nativeInput()
    const val = modelValue.value || ''
    const cursor = typeof el?.selectionStart === 'number' ? el.selectionStart : val.length
    const start = mentionStart.value > -1 ? mentionStart.value : cursor
    const text = `@${displayName(u)} `
    const next = val.slice(0, start) + text + val.slice(cursor)

    modelValue.value = next
    close()

    nextTick(() => {
        const native = nativeInput()
        if (!native) return
        const pos = start + text.length
        native.focus()
        native.setSelectionRange(pos, pos)
    })
}

/* 键盘导航：仅在候选面板可见时接管方向键 / 回车 / Esc */
function onKeydown(ev) {
    if (!visible.value || !users.value.length) return
    if (ev.key === 'ArrowDown') {
        ev.preventDefault()
        activeIndex.value = (activeIndex.value + 1) % users.value.length
    } else if (ev.key === 'ArrowUp') {
        ev.preventDefault()
        activeIndex.value = (activeIndex.value - 1 + users.value.length) % users.value.length
    } else if (ev.key === 'Enter') {
        ev.preventDefault()
        choose(users.value[activeIndex.value])
    } else if (ev.key === 'Escape') {
        close()
    }
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<style scoped>
.mention-wrap {
    position: relative;
    width: 100%;
}

.mention-panel {
    position: absolute;
    z-index: 1100;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    padding: 4px 0;
    background: var(--color-bg-popup, #fff);
    border: 1px solid var(--color-neutral-3, #e5e6eb);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
    overflow: hidden;
}

.mention-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    cursor: pointer;
}

.mention-item.is-active {
    background: var(--color-fill-2, #f2f3f5);
}

.mention-name {
    flex: 1;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: var(--color-text-1, #1d2129);
}

.mention-id {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--color-text-3, #86909c);
}
</style>
