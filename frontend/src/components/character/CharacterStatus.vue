<script setup lang="ts">
// 角色状态条组件：用于侧边栏显示角色状态（立绘缩略图、名字、HP/SAN 条）
// 支持 HP/SAN 变化动画、状态效果图标、死亡灰度、点击展开
import { computed, ref, watch } from 'vue'
import type { Character } from '@/types/models'
import StatBar from '@/components/common/StatBar.vue'

const props = withDefaults(
  defineProps<{
    character: Character
    /** 是否紧凑模式（侧边栏用） */
    compact?: boolean
    /** 是否显示玩家名 */
    showPlayerName?: boolean
    /** 玩家名（可选） */
    playerName?: string
    /** 状态效果列表（来自战斗参与者，可选） */
    statusEffects?: string[]
    /** 是否为当前战斗回合 */
    isCurrentTurn?: boolean
    /** 是否可点击（DM 视角） */
    clickable?: boolean
    /** 是否在线 */
    isOnline?: boolean
  }>(),
  {
    compact: false,
    showPlayerName: false,
    playerName: '',
    statusEffects: () => [],
    isCurrentTurn: false,
    clickable: false,
    isOnline: true,
  },
)

const emit = defineEmits<{
  click: [character: Character]
}>()

/** 规则集是否为 COC */
const isCoc = computed(() => props.character.ruleSet === 'coc7')

/** 立绘 URL */
const portraitUrl = computed(() => {
  if (!props.character.portraitUrl) return ''
  if (props.character.portraitUrl.startsWith('http')) return props.character.portraitUrl
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  return `${apiBase}${props.character.portraitUrl}`
})

/** 从 data 中安全读取数值 */
function getNum(key: string): number {
  const v = props.character.data[key]
  return typeof v === 'number' ? v : 0
}

/** HP 相关 */
const hp = computed(() => getNum('hp'))
const maxHp = computed(() => getNum('maxHp') || 1)

/** SAN 相关（COC） */
const san = computed(() => getNum('san'))
const maxSan = computed(() => getNum('maxSan') || 99)

/** MP 相关（COC） */
const mp = computed(() => getNum('mp'))
const maxMp = computed(() => getNum('maxMp') || 1)

/** AC（DND） */
const ac = computed(() => getNum('ac'))

/** 等级（DND） */
const level = computed(() => getNum('level'))

/** HP 百分比 */
const hpPercent = computed(() => {
  if (maxHp.value <= 0) return 0
  return Math.max(0, Math.min(100, (hp.value / maxHp.value) * 100))
})

/** HP 状态等级（按任务要求：绿>50% / 黄 25-50% / 红<25%） */
const hpStatus = computed(() => {
  if (hp.value <= 0) return 'dead'
  if (hpPercent.value > 50) return 'healthy'
  if (hpPercent.value >= 25) return 'wounded'
  return 'critical'
})

/** 是否死亡 */
const isDead = computed(() => hp.value <= 0)

/** 是否 NPC */
const isNpc = computed(() => props.character.isNpc)

/** 角色名 */
const charName = computed(() => props.character.name || '未命名角色')

// ===== 动画状态检测 =====
/** HP 变化动画类 */
const hpAnimClass = ref('')
/** SAN 变化动画类 */
const sanAnimClass = ref('')

/** 监听 HP 变化触发动画 */
watch(
  hp,
  (newVal, oldVal) => {
    if (oldVal === undefined || newVal === oldVal) return
    if (newVal < oldVal) {
      hpAnimClass.value = 'animate-hp-damage'
    } else if (newVal > oldVal) {
      hpAnimClass.value = 'animate-hp-heal'
    }
    // 动画结束后清除类
    window.setTimeout(() => {
      hpAnimClass.value = ''
    }, 1000)
  },
  { flush: 'post' },
)

/** 监听 SAN 变化触发动画 */
watch(
  san,
  (newVal, oldVal) => {
    if (oldVal === undefined || newVal === oldVal) return
    if (newVal < oldVal) {
      sanAnimClass.value = 'animate-san-loss'
      window.setTimeout(() => {
        sanAnimClass.value = ''
      }, 1200)
    }
  },
  { flush: 'post' },
)

/** 状态效果图标映射（DND + COC 通用） */
const STATUS_ICONS: Record<string, string> = {
  poisoned: '☠',
  中毒: '☠',
  stunned: '💫',
  眩晕: '💫',
  paralyzed: '⛓',
  麻痹: '⛓',
  frightened: '😱',
  恐惧: '😱',
  prone: '🛑',
  倒地: '🛑',
  unconscious: '💤',
  昏迷: '💤',
  blinded: '🌑',
  目盲: '🌑',
  deafened: '🔇',
  耳聋: '🔇',
  charmed: '💖',
  魅惑: '💖',
  restrained: '🪢',
  束缚: '🪢',
  invisible: '👻',
  隐形: '👻',
  burning: '🔥',
  燃烧: '🔥',
  frozen: '❄',
  冻结: '❄',
  blessed: '✨',
  祝福: '✨',
  haste: '⚡',
  加速: '⚡',
  'san-loss': '🧠',
  'san 损失': '🧠',
  'temporary-insanity': '🌀',
  临时疯狂: '🌀',
  'indefinite-insanity': '🌫',
  永久疯狂: '🌫',
}

