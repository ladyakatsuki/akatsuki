<script setup lang="ts">
// 骰子浮窗组件 - 可折叠/展开的浮窗，含快捷骰子、自定义表达式、DND/COC 模式
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import DiceIcon from './DiceIcon.vue'
import DiceAnimation from './DiceAnimation.vue'
import { useDice, QUICK_DICE_SIDES } from '@/composables/useDice'
import { useRoomStore } from '@/stores/room'
import type { DiceRollRequest, SocketAck, DiceRollResultEvent } from '@/types/socket'

const roomStore = useRoomStore()
const { isDM, ruleSystem } = storeToRefs(roomStore)
const { roll } = useDice()

// ===== 面板状态 =====
const expanded = ref(false)
const rolling = ref(false)
/** 当前动画显示的骰子面数 */
const animSides = ref(20)

// ===== 表单状态 =====
const expression = ref('')
const label = ref('')
/** DND 优势/劣势：'none' | 'advantage' | 'disadvantage' */
const dndMode = ref<'none' | 'advantage' | 'disadvantage'>('none')
/** COC 奖金骰数量 */
const bonusDice = ref(0)
/** COC 惩罚骰数量 */
const penaltyDice = ref(0)
/** 暗骰 */
const isHidden = ref(false)
/** 表达式错误提示 */
const exprError = ref('')

/** 是否为 COC 规则集 */
const isCoc = computed(() => ruleSystem.value === 'coc7')
/** 是否为 DND 规则集 */
const isDnd = computed(() => ruleSystem.value === 'dnd5e')

/** 快捷骰子配置 */
const quickDice = computed(() =>
  QUICK_DICE_SIDES.map((sides) => ({
    sides,
    label: `d${sides}`,
    // DND 常用 d20，COC 常用 d100
    highlight: isDnd.value ? sides === 20 : sides === 100,
  })),
)

/** 验证表达式基本格式 */
function validateExpression(expr: string): boolean {
  if (!expr.trim()) return false
  // 允许 NdM[kh/kl N][+/-N] 等格式，至少包含 d
  return /^\d*d\d+/i.test(expr.trim())
}

/** 快捷掷骰 */
function quickRoll(sides: number) {
  animSides.value = sides
  rolling.value = true
  const request: DiceRollRequest = {
    expression: `1d${sides}`,
    label: label.value || undefined,
    isHidden: isDM.value ? isHidden.value : undefined,
  }
  // DND d20 优势/劣势
  if (isDnd.value && sides === 20 && dndMode.value !== 'none') {
    request.expression = '2d20kh1'
    request.advantage = dndMode.value === 'advantage'
    request.disadvantage = dndMode.value === 'disadvantage'
  }
  // COC d100 奖金骰/惩罚骰
  if (isCoc.value && sides === 100) {
    if (bonusDice.value > 0) request.bonusDice = bonusDice.value
    if (penaltyDice.value > 0) request.penaltyDice = penaltyDice.value
  }
  sendRoll(request)
}

/** 自定义表达式掷骰 */
function customRoll() {
  exprError.value = ''
  const expr = expression.value.trim()
  if (!expr) {
    exprError.value = '请输入骰子表达式'
    return
  }
  if (!validateExpression(expr)) {
    exprError.value = '表达式格式无效，如 2d6+3、1d20kh1'
    return
  }
  // 推测动画骰子面数
  const sidesMatch = expr.match(/d(\d+)/i)
  animSides.value = sidesMatch ? parseInt(sidesMatch[1], 10) : 20
  rolling.value = true

  const request: DiceRollRequest = {
    expression: expr,
    label: label.value || undefined,
    isHidden: isDM.value ? isHidden.value : undefined,
  }
  // DND 优势/劣势
  if (isDnd.value && dndMode.value !== 'none') {
    request.advantage = dndMode.value === 'advantage'
    request.disadvantage = dndMode.value === 'disadvantage'
  }
  // COC 奖金骰/惩罚骰
  if (isCoc.value) {
    if (bonusDice.value > 0) request.bonusDice = bonusDice.value
    if (penaltyDice.value > 0) request.penaltyDice = penaltyDice.value
  }
  sendRoll(request)
}

