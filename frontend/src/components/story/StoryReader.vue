<script setup lang="ts">
// 玩家故事阅读器：仿古书风格，自动同步 DM 推进的章节 / 场景
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import MarkdownRenderer from './MarkdownRenderer.vue'
import JsonStoryView from './JsonStoryView.vue'
import { useStoryStore } from '@/stores/story'

const storyStore = useStoryStore()
const {
  story,
  hasStory,
  isJsonFormat,
  isMdFormat,
  currentChapter,
  currentChapterIndex,
  chapterCount,
  currentScene,
  lastEvent,
} = storeToRefs(storyStore)

/** 阅读器容器引用（用于滚动控制） */
const readerRef = ref<HTMLElement | null>(null)

/** 章节切换动画 key */
const chapterKey = computed(() => `${currentChapter.value?.id ?? ''}-${currentChapterIndex.value}`)

/** 场景切换动画 key */
const sceneKey = computed(() => currentScene.value?.id ?? '')

/** 章节切换时滚动到顶部 */
watch(
  () => [chapterKey.value, sceneKey.value],
  () => {
    if (readerRef.value) {
      readerRef.value.scrollTop = 0
    }
  },
)

/** 最近事件提示（自动消失） */
const eventToast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null

watch(lastEvent, (evt) => {
  if (!evt) return
  const labels: Record<string, string> = {
    chapter: '章节事件',
    scene: '场景事件',
    npc: 'NPC 登场',
    encounter: '遇敌触发',
    choice: '选择触发',
  }
  eventToast.value = labels[evt.type] ?? '故事事件'
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    eventToast.value = ''
  }, 2500)
})

/** 故事素材图片（取前 3 张） */
const storyImages = computed(() => story.value?.assets.slice(0, 3) ?? [])

/** 拼接后端地址 */
function fullUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('data:')) return url
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  return `${apiBase}${url}`
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <!-- 无故事占位 -->
    <div
      v-if="!hasStory"
      class="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <div class="mb-2 text-5xl opacity-20">📜</div>
      <p class="font-display text-base text-text-muted">DM 尚未上传故事书</p>
      <p class="text-xs text-text-muted/70">耐心等待 DM 开启冒险之旅…</p>
    </div>

    <!-- 故事阅读区 -->
    <div v-else class="flex h-full flex-col">
      <!-- 故事标题栏（仿古书封面） -->
      <header class="story-header border-b border-border/60 px-4 py-3 text-center">
        <p class="text-[10px] uppercase tracking-[0.4em] text-text-muted">
          {{ isJsonFormat ? 'Interactive Story' : 'Chronicle' }}
        </p>
        <h2 class="mt-1 font-display text-xl font-bold text-gradient-gold">
          {{ story?.title }}
        </h2>
        <div class="mt-1 flex items-center justify-center gap-2 text-[10px] text-text-muted">
          <span v-if="isMdFormat">
            第 <span class="text-primary">{{ currentChapterIndex }}</span> / {{ chapterCount }} 章
          </span>
          <span v-else-if="currentScene">
            场景：<span class="text-primary">{{ currentScene.title }}</span>
          </span>
          <span v-else>尚未开始</span>
        </div>
      </header>

      <!-- 阅读内容（滚动区） -->
      <div ref="readerRef" class="story-reader flex-1 overflow-auto px-4 py-3">
        <!-- 事件提示 toast -->
        <Transition name="toast">
          <div
            v-if="eventToast"
            class="event-toast mb-3 rounded-md border border-primary/50 bg-primary/15 px-3 py-1.5 text-center text-xs text-primary animate-fade-in"
          >
            <span class="mr-1">✦</span>{{ eventToast }}<span class="ml-1">✦</span>
          </div>
        </Transition>

        <!-- ===== Markdown 格式：章节内容 ===== -->
        <article v-if="isMdFormat" :key="chapterKey" class="story-chapter animate-fade-in">
          <!-- 章节标题装饰 -->
          <div v-if="currentChapter" class="mb-4 text-center">
            <div class="chapter-ornament mb-1 flex items-center justify-center gap-2 text-primary">
              <span class="h-px w-12 bg-gradient-to-r from-transparent to-primary/60" />
              <span class="text-xs">◆</span>
              <span class="h-px w-12 bg-gradient-to-l from-transparent to-primary/60" />
            </div>
            <h3 class="font-display text-lg font-bold text-primary">
              {{ currentChapter.title }}
            </h3>
            <div class="chapter-ornament mt-1 flex items-center justify-center gap-2 text-primary">
              <span class="h-px w-12 bg-gradient-to-r from-transparent to-primary/60" />
              <span class="text-xs">◆</span>
              <span class="h-px w-12 bg-gradient-to-l from-transparent to-primary/60" />
            </div>
          </div>

          <!-- 章节正文 -->
          <MarkdownRenderer v-if="currentChapter" :content="currentChapter.content" parchment />
          <div v-else class="py-8 text-center text-sm text-text-muted">章节内容缺失</div>
        </article>

        <!-- ===== JSON 格式：场景 / NPC / 遇敌 / 选择 ===== -->
        <article v-else :key="sceneKey" class="story-scene-container animate-fade-in">
          <JsonStoryView :is-d-m="false" />
        </article>

        <!-- 故事素材图片（仅 Markdown 格式显示在末尾） -->
        <section v-if="isMdFormat && storyImages.length > 0" class="story-assets mt-4">
          <p class="mb-2 text-center text-[10px] uppercase tracking-widest text-text-muted">
            ◆ 插图 ◆
          </p>
          <div class="flex flex-wrap justify-center gap-2">
            <img
              v-for="(img, idx) in storyImages"
              :key="idx"
              :src="fullUrl(img)"
              :alt="`插图 ${idx + 1}`"
              class="max-h-48 rounded-md border border-border/60 object-cover"
              loading="lazy"
            />
          </div>
        </section>

        <!-- 章节末尾装饰 -->
        <div v-if="isMdFormat" class="chapter-end mt-6 text-center text-text-muted/40">
          <span>❖</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 阅读器主体：仿古书风格 */
.story-reader {
  background-image:
    radial-gradient(circle at 30% 20%, rgb(var(--color-primary) / 0.03), transparent 50%),
    radial-gradient(circle at 70% 80%, rgb(var(--color-primary) / 0.02), transparent 50%);
  scroll-behavior: smooth;
}

/* 章节切换动画 */
.story-chapter,
.story-scene-container {
  animation: fadeInUp 0.4s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 事件提示 toast */
.event-toast {
  backdrop-filter: blur(4px);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* 章节末尾装饰 */
.chapter-end {
  font-size: 14px;
  letter-spacing: 0.5em;
}
</style>