/** 获取状态效果图标 */
function statusIcon(effect: string): string {
  return STATUS_ICONS[effect.toLowerCase()] ?? '•'
}

/** 点击事件 */
function onClick() {
  if (props.clickable) {
    emit('click', props.character)
  }
}
</script>

<template>
  <div
    class="character-status group relative rounded-md border p-2 transition-all duration-200"
    :class="[
      compact ? 'space-y-1.5' : 'space-y-2',
      isCurrentTurn
        ? 'border-primary bg-primary/10 shadow-glow ring-1 ring-primary/40'
        : 'border-border/50 bg-surface/40 hover:border-primary/40 hover:bg-surface/70',
      clickable ? 'cursor-pointer' : '',
      isDead ? 'animate-death-fade' : '',
    ]"
    @click="onClick"
  >
    <!-- 当前回合指示器 -->
    <div
      v-if="isCurrentTurn"
      class="absolute -left-0.5 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-primary animate-glow-pulse"
    />

    <div class="flex items-start gap-2">
      <!-- 立绘缩略图（圆形） -->
      <div class="relative shrink-0">
        <div
          class="flex items-center justify-center overflow-hidden rounded-full border border-border/60 bg-background/60"
          :class="compact ? 'h-9 w-9' : 'h-12 w-12'"
        >
          <img
            v-if="portraitUrl"
            :src="portraitUrl"
            :alt="charName"
            class="h-full w-full object-cover"
          />
          <span v-else class="font-display text-sm text-text-muted">
            {{ charName.charAt(0) }}
          </span>
        </div>
        <!-- NPC 标识 -->
        <span
          v-if="isNpc"
          class="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[8px] font-bold text-text"
          title="NPC"
        >
          N
        </span>
        <!-- HP 状态点 -->
        <span
          v-else
          class="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-surface"
          :class="{
            'bg-success': hpStatus === 'healthy',
            'bg-warning': hpStatus === 'wounded',
            'bg-danger': hpStatus === 'critical',
            'bg-text-muted': hpStatus === 'dead',
          }"
        />
        <!-- 在线状态点 -->
        <span
          v-if="!isNpc"
          class="absolute -bottom-0.5 -right-0.5 inline-block h-2.5 w-2.5 rounded-full border-2 border-surface"
          :class="isOnline ? 'bg-success' : 'bg-text-muted/40'"
          :title="isOnline ? '在线' : '离线'"
        />
        <!-- 死亡图标 -->
        <span
          v-if="isDead"
          class="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-base"
          title="已倒下"
        >
          💀
        </span>
      </div>

      <!-- 名字与状态 -->
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1">
          <p class="truncate text-sm font-semibold text-text">{{ charName }}</p>
          <span
            v-if="isDead"
            class="shrink-0 rounded bg-danger/30 px-1 text-[9px] font-bold text-danger"
          >
            倒下
          </span>
        </div>
        <p v-if="showPlayerName && playerName" class="truncate text-[10px] text-text-muted">
          {{ playerName }}
        </p>
        <div class="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-text-muted">
          <!-- DND 标签 -->
          <template v-if="!isCoc">
            <span v-if="level" class="rounded bg-primary/15 px-1 text-primary">
              Lv.{{ level }}
            </span>
            <span v-if="ac" class="rounded bg-surface px-1">AC {{ ac }}</span>
          </template>
          <!-- COC 标签 -->
          <template v-else>
            <span class="rounded bg-success/15 px-1 text-success">SAN {{ san }}/{{ maxSan }}</span>
          </template>
        </div>
      </div>
    </div>

    <!-- HP 条（带动画） -->
    <div class="rounded" :class="hpAnimClass">
      <StatBar
        :value="hp"
        :max="maxHp"
        label="HP"
        variant="hp"
        :height="compact ? 8 : 12"
        :show-text="!compact"
      />
    </div>

    <!-- SAN 条（仅 COC，诡异绿色，带波纹动画） -->
    <div v-if="isCoc" class="rounded" :class="sanAnimClass">
      <StatBar
        :value="san"
        :max="maxSan"
        label="SAN"
        variant="san"
        :height="compact ? 8 : 12"
        :show-text="!compact"
      />
    </div>

    <!-- MP 条（仅 COC，蓝色，非紧凑模式） -->
    <StatBar
      v-if="isCoc && !compact"
      :value="mp"
      :max="maxMp"
      label="MP"
      variant="custom"
      color="rgb(59 130 246)"
      :height="10"
    />

    <!-- 状态效果图标 -->
    <div v-if="statusEffects.length > 0" class="flex flex-wrap gap-1">
      <span
        v-for="(effect, idx) in statusEffects"
        :key="`${effect}-${idx}`"
        class="inline-flex items-center gap-0.5 rounded bg-accent/20 px-1.5 py-0.5 text-[10px] text-accent animate-status-pop"
        :title="effect"
        :style="{ animationDelay: `${idx * 0.05}s` }"
      >
        <span>{{ statusIcon(effect) }}</span>
        <span>{{ effect }}</span>
      </span>
    </div>
  </div>
</template>