/** 发送掷骰请求，ack 回来后停止动画 */
function sendRoll(request: DiceRollRequest) {
  const ackCb = (res: SocketAck<DiceRollResultEvent>) => {
    // 动画至少持续 1.2s，避免闪烁
    const elapsed = Date.now() - rollStartTime
    const remaining = Math.max(0, 1200 - elapsed)
    setTimeout(() => {
      rolling.value = false
    }, remaining)
    if (!res.ok) {
      exprError.value = res.error || '掷骰失败'
    } else {
      // 掷骰成功后清空表达式（保留标签方便连续掷骰）
      expression.value = ''
    }
  }
  const rollStartTime = Date.now()
  roll(request, ackCb)
}

/** 切换 DND 模式 */
function toggleDndMode(mode: 'advantage' | 'disadvantage') {
  dndMode.value = dndMode.value === mode ? 'none' : mode
}

/** 调整 COC 奖金骰/惩罚骰（互斥，0-3） */
function adjustBonus(delta: number) {
  bonusDice.value = Math.max(0, Math.min(3, bonusDice.value + delta))
  if (bonusDice.value > 0) penaltyDice.value = 0
}
function adjustPenalty(delta: number) {
  penaltyDice.value = Math.max(0, Math.min(3, penaltyDice.value + delta))
  if (penaltyDice.value > 0) bonusDice.value = 0
}
</script>

