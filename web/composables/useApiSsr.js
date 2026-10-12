export async function useApiSsr(key, url, body, method = 'post', fallback = { code: 201, msg: '请求失败，请稍后重试' }) {
  const res = await useAsyncData(key, async () => {
    try {
      const res = await useApiFetch()[method.toLowerCase()](url, body)
      return res
    } catch (e) {
      console.error('请求失败:', e)
      return fallback
    }
  })

  return res.data.value
}
