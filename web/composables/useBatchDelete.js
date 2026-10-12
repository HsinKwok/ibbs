// composables/useBatchDelete.js
import { ref } from 'vue'
import { Message } from '@arco-design/web-vue'

/*
 * 全局共享的批量删除确认弹窗状态。
 * 由 <BatchDeleteConfirm /> 单例组件渲染，任何列表页调用 batchDelete 都复用同一个弹窗。
 */
const confirmState = ref({
  visible: false,
  label: '数据',
  count: 0,
  onConfirm: null,
  // 可选附加勾选项（如「同时删除关联内容」），label 为空时不展示
  optionLabel: '',
  optionChecked: false
})

/* 供全局确认弹窗组件读取共享状态 */
export function useBatchDeleteConfirm() {
  return confirmState
}

/*
 * 后台列表统一批量删除：
 * 管理表格勾选状态，点击「批量删除」后弹出全局确认弹窗，
 * 确认后调用批量删除接口，最后统一提示并刷新列表。
 *
 * @param {(key: any) => Promise<any>} removeOne 单条删除函数，返回接口响应（code === 200 视为成功）
 * @param {object} [options]
 * @param {string} [options.label] 数据名称，用于提示文案，默认「数据」
 * @param {() => void} [options.reload] 删除完成后刷新列表的回调
 * @param {(keys: any[]) => Promise<any>} [options.batchRemove] 批量删除接口函数，返回接口响应（code === 200 视为成功）
 * @param {{label: string, default?: boolean}} [options.checkOption] 可选的附加勾选项（如「同时删除关联内容」），勾选状态作为第二参数传给删除函数
 */
export function useBatchDelete(removeOne, options = {}) {
  const { label = '数据', reload, batchRemove, checkOption } = options
  // 已勾选行的主键集合（配合 a-table 的 v-model:selectedKeys）
  const selectedKeys = ref([])
  const batchDeleting = ref(false)
  // a-table 行选择配置：复选框 + 表头全选
  const rowSelection = { type: 'checkbox', showCheckedAll: true }

  /* 执行删除并汇总结果：优先走批量接口，未提供时回退逐条删除 */
  const runDelete = async (keys, optionChecked = false) => {
    batchDeleting.value = true
    let success = 0
    let fail = 0
    try {
      if (batchRemove) {
        const res = await batchRemove(keys, optionChecked)
        if (res && res.code === 200) success = keys.length
        else fail = keys.length
      } else {
        for (const key of keys) {
          const res = await removeOne(key, optionChecked)
          if (res && res.code === 200) success++
          else fail++
        }
      }
    } catch (e) {
      fail = keys.length - success
    } finally {
      batchDeleting.value = false
      selectedKeys.value = []
    }
    if (fail === 0) {
      Message.success(`已删除 ${success} 条${label}`)
    } else if (success === 0) {
      Message.error(`删除失败，共 ${fail} 条未删除`)
    } else {
      Message.warning(`成功删除 ${success} 条，${fail} 条删除失败`)
    }
    reload?.()
  }

  const batchDelete = () => {
    const keys = [...selectedKeys.value]
    if (!keys.length) {
      Message.warning(`请先勾选要删除的${label}`)
      return
    }
    if (batchDeleting.value) return
    // 写入共享状态，打开全局确认弹窗（每次打开重置附加勾选项）
    confirmState.value.label = label
    confirmState.value.count = keys.length
    confirmState.value.optionLabel = checkOption?.label || ''
    confirmState.value.optionChecked = checkOption?.default ?? false
    confirmState.value.onConfirm = () => runDelete(keys, confirmState.value.optionChecked)
    confirmState.value.visible = true
  }

  return { selectedKeys, rowSelection, batchDeleting, batchDelete }
}
