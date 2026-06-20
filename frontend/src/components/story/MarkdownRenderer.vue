<script setup lang="ts">
// Markdown 渲染组件：解析 Markdown 内容并渲染为仿古书风格 HTML
import { computed } from 'vue'
import { marked } from 'marked'

const props = withDefaults(
  defineProps<{
    /** Markdown 原文 */
    content: string
    /** 是否开启仿古书排版 */
    parchment?: boolean
  }>(),
  {
    content: '',
    parchment: true,
  },
)

// 配置 marked：开启 GFM、换行转 <br>
marked.setOptions({
  gfm: true,
  breaks: true,
})

/** 解析后的 HTML */
const html = computed(() => {
  if (!props.content) return ''
  try {
    return marked.parse(props.content, { async: false }) as string
  } catch {
    return `<p class="text-danger">Markdown 解析失败</p>`
  }
})
</script>

<template>
  <div class="markdown-body" :class="parchment ? 'parchment-style' : ''" v-html="html" />
</template>

<style scoped>
.markdown-body {
  @apply text-sm leading-relaxed text-text;
  font-family: 'Songti SC', 'STSong', 'SimSun', serif;
  word-break: break-word;
}

/* 仿古书排版 */
.parchment-style {
  padding: 0.5rem 0.25rem;
}

/* 标题 */
.markdown-body :deep(h1) {
  @apply mb-4 mt-2 text-center font-display text-2xl font-bold;
  color: rgb(var(--color-primary));
  letter-spacing: 0.15em;
  text-shadow: 0 0 8px rgb(var(--color-primary) / 0.2);
}

.markdown-body :deep(h2) {
  @apply mb-3 mt-5 font-display text-xl font-bold;
  color: rgb(var(--color-primary));
  border-bottom: 1px solid rgb(var(--color-border) / 0.6);
  padding-bottom: 0.3rem;
  letter-spacing: 0.1em;
}

.markdown-body :deep(h3) {
  @apply mb-2 mt-4 font-display text-lg font-semibold;
  color: rgb(var(--color-primary) / 0.9);
  letter-spacing: 0.05em;
}

.markdown-body :deep(h4) {
  @apply mb-2 mt-3 font-display text-base font-semibold;
  color: rgb(var(--color-text));
}

.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  @apply mb-2 mt-3 text-sm font-semibold;
  color: rgb(var(--color-text-muted));
}

/* 段落 */
.markdown-body :deep(p) {
  @apply mb-3 text-sm leading-7;
  text-indent: 2em;
  color: rgb(var(--color-text) / 0.92);
}

/* 首段不缩进 */
.markdown-body :deep(p:first-child) {
  text-indent: 2em;
}

/* 强调 */
.markdown-body :deep(strong) {
  @apply font-bold;
  color: rgb(var(--color-primary));
}

.markdown-body :deep(em) {
  @apply italic;
  color: rgb(var(--color-text) / 0.85);
}

/* 删除线 */
.markdown-body :deep(del) {
  color: rgb(var(--color-text-muted) / 0.6);
}

/* 链接 */
.markdown-body :deep(a) {
  color: rgb(var(--color-primary));
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: color 0.15s ease;
}

.markdown-body :deep(a:hover) {
  color: rgb(var(--color-primary) / 0.8);
  text-shadow: 0 0 4px rgb(var(--color-primary) / 0.3);
}

/* 列表 */
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  @apply mb-3 ml-5 space-y-1;
}

.markdown-body :deep(ul) {
  list-style-type: '◆ ';
}

.markdown-body :deep(ol) {
  list-style-type: decimal;
}

.markdown-body :deep(li) {
  @apply text-sm leading-6;
  color: rgb(var(--color-text) / 0.9);
}

.markdown-body :deep(li > p) {
  text-indent: 0;
  margin-bottom: 0.25rem;
}

/* 引用 */
.markdown-body :deep(blockquote) {
  @apply mb-3 rounded-r border-l-4 py-2 pl-4 pr-2;
  border-color: rgb(var(--color-primary) / 0.6);
  background: rgb(var(--color-primary) / 0.05);
  color: rgb(var(--color-text-muted));
  font-style: italic;
}

.markdown-body :deep(blockquote p) {
  text-indent: 0;
  margin-bottom: 0;
}

/* 代码 */
.markdown-body :deep(code) {
  @apply rounded px-1.5 py-0.5 font-mono text-[12px];
  background: rgb(var(--color-background) / 0.8);
  color: rgb(var(--color-primary));
  border: 1px solid rgb(var(--color-border) / 0.5);
}

.markdown-body :deep(pre) {
  @apply mb-3 overflow-auto rounded-md p-3;
  background: rgb(var(--color-background) / 0.9);
  border: 1px solid rgb(var(--color-border) / 0.6);
  box-shadow: inset 0 1px 4px rgb(0 0 0 / 0.3);
}

.markdown-body :deep(pre code) {
  background: transparent;
  border: none;
  padding: 0;
  color: rgb(var(--color-text));
  font-size: 12px;
  line-height: 1.6;
}

/* 分隔线 */
.markdown-body :deep(hr) {
  @apply my-4 border-0;
  height: 1px;
  background: linear-gradient(to right, transparent, rgb(var(--color-primary) / 0.5), transparent);
}

/* 表格 */
.markdown-body :deep(table) {
  @apply mb-3 w-full border-collapse text-xs;
  border: 1px solid rgb(var(--color-border) / 0.6);
}

.markdown-body :deep(th) {
  @apply px-3 py-2 text-left font-semibold;
  background: rgb(var(--color-surface) / 0.8);
  color: rgb(var(--color-primary));
  border: 1px solid rgb(var(--color-border) / 0.6);
}

.markdown-body :deep(td) {
  @apply px-3 py-2;
  border: 1px solid rgb(var(--color-border) / 0.4);
  color: rgb(var(--color-text) / 0.9);
}

.markdown-body :deep(tr:nth-child(even) td) {
  background: rgb(var(--color-background) / 0.3);
}

/* 图片 */
.markdown-body :deep(img) {
  @apply mx-auto my-3 max-w-full rounded-md;
  max-height: 360px;
  border: 2px solid rgb(var(--color-border) / 0.6);
  box-shadow:
    0 0 0 1px rgb(var(--color-primary) / 0.2),
    0 4px 12px rgb(0 0 0 / 0.4);
}
</style>
