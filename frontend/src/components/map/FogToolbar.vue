<script setup lang="ts">
// 迷雾战争工具栏：DM 可涂抹/擦除迷雾、调整笔刷、清空；玩家只读
import { computed } from 'vue'
import BaseButton from '@/components/common/BaseButton.vue'
import { useMapStore } from '@/stores/map'
import { storeToRefs } from 'pinia'

const props = withDefaults(
  defineProps<{
    isDM: boolean
    /** 迷雾编辑模式是否激活 */
    editable: boolean
    /** 绘制模式 */
    mode: 'add' | 'remove'
    /** 笔刷大小 */
    brushSize: number
  }>(),
  {
    isDM: false,
    editable: false,
    mode: 'add',
    brushSize: 1,
  },
)

const emit = defineEmits<{
  'update:editable': [v: boolean]
  'update:mode': [v: 'add' | 'remove']
  'update:brushSize': [v: number]
}>()

const mapStore = useMapStore()
const { fogCells } = storeToRefs(mapStore)

const brushOptions = [1, 2, 3, 4]

const modeLabel = computed(() =>
  props.editable ? (props.mode === 'add' ? '涂抹中' : '擦除中') : '未启用',
)

function toggleEditable() {
  emit('update:editable', !props.editable)
}

function setMode(m: 'add' | 'remove') {
  emit('update:mode', m)
  if (!props.editable) emit('update:editable', true)
}

function setBrush(n: number) {
  emit('update:brushSize', n)
  if (!props.editable) emit('update:editable', true)
}

function clearFog() {
  if (window.confirm('确定清空所有迷雾吗？')) {
    mapStore.clearFog()
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 border-t border-border/50 px-3 py-2">
    <!-- DM 工具 -->
    <template v-if="isDM">
      <button
        class="fog-toggle"
        :class="editable ? 'bg-primary/80 text-background' : 'bg-surface-hover text-text-muted'"
        @click="toggleEditable"
      >
        {{ editable ? '退出迷雾编辑' : '迷雾编辑' }}
      </button>

      <div
        class="flex items-center gap-1"
        :class="editable ? '' : 'opacity-40 pointer-events-none'"
      >
        <span class="text-[10px] text-text-muted">模式</span>
        <button
          class="fog-chip"
          :class="mode === 'add' ? 'fog-chip-active' : ''"
          @click="setMode('add')"
        >
          涂抹
        </button>
        <button
          class="fog-chip"
          :class="mode === 'remove' ? 'fog-chip-active' : ''"
          @click="setMode('remove')"
        >
          擦除
        </button>
      </div>

      <div
        class="flex items-center gap-1"
        :class="editable ? '' : 'opacity-40 pointer-events-none'"
      >
        <span class="text-[10px] text-text-muted">笔刷</span>
        <button
          v-for="n in brushOptions"
          :key="n"
          class="fog-chip"
          :class="brushSize === n ? 'fog-chip-active' : ''"
          @click="setBrush(n)"
        >
          {{ n }}
        </button>
      </div>

      <BaseButton size="sm" variant="ghost" :disabled="fogCells.length === 0" @click="clearFog">
        清空迷雾
      </BaseButton>

      <span class="ml-auto text-[10px] text-text-muted">
        {{ modeLabel }} · 迷雾格 {{ fogCells.length }}
      </span>
    </template>

    <!-- 玩家只读提示 -->
    <template v-else>
      <span class="text-[10px] text-text-muted">
        迷雾覆盖中（{{ fogCells.length }} 格），仅 DM 可编辑
      </span>
    </template>
  </div>
</template>

<style scoped>
.fog-toggle {
  @apply rounded-md px-3 py-1 text-xs font-semibold transition-colors;
}
.fog-chip {
  @apply rounded border border-border/60 bg-surface px-2 py-0.5 text-[11px] text-text-muted
    transition-colors hover:border-primary/50 hover:text-text;
}
.fog-chip-active {
  @apply border-primary bg-primary/20 text-primary;
}
</style>
