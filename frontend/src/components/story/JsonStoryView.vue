<script setup lang="ts">
// JSON 故事展示组件：场景描述、NPC 卡片、遇敌信息、选择按钮
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useStoryStore } from '@/stores/story'
import type { StoryChoice, StoryEncounter, StoryNpc, StoryScene } from '@/types/models'

const props = withDefaults(
  defineProps<{
    /** 是否为 DM 视图（DM 可触发事件） */
    isDM?: boolean
  }>(),
  {
    isDM: false,
  },
)

const storyStore = useStoryStore()
const { story, currentScene } = storeToRefs(storyStore)

/** 当前场景关联的 NPC */
const sceneNpcs = computed<StoryNpc[]>(() => {
  if (!currentScene.value?.npcIds || !story.value) return []
  const ids = currentScene.value.npcIds
  return story.value.npcs.filter((n) => ids.includes(n.id))
})

/** 当前场景关联的遇敌 */
const sceneEncounters = computed<StoryEncounter[]>(() => {
  if (!currentScene.value?.encounterIds || !story.value) return []
  const ids = currentScene.value.encounterIds
  return story.value.encounters.filter((e) => ids.includes(e.id))
})

/** 当前场景的选择 */
const sceneChoices = computed<StoryChoice[]>(() => currentScene.value?.choices ?? [])

/** 拼接后端地址（用于 NPC 立绘） */
function fullUrl(url?: string): string {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('data:')) return url
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  return `${apiBase}${url}`
}

/** 处理选择：DM 可推进场景，玩家仅触发 choice 事件 */
function handleChoice(choice: StoryChoice) {
  if (props.isDM) {
    // DM 点击选择：若有目标场景则推进，否则触发 choice 事件
    if (choice.targetSceneId) {
      storyStore.advanceScene(choice.targetSceneId)
    }
    storyStore.triggerEvent({
      type: 'choice',
      data: { choiceId: choice.id, text: choice.text, action: choice.action },
    })
  } else {
    // 玩家：仅触发 choice 事件（由 DM 决定是否推进）
    storyStore.triggerEvent({
      type: 'choice',
      data: { choiceId: choice.id, text: choice.text, action: choice.action },
    })
  }
}

/** DM 触发 NPC 事件 */
function handleNpcEvent(npc: StoryNpc) {
  if (!props.isDM) return
  storyStore.triggerEvent({
    type: 'npc',
    data: { npcId: npc.id, name: npc.name },
  })
}

/** DM 触发遇敌事件 */
function handleEncounterEvent(encounter: StoryEncounter) {
  if (!props.isDM) return
  storyStore.triggerEvent({
    type: 'encounter',
    data: { encounterId: encounter.id, name: encounter.name },
  })
}

/** DM 跳转到指定场景 */
function handleSceneJump(scene: StoryScene) {
  if (!props.isDM) return
  storyStore.advanceScene(scene.id)
}

/** 难度配色 */
function difficultyClass(diff?: string): string {
  if (!diff) return 'text-text-muted'
  const d = diff.toLowerCase()
  if (d.includes('easy') || d.includes('简单') || d.includes('易')) return 'text-success'
  if (d.includes('hard') || d.includes('困难') || d.includes('难')) return 'text-danger'
  if (d.includes('dead') || d.includes('致命') || d.includes('死')) return 'text-danger'
  return 'text-warning'
}
</script>

