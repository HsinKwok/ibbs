<template>
    <a-modal v-model:visible="state.visible" :width="400" :mask-closable="false"
        :ok-button-props="{ status: 'danger' }" ok-text="确认删除" cancel-text="取消" unmount-on-close
        @before-ok="handleBeforeOk" @cancel="handleCancel">
        <template #title>
            <span class="del-modal__title">批量删除</span>
        </template>
        <div class="del-modal">
            <div class="del-modal__badge">
                <icon-exclamation-circle-fill class="del-modal__icon" />
            </div>
            <div class="del-modal__body">
                <p class="del-modal__text">
                    确认删除已选中的 <span class="del-modal__count">{{ state.count }}</span> 条{{
                        state.label }}？
                </p>
                <a-checkbox v-if="state.optionLabel" v-model="state.optionChecked" class="del-modal__option">
                    {{ state.optionLabel }}
                </a-checkbox>
                <p class="del-modal__tip">删除后将无法恢复，请谨慎操作。</p>
            </div>
        </div>
    </a-modal>
</template>

<script setup>
/*
 * 全局批量删除确认弹窗（单例）。
 * 在 admin 外壳挂载一次，所有列表页通过 useBatchDelete 复用同一弹窗。
 */
const state = useBatchDeleteConfirm()

/* before-ok 返回 Promise，Arco 会自动显示确认按钮 loading，
   完成（resolve 非 false）后自动关闭弹窗 */
const handleBeforeOk = () => {
    const task = state.value.onConfirm
    state.value.onConfirm = null
    return task ? task() : true
}

const handleCancel = () => {
    state.value.onConfirm = null
}
</script>

<style lang="scss" scoped>
.del-modal {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 4px 0 6px;

    /* 柔和红色圆形徽标，弱化纯色大图标的冲击感 */
    &__badge {
        flex-shrink: 0;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(245, 63, 63, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    &__icon {
        font-size: 20px;
        color: #f53f3f;
    }

    &__body {
        flex: 1;
        padding-top: 2px;
    }

    &__text {
        margin: 0;
        font-size: 15px;
        line-height: 22px;
        color: #1d2129;
    }

    /* 强化待删除数量的层级，提升关键信息的可读性 */
    &__count {
        font-size: 16px;
        font-weight: 600;
        color: #f53f3f;
        padding: 0 2px;
    }

    /* 可选附加勾选项（如「同时删除关联内容」） */
    &__option {
        display: block;
        margin-top: 10px;
        font-size: 13px;
        line-height: 20px;
        color: #4e5969;
    }

    &__tip {
        margin: 8px 0 0;
        font-size: 13px;
        line-height: 20px;
        color: #86909c;
    }
}

.del-modal__title {
    font-weight: 600;
    color: #1d2129;
}
</style>
