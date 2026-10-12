import { defineNuxtPlugin } from '#app'
import ArcoVueIcon from '@arco-design/web-vue/es/icon'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(ArcoVueIcon)
})
