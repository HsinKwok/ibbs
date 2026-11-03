// composables/useSidebar.js

/*
 * 前台右侧栏：热门圈子 + 热门话题（无分页，一次性加载）。
 * 供 class / follow / market / uplist 等页面复用，消除重复的 GetCategory/GetTopicList。
 *
 * 走 useAsyncData：SSR 期间随页面一起预取并写入 payload，首屏即有侧栏内容；
 * 客户端跨页导航直接复用同一份 payload，不再每次切换页面都发 2 次 GetCategory
 * （此前是 onMounted 拉取，属于纯客户端请求，且每页各来一遍）。
 * 侧栏内容变动频率低，后端 GetCategory 另有 60s 进程内缓存兜底。
 *
 * @param {object} [options]
 * @param {boolean} [options.autoLoad] 是否立即加载，默认 true
 */
let cached = null
let inflight = null

async function fetchSidebar() {
  if (cached) return cached
  if (inflight) return inflight
  inflight = (async () => {
    try {
      /* type: 'all' 一次返回圈子 + 话题两组，替代此前的两次 GetCategory */
      const res = await useApiFetch().post('/api/GetCategory', { type: 'all' })
      cached = {
        CategoryList: res.code == 200 ? (res.data?.CategoryList ?? []) : [],
        TopicList: res.code == 200 ? (res.data?.TopicList ?? []) : [],
      }
      return cached
    } finally {
      inflight = null
    }
  })()
  return inflight
}

/* 空数据也要保持结构稳定，避免模板里 v-for 拿到 null */
const EMPTY = { CategoryList: [], TopicList: [] }

export function useSidebar({ autoLoad = true } = {}) {
  const { data, refresh } = useAsyncData('sidebar:v1', fetchSidebar, {
    default: () => cached ?? EMPTY,
    immediate: autoLoad,
  })

  const CategoryList = computed(() => data.value?.CategoryList ?? [])
  const TopicList = computed(() => data.value?.TopicList ?? [])

  const load = () => refresh()

  return { CategoryList, TopicList, load }
}
