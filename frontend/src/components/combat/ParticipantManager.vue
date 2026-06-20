<script setup lang="ts">
// 参与者管理组件：DM 添加/移除战斗参与者，支持选择已有角色或手动输入
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'
import { useCombatStore } from '@/stores/combat'
import { useCharacterStore } from '@/stores/character'
import { useRoomStore } from '@/stores/room'
import { useLogStore } from '@/stores/log'
import type { Character } from '@/types/models'
import type { CombatAddParticipantPayload } from '@/types/socket'

const combatStore = useCombatStore()
const characterStore = useCharacterStore()
const roomStore = useRoomStore()
const logStore = useLogStore()

const { participants, isActive } = storeToRefs(combatStore)
const { roomCharacters } = storeToRefs(characterStore)
const { ruleSystem } = storeToRefs(roomStore)

/** 添加模式：'select' 选择角色 | 'manual' 手动输入 */
const addMode = ref<'select' | 'manual'>('select')

/** 选中的角色 ID 列表 */
const selectedCharacterIds = ref<string[]>([])

/** 手动输入表单 */
const manualForm = ref({
  name: '',
  type: 'npc' as 'player' | 'npc',
  initiative: 10,
  hp: 10,
  maxHp: 10,
  ac: 10,
})

/** 是否 DND 规则集 */
const isDnd = computed(() => ruleSystem.value === 'dnd5e')

/** 已加入战斗的角色 ID 集合 */
const participantCharacterIds = computed(() => {
  const set = new Set<string>()
  participants.value.forEach((p) => {
    if (p.characterId) set.add(p.characterId)
  })
  return set
})

/** 可选角色（房间内所有角色，区分玩家与 NPC） */
const selectableCharacters = computed<Character[]>(() => {
  return roomCharacters.value.filter((c) => !participantCharacterIds.value.has(c.id))
})

/** 玩家角色 */
const playerCharacters = computed(() => selectableCharacters.value.filter((c) => !c.isNpc))

/** NPC */
const npcCharacters = computed(() => selectableCharacters.value.filter((c) => c.isNpc))

/** 从角色卡读取数值 */
function getCharNum(c: Character, key: string): number {
  const v = c.data[key]
  return typeof v === 'number' ? v : 0
}

/** 切换角色选中 */
function toggleCharacter(id: string) {
  const idx = selectedCharacterIds.value.indexOf(id)
  if (idx >= 0) {
    selectedCharacterIds.value.splice(idx, 1)
  } else {
    selectedCharacterIds.value.push(id)
  }
}

/** 批量添加房间内所有角色 */
function addAllCharacters() {
  if (!isActive.value) {
    logStore.addLog('system', '请先发起战斗')
    return
  }
  selectableCharacters.value.forEach((c) => {
    const payload = buildPayloadFromCharacter(c)
    combatStore.addParticipant(payload)
  })
  selectedCharacterIds.value = []
}

/** 根据角色构造参与者载荷 */
function buildPayloadFromCharacter(c: Character): CombatAddParticipantPayload {
  const hp = getCharNum(c, 'hp') || 10
  const maxHp = getCharNum(c, 'maxHp') || hp
  const ac = getCharNum(c, 'ac') || undefined
  const initiative = getCharNum(c, 'initiative') || 10
  return {
    characterId: c.id,
    name: c.name,
    type: c.isNpc ? 'npc' : 'player',
    initiative,
    hp,
    maxHp,
    ac: isDnd.value ? ac : undefined,
    statusEffects: [],
  }
}

/** 提交选中角色 */
function submitSelected() {
  if (!isActive.value) {
    logStore.addLog('system', '请先发起战斗')
    return
  }
  if (selectedCharacterIds.value.length === 0) return
  selectedCharacterIds.value.forEach((id) => {
    const c = roomCharacters.value.find((rc) => rc.id === id)
    if (!c) return
    const payload = buildPayloadFromCharacter(c)
    combatStore.addParticipant(payload)
  })
  selectedCharacterIds.value = []
}

