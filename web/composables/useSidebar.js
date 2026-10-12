// composables/useSidebar.js
import { ref, onMounted } from 'vue'

/*
 * 前台右侧栏：热门圈子 + 热门话题（无分页，一次性加载）。
 * 供 class / follow / market / uplist 等页面复用，消除重复的 GetCategory/GetTopicList。
 *
 * 侧栏内容变动频率低，用模块级缓存 + 并发去重，避免每次页面切换都重复请求（仅客户端生效）。
 *
 * @param {object} [options]
 * @param {boolean} [options.autoLoad] 是否 onMounted 自动加载，默认 true
 */
let cached = null
let inflight = null

async function fetchSidebar() {
  if (cached) return cached
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const [catRes, topicRes] = await Promise.all([
        useApiFetch().post('/api/GetCategory'),
        useApiFetch().post('/api/GetCategory', { type: 2 }),
      ])
      cached = {
        CategoryList: catRes.code == 200 ? catRes.data : [],
        TopicList: topicRes.code == 200 ? topicRes.data : [],
      }
      return cached
    } finally {
      inflight = null
    }
  })()
  return inflight
}

export function useSidebar({ autoLoad = true } = {}) {
  const CategoryList = ref(cached?.CategoryList ?? [])
  const TopicList = ref(cached?.TopicList ?? [])

  const load = async () => {
    const data = await fetchSidebar()
    CategoryList.value = data.CategoryList
    TopicList.value = data.TopicList
  }

  if (autoLoad) onMounted(load)

  return { CategoryList, TopicList, load }
}
