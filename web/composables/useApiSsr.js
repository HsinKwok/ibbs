export async function useApiSsr(key, url, body, method = 'post', fallback = { code: 201, msg: '请求失败，请稍后重试' }) {
  const res = await useAsyncData(key, async () => {
    try {
      const res = await useApiFetch()[method.toLowerCase()](url, body)
      return res
    } catch (e) {
      console.error('请求失败:', e)
      /* 这里只返回可序列化的普通对象：抛出的 FetchError 是 class 实例，
         进入 useAsyncData 后会让 payload 的 devalue 序列化整体失败，
         客户端拿不到任何 SSR 数据（且每个 asyncData 都会被重新请求）。
         接口返回体（e.data）是普通对象时沿用，便于页面按 code 分支处理。 */
      const data = e?.data
      return data && typeof data === 'object' ? data : fallback
    }
  })

  return res.data.value
}
