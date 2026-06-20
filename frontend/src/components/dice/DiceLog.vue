<script setup lang="ts">
// 骰子结果历史日志面板 - 显示所有掷骰结果（时间倒序）
import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useLogStore } from '@/stores/log'
import { useRoomStore } from '@/stores/room'
import { formatTime } from '@/utils/format'
import type { DiceRollResultEvent, SuccessLevel } from '@/types/socket'

withDefaults(
  defineProps<{
    /** 是否显示标题栏（嵌入 LogPanel 时可关闭） */
    showHeader?: boolean
  }>(),
  {
    showHeader: true,
  },
)

const logStore = useLogStore()
const roomStore = useRoomStore()
const { diceResults } = storeToRefs(logStore)
const { playerId } = storeToRefs(roomStore)

const scrollRef = ref<HTMLElement | null>(null)
/** 显示条数（滚动加载更多） */
const visibleCount = ref(20)

/** 倒序结果（最新在前） */
const reversedResults = computed(() => {
  const list = [...diceResults.value].reverse()
  return list.slice(0, visibleCount.value)
})

/** 是否还有更多可加载 */
const hasMore = computed(() => diceResults.value.length > visibleCount.value)

/** 加载更多 */
function loadMore() {
  visibleCount.value = Math.min(visibleCount.value + 20, diceResults.value.length)
}

/** 新结果到达时自动滚动到顶部 */
watch(
  () => diceResults.value.length,
  async () => {
    await nextTick()
    if (scrollRef.value) {
      scrollRef.value.scrollTop = 0
    }
  },
)

/** 成功等级配置（中文 + 配色） */
const SUCCESS_LEVEL_META: Record<NonNullable<SuccessLevel>, { label: string; color: string }> = {
  critical: { label: '大成功', color: 'text-success border-success/60 bg-success/15' },
  extreme: { label: '极难成功', color: 'text-primary border-primary/60 bg-primary/15' },
  hard: { label: '困难成功', color: 'text-warning border-warning/60 bg-warning/15' },
  regular: { label: '普通成功', color: 'text-text border-border bg-surface/40' },
  fumble: { label: '大失败', color: 'text-danger border-danger/60 bg-danger/15' },
}

/** 更精确的保留判断：按位置匹配 kept */
function isKeptByIndex(result: DiceRollResultEvent, index: number): boolean {
  // 如果 kept 长度等于 rolls 长度，全部保留
  if (result.kept.length >= result.rolls.length) return true
  // 否则按值匹配（取 kept 中前 N 个匹配的）
  // 简化处理：前 kept.length 个保留
  return index < result.kept.length
}

/** 获取玩家头像首字母 */
function getAvatarChar(name: string): string {
  return name?.charAt(0)?.toUpperCase() || '?'
}