/** 提交手动输入 */
function submitManual() {
  if (!isActive.value) {
    logStore.addLog('system', '请先发起战斗')
    return
  }
  if (!manualForm.value.name.trim()) {
    logStore.addLog('system', '请输入参与者名字')
    return
  }
  const payload: CombatAddParticipantPayload = {
    name: manualForm.value.name.trim(),
    type: manualForm.value.type,
    initiative: manualForm.value.initiative,
    hp: manualForm.value.hp,
    maxHp: manualForm.value.maxHp || manualForm.value.hp,
    ac: isDnd.value ? manualForm.value.ac : undefined,
    statusEffects: [],
  }
  combatStore.addParticipant(payload)
  // 重置部分字段
  manualForm.value.name = ''
  manualForm.value.hp = 10
  manualForm.value.maxHp = 10
}

/** 移除参与者 */
function removeParticipant(participantId: string, name: string) {
  if (window.confirm(`确定移除参与者「${name}」吗？`)) {
    combatStore.removeParticipant(participantId)
  }
}

/** 数值输入处理 */
function onNumberInput(e: Event, field: keyof typeof manualForm.value) {
  const v = parseInt((e.target as HTMLInputElement).value, 10)
  if (!Number.isNaN(v)) {
    ;(manualForm.value as Record<string, unknown>)[field] = v
  }
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- 战斗未开始提示 -->
    <div
      v-if="!isActive"
      class="border-b border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning"
    >
      请先在「回合控制」中发起战斗，再添加参与者
    </div>

    <!-- 模式切换 -->
    <div class="flex gap-1 border-b border-border/50 px-3 py-2">
      <button
        class="flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
        :class="
          addMode === 'select' ? 'bg-primary/20 text-primary' : 'text-text-muted hover:text-text'
        "
        @click="addMode = 'select'"
      >
        选择角色
      </button>
      <button
        class="flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
        :class="
          addMode === 'manual' ? 'bg-primary/20 text-primary' : 'text-text-muted hover:text-text'
        "
        @click="addMode = 'manual'"
      >
        手动添加
      </button>
    </div>

    <!-- 内容区 -->
    <div class="flex-1 overflow-auto p-3">
      <!-- 选择角色模式 -->
      <div v-if="addMode === 'select'" class="space-y-3">
        <!-- 玩家角色 -->
        <div v-if="playerCharacters.length > 0">
          <p class="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-primary">
            玩家角色
          </p>
          <div class="space-y-1">
            <label
              v-for="c in playerCharacters"
              :key="c.id"
              class="flex cursor-pointer items-center gap-2 rounded border border-border/40 bg-background/40 px-2 py-1.5 text-xs transition-colors hover:border-primary/40"
              :class="selectedCharacterIds.includes(c.id) ? 'border-primary/60 bg-primary/10' : ''"
            >
              <input
                type="checkbox"
                class="accent-primary"
                :checked="selectedCharacterIds.includes(c.id)"
                @change="toggleCharacter(c.id)"
              />
              <span class="flex-1 truncate text-text">{{ c.name }}</span>
              <span class="text-text-muted">HP {{ getCharNum(c, 'hp') }}</span>
              <span v-if="isDnd" class="text-text-muted">AC {{ getCharNum(c, 'ac') }}</span>
            </label>
          </div>
        </div>

        <!-- NPC -->
        <div v-if="npcCharacters.length > 0">
          <p class="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-accent">NPC</p>
          <div class="space-y-1">
            <label
              v-for="c in npcCharacters"
              :key="c.id"
              class="flex cursor-pointer items-center gap-2 rounded border border-border/40 bg-background/40 px-2 py-1.5 text-xs transition-colors hover:border-primary/40"
              :class="selectedCharacterIds.includes(c.id) ? 'border-primary/60 bg-primary/10' : ''"
            >
              <input
                type="checkbox"
                class="accent-primary"
                :checked="selectedCharacterIds.includes(c.id)"
                @change="toggleCharacter(c.id)"
              />
              <span class="flex-1 truncate text-text">{{ c.name }}</span>
              <span class="text-text-muted">HP {{ getCharNum(c, 'hp') }}</span>
              <span v-if="isDnd" class="text-text-muted">AC {{ getCharNum(c, 'ac') }}</span>
            </label>
          </div>
        </div>

        <!-- 空状态 -->
        <div
          v-if="playerCharacters.length === 0 && npcCharacters.length === 0"
          class="py-4 text-center text-xs text-text-muted"
        >
          房间内所有角色均已加入战斗
        </div>

        <!-- 操作按钮 -->
        <div class="flex gap-2 pt-2">
          <BaseButton
            size="sm"
            variant="primary"
            block
            :disabled="selectedCharacterIds.length === 0"
            @click="submitSelected"
          >
            添加选中（{{ selectedCharacterIds.length }}）
          </BaseButton>
          <BaseButton
            v-if="selectableCharacters.length > 0"
            size="sm"
            variant="ghost"
            @click="addAllCharacters"
          >
            全部添加
          </BaseButton>
        </div>
      </div>

      <!-- 手动添加模式 -->
      <div v-else class="space-y-3">
        <BaseInput
          v-model="manualForm.name"
          label="名字"
          placeholder="如：哥布林斥候"
          :maxlength="32"
        />

        <!-- 类型 -->
        <div>
          <label
            class="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-text-muted"
          >
            类型
          </label>
          <div class="flex gap-1">
            <button
              class="flex-1 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors"
              :class="
                manualForm.type === 'player'
                  ? 'border-primary/60 bg-primary/15 text-primary'
                  : 'border-border/40 bg-background/40 text-text-muted hover:text-text'
              "
              @click="manualForm.type = 'player'"
            >
              玩家
            </button>
            <button
              class="flex-1 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors"
              :class="
                manualForm.type === 'npc'
                  ? 'border-accent/60 bg-accent/15 text-accent'
                  : 'border-border/40 bg-background/40 text-text-muted hover:text-text'
              "
              @click="manualForm.type = 'npc'"
            >
              NPC
            </button>
          </div>
        </div>

        <!-- 数值字段 -->
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label
              class="mb-1 block text-xs font-semibold uppercase tracking-widest text-text-muted"
            >
              先攻
            </label>
            <input
              type="number"
              class="input-field"
              :value="manualForm.initiative"
              @input="onNumberInput($event, 'initiative')"
            />
          </div>
          <div>
            <label
              class="mb-1 block text-xs font-semibold uppercase tracking-widest text-text-muted"
            >
              HP
            </label>
            <input
              type="number"
              class="input-field"
              :value="manualForm.hp"
              @input="onNumberInput($event, 'hp')"
            />
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
              :value="manualForm.maxHp"
              @input="onNumberInput($event, 'maxHp')"
            />
          </div>
          <div v-if="isDnd">
            <label
              class="mb-1 block text-xs font-semibold uppercase tracking-widest text-text-muted"
            >
              AC
            </label>
            <input
              type="number"
              class="input-field"
              :value="manualForm.ac"
              @input="onNumberInput($event, 'ac')"
            />
          </div>
        </div>

        <BaseButton
          size="sm"
          variant="primary"
          block
          :disabled="!manualForm.name.trim()"
          @click="submitManual"
        >
          添加参与者
        </BaseButton>
      </div>

      <!-- 当前参与者列表（可移除） -->
      <div v-if="participants.length > 0" class="mt-4 border-t border-border/50 pt-3">
        <p class="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
          当前参与者（点击移除）
        </p>
        <div class="space-y-1">
          <div
            v-for="p in participants"
            :key="p.id"
            class="group flex items-center gap-2 rounded border border-border/40 bg-background/40 px-2 py-1.5 text-xs"
          >
            <span
              class="rounded px-1 py-0.5 text-[9px] font-bold uppercase"
              :class="
                p.type === 'player' ? 'bg-primary/20 text-primary' : 'bg-accent/20 text-accent'
              "
            >
              {{ p.type === 'player' ? 'P' : 'N' }}
            </span>
            <span class="flex-1 truncate text-text">{{ p.name }}</span>
            <span class="font-mono text-text-muted">{{ p.hp }}/{{ p.maxHp }}</span>
            <button
              class="rounded p-0.5 text-text-muted opacity-0 transition-opacity hover:bg-danger/20 hover:text-danger group-hover:opacity-100"
              title="移除"
              @click="removeParticipant(p.id, p.name)"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
