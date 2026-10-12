// composables/useAdminTable.js
import { ref, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useBatchDelete, useBatchDeleteConfirm } from './useBatchDelete'
import { useList } from './useList'

/*
 * 单列表工厂：在 useList（列表查询 + 分页）基础上，补充「单删 + 批量删」。
 * 主列表与子列表共用，避免逻辑重复。
 *
 * @param {object} cfg
 * @param {string} cfg.api              列表查询接口（POST）
 * @param {string|Function} cfg.remove  单删：URL 字符串或 (id, optionChecked) => Promise
 * @param {string|Function} [cfg.batchRemove] 批量删：URL 字符串或 (ids, optionChecked) => Promise
 * @param {string} cfg.label            数据名称
 * @param {object} [cfg.extraQuery]     额外查询初始字段
 * @param {{label: string}} [cfg.deleteOption] 删除前选项（单删弹窗勾选项 + 批量删除勾选项）
 * @param {(data: any[]) => void} [cfg.onLoad] 加载完成回调（用于联动）
 * @param {() => void} [cfg.reload]     删除/保存后刷新回调（默认 load）
 * @param {'page'|'cursor'} [cfg.pagination] 分页模式：page（常规）/ cursor（R2 游标）
 */
function createList(cfg) {
  const {
    api, remove, batchRemove, label,
    extraQuery = {}, deleteOption = null, onLoad = null, reload = null, pagination = 'page',
  } = cfg

  const base = useList({ api, extraQuery, autoLoad: false, onLoad, pagination })

  // 删除后刷新：游标分页刷新当前页（reload），常规分页直接 load；均可由 reload 参数覆盖
  const refresh = reload || (pagination === 'cursor' ? () => base.reload() : () => base.load())

  // removeOne：兼容 URL 字符串与函数形式（函数可接收删除选项第二参数）
  const removeOne = (id, optionChecked = false) => {
    if (typeof remove === 'function') return remove(id, optionChecked)
    return useApiFetch().post(remove, { id })
  }

  const confirmState = useBatchDeleteConfirm()

  const delDirect = async (id) => {
    try {
      const res = await removeOne(id)
      if (res.code === 200) { Message.success('删除成功'); refresh() }
      else Message.error(res.msg || '删除失败')
    } catch (e) {
      Message.error('删除失败，请稍后重试')
    }
  }

  // 单删：配置 deleteOption 时弹出全局确认弹窗（true 无勾选项；{ label } 显示勾选项），否则直接删除（配合模板 a-popconfirm）
  const del = (id) => {
    if (deleteOption) {
      confirmState.value.label = label
      confirmState.value.count = 1
      confirmState.value.optionLabel = typeof deleteOption === 'object' ? (deleteOption.label || '') : ''
      confirmState.value.optionChecked = false
      confirmState.value.onConfirm = async () => {
        try {
          const res = await removeOne(id, confirmState.value.optionChecked)
          if (res.code === 200) { Message.success('删除成功'); refresh(); return true }
          Message.error(res.msg || '删除失败')
        } catch (e) {
          Message.error('删除失败，请稍后重试')
        }
        return false
      }
      confirmState.value.visible = true
      return
    }
    return delDirect(id)
  }

  // 批量删除
  const { selectedKeys, rowSelection, batchDeleting, batchDelete } = useBatchDelete(removeOne, {
    batchRemove: batchRemove
      ? (ids, optionChecked) => typeof batchRemove === 'function'
        ? batchRemove(ids, optionChecked)
        : useApiFetch().post(batchRemove, { ids })
      : undefined,
    label,
    reload: refresh,
    checkOption: deleteOption ? { label: typeof deleteOption === 'object' ? (deleteOption.label || '') : '' } : undefined,
  })

  return { ...base, del, selectedKeys, rowSelection, batchDeleting, batchDelete }
}