/** 是否为自己掷的骰 */
function isOwnRoll(result: DiceRollResultEvent): boolean {
  return result.playerId === playerId.value
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- 标题 -->
    <div v-if="showHeader" class="flex items-center justify-between border-b border-border p-4">
      <div>
        <div class="title-divider mb-1">
          <span class="text-xs">◆</span>
        </div>
        <h2 class="font-display text-base font-semibold text-primary">骰子记录</h2>
      </div>
      <span class="rounded-full bg-surface/60 px-2 py-0.5 text-xs text-text-muted">
        共 {{ diceResults.length }} 条
      </span>
    </div>

    <!-- 结果列表 -->
    <div ref="scrollRef" class="flex-1 space-y-2 overflow-auto p-3">
      <template v-if="reversedResults.length">
        <div
          v-for="result in reversedResults"
          :key="result.id"
          class="dice-result-item rounded-lg border border-border/50 bg-surface/40 p-3 animate-fade-in"
          :class="result.isHidden ? 'border-warning/30 bg-warning/5' : ''"
        >
          <!-- 顶部：玩家信息 + 时间 -->
          <div class="mb-2 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <!-- 头像 -->
              <div
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-surface text-xs font-bold text-primary"
              >
                {{ getAvatarChar(result.playerName) }}
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="truncate text-sm font-semibold text-text">{{
                    result.playerName
                  }}</span>
                  <span
                    v-if="isOwnRoll(result)"
                    class="rounded bg-primary/20 px-1 text-[10px] text-primary"
                  >
                    我
                  </span>
                  <span
                    v-if="result.isHidden"
                    class="rounded bg-warning/20 px-1 text-[10px] text-warning"
                    title="暗骰"
                  >
                    暗骰
                  </span>
                </div>
                <span class="text-[10px] text-text-muted">{{ formatTime(result.timestamp) }}</span>
              </div>
            </div>
            <!-- 成功等级徽章 -->
            <span
              v-if="result.successLevel"
              class="shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold"
              :class="SUCCESS_LEVEL_META[result.successLevel].color"
            >
              {{ SUCCESS_LEVEL_META[result.successLevel].label }}
            </span>
          </div>

          <!-- 标签 + 表达式 -->
          <div class="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span
              v-if="result.label"
              class="rounded bg-accent/20 px-1.5 py-0.5 font-semibold text-accent"
            >
              {{ result.label }}
            </span>
            <span class="font-mono text-text-muted">{{ result.expression }}</span>
          </div>

          <!-- 骰子结果明细 -->
          <div class="mb-2 flex flex-wrap items-center gap-1">
            <span
              v-for="(value, idx) in result.rolls"
              :key="idx"
              class="flex h-7 w-7 items-center justify-center rounded border font-mono text-sm font-bold"
              :class="
                isKeptByIndex(result, idx)
                  ? 'border-primary/60 bg-primary/15 text-primary'
                  : 'border-border/50 bg-background/40 text-text-muted/50 line-through'
              "
            >
              {{ value }}
            </span>
            <!-- 修饰符 -->
            <span v-if="result.modifier !== 0" class="font-mono text-sm text-text-muted">
              {{ result.modifier > 0 ? '+' : '' }}{{ result.modifier }}
            </span>
          </div>

          <!-- 总计 + SAN 扣损 -->
          <div class="flex items-center justify-between border-t border-border/40 pt-2">
            <div class="flex items-baseline gap-1.5">
              <span class="text-[10px] uppercase tracking-widest text-text-muted">总计</span>
              <span
                class="font-display text-2xl font-bold"
                :class="
                  result.successLevel === 'critical'
                    ? 'text-success'
                    : result.successLevel === 'fumble'
                      ? 'text-danger'
                      : 'text-gradient-gold'
                "
              >
                {{ result.total }}
              </span>
            </div>
            <!-- SAN 扣损 -->
            <div
              v-if="result.sanLossApplied !== undefined"
              class="flex items-center gap-1 text-xs text-danger"
            >
              <span>SAN</span>
              <span class="font-mono font-bold">-{{ result.sanLossApplied }}</span>
            </div>
            <!-- 目标值 -->
            <div
              v-if="result.target !== undefined"
              class="flex items-center gap-1 text-xs text-text-muted"
            >
              <span>目标</span>
              <span class="font-mono">{{ result.target }}</span>
            </div>
          </div>
        </div>

        <!-- 加载更多 -->
        <button
          v-if="hasMore"
          class="w-full rounded-md border border-border/50 bg-surface/30 py-2 text-xs text-text-muted transition-colors hover:bg-surface-hover hover:text-primary"
          @click="loadMore"
        >
          加载更多（剩余 {{ diceResults.length - visibleCount }} 条）
        </button>
      </template>

      <!-- 空状态 -->
      <div v-else class="flex h-full flex-col items-center justify-center px-4 text-center">
        <div class="mb-3 text-4xl opacity-30">◆</div>
        <p class="text-sm text-text-muted">暂无掷骰记录</p>
        <p class="mt-1 text-xs text-text-muted/70">掷出第一颗骰子开始你的冒险</p>
      </div>
    </div>
  </div>
</template>
