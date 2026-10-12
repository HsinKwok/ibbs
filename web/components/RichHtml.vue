<template>
  <div ref="rootRef" class="rich-html" v-html="safeHtml" />
</template>

<script setup>
import { onMounted, watch, nextTick, ref, computed } from 'vue'
/* 仅引入常用语言集，避免打包 highlight.js 全量语言 */
import hljs from 'highlight.js/lib/common'
import 'highlight.js/styles/github-dark.css'
import { sanitizeHtml } from '@/utils/sanitize'

const props = defineProps({ html: String })
const rootRef = ref(null)

/* 帖子正文为富文本，渲染前统一清洗，防止存储型 XSS */
const safeHtml = computed(() => sanitizeHtml(props.html))

const highlight = async () => {
  await nextTick()
  const root = rootRef.value
  if (!root) return
  /* 限定在本组件内查询，避免多个 RichHtml 实例互相重复高亮整页 */
  root.querySelectorAll('pre code').forEach((block) => {
    hljs.highlightElement(block)
  })
}

onMounted(highlight)
watch(safeHtml, highlight)
</script>

<style lang="scss">

.rich-html{
  /* 行高 */
  line-height: 1.6;

  li{
    margin-left: 20px;
  }

  h1,h2,h3{
    margin: 10px 0;
  }

  hr{
    margin: 10px 0;
  }
  
  p {
  white-space: normal;

  img {
    width: 100%;
    border-radius: 10px;
    margin: 10px auto;
  }

  video {
    width: 100%;
    border-radius: 10px;
    margin: 10px auto;
  }
}

img {
  width: 100%;
  border-radius: 10px;
  height: auto;
  margin: 10px auto;
}

video {
  width: 100%;
  border-radius: 10px;
  margin: 10px auto;
  height: auto;
}

pre code {
  background-color: #ececec;
  /* GitHub 风格 */
  padding: 1em;
  border-radius: 8px;
  margin: 10px auto;
  display: block;
  overflow-x: auto;
}

/* 让表格横向滚动 */
table {
  width: 100%;
  border-collapse: collapse;
  border-spacing: 0;
  margin: 1em 0;
  font-size: 14px;
  color: #333;
  background-color: #fff;
  border: 1px solid #e0e0e0;
  display: block;
  overflow-x: auto;
  white-space: nowrap;
  /* 不自动换行，保持结构 */
}

/* 表头 */
thead {
  background-color: #f8f8f8;
}

/* 单元格通用样式 */
th,
td {
  padding: 10px;
  border: 1px solid #e0e0e0;
  text-align: left;
  vertical-align: middle;
}

/* 鼠标悬停高亮行 */
tbody tr:hover {
  background-color: #f2f2f2;
}

/* 手机端字体稍微小一点 */
@media (max-width: 768px) {
  table {
    font-size: 13px;
  }
}
}

</style>