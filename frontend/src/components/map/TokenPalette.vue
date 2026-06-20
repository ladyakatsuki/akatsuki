<script setup lang="ts">
// Token 放置面板：DM 可拖拽角色或自定义 Token 到地图
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useCharacterStore } from '@/stores/character'
import type { Character, MapToken } from '@/types/models'
import type { MapTokenAddPayload } from '@/types/socket'

withDefaults(
  defineProps<{
    isDM: boolean
  }>(),
  { isDM: false },
)

const characterStore = useCharacterStore()
const { roomCharacters } = storeToRefs(characterStore)

/** 预设颜色 */
const COLORS = [
  '#d4a574',
  '#8b3a3a',
  '#6ea05a',
  '#5070b0',
  '#b08840',
  '#8b5a9c',
  '#5aaaaa',
  '#9a9a9a',
]

/** 自定义 Token 表单 */
const customName = ref('')
const customType = ref<MapToken['type']>('object')
const customColor = ref(COLORS[0])

const TYPE_LABELS: Record<MapToken['type'], string> = {
  player: '玩家',
  npc: 'NPC',
  object: '物体',
}

/** 角色默认颜色（按名字哈希） */
function colorForChar(char: Character): string {
  let hash = 0
  for (let i = 0; i < char.name.length; i++) {
    hash = (hash * 31 + char.name.charCodeAt(i)) | 0
  }
  return COLORS[Math.abs(hash) % COLORS.length]
}

/** 解析立绘 URL */
function resolvePortrait(url: string | null): string {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) return url
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  return `${apiBase}${url}`
}

type DragPayload = Omit<MapTokenAddPayload, 'x' | 'y'>

function startDragChar(e: DragEvent, char: Character) {
  const payload: DragPayload = {
    characterId: char.id,
    name: char.name,
    type: char.isNpc ? 'npc' : 'player',
    color: colorForChar(char),
    size: 1,
    imageUrl: char.portraitUrl ?? undefined,
  }
  e.dataTransfer?.setData('application/x-map-token', JSON.stringify(payload))
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'
}

function startDragCustom(e: DragEvent) {
  const payload: DragPayload = {
    name: customName.value.trim() || TYPE_LABELS[customType.value],
    type: customType.value,
    color: customColor.value,
    size: 1,
  }
  e.dataTransfer?.setData('application/x-map-token', JSON.stringify(payload))
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'
}

const customTypeLabel = computed(() => TYPE_LABELS[customType.value])
</script>

<template>
  <div v-if="isDM" class="flex h-full flex-col">
    <!-- 角色 Token -->
    <div class="border-b border-border/50 px-3 py-2">
      <p class="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
        角色 Token（拖到地图）
      </p>
      <div class="space-y-1 overflow-auto" style="max-height: 40%">
        <div
          v-for="char in roomCharacters"
          :key="char.id"
          draggable="true"
          class="token-drag-item"
          :title="`拖拽「${char.name}」到地图`"
          @dragstart="startDragChar($event, char)"
        >
          <div
            class="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60"
          >
            <img
              v-if="char.portraitUrl"
              :src="resolvePortrait(char.portraitUrl)"
              :alt="char.name"
              class="h-full w-full object-cover"
            />
            <span v-else class="text-xs text-text-muted">{{ char.name.charAt(0) }}</span>
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-xs text-text">{{ char.name }}</p>
            <p class="text-[10px] text-text-muted">
              {{ char.isNpc ? 'NPC' : '玩家' }}
            </p>
          </div>
          <span class="text-text-muted/50">⠿</span>
        </div>
        <p v-if="!roomCharacters.length" class="py-2 text-center text-[10px] text-text-muted">
          暂无角色，先创建角色
        </p>
      </div>
    </div>

    <!-- 自定义 Token -->
    <div class="flex-1 overflow-auto px-3 py-2">
      <p class="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
        自定义 Token
      </p>

      <!-- 名称 -->
      <input
        v-model="customName"
        type="text"
        placeholder="Token 名称（留空用类型名）"
        class="input-field mb-2 py-1 text-xs"
      />

      <!-- 类型 -->
      <div class="mb-2">
        <p class="mb-1 text-[10px] text-text-muted">类型</p>
        <div class="flex gap-1">
          <button
            v-for="(label, key) in TYPE_LABELS"
            :key="key"
            class="palette-chip"
            :class="customType === key ? 'palette-chip-active' : ''"
            @click="customType = key as MapToken['type']"
          >
            {{ label }}
          </button>
        </div>
      </div>

      <!-- 颜色 -->
      <div class="mb-3">
        <p class="mb-1 text-[10px] text-text-muted">颜色</p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="c in COLORS"
            :key="c"
            class="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
            :class="customColor === c ? 'border-primary' : 'border-transparent'"
            :style="{ backgroundColor: c }"
            @click="customColor = c"
          />
        </div>
      </div>

      <!-- 拖拽预览 -->
      <div
        draggable="true"
        class="flex cursor-grab items-center justify-center gap-2 rounded-md border border-dashed border-primary/50 bg-primary/5 py-3 transition-colors hover:bg-primary/10"
        @dragstart="startDragCustom"
      >
        <span
          class="inline-block h-6 w-6 rounded-full border border-border/60"
          :style="{ backgroundColor: customColor }"
        />
        <span class="text-xs text-text">拖拽「{{ customName || customTypeLabel }}」到地图</span>
      </div>
    </div>
  </div>

  <!-- 玩家视图：不显示放置面板 -->
  <div v-else class="flex h-full items-center justify-center p-3 text-center">
    <p class="text-[10px] text-text-muted">仅 DM 可放置 Token</p>
  </div>
</template>

<style scoped>
.token-drag-item {
  @apply flex cursor-grab items-center gap-2 rounded border border-border/40 bg-surface/40
    px-2 py-1 transition-colors hover:border-primary/50 hover:bg-surface/70;
}
.palette-chip {
  @apply flex-1 rounded border border-border/60 bg-surface px-2 py-1 text-[11px] text-text-muted
    transition-colors hover:border-primary/50 hover:text-text;
}
.palette-chip-active {
  @apply border-primary bg-primary/20 text-primary;
}
</style>
