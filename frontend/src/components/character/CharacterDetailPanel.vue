<script setup lang="ts">
// DM 角色详情面板：点击侧边栏角色时展开，显示完整信息与快速操作
// 可折叠/展开，支持伤害/治疗/添加状态等快速操作
import { computed, ref, watch } from 'vue'
import BaseButton from '@/components/common/BaseButton.vue'
import StatBar from '@/components/common/StatBar.vue'
import { useCharacterStore } from '@/stores/character'
import { useCombatStore } from '@/stores/combat'
import type { Character } from '@/types/models'
import type { CombatParticipant } from '@/types/models'

const props = defineProps<{
  /** 当前查看的角色 */
  character: Character | null
  /** 是否显示 */
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const characterStore = useCharacterStore()
const combatStore = useCombatStore()

/** 是否 DND 规则集 */
const isDnd = computed(() => props.character?.ruleSet === 'dnd5e')
/** 是否 COC 规则集 */
const isCoc = computed(() => props.character?.ruleSet === 'coc7')

/** 立绘 URL */
const portraitUrl = computed(() => {
  if (!props.character?.portraitUrl) return ''
  if (props.character.portraitUrl.startsWith('http')) return props.character.portraitUrl
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  return `${apiBase}${props.character.portraitUrl}`
})

/** 从 data 中安全读取数值 */
function getNum(key: string): number {
  const v = props.character?.data[key]
  return typeof v === 'number' ? v : 0
}

/** 从 data 中安全读取字符串 */
function getStr(key: string): string {
  const v = props.character?.data[key]
  return typeof v === 'string' ? v : ''
}

/** HP 相关 */
const hp = computed(() => getNum('hp'))
const maxHp = computed(() => getNum('maxHp') || 1)
const ac = computed(() => getNum('ac'))
const speed = computed(() => getNum('speed'))
const initiative = computed(() => getNum('initiative'))
const proficiencyBonus = computed(() => getNum('proficiencyBonus'))

/** SAN/MP（COC） */
const san = computed(() => getNum('san'))
const maxSan = computed(() => getNum('maxSan') || 99)
const mp = computed(() => getNum('mp'))
const maxMp = computed(() => getNum('maxMp') || 1)
const luck = computed(() => getNum('luck'))
const db = computed(() => getNum('db'))
const build = computed(() => getNum('build'))
const mov = computed(() => getNum('mov'))

/** DND 属性 */
const dndAttrs = computed(() => {
  if (!isDnd.value || !props.character) return []
  const d = props.character.data
  const attrs: { key: string; label: string; value: number; mod: number }[] = [
    { key: 'str', label: '力量', value: getNum('str'), mod: getNum('strMod') },
    { key: 'dex', label: '敏捷', value: getNum('dex'), mod: getNum('dexMod') },
    { key: 'con', label: '体质', value: getNum('con'), mod: getNum('conMod') },
    { key: 'int', label: '智力', value: getNum('int'), mod: getNum('intMod') },
    { key: 'wis', label: '感知', value: getNum('wis'), mod: getNum('wisMod') },
    { key: 'cha', label: '魅力', value: getNum('cha'), mod: getNum('chaMod') },
  ]
  // 过滤掉全为 0 的属性（避免空数据时显示一堆 0）
  return attrs.filter((a) => a.value !== 0 || d[a.key] !== undefined)
})

/** COC 核心属性 */
const cocAttrs = computed(() => {
  if (!isCoc.value || !props.character) return []
  const d = props.character.data
  const attrs: { key: string; label: string; value: number }[] = [
    { key: 'str', label: '力量', value: getNum('str') },
    { key: 'con', label: '体质', value: getNum('con') },
    { key: 'siz', label: '体型', value: getNum('siz') },
    { key: 'dex', label: '敏捷', value: getNum('dex') },
    { key: 'app', label: '外貌', value: getNum('app') },
    { key: 'int', label: '智力', value: getNum('int') },
    { key: 'pow', label: '意志', value: getNum('pow') },
    { key: 'edu', label: '教育', value: getNum('edu') },
  ]
  return attrs.filter((a) => a.value !== 0 || d[a.key] !== undefined)
})

/** 角色基本信息 */
const charInfo = computed(() => {
  if (!props.character) return [] as { label: string; value: string }[]
  if (isDnd.value) {
    return [
      { label: '职业', value: getStr('class') || '-' },
      { label: '种族', value: getStr('race') || '-' },
      { label: '背景', value: getStr('background') || '-' },
      { label: '阵营', value: getStr('alignment') || '-' },
    ].filter((i) => i.value !== '-')
  }
  return [
    { label: '职业', value: getStr('occupation') || '-' },
    { label: '年龄', value: getNum('age') ? String(getNum('age')) : '-' },
    { label: '性别', value: getStr('sex') || '-' },
    { label: '居住地', value: getStr('residence') || '-' },
  ].filter((i) => i.value !== '-')
})

/** 关联的战斗参与者（用于读取/更新状态效果） */
const combatParticipant = computed<CombatParticipant | null>(() => {
  if (!props.character) return null
  return combatStore.participants.find((p) => p.characterId === props.character?.id) ?? null
})

/** 状态效果列表（优先战斗参与者，其次角色数据） */
const statusEffects = computed<string[]>(() => {
  if (combatParticipant.value) return combatParticipant.value.statusEffects
  return []
})

/** 是否死亡 */
const isDead = computed(() => hp.value <= 0)

// ===== 折叠状态 =====
const expandedSections = ref({
  attrs: true,
  combat: true,
  status: true,
  background: false,
})

function toggleSection(key: keyof typeof expandedSections.value) {
  expandedSections.value[key] = !expandedSections.value[key]
}

// ===== 快速操作 =====
/** 伤害/治疗输入 */
const damageAmount = ref(0)
/** 新增状态效果输入 */
const newStatusEffect = ref('')

/** 快速数值按钮 */
const QUICK_AMOUNTS = [1, 5, 10, 25]

/** 预设状态效果 */
const PRESET_STATUS_EFFECTS = [
  '中毒',
  '眩晕',
  '麻痹',
  '恐惧',
  '倒地',
  '昏迷',
  '目盲',
  '耳聋',
  '魅惑',
  '束缚',
  '隐形',
  '燃烧',
  '冻结',
  '祝福',
  '加速',
  'SAN 损失',
  '临时疯狂',
  '永久疯狂',
]

/** 状态效果图标映射 */
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

function statusIcon(effect: string): string {
  return STATUS_ICONS[effect.toLowerCase()] ?? '•'
}

/** 应用伤害：更新角色卡 data.hp */
function applyDamage(amount: number) {
  if (amount <= 0 || !props.character) return
  const newHp = Math.max(0, hp.value - amount)
  characterStore.updateCharacterData(props.character.id, { hp: newHp })
  // 同步战斗参与者
  if (combatParticipant.value) {
    combatStore.updateParticipant(combatParticipant.value.id, { hp: newHp })
  }
  damageAmount.value = 0
}

/** 应用治疗：更新角色卡 data.hp */
function applyHealing(amount: number) {
  if (amount <= 0 || !props.character) return
  const newHp = Math.min(maxHp.value, hp.value + amount)
  characterStore.updateCharacterData(props.character.id, { hp: newHp })
  if (combatParticipant.value) {
    combatStore.updateParticipant(combatParticipant.value.id, { hp: newHp })
  }
  damageAmount.value = 0
}

/** 添加状态效果 */
function addStatusEffect(effect: string) {
  const trimmed = effect.trim()
  if (!trimmed || !combatParticipant.value) return
  if (statusEffects.value.includes(trimmed)) return
  const next = [...statusEffects.value, trimmed]
  combatStore.updateParticipant(combatParticipant.value.id, { statusEffects: next })
  newStatusEffect.value = ''
}

/** 移除状态效果 */
function removeStatusEffect(effect: string) {
  if (!combatParticipant.value) return
  const next = statusEffects.value.filter((e) => e !== effect)
  combatStore.updateParticipant(combatParticipant.value.id, { statusEffects: next })
}

/** 关闭面板 */
function close() {
  emit('close')
}

// 当切换角色时重置折叠状态
watch(
  () => props.character?.id,
  () => {
    damageAmount.value = 0
    newStatusEffect.value = ''
  },
)
</script>

<template>
  <Teleport to="body">
    <Transition name="detail-slide">
      <div v-if="show && character" class="fixed inset-0 z-40 flex justify-end">
        <!-- 遮罩 -->
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="close" />

        <!-- 面板主体 -->
        <div
          class="frame-card relative z-10 h-full w-full max-w-md overflow-auto rounded-none p-5 animate-slide-in-right"
        >
          <!-- 头部 -->
          <header class="mb-4 flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <!-- 立绘大图 -->
              <div
                class="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border-2 border-primary/60 bg-background/60"
                :class="isDead ? 'animate-death-fade' : ''"
              >
                <img
                  v-if="portraitUrl"
                  :src="portraitUrl"
                  :alt="character.name"
                  class="h-full w-full object-cover"
                />
                <span v-else class="font-display text-2xl text-text-muted">
                  {{ character.name.charAt(0) }}
                </span>
                <span
                  v-if="isDead"
                  class="absolute inset-0 flex items-center justify-center bg-black/70 text-2xl"
                >
                  💀
                </span>
              </div>
              <div class="min-w-0">
                <h3 class="truncate font-display text-xl font-semibold text-gradient-gold">
                  {{ character.name }}
                </h3>
                <p class="mt-0.5 text-xs text-text-muted">
                  {{ isDnd ? 'DND 5E' : 'COC 7版' }}
                  <span v-if="character.isNpc" class="ml-1 rounded bg-accent/20 px-1 text-accent">
                    NPC
                  </span>
                  <span v-if="isDead" class="ml-1 rounded bg-danger/30 px-1 text-danger">
                    已倒下
                  </span>
                </p>
              </div>
            </div>
            <button
              class="shrink-0 text-text-muted transition-colors hover:text-danger"
              aria-label="关闭"
              @click="close"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </header>

          <!-- 快速操作区 -->
          <section class="mb-4 rounded-md border border-border/50 bg-background/40 p-3">
            <p class="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
              快速操作
            </p>
            <div class="mb-2 flex items-center gap-2">
              <input
                v-model.number="damageAmount"
                type="number"
                min="0"
                class="input-field flex-1 text-sm"
                placeholder="输入数值"
              />
              <BaseButton size="sm" variant="danger" @click="applyDamage(damageAmount)">
                伤害
              </BaseButton>
              <BaseButton size="sm" variant="primary" @click="applyHealing(damageAmount)">
                治疗
              </BaseButton>
            </div>
            <div class="flex flex-wrap gap-1">
              <button
                v-for="amt in QUICK_AMOUNTS"
                :key="`d-${amt}`"
                class="rounded border border-danger/40 bg-danger/10 px-2 py-0.5 text-[10px] text-danger transition-colors hover:bg-danger/20"
                @click="applyDamage(amt)"
              >
                -{{ amt }}
              </button>
              <span class="mx-1 text-text-muted">|</span>
              <button
                v-for="amt in QUICK_AMOUNTS"
                :key="`h-${amt}`"
                class="rounded border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] text-success transition-colors hover:bg-success/20"
                @click="applyHealing(amt)"
              >
                +{{ amt }}
              </button>
            </div>
          </section>

          <!-- 战斗数据 -->
          <section class="mb-4">
            <button
              class="flex w-full items-center justify-between rounded-md border border-border/50 bg-surface/40 px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-primary transition-colors hover:bg-surface/70"
              @click="toggleSection('combat')"
            >
              <span>战斗数据</span>
              <span
                class="transition-transform"
                :class="expandedSections.combat ? 'rotate-90' : ''"
              >
                ▶
              </span>
            </button>
            <div v-show="expandedSections.combat" class="mt-2 space-y-2 px-1">
              <!-- HP 条 -->
              <StatBar :value="hp" :max="maxHp" label="HP" variant="hp" :height="14" />
              <!-- SAN 条（COC） -->
              <StatBar
                v-if="isCoc"
                :value="san"
                :max="maxSan"
                label="SAN"
                variant="san"
                :height="14"
              />
              <!-- MP 条（COC） -->
              <StatBar
                v-if="isCoc"
                :value="mp"
                :max="maxMp"
                label="MP"
                variant="custom"
                color="rgb(59 130 246)"
                :height="12"
              />

              <!-- 数值网格 -->
              <div class="grid grid-cols-3 gap-2 text-xs">
                <div
                  class="rounded border border-border/40 bg-background/40 px-2 py-1.5 text-center"
                >
                  <p class="text-[9px] uppercase tracking-wider text-text-muted">HP</p>
                  <p class="font-mono font-bold text-text">{{ hp }}/{{ maxHp }}</p>
                </div>
                <div
                  v-if="isDnd"
                  class="rounded border border-border/40 bg-background/40 px-2 py-1.5 text-center"
                >
                  <p class="text-[9px] uppercase tracking-wider text-text-muted">AC</p>
                  <p class="font-mono font-bold text-text">{{ ac || '-' }}</p>
                </div>
                <div
                  v-if="isDnd"
                  class="rounded border border-border/40 bg-background/40 px-2 py-1.5 text-center"
                >
                  <p class="text-[9px] uppercase tracking-wider text-text-muted">速度</p>
                  <p class="font-mono font-bold text-text">{{ speed || '-' }}</p>
                </div>
                <div
                  v-if="isDnd"
                  class="rounded border border-border/40 bg-background/40 px-2 py-1.5 text-center"
                >
                  <p class="text-[9px] uppercase tracking-wider text-text-muted">先攻</p>
                  <p class="font-mono font-bold text-text">
                    {{ initiative >= 0 ? '+' : '' }}{{ initiative || 0 }}
                  </p>
                </div>
                <div
                  v-if="isDnd"
                  class="rounded border border-border/40 bg-background/40 px-2 py-1.5 text-center"
                >
                  <p class="text-[9px] uppercase tracking-wider text-text-muted">熟练</p>
                  <p class="font-mono font-bold text-text">+{{ proficiencyBonus || 0 }}</p>
                </div>
                <div
                  v-if="isCoc"
                  class="rounded border border-border/40 bg-background/40 px-2 py-1.5 text-center"
                >
                  <p class="text-[9px] uppercase tracking-wider text-text-muted">幸运</p>
                  <p class="font-mono font-bold text-text">{{ luck || '-' }}</p>
                </div>
                <div
                  v-if="isCoc"
                  class="rounded border border-border/40 bg-background/40 px-2 py-1.5 text-center"
                >
                  <p class="text-[9px] uppercase tracking-wider text-text-muted">DB</p>
                  <p class="font-mono font-bold text-text">{{ db >= 0 ? '+' : '' }}{{ db || 0 }}</p>
                </div>
                <div
                  v-if="isCoc"
                  class="rounded border border-border/40 bg-background/40 px-2 py-1.5 text-center"
                >
                  <p class="text-[9px] uppercase tracking-wider text-text-muted">体格</p>
                  <p class="font-mono font-bold text-text">{{ build || 0 }}</p>
                </div>
                <div
                  v-if="isCoc"
                  class="rounded border border-border/40 bg-background/40 px-2 py-1.5 text-center"
                >
                  <p class="text-[9px] uppercase tracking-wider text-text-muted">MOV</p>
                  <p class="font-mono font-bold text-text">{{ mov || '-' }}</p>
                </div>
              </div>
            </div>
          </section>

          <!-- 状态效果 -->
          <section class="mb-4">
            <button
              class="flex w-full items-center justify-between rounded-md border border-border/50 bg-surface/40 px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-primary transition-colors hover:bg-surface/70"
              @click="toggleSection('status')"
            >
              <span>状态效果 ({{ statusEffects.length }})</span>
              <span
                class="transition-transform"
                :class="expandedSections.status ? 'rotate-90' : ''"
              >
                ▶
              </span>
            </button>
            <div v-show="expandedSections.status" class="mt-2 space-y-2 px-1">
              <!-- 已有效果 -->
              <div v-if="statusEffects.length > 0" class="flex flex-wrap gap-1">
                <span
                  v-for="(effect, idx) in statusEffects"
                  :key="`${effect}-${idx}`"
                  class="inline-flex items-center gap-1 rounded bg-accent/20 px-2 py-0.5 text-[11px] text-accent animate-status-pop"
                >
                  <span>{{ statusIcon(effect) }}</span>
                  <span>{{ effect }}</span>
                  <button
                    class="ml-0.5 text-accent/70 hover:text-danger"
                    @click="removeStatusEffect(effect)"
                  >
                    ×
                  </button>
                </span>
              </div>
              <p v-else class="text-xs text-text-muted">暂无状态效果</p>

              <!-- 预设效果（仅战斗中可用） -->
              <template v-if="combatParticipant">
                <p class="mt-2 text-[10px] uppercase tracking-widest text-text-muted">预设</p>
                <div class="flex flex-wrap gap-1">
                  <button
                    v-for="preset in PRESET_STATUS_EFFECTS"
                    :key="preset"
                    class="rounded border border-border/40 bg-background/40 px-1.5 py-0.5 text-[10px] text-text-muted transition-colors hover:border-primary/40 hover:text-primary"
                    :class="
                      statusEffects.includes(preset)
                        ? 'border-primary/60 bg-primary/10 text-primary'
                        : ''
                    "
                    @click="addStatusEffect(preset)"
                  >
                    + {{ preset }}
                  </button>
                </div>
                <!-- 自定义输入 -->
                <div class="mt-2 flex gap-1">
                  <input
                    v-model="newStatusEffect"
                    class="input-field flex-1 text-xs"
                    placeholder="自定义状态效果"
                    maxlength="20"
                    @keyup.enter="addStatusEffect(newStatusEffect)"
                  />
                  <BaseButton size="sm" variant="ghost" @click="addStatusEffect(newStatusEffect)">
                    添加
                  </BaseButton>
                </div>
              </template>
              <p v-else class="mt-1 text-[10px] italic text-text-muted/70">
                * 角色未参与战斗，状态效果需在战斗中管理
              </p>
            </div>
          </section>

          <!-- 属性 -->
          <section v-if="dndAttrs.length || cocAttrs.length" class="mb-4">
            <button
              class="flex w-full items-center justify-between rounded-md border border-border/50 bg-surface/40 px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-primary transition-colors hover:bg-surface/70"
              @click="toggleSection('attrs')"
            >
              <span>属性</span>
              <span class="transition-transform" :class="expandedSections.attrs ? 'rotate-90' : ''">
                ▶
              </span>
            </button>
            <div v-show="expandedSections.attrs" class="mt-2 px-1">
              <!-- DND 属性 -->
              <div v-if="isDnd" class="grid grid-cols-3 gap-2">
                <div
                  v-for="attr in dndAttrs"
                  :key="attr.key"
                  class="rounded border border-border/40 bg-background/40 px-2 py-1.5 text-center"
                >
                  <p class="text-[9px] uppercase tracking-wider text-text-muted">
                    {{ attr.label }}
                  </p>
                  <p class="font-display text-lg font-bold text-text">{{ attr.value }}</p>
                  <p class="font-mono text-[10px] text-primary">
                    {{ attr.mod >= 0 ? '+' : '' }}{{ attr.mod }}
                  </p>
                </div>
              </div>
              <!-- COC 属性 -->
              <div v-else class="grid grid-cols-4 gap-2">
                <div
                  v-for="attr in cocAttrs"
                  :key="attr.key"
                  class="rounded border border-border/40 bg-background/40 px-2 py-1.5 text-center"
                >
                  <p class="text-[9px] uppercase tracking-wider text-text-muted">
                    {{ attr.label }}
                  </p>
                  <p class="font-display text-base font-bold text-text">{{ attr.value }}</p>
                </div>
              </div>
            </div>
          </section>

          <!-- 背景信息 -->
          <section v-if="charInfo.length" class="mb-4">
            <button
              class="flex w-full items-center justify-between rounded-md border border-border/50 bg-surface/40 px-3 py-2 text-left text-xs font-semibold uppercase tracking-widest text-primary transition-colors hover:bg-surface/70"
              @click="toggleSection('background')"
            >
              <span>背景信息</span>
              <span
                class="transition-transform"
                :class="expandedSections.background ? 'rotate-90' : ''"
              >
                ▶
              </span>
            </button>
            <div v-show="expandedSections.background" class="mt-2 space-y-1.5 px-1">
              <div
                v-for="info in charInfo"
                :key="info.label"
                class="flex items-center justify-between rounded border border-border/40 bg-background/40 px-2 py-1 text-xs"
              >
                <span class="text-text-muted">{{ info.label }}</span>
                <span class="font-semibold text-text">{{ info.value }}</span>
              </div>
            </div>
          </section>

          <!-- 底部关闭按钮 -->
          <footer class="mt-6 flex justify-end">
            <BaseButton variant="ghost" @click="close">关闭</BaseButton>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.detail-slide-enter-active,
.detail-slide-leave-active {
  transition: opacity 0.25s ease;
}
.detail-slide-enter-from,
.detail-slide-leave-to {
  opacity: 0;
}
</style>