/*
 * 后台列表页统一封装。
 *
 * @param {object} options
 * @param {string} options.api          列表查询接口（POST）
 * @param {string|Function} options.remove       单删接口（或函数）
 * @param {string|Function} [options.batchRemove] 批量删接口（或函数）
 * @param {string} [options.addApi]     新增接口（POST）；不传则 submit 始终走编辑接口
 * @param {string} [options.editApi]    编辑接口（POST）
 * @param {string} [options.label]      数据名称，默认「数据」
 * @param {object} [options.extraQuery] 额外查询初始字段
 * @param {boolean} [options.autoLoad]  是否 onMounted 自动加载，默认 true
 * @param {(info: object) => (object|void)} [options.beforeSubmit] 提交前预处理；可直接修改 info，或返回替换后的提交载荷
 * @param {boolean|{label: string}} [options.deleteOption] 删除前确认：true 弹确认框（无勾选项）；{ label } 弹确认框并显示勾选项
 * @param {object} [options.sub]        子列表配置（与主列表同构，不含 addApi/editApi）
 * @param {(mainData: any[], subTable: object|null) => void} [options.onMainLoaded] 主列表加载完成回调（用于主子联动）
 * @param {'page'|'cursor'} [options.pagination] 分页模式：page（常规，默认）/ cursor（R2 游标分页，返回 nextPage/prevPage/refresh 等）
 *
 * @example
 * // 基础用法：删除确认依赖模板里的 a-popconfirm，del 内部直接删除
 * const { list, query, loading, load, del, selectedKeys, rowSelection, batchDeleting, batchDelete, visible, info, openAdd, openEdit, submit } = useAdminTable({
 *     api: '/api/noticeList', remove: '/api/delnotices', batchRemove: '/api/batchDelnotices',
 *     addApi: '/api/addnotices', editApi: '/api/editnotices', label: '公告',
 * })
 * // 模板删除按钮：
 * // <a-popconfirm content="确认删除？" @ok="() => del(record.id)"><a-button status="danger">删除</a-button></a-popconfirm>
 *
 * @example
 * // 删除前确认弹窗（带勾选项）：配置 deleteOption 后，del 会弹出全局确认框（含勾选项），
 * // 单删与批量删除均可勾选；remove/batchRemove 用函数形式接收第二参数（勾选状态）。
 * // 此时模板删除按钮直接写 @click="del(record.id)"，无需再包 a-popconfirm。
 * const { list, query, loading, load, del, selectedKeys, rowSelection, batchDeleting, batchDelete, visible, info, openEdit, submit } = useAdminTable({
 *     api: '/api/userlist',
 *     remove: (id, delContent) => useApiFetch().post('/api/deluser', delContent ? { id, delContent: 1 } : { id }),
 *     batchRemove: (ids, delContent) => useApiFetch().post('/api/batchDeluser', delContent ? { ids, delContent: 1 } : { ids }),
 *     editApi: '/api/edituser',
 *     label: '用户',
 *     deleteOption: { label: '同时删除其发表的所有帖子和上传的文件' },
 * })
 * // 模板删除按钮：
 * // <a-button type="primary" status="danger" @click="del(record.id)">删除</a-button>
 *
 * @example
 * // 无勾选项的通用删除确认弹窗：配置 deleteOption: true 后，del 弹出确认框（不带勾选项），
 * // 适用于不需要额外选项的普通删除；此时模板删除按钮直接写 @click="del(record.id)"，无需再包 a-popconfirm。
 * const { list, query, loading, load, del, selectedKeys, rowSelection, batchDeleting, batchDelete, visible, info, openAdd, openEdit, submit } = useAdminTable({
 *     api: '/api/getMedal', remove: '/api/delMedal', batchRemove: '/api/batchDelMedal',
 *     addApi: '/api/addMedal', editApi: '/api/editMedal', label: '勋章',
 *     deleteOption: true,
 * })
 * // 模板删除按钮：
 * // <a-button type="primary" status="danger" @click="del(record.id)">删除</a-button>
 *
 * @example
 * // 删除前确认弹窗完整用法（script + template）：
 * // 1) 配置 deleteOption 后，del 弹出全局确认框；2) 确认弹窗由后台外壳的 <BatchDeleteConfirm /> 渲染。
 * <script setup>
 * const { list, query, loading, load, del, selectedKeys, rowSelection, batchDeleting, batchDelete } = useAdminTable({
 *     api: '/api/GetThreadsAdmin',
 *     remove: '/api/DelThreadsAdmin',
 *     batchRemove: '/api/batchDelThreadsAdmin',
 *     label: '帖子',
 *     deleteOption: true, // 无勾选项；改为 { label: '同时删除其内容' } 则显示勾选项
 * })
 * const columns = [] // 列配置
 * </script>
 * // 模板：删除按钮直接用普通按钮触发 del，无需 a-popconfirm
 * <a-table :columns="columns" :data="list" :loading="loading" row-key="id"
 *     v-model:selectedKeys="selectedKeys" :row-selection="rowSelection">
 *     <template #console="{ record }">
 *         <a-button type="primary" status="danger" @click="del(record.id)">删除</a-button>
 *     </template>
 * </a-table>
 * <a-button status="danger" :disabled="!selectedKeys.length" @click="batchDelete()">批量删除</a-button>
 */
export function useAdminTable(options) {
  const {
    api, remove, batchRemove, addApi, editApi,
    label = '数据', extraQuery = {}, autoLoad = true,
    beforeSubmit = null, deleteOption = null,
    sub = null, onMainLoaded = null, pagination = 'page',
  } = options

  // 子列表（先创建，便于主列表联动钩子引用）
  const subTable = sub ? createList({
    api: sub.api, remove: sub.remove, batchRemove: sub.batchRemove,
    label: sub.label || label, extraQuery: sub.extraQuery,
    deleteOption: sub.deleteOption || deleteOption,
    pagination: sub.pagination || pagination,
  }) : null

  // 主列表
  const main = createList({
    api, remove, batchRemove, label, extraQuery, deleteOption, pagination,
    onLoad: onMainLoaded ? (data) => onMainLoaded(data, subTable) : null,
  })

  // 新增/编辑抽屉（主列表与子列表共用）
  const visible = ref(false)
  const info = ref({})
  const type = ref(1) // 1 新增，2 编辑
  const submitting = ref(false)
  const openAdd = (initial = {}) => { info.value = { ...initial }; type.value = 1; visible.value = true }
  const openEdit = (record) => { info.value = { ...record }; type.value = 2; visible.value = true }

  const submit = async () => {
    if (submitting.value) return
    submitting.value = true
    try {
      // beforeSubmit 可直接修改 info，也可返回一个替换后的提交载荷（不改动 info，避免影响抽屉表单）
      let payload = info.value
      if (beforeSubmit) payload = beforeSubmit(info.value) || info.value
      // 未配置 addApi 时（仅编辑场景），始终走 editApi
      const url = addApi ? (type.value === 1 ? addApi : editApi) : editApi
      const res = await useApiFetch().post(url, payload)
      if (res.code === 200) {
        Message.success('保存成功')
        visible.value = false
        main.load()
        if (subTable) subTable.load()
      } else {
        Message.error(res.msg || '保存失败')
      }
    } catch (e) {
      Message.error('保存失败，请稍后重试')
    } finally {
      submitting.value = false
    }
  }

  if (autoLoad) onMounted(main.load)

  return {
    ...main,
    sub: subTable,
    visible, info, type, openAdd, openEdit, submit, submitting,
  }
}
