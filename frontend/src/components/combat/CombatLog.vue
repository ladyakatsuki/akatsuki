<script setup lang="ts">
// 战斗日志面板：从 log store 过滤 combat 类型日志展示
import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useLogStore } from '@/stores/log'

const logStore = useLogStore()
const { logs } = storeToRefs(logStore)

const scrollRef = ref<HTMLElement | null>(null)

/** 仅战斗相关日志 */
const combatLogs = computed(() => {
  return logs.value
    .filter((l) => l.type === 'combat')
    .slice()
    .reverse()
})

/** 自动滚动到顶部（最新） */
watch(
  () => combatLogs.value.length,
  async () => {
    await nextTick()
    if (scrollRef.value) {
      scrollRef.value.scrollTop = 0
    }
  },
)
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- 头部 -->
    <div class="flex items-center justify-between border-b border-border/50 px-3 py-2">
      <span class="font-display text-xs font-semibold text-primary">战斗日志</span>
      <span class="rounded-full bg-surface/60 px-2 py-0.5 text-[10px] text-text-muted">
        {{ combatLogs.length }} 条
      </span>
    </div>

    <!-- 日志列表 -->
    <div ref="scrollRef" class="flex-1 space-y-1.5 overflow-auto p-2">
      <template v-if="combatLogs.length">
        <div
          v-for="log in combatLogs"
          :key="log.id"
          class="rounded border border-border/40 bg-background/40 px-2 py-1.5 text-xs animate-fade-in"
        >
          <div class="flex items-center gap-2">
            <span class="shrink-0 font-mono text-[10px] text-text-muted/70">{{
              log.timestamp
            }}</span>
            <span
              v-if="log.playerName"
              class="shrink-0 rounded bg-accent/20 px-1 text-[10px] text-accent"
            >
              {{ log.playerName }}
            </span>
          </div>
          <p class="mt-0.5 text-text/90">{{ log.message }}</p>
        </div>
      </template>

      <!-- 空状态 -->
      <div v-else class="flex h-full flex-col items-center justify-center px-4 text-center">
        <div class="mb-3 text-4xl opacity-30">⚔</div>
        <p class="text-sm text-text-muted">暂无战斗日志</p>
        <p class="mt-1 text-xs text-text-muted/70">战斗开始后将记录所有事件</p>
      </div>
    </div>
  </div>
</template>