<template>
  <div class="dice-panel-container fixed bottom-4 right-4 z-40">
    <!-- 3D 翻滚动画覆盖层 -->
    <DiceAnimation :rolling="rolling" :sides="animSides" />

    <!-- 折叠态：圆形浮标 -->
    <Transition name="dice-fab">
      <button
        v-if="!expanded"
        class="dice-fab group flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary/60 bg-surface/95 text-primary shadow-glow backdrop-blur-md transition-all hover:scale-110 hover:shadow-glow"
        title="打开骰子台"
        @click="expanded = true"
      >
        <DiceIcon
          :sides="20"
          :size="28"
          class="transition-transform group-hover:rotate-180 duration-700"
        />
      </button>
    </Transition>

    <!-- 展开态：完整面板 -->
    <Transition name="dice-panel">
      <div v-if="expanded" class="dice-panel frame-card w-80 overflow-hidden rounded-lg">
        <!-- 标题栏 -->
        <div
          class="flex items-center justify-between border-b border-border/60 bg-surface/80 px-4 py-2.5"
        >
          <div class="flex items-center gap-2">
            <DiceIcon :sides="20" :size="18" class="text-primary" />
            <span class="font-display text-sm font-semibold text-primary">骰子台</span>
            <span
              class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
              :class="isCoc ? 'bg-success/20 text-success' : 'bg-accent/20 text-accent'"
            >
              {{ isCoc ? 'COC' : 'DND' }}
            </span>
          </div>
          <button
            class="rounded p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-danger"
            title="收起"
            @click="expanded = false"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- 内容区 -->
        <div class="max-h-[70vh] space-y-3 overflow-y-auto p-3">
          <!-- 快捷骰子网格 -->
          <div>
            <div class="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              快捷掷骰
            </div>
            <div class="grid grid-cols-4 gap-1.5">
              <button
                v-for="dice in quickDice"
                :key="dice.sides"
                class="group flex flex-col items-center justify-center gap-0.5 rounded-md border py-2 transition-all duration-200 hover:scale-105"
                :class="
                  dice.highlight
                    ? 'border-primary/60 bg-primary/10 text-primary hover:bg-primary/20 hover:shadow-glow'
                    : 'border-border bg-background/50 text-text-muted hover:border-primary/40 hover:text-primary'
                "
                :title="`掷 d${dice.sides}`"
                @click="quickRoll(dice.sides)"
              >
                <DiceIcon
                  :sides="dice.sides"
                  :size="22"
                  class="transition-transform duration-500 group-hover:rotate-180"
                />
                <span class="text-[10px] font-mono font-semibold">{{ dice.label }}</span>
              </button>
            </div>
          </div>

          <!-- 分割线 -->
          <div class="title-divider text-[10px]">
            <span>◆</span>
          </div>

          <!-- 自定义表达式 -->
          <div class="space-y-2">
            <div class="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              自定义掷骰
            </div>

            <!-- 表达式输入 -->
            <div>
              <input
                v-model="expression"
                type="text"
                placeholder="如 2d20kh1+5"
                class="input-field font-mono text-sm"
                @keyup.enter="customRoll"
              />
              <p v-if="exprError" class="mt-1 text-xs text-danger">{{ exprError }}</p>
            </div>

            <!-- 标签输入 -->
            <input
              v-model="label"
              type="text"
              placeholder="标签（如 攻击检定）"
              class="input-field text-sm"
              maxlength="20"
            />

            <!-- DND 模式：优势/劣势 -->
            <div v-if="isDnd" class="flex gap-1.5">
              <button
                class="flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition-all"
                :class="
                  dndMode === 'advantage'
                    ? 'border-success/60 bg-success/20 text-success'
                    : 'border-border bg-background/40 text-text-muted hover:text-text'
                "
                @click="toggleDndMode('advantage')"
              >
                优势
              </button>
              <button
                class="flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition-all"
                :class="
                  dndMode === 'disadvantage'
                    ? 'border-danger/60 bg-danger/20 text-danger'
                    : 'border-border bg-background/40 text-text-muted hover:text-text'
                "
                @click="toggleDndMode('disadvantage')"
              >
                劣势
              </button>
            </div>

            <!-- COC 模式：奖金骰/惩罚骰 -->
            <div v-if="isCoc" class="grid grid-cols-2 gap-2">
              <div class="rounded-md border border-border bg-background/40 p-2">
                <div class="mb-1 text-center text-[10px] text-text-muted">奖金骰</div>
                <div class="flex items-center justify-between gap-1">
                  <button
                    class="flex h-6 w-6 items-center justify-center rounded bg-surface-hover text-text-muted hover:text-primary"
                    @click="adjustBonus(-1)"
                  >
                    −
                  </button>
                  <span class="font-mono text-sm font-bold text-success">{{ bonusDice }}</span>
                  <button
                    class="flex h-6 w-6 items-center justify-center rounded bg-surface-hover text-text-muted hover:text-primary"
                    @click="adjustBonus(1)"
                  >
                    +
                  </button>
                </div>
              </div>
              <div class="rounded-md border border-border bg-background/40 p-2">
                <div class="mb-1 text-center text-[10px] text-text-muted">惩罚骰</div>
                <div class="flex items-center justify-between gap-1">
                  <button
                    class="flex h-6 w-6 items-center justify-center rounded bg-surface-hover text-text-muted hover:text-primary"
                    @click="adjustPenalty(-1)"
                  >
                    −
                  </button>
                  <span class="font-mono text-sm font-bold text-danger">{{ penaltyDice }}</span>
                  <button
                    class="flex h-6 w-6 items-center justify-center rounded bg-surface-hover text-text-muted hover:text-primary"
                    @click="adjustPenalty(1)"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <!-- 暗骰切换（仅 DM 可用） -->
            <label
              v-if="isDM"
              class="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-1.5"
            >
              <input v-model="isHidden" type="checkbox" class="h-3.5 w-3.5 accent-primary" />
              <span class="text-xs text-text-muted">
                暗骰
                <span class="text-text-muted/60">（仅 DM 与自己可见）</span>
              </span>
            </label>

            <!-- 掷骰按钮 -->
            <button
              class="btn-metal w-full justify-center py-2.5"
              :disabled="rolling"
              @click="customRoll"
            >
              <span
                v-if="rolling"
                class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
              <DiceIcon v-else :sides="20" :size="16" />
              <span>{{ rolling ? '投掷中…' : '掷骰' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.dice-panel-container {
  --dice-size: 60px;
}

/* 浮标动画 */
.dice-fab-enter-active,
.dice-fab-leave-active {
  transition:
    transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.2s ease;
}
.dice-fab-enter-from,
.dice-fab-leave-to {
  transform: scale(0) rotate(-180deg);
  opacity: 0;
}

/* 面板展开动画 */
.dice-panel-enter-active,
.dice-panel-leave-active {
  transition:
    transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.25s ease;
  transform-origin: bottom right;
}
.dice-panel-enter-from,
.dice-panel-leave-to {
  transform: scale(0.6) translateY(20px);
  opacity: 0;
}
</style>
