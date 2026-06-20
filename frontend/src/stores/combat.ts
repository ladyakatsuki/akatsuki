// 战斗状态管理（对接后端 Socket 战斗契约）

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useSocket } from '@/composables/useSocket'
import { useLogStore } from '@/stores/log'
import type { CombatParticipant, CombatState } from '@/types/models'
import type {
  CombatAddParticipantPayload,
  CombatTurnEvent,
  CombatUpdateParticipantPayload,
} from '@/types/socket'

export const useCombatStore = defineStore('combat', () => {
  const logStore = useLogStore()

  // ===== 状态 =====
  /** 当前战斗状态 */
  const combat = ref<CombatState | null>(null)
  /** 加载状态 */
  const isLoading = ref(false)
  /** 错误信息 */
  const error = ref<string | null>(null)
  /** Socket 事件清理函数集合 */
  let socketCleanups: Array<() => void> = []

  // ===== Getters =====
  /** 战斗是否进行中 */
  const isActive = computed(() => combat.value?.isActive ?? false)
  /** 参与者列表（按先攻降序展示用，原始顺序保留在 combat.participants） */
  const participants = computed<CombatParticipant[]>(() => combat.value?.participants ?? [])
  /** 按先攻降序排列的参与者（用于先攻表展示） */
  const sortedParticipants = computed<CombatParticipant[]>(() => {
    const list = [...participants.value]
    list.sort((a, b) => b.initiative - a.initiative)
    return list
  })
  /** 当前回合参与者 */
  const currentParticipant = computed<CombatParticipant | null>(() => {
    if (!combat.value) return null
    const idx = combat.value.currentTurn
    if (idx < 0 || idx >= participants.value.length) return null
    return participants.value[idx] ?? null
  })
  /** 当前轮次 */
  const round = computed(() => combat.value?.round ?? 0)
  /** 参与者数量 */
  const participantCount = computed(() => participants.value.length)

  // ===== Actions =====
  /** DM 发起战斗 */
  function startCombat(participantIds: string[], rollInitiative: boolean) {
    isLoading.value = true
    error.value = null
    const { emit } = useSocket()
    emit('combat:start', { participantIds, rollInitiative })
    logStore.addLog('combat', `发起战斗，共 ${participantIds.length} 名参与者`)
  }

  /** DM 结束战斗 */
  function endCombat() {
    isLoading.value = true
    error.value = null
    const { emit } = useSocket()
    emit('combat:end')
    logStore.addLog('combat', '结束战斗')
  }

  /** 添加参与者 */
  function addParticipant(payload: CombatAddParticipantPayload) {
    error.value = null
    const { emit } = useSocket()
    emit('combat:addParticipant', payload)
    logStore.addLog('combat', `添加参与者「${payload.name}」`)
  }

  /** 移除参与者 */
  function removeParticipant(participantId: string) {
    error.value = null
    const { emit } = useSocket()
    emit('combat:removeParticipant', { participantId })
  }

  /** 更新参与者 */
  function updateParticipant(participantId: string, patch: Partial<Omit<CombatParticipant, 'id'>>) {
    error.value = null
    const { emit } = useSocket()
    const payload: CombatUpdateParticipantPayload = { participantId, patch }
    emit('combat:updateParticipant', payload)
  }

  /** 下一回合 */
  function nextTurn() {
    error.value = null
    const { emit } = useSocket()
    emit('combat:nextTurn')
  }

  /** 上一回合 */
  function prevTurn() {
    error.value = null
    const { emit } = useSocket()
    emit('combat:prevTurn')
  }

  /** 重新掷先攻 */
  function rollInitiative(participantId: string) {
    error.value = null
    const { emit } = useSocket()
    emit('combat:rollInitiative', { participantId })
  }

  // ===== Socket 事件处理 =====
  /** 处理战斗状态同步 */
  function handleCombatState(payload: { combat: CombatState | null }) {
    combat.value = payload.combat
    isLoading.value = false
    if (!payload.combat) {
      logStore.addLog('combat', '战斗已结束')
    }
  }

  /** 处理战斗回合变更 */
  function handleCombatTurn(payload: CombatTurnEvent) {
    if (combat.value) {
      combat.value = {
        ...combat.value,
        round: payload.round,
        currentTurn: payload.currentTurn,
      }
      // 同步更新对应参与者
      const idx = payload.currentTurn
      if (idx >= 0 && idx < combat.value.participants.length) {
        const next = combat.value.participants.slice()
        next[idx] = payload.participant
        combat.value = { ...combat.value, participants: next }
      }
    }
    logStore.addLog('combat', `第 ${payload.round} 轮 · ${payload.participant.name} 行动`)
  }

  /** 订阅 Socket 战斗事件 */
  function connectSocket() {
    disconnectSocket()
    const { on } = useSocket()

    socketCleanups.push(
      on('combat:state', (payload) => {
        handleCombatState(payload)
      }),
    )
    socketCleanups.push(
      on('combat:turn', (payload) => {
        handleCombatTurn(payload)
      }),
    )
  }

  /** 取消 Socket 事件订阅 */
  function disconnectSocket() {
    socketCleanups.forEach((fn) => fn())
    socketCleanups = []
  }

  /** 重置所有状态 */
  function reset() {
    disconnectSocket()
    combat.value = null
    isLoading.value = false
    error.value = null
  }

  return {
    // 状态
    combat,
    isLoading,
    error,
    // Getters
    isActive,
    participants,
    sortedParticipants,
    currentParticipant,
    round,
    participantCount,
    // Actions
    startCombat,
    endCombat,
    addParticipant,
    removeParticipant,
    updateParticipant,
    nextTurn,
    prevTurn,
    rollInitiative,
    // Socket
    connectSocket,
    disconnectSocket,
    handleCombatState,
    handleCombatTurn,
    reset,
  }
})
