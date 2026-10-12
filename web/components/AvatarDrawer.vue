<template>
    <a-drawer :visible="visible" :width="360" unmountOnClose :footer="false" title="选择默认头像"
        @cancel="close">
        <div class="avatar-grid">
            <div v-for="n in COUNT" :key="n" :class="['avatar-item', { active: selected === avatarUrl(n) }]"
                @click="selected = avatarUrl(n)">
                <img :src="avatarUrl(n)" alt="" loading="lazy" />
                <div v-if="selected === avatarUrl(n)" class="check">
                    <icon-check />
                </div>
            </div>
        </div>
        <div class="tips">上传功能已关闭，可从系统默认头像中挑选一张作为头像。</div>
        <div class="footer">
            <a-button @click="close">取消</a-button>
            <a-button type="primary" @click="confirm">确认选择</a-button>
        </div>
    </a-drawer>
</template>

<script setup>
import { Message } from '@arco-design/web-vue';

/* 默认头像数量，与 public/avatars/1.png ~ 30.png 对应 */
const COUNT = 30

const props = defineProps({
    /* 抽屉可见性 */
    visible: {
        type: Boolean,
        default: false,
    },
    /* 当前头像地址 */
    current: {
        type: String,
        default: '',
    },
})

const emit = defineEmits(['update:visible', 'success'])

const selected = ref('')

/* 打开抽屉时同步当前头像的选中态 */
watch(() => props.visible, (v) => {
    if (v) selected.value = props.current || ''
})

const avatarUrl = (n) => `/avatars/${n}.png`

const close = () => emit('update:visible', false)

const confirm = () => {
    if (!selected.value) {
        Message.warning('请选择一张头像')
        return
    }
    emit('success', selected.value)
    close()
}
</script>

<style scoped lang="scss">
.avatar-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
}

.avatar-item {
    position: relative;
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    border: 2px solid transparent;
    box-sizing: border-box;
    transition: all 0.2s;

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
    }

    &:hover {
        border-color: #c9d9ff;
    }

    &.active {
        border-color: rgb(22, 93, 255);
    }

    .check {
        position: absolute;
        right: 0;
        bottom: 0;
        width: 22px;
        height: 22px;
        background-color: rgb(22, 93, 255);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        border-top-left-radius: 8px;
        font-size: 14px;
    }
}

.tips {
    margin-top: 16px;
    font-size: 12px;
    color: #86909c;
    line-height: 1.6;
}

.footer {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
}
</style>
