// composables/useUpload.js
import { ref } from 'vue'

/*
 * 通用上传逻辑：抽取 Upimg.vue / Upfile.vue 中重复的「取值 + 进度 + 结果分发」流程。
 *
 * @param {(file: File, onProgress: (n: number) => void) => Promise<any>} uploader upimg / upfile
 * @param {object} [handlers]
 * @param {(file: File) => void} [handlers.onStart]   选中文件、开始上传前
 * @param {(res: any, file: File) => void} [handlers.onSuccess]  code === 200 时
 * @param {(msg: string) => void} [handlers.onError]   失败或被拒绝时
 * @returns {{ percent: import('vue').Ref<{ show: boolean, num: number }>, customRequest: (option: any) => Promise<void> }}
 */
export function useUpload(uploader, { onStart, onSuccess, onError } = {}) {
  const percent = ref({ show: false, num: 0 })

  const customRequest = async (option) => {
    const file = option?.target?.files?.[0]
    if (!file) return

    onStart?.(file)
    percent.value.show = true
    try {
      const res = await uploader(file, (e) => {
        /* 上传器回调已是 0..100 整数；a-progress 的 percent 同样期望 0..100 */
        percent.value.num = e
      })
      if (res?.code === 200) {
        onSuccess?.(res, file)
      } else {
        onError?.(res?.msg)
      }
    } catch (error) {
      onError?.(error?.message || '上传失败')
    } finally {
      percent.value.show = false
      percent.value.num = 0
      /* 重置 input 的 value，否则连续选择同一个文件不会再触发 change 事件 */
      if (option?.target) option.target.value = ''
    }
  }

  return { percent, customRequest }
}
