/*
 * 表格拖拽排序：把 <a-table @change> 事件转换为「拖拽结束后按新顺序持久化排序字段」。
 *
 * Arco Table 的 change 事件签名为 (data, extra, currentData)：
 *   - data  第一个参数，仅在 extra.type === 'drag' 时才反映拖拽后的新顺序；
 *   - extra 携带 type（drag / pagination / sorter / filter）。
 * 因此只处理 type === 'drag'，避免分页/排序/筛选时误触发全量更新。
 *
 * @param {object} cfg
 * @param {import('vue').Ref<any[]>} cfg.list    绑定的列表 ref（拖拽后写回新顺序）
 * @param {string} cfg.api                       保存接口
 * @param {string} cfg.field                     排序字段名（如 n_sort / n_index）
 * @param {(row: any, index: number) => object} [cfg.payload] 额外提交字段
 * @param {() => Promise<any>} [cfg.reload]      保存失败时回源重拉（权威数据）
 * @returns {(data: any[], extra: { type?: string }) => Promise<void>}
 *
 * @example
 * const handleDragSort = useDragSort({ list, api: '/api/editMedal', field: 'n_sort', reload: load })
 * // <a-table @change="handleDragSort" :draggable="{ type: 'handle' }" />
 */
import { Message } from '@arco-design/web-vue'

export function useDragSort({ list, api, field, payload, reload }) {
  return async (data, extra) => {
    if (extra?.type !== 'drag') return
    /* 先乐观更新 UI，再并发持久化；任一请求失败则回滚为新顺序前的快照并提示，
       避免「界面已变、服务端未存」的不一致。 */
    const prev = list.value
    list.value = data
    const http = useApiFetch()
    const BATCH_SIZE = 10
    try {
      /* 每批并发 BATCH_SIZE 条：pageSize 可达 1000，一次性并发全部会造成请求洪峰，
         分批串行提交可显著降低瞬时并发，同时保持同批内的并发效率。 */
      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const results = await Promise.all(
          data.slice(i, i + BATCH_SIZE).map((row, offset) => {
            const index = i + offset
            return http.post(api, {
              ...row,
              [field]: index,
              ...(payload ? payload(row, index) : {}),
            })
          })
        )
        const failed = results.find((res) => res && res.code != 200)
        if (failed) throw failed
      }
    } catch (e) {
      /* 前面批次可能已成功落库，仅回滚快照会与服务端不符；优先回源重拉权威数据，
         回源不可用或失败时再退回快照，保证界面不残留错误顺序。 */
      if (reload) {
        try { await reload() } catch { list.value = prev }
      } else {
        list.value = prev
      }
      Message.error(e?.msg || '排序保存失败，请重试')
    }
  }
}
