/*
 * Arco 组件样式已改为按需引入（ArcoResolver sideEffect），
 * 但 Message 属于命令式 API，不会被模板解析器扫描到，需显式引入一次样式。
 * 图标由 ArcoResolver 在模板中按需解析为具体图标组件，不再全局注册全部图标。
 */
import '@arco-design/web-vue/es/message/style/css.js'

export default defineNuxtPlugin(() => { })
