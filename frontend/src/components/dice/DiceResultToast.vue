<script setup lang="ts">
// 骰子结果弹窗 - 掷骰后短暂显示结果（3 秒自动消失），大字显示总计与成功等级
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useLogStore } from '@/stores/log'
import { useRoomStore } from '@/stores/room'
import type { DiceRollResultEvent, SuccessLevel } from '@/types/socket'

const logStore = useLogStore()
const roomStore = useRoomStore()
const { diceResults } = storeToRefs(logStore)
const { playerId } = storeToRefs(roomStore)

/** 当前显示的结果 */
const activeResult = ref<DiceRollResultEvent | null>(null)
/** 弹窗消失计时器 */
let dismissTimer: ReturnType<typeof setTimeout> | null = null

/** 成功等级配置 */
const SUCCESS_LEVEL_META: Record<
  NonNullable<SuccessLevel>,
  { label: string; color: string; bg: string }
> = {
  critical: { label: '大成功', color: 'text-success', bg: 'border-success/60 bg-success/15' },
  extreme: { label: '极难成功', color: 'text-primary', bg: 'border-primary/60 bg-primary/15' },
  hard: { label: '困难成功', color: 'text-warning', bg: 'border-warning/60 bg-warning/15' },
  regular: { label: '普通成功', color: 'text-text', bg: 'border-border bg-surface/40' },
  fumble: { label: '大失败', color: 'text-danger', bg: 'border-danger/60 bg-danger/15' },
}

/** 监听新骰子结果，触发弹窗 */
watch(
  () => diceResults.value.length,
  (newLen, oldLen) => {
    if (newLen > oldLen) {
      const latest = diceResults.value[newLen - 1]
      if (latest) {
        showResult(latest)
      }
    }
  },
)

/** 显示结果弹窗，3 秒后自动消失 */
function showResult(result: DiceRollResultEvent) {
  activeResult.value = result
  if (dismissTimer) clearTimeout(dismissTimer)
  dismissTimer = setTimeout(() => {
    activeResult.value = null
  }, 3000)
}

/** 关闭弹窗 */
function dismiss() {
  if (dismissTimer) clearTimeout(dismissTimer)
  activeResult.value = null
}

/** 是否为自己掷的骰 */
const isOwn = computed(() => activeResult.value?.playerId === playerId.value)

/** 成功等级元信息 */
const successMeta = computed(() => {
  if (!activeResult.value?.successLevel) return null
  return SUCCESS_LEVEL_META[activeResult.value.successLevel]
})
</script>

<template>
  <Transition name="toast">
    <div
      v-if="activeResult"
      class="dice-toast fixed left-1/2 top-20 z-50 -translate-x-1/2"
      @click="dismiss"
    >
      <div
        class="frame-card relative min-w-[280px] max-w-md overflow-hidden rounded-xl px-6 py-4"
        :class="successMeta?.bg ?? 'border-border'"
      >
        <!-- 关闭按钮 -->
        <button
          class="absolute right-2 top-2 rounded p-1 text-text-muted/60 transition-colors hover:text-danger"
          title="关闭"
          @click.stop="dismiss"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <!-- 玩家名 + 标签 -->
        <div class="mb-2 flex items-center gap-2">
          <span class="text-sm font-semibold text-text">
            {{ activeResult.playerName }}
            <span v-if="isOwn" class="text-text-muted">（你）</span>
          </span>
          <span
            v-if="activeResult.isHidden"
            class="rounded bg-warning/20 px-1.5 py-0.5 text-[10px] font-bold text-warning"
          >
            暗骰
          </span>
        </div>

        <!-- 标签 + 表达式 -->
        <div class="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span
            v-if="activeResult.label"
            class="rounded bg-accent/20 px-1.5 py-0.5 font-semibold text-accent"
          >
            {{ activeResult.label }}
          </span>
          <span class="font-mono text-text-muted">{{ activeResult.expression }}</span>
        </div>

        <!-- 大字总计 -->
        <div class="flex items-center justify-center gap-4">
          <div class="text-center">
            <div class="text-[10px] uppercase tracking-widest text-text-muted">总计</div>
            <div
              class="font-display text-5xl font-bold leading-none"
              :class="successMeta?.color ?? 'text-gradient-gold'"
            >
              {{ activeResult.total }}
            </div>
          </div>

          <!-- 成功等级 -->
          <div v-if="successMeta" class="border-l border-border/50 pl-4">
            <div class="text-[10px] uppercase tracking-widest text-text-muted">结果</div>
            <div class="font-display text-xl font-bold" :class="successMeta.color">
              {{ successMeta.label }}
            </div>
          </div>

          <!-- SAN 扣损 -->
          <div
            v-if="activeResult.sanLossApplied !== undefined"
            class="border-l border-border/50 pl-4"
          >
            <div class="text-[10px] uppercase tracking-widest text-text-muted">SAN</div>
            <div class="font-display text-xl font-bold text-danger">
              -{{ activeResult.sanLossApplied }}
            </div>
          </div>
        </div>

        <!-- 骰子明细 -->
        <div class="mt-3 flex flex-wrap items-center justify-center gap-1">
          <span
            v-for="(value, idx) in activeResult.rolls"
            :key="idx"
            class="flex h-6 w-6 items-center justify-center rounded border font-mono text-xs font-bold"
            :class="
              idx < activeResult.kept.length
                ? 'border-primary/60 bg-primary/15 text-primary'
                : 'border-border/50 bg-background/40 text-text-muted/50'
            "
          >
            {{ value }}
          </span>
          <span v-if="activeResult.modifier !== 0" class="font-mono text-xs text-text-muted">
            {{ activeResult.modifier > 0 ? '+' : '' }}{{ activeResult.modifier }}
          </span>
        </div>

        <!-- 底部进度条（自动消失倒计时） -->
        <div class="toast-progress absolute bottom-0 left-0 h-0.5 bg-primary/60" />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* 弹窗缩放进入动画 */
.toast-enter-active {
  transition:
    transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.3s ease;
}
.toast-leave-active {
  transition:
    transform 0.25s ease,
    opacity 0.25s ease;
}
.toast-enter-from {
  transform: translate(-50%, -30px) scale(0.7);
  opacity: 0;
}
.toast-leave-to {
  transform: translate(-50%, -20px) scale(0.9);
  opacity: 0;
}

/* 倒计时进度条 */
.toast-progress {
  animation: toast-countdown 3s linear forwards;
}

@keyframes toast-countdown {
  from {
    width: 100%;
  }
  to {
    width: 0%;
  }
}
</style>
