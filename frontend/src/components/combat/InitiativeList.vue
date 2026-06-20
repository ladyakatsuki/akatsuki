<script setup lang="ts">
// 先攻表组件：展示战斗参与者（按先攻降序），高亮当前回合，DM 可拖拽排序与点击编辑
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useCombatStore } from '@/stores/combat'
import { useRoomStore } from '@/stores/room'
import StatBar from '@/components/common/StatBar.vue'
import ParticipantEditor from './ParticipantEditor.vue'
import type { CombatParticipant } from '@/types/models'

const props = withDefaults(
  defineProps<{
    /** 是否为 DM 视图（可编辑） */
    isDM?: boolean
    /** 是否紧凑模式 */
    compact?: boolean
  }>(),
  {
    isDM: false,
    compact: false,
  },
)

const combatStore = useCombatStore()
const roomStore = useRoomStore()
const { sortedParticipants, currentParticipant, isActive, round } = storeToRefs(combatStore)
const { ruleSystem } = storeToRefs(roomStore)

/** 当前编辑的参与者 */
const editingParticipant = ref<CombatParticipant | null>(null)
/** 编辑弹窗显示 */
const showEditor = ref(false)

/** 拖拽中的参与者 ID */
const draggingId = ref<string | null>(null)
/** 拖拽悬停的目标 ID */
const dragOverId = ref<string | null>(null)

/** 是否 DND 规则集（显示 AC） */
const isDnd = computed(() => ruleSystem.value === 'dnd5e')

/** HP 百分比 */
function hpPercent(p: CombatParticipant): number {
  if (p.maxHp <= 0) return 0
  return Math.max(0, Math.min(100, (p.hp / p.maxHp) * 100))
}

/** HP 状态等级 */
function hpStatus(p: CombatParticipant): 'healthy' | 'wounded' | 'critical' | 'dead' {
  const pct = hpPercent(p)
  if (p.hp <= 0) return 'dead'
  if (pct > 60) return 'healthy'
  if (pct > 30) return 'wounded'
  return 'critical'
}

/** 是否为当前回合参与者 */
function isCurrent(p: CombatParticipant): boolean {
  return currentParticipant.value?.id === p.id
}

/** 类型标签 */
function typeLabel(p: CombatParticipant): string {
  return p.type === 'player' ? '玩家' : 'NPC'
}

/** 类型样式 */
function typeClass(p: CombatParticipant): string {
  return p.type === 'player'
    ? 'border-primary/50 text-primary bg-primary/10'
    : 'border-accent/50 text-accent bg-accent/10'
}

/** 点击参与者：DM 打开编辑 */
function onClickParticipant(p: CombatParticipant) {
  if (!props.isDM) return
  editingParticipant.value = p
  showEditor.value = true
}

/** 拖拽开始 */
function onDragStart(e: DragEvent, p: CombatParticipant) {
  if (!props.isDM) return
  draggingId.value = p.id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', p.id)
  }
}

/** 拖拽悬停 */
function onDragOver(e: DragEvent, p: CombatParticipant) {
  if (!props.isDM || !draggingId.value) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  dragOverId.value = p.id
}

/** 拖拽离开 */
function onDragLeave(_p: CombatParticipant) {
  // 仅当离开当前目标时清空
  dragOverId.value = null
}

/** 拖拽放下：交换两个参与者的先攻值（手动调整） */
function onDrop(e: DragEvent, target: CombatParticipant) {
  if (!props.isDM) return
  e.preventDefault()
  const sourceId = draggingId.value
  draggingId.value = null
  dragOverId.value = null
  if (!sourceId || sourceId === target.id) return

  const source = sortedParticipants.value.find((p) => p.id === sourceId)
  if (!source) return
  // 交换先攻值（若相同则微调）
  const sourceInit = source.initiative
  const targetInit = target.initiative
  if (sourceInit === targetInit) {
    // 微调避免相等
    combatStore.updateParticipant(source.id, { initiative: sourceInit + 0.5 })
    combatStore.updateParticipant(target.id, { initiative: targetInit })
  } else {
    combatStore.updateParticipant(source.id, { initiative: targetInit })
    combatStore.updateParticipant(target.id, { initiative: sourceInit })
  }
}

/** 重新掷先攻 */
function onRollInitiative(p: CombatParticipant, e: Event) {
  e.stopPropagation()
  if (!props.isDM) return
  combatStore.rollInitiative(p.id)
}

/** 编辑器关闭 */
function onEditorClose() {
  showEditor.value = false
  editingParticipant.value = null
}

/** 状态效果图标映射（简易 emoji） */
const STATUS_ICONS: Record<string, string> = {
  poisoned: '☠',
  stunned: '💫',
  paralyzed: '⛓',
  frightened: '😱',
  prone: '🛑',
  unconscious: '💤',
  blinded: '🌑',
  deafened: '🔇',
  charmed: '💖',
  restrained: '🪢',
  invisible: '👻',
  burning: '🔥',
  frozen: '❄',
  blessed: '✨',
  haste: '⚡',
  'san-loss': '🧠',
  'temporary-insanity': '🌀',
  'indefinite-insanity': '🌫',
}

