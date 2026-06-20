<script setup lang="ts">
// 参与者编辑组件：DM 编辑 HP/AC/状态效果/备注，含伤害/治疗快速按钮
import { computed, ref, watch } from 'vue'
import BaseButton from '@/components/common/BaseButton.vue'
import { useCombatStore } from '@/stores/combat'
import { useRoomStore } from '@/stores/room'
import type { CombatParticipant } from '@/types/models'

const props = defineProps<{
  /** 编辑的参与者 */
  participant: CombatParticipant | null
  /** 是否显示 */
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const combatStore = useCombatStore()
const roomStore = useRoomStore()
const { ruleSystem } = roomStore

/** 是否 DND 规则集 */
const isDnd = computed(() => ruleSystem === 'dnd5e')

/** 编辑表单（本地副本，提交时同步到 store） */
const form = ref({
  hp: 0,
  maxHp: 0,
  ac: 0,
  initiative: 0,
  notes: '',
  statusEffects: [] as string[],
})

/** 伤害/治疗输入 */
const damageAmount = ref(0)
/** 新增状态效果输入 */
const newStatusEffect = ref('')

/** 预设状态效果列表（DND + COC 通用） */
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

/** 快速伤害/治疗按钮 */
const QUICK_AMOUNTS = [1, 5, 10, 25]

/** 监听参与者变化，初始化表单 */
watch(
  () => props.participant,
  (p) => {
    if (p) {
      form.value = {
        hp: p.hp,
        maxHp: p.maxHp,
        ac: p.ac ?? 0,
        initiative: p.initiative,
        notes: p.notes ?? '',
        statusEffects: [...p.statusEffects],
      }
      damageAmount.value = 0
      newStatusEffect.value = ''
    }
  },
  { immediate: true },
)

/** 应用伤害 */
function applyDamage(amount: number) {
  if (amount === 0 || !props.participant) return
  const newHp = Math.max(0, form.value.hp - amount)
  form.value.hp = newHp
  combatStore.updateParticipant(props.participant.id, { hp: newHp })
}

/** 应用治疗 */
function applyHealing(amount: number) {
  if (amount === 0 || !props.participant) return
  const newHp = Math.min(form.value.maxHp, form.value.hp + amount)
  form.value.hp = newHp
  combatStore.updateParticipant(props.participant.id, { hp: newHp })
}

/** 提交伤害 */
function submitDamage() {
  if (damageAmount.value > 0) {
    applyDamage(damageAmount.value)
    damageAmount.value = 0
  }
}

/** 提交治疗 */
function submitHealing() {
  if (damageAmount.value > 0) {
    applyHealing(damageAmount.value)
    damageAmount.value = 0
  }
}

/** HP 直接输入 */
function onHpInput(e: Event) {
  const v = parseInt((e.target as HTMLInputElement).value, 10)
  if (!Number.isNaN(v) && props.participant) {
    form.value.hp = v
    combatStore.updateParticipant(props.participant.id, { hp: v })
  }
}

/** 最大 HP 直接输入 */
function onMaxHpInput(e: Event) {
  const v = parseInt((e.target as HTMLInputElement).value, 10)
  if (!Number.isNaN(v) && props.participant) {
    form.value.maxHp = v
    combatStore.updateParticipant(props.participant.id, { maxHp: v })
  }
}

/** AC 直接输入 */
function onAcInput(e: Event) {
  const v = parseInt((e.target as HTMLInputElement).value, 10)
  if (!Number.isNaN(v) && props.participant) {
    form.value.ac = v
    combatStore.updateParticipant(props.participant.id, { ac: v })
  }
}

/** 先攻直接输入 */
function onInitiativeInput(e: Event) {
  const v = parseInt((e.target as HTMLInputElement).value, 10)
  if (!Number.isNaN(v) && props.participant) {
    form.value.initiative = v
    combatStore.updateParticipant(props.participant.id, { initiative: v })
  }
}

/** 备注输入 */
function onNotesInput(e: Event) {
  form.value.notes = (e.target as HTMLTextAreaElement).value
  if (props.participant) {
    combatStore.updateParticipant(props.participant.id, { notes: form.value.notes })
  }
}

/** 添加状态效果 */
function addStatusEffect(effect: string) {
  const trimmed = effect.trim()
  if (!trimmed || !props.participant) return
  if (form.value.statusEffects.includes(trimmed)) return
  form.value.statusEffects.push(trimmed)
  combatStore.updateParticipant(props.participant.id, {
    statusEffects: [...form.value.statusEffects],
  })
  newStatusEffect.value = ''
}

/** 移除状态效果 */
function removeStatusEffect(effect: string) {
  const idx = form.value.statusEffects.indexOf(effect)
  if (idx < 0) return
  form.value.statusEffects.splice(idx, 1)
  if (props.participant) {
    combatStore.updateParticipant(props.participant.id, {
      statusEffects: [...form.value.statusEffects],
    })
  }
}

/** 关闭弹窗 */
function close() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show && participant"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <!-- 遮罩 -->
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="close" />

        <!-- 内容 -->
        <div class="frame-card relative z-10 w-full max-w-md p-6 animate-fade-in">
          <header class="mb-4 flex items-center justify-between">
            <div>
              <h3 class="font-display text-xl font-semibold text-gradient-gold">编辑参与者</h3>
              <p class="mt-0.5 text-xs text-text-muted">{{ participant.name }}</p>
            </div>
            <button class="text-text-muted transition-colors hover:text-danger" @click="close">
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

          <div class="space-y-4">
            <!-- 快速伤害/治疗 -->
            <div class="rounded-md border border-border/50 bg-background/40 p-3">
              <p class="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                快速伤害 / 治疗
              </p>
              <div class="mb-2 flex items-center gap-2">
                <input
                  v-model.number="damageAmount"
                  type="number"
                  min="0"
                  class="input-field flex-1"
                  placeholder="数值"
                />
                <BaseButton size="sm" variant="danger" @click="submitDamage">伤害</BaseButton>
                <BaseButton size="sm" variant="primary" @click="submitHealing">治疗</BaseButton>
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
            </div>

            <!-- HP / MaxHP -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label
                  class="mb-1 block text-xs font-semibold uppercase tracking-widest text-text-muted"
                >
                  当前 HP
                </label>
                <input type="number" class="input-field" :value="form.hp" @change="onHpInput" />
              </div>
              <div>
                <label
                  class="mb-1 block text-xs font-semibold uppercase tracking-widest text-text-muted"
                >
                  最大 HP
                </label>
                <input
                  type="number"
                  class="input-field"
                  :value="form.maxHp"
                  @change="onMaxHpInput"
                />
              </div>
            </div>

            <!-- AC / 先攻 -->
            <div class="grid grid-cols-2 gap-2">
              <div v-if="isDnd">
                <label
                  class="mb-1 block text-xs font-semibold uppercase tracking-widest text-text-muted"
                >
                  AC
                </label>
                <input type="number" class="input-field" :value="form.ac" @change="onAcInput" />
              </div>
              <div :class="isDnd ? '' : 'col-span-2'">
                <label
                  class="mb-1 block text-xs font-semibold uppercase tracking-widest text-text-muted"
                >
                  先攻
                </label>
                <input
                  type="number"
                  class="input-field"
                  :value="form.initiative"
                  @change="onInitiativeInput"
                />
              </div>
            </div>

            <!-- 状态效果 -->
            <div>
              <label
                class="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-text-muted"
              >
                状态效果
              </label>
              <!-- 已有效果 -->
              <div v-if="form.statusEffects.length > 0" class="mb-2 flex flex-wrap gap-1">
                <span
                  v-for="effect in form.statusEffects"
                  :key="effect"
                  class="inline-flex items-center gap-1 rounded bg-accent/20 px-1.5 py-0.5 text-[10px] text-accent"
                >
                  {{ effect }}
                  <button
                    class="ml-0.5 text-accent/70 hover:text-danger"
                    @click="removeStatusEffect(effect)"
                  >
                    ×
                  </button>
                </span>
              </div>
              <!-- 预设效果 -->
              <div class="mb-2 flex flex-wrap gap-1">
                <button
                  v-for="preset in PRESET_STATUS_EFFECTS"
                  :key="preset"
                  class="rounded border border-border/40 bg-background/40 px-1.5 py-0.5 text-[10px] text-text-muted transition-colors hover:border-primary/40 hover:text-primary"
                  :class="
                    form.statusEffects.includes(preset)
                      ? 'border-primary/60 bg-primary/10 text-primary'
                      : ''
                  "
                  @click="addStatusEffect(preset)"
                >
                  + {{ preset }}
                </button>
              </div>
              <!-- 自定义输入 -->
              <div class="flex gap-1">
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
            </div>

            <!-- 备注 -->
            <div>
              <label
                class="mb-1 block text-xs font-semibold uppercase tracking-widest text-text-muted"
              >
                备注
              </label>
              <textarea
                class="input-field min-h-[60px] resize-y text-xs"
                :value="form.notes"
                placeholder="DM 备注（仅自己可见）"
                @input="onNotesInput"
              />
            </div>
          </div>

          <footer class="mt-5 flex justify-end gap-3">
            <BaseButton variant="ghost" @click="close">关闭</BaseButton>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
