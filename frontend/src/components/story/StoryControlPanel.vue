<script setup lang="ts">
// DM 故事控制面板：上传、章节跳转、场景控制、事件触发、删除
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import StoryUploader from './StoryUploader.vue'
import JsonStoryView from './JsonStoryView.vue'
import MarkdownRenderer from './MarkdownRenderer.vue'
import { useStoryStore } from '@/stores/story'
import { useRoomStore } from '@/stores/room'
import type { StoryNpc, StoryEncounter } from '@/types/models'

const storyStore = useStoryStore()
const roomStore = useRoomStore()
const { code, playerId } = storeToRefs(roomStore)
const {
  story,
  hasStory,
  isJsonFormat,
  isMdFormat,
  chapters,
  currentChapter,
  currentChapterIndex,
  chapterCount,
  isLoading,
  error,
} = storeToRefs(storyStore)

/** 上传弹窗 */
const showUploader = ref(false)

/** 是否为第一章 */
const isFirstChapter = computed(() => story.value?.currentChapter === 0)
/** 是否为最后一章 */
const isLastChapter = computed(() => {
  if (!story.value) return true
  return story.value.currentChapter >= chapters.value.length - 1
})

/** DM 跳转到指定章节 */
function handleJumpChapter(idx: number) {
  storyStore.advanceChapter(idx)
}

/** 上一章 */
function handlePrev() {
  storyStore.prevChapter()
}

/** 下一章 */
function handleNext() {
  storyStore.nextChapter()
}

/** 上传成功后关闭弹窗 */
function handleUploadSuccess() {
  showUploader.value = false
}

/** 删除故事 */
async function handleDelete() {
  if (!code.value || !playerId.value || !story.value) return
  if (!window.confirm(`确定删除故事书「${story.value.title}」吗？此操作不可恢复。`)) return
  await storyStore.deleteStory(code.value, playerId.value)
}

/** 触发 NPC 事件 */
function handleTriggerNpc(npc: StoryNpc) {
  storyStore.triggerEvent({
    type: 'npc',
    data: { npcId: npc.id, name: npc.name },
  })
}

/** 触发遇敌事件 */
function handleTriggerEncounter(enc: StoryEncounter) {
  storyStore.triggerEvent({
    type: 'encounter',
    data: { encounterId: enc.id, name: enc.name },
  })
}

/** 触发章节事件 */
function handleTriggerChapter() {
  if (!currentChapter.value) return
  storyStore.triggerEvent({
    type: 'chapter',
    data: { chapterId: currentChapter.value.id, title: currentChapter.value.title },
  })
}