/** 获取状态效果图标 */
function statusIcon(effect: string): string {
  return STATUS_ICONS[effect.toLowerCase()] ?? '•'
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- 空状态 -->
    <div
      v-if="!isActive || sortedParticipants.length === 0"
      class="flex h-full flex-col items-center justify-center px-4 text-center"
    >
      <div class="mb-3 text-4xl opacity-30">⚔</div>
      <p class="text-sm text-text-muted">暂无战斗进行</p>
      <p class="mt-1 text-xs text-text-muted/70">
        {{ isDM ? '在控制面板发起战斗以开始追踪' : '等待 DM 发起战斗' }}
      </p>
    </div>

    <!-- 先攻列表 -->
    <div v-else class="flex h-full flex-col">
      <!-- 头部：轮次信息 -->
      <div class="flex items-center justify-between border-b border-border/50 px-3 py-2 text-xs">
        <span class="font-display font-semibold text-primary">第 {{ round }} 轮</span>
        <span class="text-text-muted">共 {{ sortedParticipants.length }} 名参与者</span>
      </div>

      <!-- 列表 -->
      <div class="flex-1 space-y-1.5 overflow-auto p-2">
        <div
          v-for="p in sortedParticipants"
          :key="p.id"
          class="participant-card group relative cursor-pointer rounded-md border p-2 transition-all duration-200 animate-fade-in"
          :class="[
            isCurrent(p)
              ? 'border-primary bg-primary/15 shadow-glow ring-1 ring-primary/40'
              : 'border-border/50 bg-surface/40 hover:border-primary/40 hover:bg-surface/70',
            draggingId === p.id ? 'opacity-40' : '',
            dragOverId === p.id && draggingId !== p.id ? 'ring-2 ring-accent/60' : '',
          ]"
          :draggable="isDM"
          @click="onClickParticipant(p)"
          @dragstart="onDragStart($event, p)"
          @dragover="onDragOver($event, p)"
          @dragleave="onDragLeave(p)"
          @drop="onDrop($event, p)"
        >
          <!-- 当前回合指示器 -->
          <div
            v-if="isCurrent(p)"
            class="absolute -left-0.5 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-primary animate-glow-pulse"
          />

          <div class="flex items-center gap-2">
            <!-- 先攻值徽章 -->
            <div
              class="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-md border font-display font-bold"
              :class="
                isCurrent(p)
                  ? 'border-primary bg-primary/20 text-primary'
                  : 'border-border/60 bg-background/60 text-text-muted'
              "
              :title="'先攻值'"
            >
              <span class="text-sm leading-none">{{ p.initiative }}</span>
              <span class="mt-0.5 text-[8px] uppercase tracking-wider opacity-70">Init</span>
            </div>

            <!-- 名字与状态 -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span class="truncate text-sm font-semibold text-text">{{ p.name }}</span>
                <span
                  class="shrink-0 rounded border px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                  :class="typeClass(p)"
                >
                  {{ typeLabel(p) }}
                </span>
                <!-- 死亡标记 -->
                <span
                  v-if="hpStatus(p) === 'dead'"
                  class="shrink-0 rounded bg-danger/30 px-1 text-[9px] font-bold text-danger"
                >
                  倒下
                </span>
              </div>

              <!-- HP 条 -->
              <div class="mt-1">
                <StatBar
                  :value="p.hp"
                  :max="p.maxHp"
                  variant="hp"
                  :height="compact ? 6 : 8"
                  :show-text="!compact"
                />
              </div>
            </div>

            <!-- AC（DND） -->
            <div
              v-if="isDnd && p.ac !== undefined"
              class="flex shrink-0 flex-col items-center justify-center rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5"
              title="护甲等级"
            >
              <span class="text-[8px] uppercase tracking-wider text-text-muted">AC</span>
              <span class="font-display text-sm font-bold text-text">{{ p.ac }}</span>
            </div>

            <!-- DM 操作按钮 -->
            <div v-if="isDM" class="flex shrink-0 flex-col gap-1">
              <button
                class="rounded p-1 text-text-muted opacity-0 transition-opacity hover:bg-primary/20 hover:text-primary group-hover:opacity-100"
                title="重新掷先攻"
                @click="onRollInitiative(p, $event)"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                  <path d="M3 21v-5h5" />
                </svg>
              </button>
            </div>
          </div>

          <!-- 状态效果 -->
          <div
            v-if="p.statusEffects && p.statusEffects.length > 0"
            class="mt-1.5 flex flex-wrap gap-1"
          >
            <span
              v-for="effect in p.statusEffects"
              :key="effect"
              class="inline-flex items-center gap-0.5 rounded bg-accent/20 px-1.5 py-0.5 text-[10px] text-accent"
              :title="effect"
            >
              <span>{{ statusIcon(effect) }}</span>
              <span>{{ effect }}</span>
            </span>
          </div>

          <!-- 备注 -->
          <p v-if="p.notes && !compact" class="mt-1 truncate text-[10px] italic text-text-muted/80">
            {{ p.notes }}
          </p>
        </div>
      </div>
    </div>

    <!-- DM 编辑弹窗 -->
    <ParticipantEditor
      v-if="isDM && showEditor"
      :participant="editingParticipant"
      :show="showEditor"
      @close="onEditorClose"
    />
  </div>
</template>

<style scoped>
.participant-card {
  position: relative;
}
</style>
