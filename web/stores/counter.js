// stores/counter.ts
import {
  defineStore
} from 'pinia'

/* 同一时刻的并发去重：用 WeakMap 以 store 实例为键，
   既不参与 SSR 序列化，也不会在服务端多个请求间串数据。 */
const initPromises = new WeakMap()
const userInflight = new WeakMap()

/* 站点配置信息1 */
export const useSiteConfig = defineStore('SiteConfig', {
  state: () => ({
    Config: {},
  }),
  actions: {
    increment(siteConfig) {
      this.Config = siteConfig
    },
    /* 按需拉取站点信息基础配置（已加载则跳过）
     * 前台由 app.vue 预加载；后台 /admin 路由被跳过，需各自调用本方法。 */
    async init() {
      if (this.Config && Object.keys(this.Config).length > 0) {
        return this.Config
      }
      /* 同一时刻多个组件并发调用时合并为一次请求 */
      if (initPromises.has(this)) {
        return initPromises.get(this)
      }
      const p = (async () => {
        try {
          const res = await useApiFetch().post('/api/webinfo')
          if (res && res.code == 200) {
            this.Config = res.data
          }
          return this.Config
        } finally {
          initPromises.delete(this)
        }
      })()
      initPromises.set(this, p)
      return p
    }
  }
})

/* 用户信息 */
export const useUserInfo = defineStore('UserInfo', {

  state: () => ({
    UserInfo: {},
    /* 是否已成功拉取过一次用户信息：用于跳过重复请求（列表项等会各自调用 init） */
    loaded: false,
  }),
  actions: {
    increment(userInfo) {
      this.UserInfo = userInfo
    },
    /* force=true 时强制重新拉取（登录 / 资料变更 / 支付 / 提现等场景） */
    async init(CallBack = () => { }, force = false) {
      /* 已加载且非强制刷新：直接复用缓存，避免每处调用重复请求 /api/myinfo */
      if (!force && this.loaded) {
        CallBack(this.UserInfo)
        return this.UserInfo
      }
      /* 同一时刻多个组件（列表项等）并发调用时合并为一次请求 */
      if (!force && initPromises.has(this)) {
        return initPromises.get(this)
      }
      const p = (async () => {
        try {
          const res = await useApiFetch().post('/api/myinfo')
          if (res.code == 200) {
            this.UserInfo = res.data

            CallBack(res.data)
          } else {
            CallBack(false)
            this.UserInfo = {
              /* 未登录：留空，交由 UserAvatar 回退到本地默认头像 */
              n_avatar: '',
            }
          }
          this.loaded = true
        } finally {
          /* 仅当登记的仍是本次 promise 时删除：force 刷新会用新 promise 覆盖，
             无条件删除会误删并发请求的登记，导致去重失效 */
          if (initPromises.get(this) === p) initPromises.delete(this)
        }
      })()
      initPromises.set(this, p)
      return p
    }
  }
})

/* 其他用户公开信息缓存：列表页大量 ItemA 会重复拉取同一作者，
   这里做「结果缓存 + 并发去重」，同一 uid 每次会话只请求一次。 */
export const useUserProfile = defineStore('UserProfile', {
  state: () => ({
    users: {},
  }),
  actions: {
    /* 获取单个用户信息（命中缓存直接返回；否则请求并缓存） */
    async fetchUser(id) {
      if (id === undefined || id === null || id === '') return null
      const key = String(id)
      if (this.users[key]) return this.users[key]

      let inflight = userInflight.get(this)
      if (!inflight) {
        inflight = new Map()
        userInflight.set(this, inflight)
      }
      if (inflight.has(key)) return inflight.get(key)

      const p = (async () => {
        try {
          const res = await useApiFetch().post('/api/GetUser', { id: key })
          if (res && res.code == 200) {
            this.users[key] = res.data
            return res.data
          }
          if (res && res.code == 404) {
            /* 用户已注销：缓存占位信息，避免重复请求 */
            const u = { id: key, n_nickname: '该用户已被注销', isCancelled: true }
            this.users[key] = u
            return u
          }
          return null
        } finally {
          inflight.delete(key)
        }
      })()
      inflight.set(key, p)
      return p
    },
    /* 父级批量预取：收集列表内所有作者 id 后走一次批量接口 /api/GetUsers，
       并为每个 id 在 userInflight 登记占位 promise，使并发挂载的 ItemA 复用同批结果，
       避免「预取 + 单项」重复请求（否则会退化成 1+N）。 */
    async prefetchUsers(ids = []) {
      const uniq = [...new Set(
        ids
          .filter((id) => id !== undefined && id !== null && id !== '')
          .map(String)
      )]
      let inflight = userInflight.get(this)
      if (!inflight) {
        inflight = new Map()
        userInflight.set(this, inflight)
      }
      /* 仅请求「未缓存且无进行中请求」的 id */
      const missing = uniq.filter((id) => !this.users[id] && !inflight.has(id))
      if (missing.length === 0) return

      const batch = (async () => {
        const map = {}
        try {
          const res = await useApiFetch().post('/api/GetUsers', { ids: missing })
          if (res && res.code == 200 && Array.isArray(res.data)) {
            for (const u of res.data) {
              if (u && u.id !== undefined && u.id !== null) {
                const key = String(u.id)
                this.users[key] = u
                map[key] = u
              }
            }
            /* 请求成功但未返回的 id 视为已注销，与 fetchUser 的 404 行为保持一致 */
            for (const id of missing) {
              if (!map[id]) {
                this.users[id] = { id, n_nickname: '该用户已被注销', isCancelled: true }
              }
            }
          }
        } catch (e) {
          /* 批量预取失败静默处理：列表项会退化为逐个 fetchUser */
        }
        return map
      })()

      return Promise.all(missing.map((id) => {
        const p = batch
          .then((map) => map[id] || this.users[id] || null)
          .finally(() => inflight.delete(id))
        inflight.set(id, p)
        return p
      }))
    }
  }
})
