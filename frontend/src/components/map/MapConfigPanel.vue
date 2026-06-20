<script setup lang="ts">
// 地图配置面板：DM 可调整网格类型/大小、地图尺寸、背景图；玩家只读
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import BaseButton from '@/components/common/BaseButton.vue'
import { useMapStore } from '@/stores/map'
import type { GridType } from '@/types/models'

const props = withDefaults(
  defineProps<{
    isDM: boolean
  }>(),
  { isDM: false },
)

const mapStore = useMapStore()
const { gridType, gridSize, width, height, backgroundUrl } = storeToRefs(mapStore)

// 本地可编辑值（避免每次输入都触发广播）
const localGridSize = ref(gridSize.value)
const localWidth = ref(width.value)
const localHeight = ref(height.value)
const localBgUrl = ref(backgroundUrl.value ?? '')

// 同步外部变更到本地
watch(gridSize, (v) => (localGridSize.value = v))
watch(width, (v) => (localWidth.value = v))
watch(height, (v) => (localHeight.value = v))
watch(backgroundUrl, (v) => (localBgUrl.value = v ?? ''))

function setGridType(t: GridType) {
  if (!props.isDM) return
  if (t === gridType.value) return
  mapStore.setConfig({ gridType: t })
}

function applyGridSize() {
  if (!props.isDM) return
  const v = Math.max(20, Math.min(120, Math.round(localGridSize.value) || 50))
  localGridSize.value = v
  if (v !== gridSize.value) mapStore.setConfig({ gridSize: v })
}

function applySize() {
  if (!props.isDM) return
  const w = Math.max(5, Math.min(100, Math.round(localWidth.value) || 20))
  const h = Math.max(5, Math.min(100, Math.round(localHeight.value) || 15))
  localWidth.value = w
  localHeight.value = h
  if (w !== width.value || h !== height.value) {
    mapStore.setConfig({ width: w, height: h })
  }
}

function applyBackground() {
  if (!props.isDM) return
  const url = localBgUrl.value.trim()
  mapStore.setBackground(url)
}

function clearBackground() {
  if (!props.isDM) return
  localBgUrl.value = ''
  mapStore.setBackground('')
}
</script>

<template>
  <div class="space-y-3 p-3">
    <!-- 玩家只读信息 -->
    <template v-if="!isDM">
      <div class="space-y-1 text-xs text-text-muted">
        <p>网格：{{ gridType === 'hex' ? '六边形' : '方格' }} · {{ gridSize }}px</p>
        <p>尺寸：{{ width }} × {{ height }}</p>
        <p>背景：{{ backgroundUrl ? '已设置' : '无' }}</p>
      </div>
    </template>

    <!-- DM 配置 -->
    <template v-else>
      <!-- 网格类型 -->
      <div>
        <label
          class="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-text-muted"
        >
          网格类型
        </label>
        <div class="flex gap-1">
          <button
            class="cfg-chip"
            :class="gridType === 'square' ? 'cfg-chip-active' : ''"
            @click="setGridType('square')"
          >
            方格
          </button>
          <button
            class="cfg-chip"
            :class="gridType === 'hex' ? 'cfg-chip-active' : ''"
            @click="setGridType('hex')"
          >
            六边形
          </button>
        </div>
      </div>

      <!-- 格子大小 -->
      <div>
        <label
          class="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-text-muted"
        >
          格子大小（px）
        </label>
        <div class="flex items-center gap-2">
          <input
            v-model.number="localGridSize"
            type="number"
            min="20"
            max="120"
            class="input-field flex-1 py-1"
            @change="applyGridSize"
            @keyup.enter="applyGridSize"
          />
          <span class="text-[10px] text-text-muted">20-120</span>
        </div>
      </div>

      <!-- 地图尺寸 -->
      <div>
        <label
          class="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-text-muted"
        >
          地图尺寸（格）
        </label>
        <div class="flex items-center gap-2">
          <input
            v-model.number="localWidth"
            type="number"
            min="5"
            max="100"
            class="input-field flex-1 py-1"
            @change="applySize"
            @keyup.enter="applySize"
          />
          <span class="text-text-muted">×</span>
          <input
            v-model.number="localHeight"
            type="number"
            min="5"
            max="100"
            class="input-field flex-1 py-1"
            @change="applySize"
            @keyup.enter="applySize"
          />
        </div>
      </div>

      <!-- 背景图 -->
      <div>
        <label
          class="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-text-muted"
        >
          背景图 URL
        </label>
        <input
          v-model="localBgUrl"
          type="text"
          placeholder="https://… 或 /assets/xxx.png"
          class="input-field py-1"
          @keyup.enter="applyBackground"
        />
        <div class="mt-1.5 flex gap-1">
          <BaseButton size="sm" variant="primary" @click="applyBackground">应用背景</BaseButton>
          <BaseButton size="sm" variant="ghost" :disabled="!backgroundUrl" @click="clearBackground">
            清除
          </BaseButton>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.cfg-chip {
  @apply flex-1 rounded border border-border/60 bg-surface px-3 py-1.5 text-xs text-text-muted
    transition-colors hover:border-primary/50 hover:text-text;
}
.cfg-chip-active {
  @apply border-primary bg-primary/20 text-primary;
}
</style>
