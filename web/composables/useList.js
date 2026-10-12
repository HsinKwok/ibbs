// composables/useList.js
import { ref, onMounted } from 'vue'
import { Message } from '@arco-design/web-vue'

/*
 * 轻量列表封装：列表查询 + 分页（不含删除/编辑）。
 * 供前台纯查询列表使用，也被 useAdminTable 复用为列表基础。
 *
 * @param {object} options
 * @param {string} options.api          列表查询接口（POST）
 * @param {object} [options.extraQuery] 额外查询初始字段（page 模式下与 page/pagesize/total 合并；cursor 模式下 limit 从这里取）
 * @param {boolean} [options.autoLoad]  是否 onMounted 自动加载，默认 true
 * @param {(data: any[]) => void} [options.onLoad] 加载完成回调（用于联动）
 * @param {'page'|'cursor'} [options.pagination] 分页模式：page（常规分页，默认）/ cursor（R2 游标分页）
 *
 * @example
 * // 前台纯查询列表（常规分页）
 * const { list, query, loading, load } = useList({ api: '/api/getMedalList', extraQuery: { pagesize: 50 } })
 *
 * @example
 * // R2 游标分页列表
 * const { list, loading, load, refresh, nextPage, prevPage, page, truncated } = useList({ api: '/api/getUploadFileList', pagination: 'cursor' })
 */
export function useList({ api, extraQuery = {}, autoLoad = true, onLoad = null, pagination = 'page' }) {
  const list = ref([])
  const loading = ref(false)

  // 游标分页（R2 对象存储列表）
  if (pagination === 'cursor') {
    const page = ref(1)
    const cursors = ref([''])
    const nextCursor = ref('')
    const truncated = ref(false)
    const limit = extraQuery.limit || 50

    // 请求序号：丢弃过期响应，避免快速翻页时旧数据覆盖新数据
    let reqId = 0
    const load = async (cursor = '') => {
      const id = ++reqId
      loading.value = true
      try {
        const res = await useApiFetch().post(api, { cursor, limit })
        if (id !== reqId) return
        if (res.code === 200) {
          const data = res.data || {}
          list.value = data.list || []
          nextCursor.value = data.cursor || ''
          truncated.value = !!data.truncated
          if (onLoad) onLoad(list.value)
        } else {
          Message.error(res.msg || '加载失败')
        }
      } catch (e) {
        if (id === reqId) Message.error('加载失败，请稍后重试')
      } finally {
        if (id === reqId) loading.value = false
      }
    }

    const refresh = () => {
      page.value = 1
      cursors.value = ['']
      nextCursor.value = ''
      return load('')
    }

    const nextPage = () => {
      if (!truncated.value) return
      cursors.value[page.value] = nextCursor.value
      page.value += 1
      return load(nextCursor.value)
    }

    const prevPage = () => {
      if (page.value <= 1) return
      page.value -= 1
      return load(cursors.value[page.value - 1] || '')
    }

    // 重新加载当前页（删除等操作后刷新当前页，而非回到第一页）
    const reload = () => load(cursors.value[page.value - 1] || '')

    if (autoLoad) onMounted(() => load(''))

    return { list, loading, load, refresh, reload, nextPage, prevPage, page, truncated }
  }

  // 常规 page/pagesize 分页
  const query = ref({ page: 1, pagesize: 20, total: 0, ...extraQuery })

  // 请求序号：丢弃过期响应，避免快速翻页时旧数据覆盖新数据
  let reqId = 0

  const doLoad = async () => {
    const id = ++reqId
    loading.value = true
    try {
      const res = await useApiFetch().post(api, query.value)
      if (id !== reqId) return
      if (res.code === 200) {
        list.value = res.data || []
        query.value.total = res.total
        if (onLoad) onLoad(res.data || [])
      } else {
        Message.error(res.msg || '加载失败')
      }
    } catch (e) {
      if (id === reqId) Message.error('加载失败，请稍后重试')
    } finally {
      if (id === reqId) loading.value = false
    }
  }

  // 同一微任务内多次调用（如分页组件切页大小会同时触发 change 与 page-size-change）合并为一次请求，
  // 请求执行时再读取 query，保证拿到的页码/页大小是最新值
  let scheduled = null
  const load = () => {
    if (!scheduled) {
      scheduled = Promise.resolve().then(() => {
        scheduled = null
        return doLoad()
      })
    }
    return scheduled
  }

  if (autoLoad) onMounted(load)

  return { list, query, loading, load }
}