<template>
  <div class="space-y-4">
    <!-- 当前场景描述 -->
    <section v-if="currentScene" class="story-scene">
      <div class="mb-2 flex items-center gap-2">
        <span class="text-primary">◆</span>
        <h4 class="font-display text-base font-bold text-primary">{{ currentScene.title }}</h4>
      </div>
      <div class="rounded-md border-l-2 border-primary/60 bg-primary/5 px-3 py-2">
        <p class="text-sm leading-7 text-text/90" style="text-indent: 2em">
          {{ currentScene.description }}
        </p>
      </div>
    </section>

    <!-- 无场景提示 -->
    <div v-else class="flex flex-col items-center justify-center py-6 text-center text-text-muted">
      <span class="mb-2 text-3xl opacity-30">◇</span>
      <p class="text-xs">尚未进入任何场景</p>
      <p v-if="isDM" class="mt-1 text-[10px]">请从下方场景列表中选择一个开始</p>
    </div>

    <!-- NPC 卡片 -->
    <section v-if="sceneNpcs.length > 0" class="story-npcs">
      <p
        class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-text-muted"
      >
        <span>👤</span>
        <span>出场 NPC</span>
      </p>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div
          v-for="npc in sceneNpcs"
          :key="npc.id"
          class="npc-card group flex gap-3 rounded-md border border-border/60 bg-background/40 p-2.5 transition-all duration-200 hover:border-primary/50"
        >
          <!-- 立绘 -->
          <div
            class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-border/60 bg-surface/60"
          >
            <img
              v-if="npc.portraitUrl"
              :src="fullUrl(npc.portraitUrl)"
              :alt="npc.name"
              class="h-full w-full object-cover"
            />
            <span v-else class="font-display text-lg text-text-muted">
              {{ npc.name.charAt(0) }}
            </span>
          </div>
          <!-- 信息 -->
          <div class="min-w-0 flex-1">
            <p class="truncate font-display text-sm font-bold text-text">{{ npc.name }}</p>
            <p class="mt-0.5 line-clamp-2 text-[11px] leading-tight text-text-muted">
              {{ npc.description }}
            </p>
          </div>
          <!-- DM 操作 -->
          <button
            v-if="isDM"
            class="self-start rounded bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary opacity-0 transition-opacity group-hover:opacity-100"
            title="触发 NPC 事件"
            @click="handleNpcEvent(npc)"
          >
            触发
          </button>
        </div>
      </div>
    </section>

    <!-- 遇敌信息 -->
    <section v-if="sceneEncounters.length > 0" class="story-encounters">
      <p
        class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-text-muted"
      >
        <span>⚔</span>
        <span>遇敌</span>
      </p>
      <div class="space-y-2">
        <div
          v-for="enc in sceneEncounters"
          :key="enc.id"
          class="encounter-card group rounded-md border border-danger/40 bg-danger/5 p-2.5 transition-all duration-200 hover:border-danger/70"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-danger">⚔</span>
              <p class="font-display text-sm font-bold text-text">{{ enc.name }}</p>
              <span
                v-if="enc.difficulty"
                class="rounded bg-surface/80 px-1.5 py-0.5 text-[10px] font-semibold"
                :class="difficultyClass(enc.difficulty)"
              >
                {{ enc.difficulty }}
              </span>
            </div>
            <button
              v-if="isDM"
              class="rounded bg-danger/30 px-1.5 py-0.5 text-[10px] text-text opacity-0 transition-opacity group-hover:opacity-100"
              title="触发遇敌"
              @click="handleEncounterEvent(enc)"
            >
              触发
            </button>
          </div>
          <p class="mt-1 text-[11px] leading-tight text-text-muted">{{ enc.description }}</p>
          <div v-if="enc.enemies.length > 0" class="mt-1.5 flex flex-wrap gap-1">
            <span
              v-for="(enemy, idx) in enc.enemies"
              :key="idx"
              class="rounded bg-danger/15 px-1.5 py-0.5 text-[10px] text-danger"
            >
              {{ enemy }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- 选择按钮 -->
    <section v-if="sceneChoices.length > 0" class="story-choices">
      <p
        class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-text-muted"
      >
        <span>✦</span>
        <span>选择</span>
      </p>
      <div class="flex flex-col gap-2">
        <button
          v-for="choice in sceneChoices"
          :key="choice.id"
          type="button"
          class="choice-btn group flex items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2 text-left transition-all duration-200 hover:border-primary/60 hover:bg-primary/10"
          @click="handleChoice(choice)"
        >
          <div class="min-w-0 flex-1">
            <p class="text-sm text-text group-hover:text-primary">{{ choice.text }}</p>
            <p v-if="choice.action" class="mt-0.5 text-[10px] text-text-muted">
              {{ choice.action }}
            </p>
          </div>
          <span class="ml-2 shrink-0 text-text-muted transition-colors group-hover:text-primary"
            >→</span
          >
        </button>
      </div>
    </section>

    <!-- DM 场景跳转列表 -->
    <section v-if="isDM && story && story.scenes.length > 0" class="story-scene-list">
      <p
        class="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-text-muted"
      >
        <span>🗺</span>
        <span>场景跳转（DM）</span>
      </p>
      <div class="max-h-40 space-y-1 overflow-auto">
        <button
          v-for="scene in story.scenes"
          :key="scene.id"
          type="button"
          class="flex w-full items-center justify-between rounded border px-2 py-1.5 text-left text-xs transition-all duration-150"
          :class="
            currentScene?.id === scene.id
              ? 'border-primary bg-primary/15 text-primary'
              : 'border-border/50 bg-background/30 text-text-muted hover:border-primary/40 hover:text-text'
          "
          @click="handleSceneJump(scene)"
        >
          <span class="truncate">{{ scene.title }}</span>
          <span v-if="currentScene?.id === scene.id" class="ml-1 shrink-0">●</span>
        </button>
      </div>
    </section>
  </div>
</template>