/** 触发场景事件 */
function handleTriggerScene() {
  if (!story.value?.currentScene) return
  storyStore.triggerEvent({
    type: 'scene',
    data: { sceneId: story.value.currentScene },
  })
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- 错误提示 -->
    <div
      v-if="error"
      class="mb-2 flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
    >
      <span class="mt-0.5">⚠</span>
      <span>{{ error }}</span>
    </div>

    <!-- 无故事：上传引导 -->
    <div
      v-if="!hasStory"
      class="flex h-full flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <div class="mb-2 text-5xl opacity-20">📜</div>
      <div>
        <p class="font-display text-lg text-text-muted">尚未上传故事书</p>
        <p class="mt-1 text-xs text-text-muted/70">
          上传 Markdown 或 JSON 故事书，开启你的跑团叙事
        </p>
      </div>
      <BaseButton variant="primary" :loading="isLoading" @click="showUploader = true">
        上传故事书
      </BaseButton>
    </div>

    <!-- 有故事：控制面板 -->
    <div v-else class="flex h-full flex-col overflow-hidden">
      <!-- 标题栏 -->
      <div class="border-b border-border/50 px-3 py-2">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0 flex-1">
            <p class="truncate font-display text-sm font-bold text-gradient-gold">
              {{ story?.title }}
            </p>
            <p class="mt-0.5 text-[10px] text-text-muted">
              {{ isJsonFormat ? 'JSON 结构化' : 'Markdown' }} · {{ chapterCount }} 章
            </p>
          </div>
          <div class="flex shrink-0 gap-1">
            <BaseButton size="sm" variant="ghost" @click="showUploader = true"> 更换 </BaseButton>
            <BaseButton size="sm" variant="danger" @click="handleDelete"> 删除 </BaseButton>
          </div>
        </div>
      </div>

      <!-- 滚动内容区 -->
      <div class="flex-1 overflow-auto p-3">
        <!-- ===== Markdown 格式：章节列表 ===== -->
        <template v-if="isMdFormat">
          <!-- 章节导航 -->
          <div class="mb-3">
            <p
              class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-text-muted"
            >
              <span>📖</span>
              <span>章节列表</span>
            </p>
            <div class="space-y-1">
              <button
                v-for="(ch, idx) in chapters"
                :key="ch.id"
                type="button"
                class="chapter-item flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left text-xs transition-all duration-150"
                :class="
                  story?.currentChapter === idx
                    ? 'border-primary bg-primary/15 text-primary shadow-glow'
                    : 'border-border/50 bg-background/30 text-text-muted hover:border-primary/40 hover:text-text'
                "
                @click="handleJumpChapter(idx)"
              >
                <span
                  class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                  :class="
                    story?.currentChapter === idx
                      ? 'bg-primary text-background'
                      : 'bg-surface text-text-muted'
                  "
                >
                  {{ idx + 1 }}
                </span>
                <span class="min-w-0 flex-1 truncate">{{ ch.title }}</span>
                <span v-if="story?.currentChapter === idx" class="shrink-0 text-primary">●</span>
              </button>
            </div>
          </div>

          <!-- 章节控制 -->
          <div class="mb-3 flex items-center gap-2">
            <BaseButton size="sm" variant="metal" :disabled="isFirstChapter" @click="handlePrev">
              ← 上一章
            </BaseButton>
            <div class="flex-1 text-center text-xs text-text-muted">
              第 <span class="font-bold text-primary">{{ currentChapterIndex }}</span> /
              {{ chapterCount }} 章
            </div>
            <BaseButton size="sm" variant="metal" :disabled="isLastChapter" @click="handleNext">
              下一章 →
            </BaseButton>
          </div>

          <!-- 当前章节预览 -->
          <div v-if="currentChapter" class="mb-3">
            <div class="mb-2 flex items-center justify-between">
              <p class="text-xs font-semibold uppercase tracking-widest text-text-muted">
                当前章节
              </p>
              <BaseButton size="sm" variant="ghost" @click="handleTriggerChapter">
                触发章节事件
              </BaseButton>
            </div>
            <div class="rounded-md border border-border/60 bg-background/40 p-2.5">
              <p class="mb-1.5 font-display text-sm font-bold text-primary">
                {{ currentChapter.title }}
              </p>
              <div class="max-h-40 overflow-auto">
                <MarkdownRenderer :content="currentChapter.content" :parchment="false" />
              </div>
            </div>
          </div>
        </template>

        <!-- ===== JSON 格式：场景 / NPC / 遇敌 ===== -->
        <template v-else>
          <!-- 事件快捷触发 -->
          <div class="mb-3 flex flex-wrap gap-1.5">
            <BaseButton
              v-if="story?.currentScene"
              size="sm"
              variant="metal"
              @click="handleTriggerScene"
            >
              触发场景事件
            </BaseButton>
          </div>

          <!-- JSON 故事视图（含场景跳转、NPC、遇敌、选择） -->
          <JsonStoryView :is-d-m="true" />

          <!-- 全部 NPC 列表 -->
          <div v-if="story && story.npcs.length > 0" class="mt-4">
            <p
              class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-text-muted"
            >
              <span>👤</span>
              <span>全部 NPC（{{ story.npcs.length }}）</span>
            </p>
            <div class="space-y-1">
              <button
                v-for="npc in story.npcs"
                :key="npc.id"
                type="button"
                class="flex w-full items-center justify-between rounded border border-border/50 bg-background/30 px-2 py-1.5 text-left text-xs transition-all hover:border-primary/40 hover:bg-primary/5"
                @click="handleTriggerNpc(npc)"
              >
                <span class="truncate text-text">{{ npc.name }}</span>
                <span class="shrink-0 text-[10px] text-primary">触发 →</span>
              </button>
            </div>
          </div>

          <!-- 全部遇敌列表 -->
          <div v-if="story && story.encounters.length > 0" class="mt-4">
            <p
              class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-text-muted"
            >
              <span>⚔</span>
              <span>全部遇敌（{{ story.encounters.length }}）</span>
            </p>
            <div class="space-y-1">
              <button
                v-for="enc in story.encounters"
                :key="enc.id"
                type="button"
                class="flex w-full items-center justify-between rounded border border-danger/40 bg-danger/5 px-2 py-1.5 text-left text-xs transition-all hover:border-danger/70"
                @click="handleTriggerEncounter(enc)"
              >
                <span class="truncate text-text">{{ enc.name }}</span>
                <span class="shrink-0 text-[10px] text-danger">触发 →</span>
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- 上传弹窗 -->
    <BaseModal
      :model-value="showUploader"
      :title="hasStory ? '更换故事书' : '上传故事书'"
      width="max-w-xl"
      @update:model-value="showUploader = $event"
    >
      <StoryUploader inline @success="handleUploadSuccess" @cancel="showUploader = false" />
    </BaseModal>
  </div>
</template>
