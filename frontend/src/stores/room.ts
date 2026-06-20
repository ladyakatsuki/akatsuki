// 房间状态管理（对接后端 REST + Socket 契约）

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { roomsApi } from '@/api/rooms'
import { useSocket } from '@/composables/useSocket'
import { useUiStore } from '@/stores/ui'
import { useLogStore } from '@/stores/log'
import { STORAGE_KEYS } from '@/utils/constants'
import type { Character, Role, Room, RoomPlayer, RuleSet } from '@/types/models'

export const useRoomStore = defineStore('room', () => {
  const uiStore = useUiStore()
  const logStore = useLogStore()

  // ===== 状态 =====
  /** 当前房间 */
  const currentRoom = ref<Room | null>(null)
  /** 当前玩家 ID */
  const playerId = ref<string | null>(null)
  /** 当前玩家昵称 */
  const playerName = ref<string | null>(null)
  /** 当前角色（DM/玩家） */
  const role = ref<Role | null>(null)
  /** Socket 是否已连接 */
  const isConnected = ref(false)
  /** 在线玩家 ID 列表 */
  const onlinePlayers = ref<string[]>([])
  /** 房间内角色卡（由 characterStore 管理，此处仅保留 room:state 推送的初始数据） */
  const characters = ref<Character[]>([])
  /** 加载状态 */
  const loading = ref(false)
  /** 错误信息 */
  const error = ref('')
  /** 是否被踢出（用于路由守卫跳过离开确认） */
  const kicked = ref(false)

  /** Socket 事件清理函数集合 */
  let socketCleanups: Array<() => void> = []

  // ===== Getters =====
  /** 是否为 DM */
  const isDM = computed(() => role.value === 'dm')
  /** 规则集 */
  const ruleSystem = computed<RuleSet | undefined>(() => currentRoom.value?.ruleSystem)
  /** 房间码 */
  const code = computed(() => currentRoom.value?.code ?? '')
  /** 玩家列表 */
  const players = computed<RoomPlayer[]>(() => currentRoom.value?.players ?? [])
  /** 玩家总数 */
  const playerCount = computed(() => currentRoom.value?.players.length ?? 0)
  /** 在线玩家数 */
  const onlinePlayerCount = computed(() => onlinePlayers.value.length)
  /** DM 玩家 */
  const dm = computed(() => currentRoom.value?.players.find((p) => p.role === 'dm') ?? null)
  /** 当前玩家自己 */
  const me = computed(() => currentRoom.value?.players.find((p) => p.id === playerId.value) ?? null)

  // ===== 内部工具 =====
  /** 持久化关键状态到 localStorage */
  function persistStorage() {
    if (playerId.value) localStorage.setItem(STORAGE_KEYS.playerId, playerId.value)
    if (code.value) localStorage.setItem(STORAGE_KEYS.roomCode, code.value)
    if (playerName.value) localStorage.setItem(STORAGE_KEYS.playerName, playerName.value)
    if (role.value) localStorage.setItem(STORAGE_KEYS.role, role.value)
    if (ruleSystem.value) localStorage.setItem(STORAGE_KEYS.ruleSystem, ruleSystem.value)
  }

  /** 清除 localStorage 中的房间信息 */
  function clearStorage() {
    localStorage.removeItem(STORAGE_KEYS.playerId)
    localStorage.removeItem(STORAGE_KEYS.roomCode)
    localStorage.removeItem(STORAGE_KEYS.playerName)
    localStorage.removeItem(STORAGE_KEYS.role)
    localStorage.removeItem(STORAGE_KEYS.ruleSystem)
  }

  /** 应用房间数据并同步主题 */
  function applyRoom(room: Room) {
    currentRoom.value = room
    uiStore.syncThemeFromRuleSet(room.ruleSystem)
  }

  /** 根据玩家 ID 推导自身角色 */
  function syncRoleFromPlayers() {
    if (!currentRoom.value || !playerId.value) return
    const mePlayer = currentRoom.value.players.find((p) => p.id === playerId.value)
    if (mePlayer) role.value = mePlayer.role
  }

  // ===== Actions =====
  /** 创建房间 */
  async function createRoom(rs: RuleSet, dmName: string): Promise<Room> {
    loading.value = true
    error.value = ''
    try {
      const { room, playerId: pid } = await roomsApi.create(rs, dmName)
      applyRoom(room)
      playerId.value = pid
      playerName.value = dmName
      role.value = 'dm'
      onlinePlayers.value = [pid]
      persistStorage()
      logStore.addLog('system', `已创建房间 ${room.code}（${rs.toUpperCase()}）`)
      return room
    } catch (e) {
      error.value = (e as Error).message || '创建房间失败'
      logStore.addLog('system', `创建房间失败：${error.value}`)
      throw e
    } finally {
      loading.value = false
    }
  }

  /** 加入房间 */
  async function joinRoom(roomCode: string, name: string): Promise<Room> {
    loading.value = true
    error.value = ''
    try {
      const { room, playerId: pid } = await roomsApi.join(roomCode, name)
      applyRoom(room)
      playerId.value = pid
      playerName.value = name
      syncRoleFromPlayers()
      persistStorage()
      logStore.addLog('system', `已加入房间 ${room.code}`)
      return room
    } catch (e) {
      error.value = (e as Error).message || '加入房间失败'
      logStore.addLog('system', `加入房间失败：${error.value}`)
      throw e
    } finally {
      loading.value = false
    }
  }

  /** 离开房间（调用 API、断开 Socket、清空状态） */
  async function leaveRoom() {
    const roomCode = code.value
    const pid = playerId.value
    disconnectSocket()
    if (roomCode && pid) {
      try {
        await roomsApi.leave(roomCode, pid)
      } catch (e) {
        // 离开失败不阻塞跳转，仅记录
        logStore.addLog('system', `离开房间请求失败：${(e as Error).message}`)
      }
    }
    logStore.addLog('system', '已离开房间')
    reset()
  }

  /** 建立 Socket 连接并订阅房间事件 */
  function connectSocket() {
    if (!currentRoom.value || !playerId.value) return
    // 先清理旧订阅，避免重复绑定
    disconnectSocket()

    const { connect, on } = useSocket()

    socketCleanups.push(
      on('connect', () => {
        isConnected.value = true
        logStore.addLog('system', '实时连接已建立')
      }),
    )
    socketCleanups.push(
      on('disconnect', () => {
        isConnected.value = false
        logStore.addLog('system', '实时连接已断开')
      }),
    )
    socketCleanups.push(
      on('connect_error', () => {
        isConnected.value = false
        error.value = '实时连接失败，请检查网络或后端服务'
      }),
    )
    socketCleanups.push(
      on('room:state', (payload) => {
        applyRoom(payload.room)
        characters.value = payload.characters
        onlinePlayers.value = payload.onlinePlayers
        syncRoleFromPlayers()
      }),
    )
    socketCleanups.push(
      on('room:playerJoined', ({ player }) => {
        handlePlayerJoined(player)
      }),
    )
    socketCleanups.push(
      on('room:playerLeft', ({ playerId: leftId }) => {
        handlePlayerLeft(leftId)
      }),
    )
    socketCleanups.push(
      on('room:playerDisconnected', ({ playerId: disId }) => {
        handlePlayerLeft(disId)
        logStore.addLog('system', '一位玩家掉线')
      }),
    )
    socketCleanups.push(
      on('room:playerKicked', ({ playerId: kickedId }) => {
        handlePlayerKicked(kickedId)
      }),
    )
    socketCleanups.push(
      on('error', ({ message }) => {
        error.value = message
        logStore.addLog('system', `服务端错误：${message}`)
      }),
    )
    // 骰子结果：存入 log store 供 DiceLog / DiceResultToast 使用
    socketCleanups.push(
      on('dice:result', (result) => {
        logStore.addDiceResult(result)
      }),
    )
    // 日志事件：服务端推送的可读日志
    socketCleanups.push(
      on('log:add', (logEvent) => {
        logStore.addLogEvent(logEvent)
      }),
    )

    connect(currentRoom.value.code, playerId.value)
  }

  /** 断开 Socket 并清理事件订阅 */
  function disconnectSocket() {
    const { disconnect } = useSocket()
    socketCleanups.forEach((fn) => fn())
    socketCleanups = []
    disconnect()
    isConnected.value = false
  }

  /** 获取房间完整状态 */
  async function fetchRoomState() {
    if (!code.value || !playerId.value) return
    try {
      const state = await roomsApi.getState(code.value, playerId.value)
      applyRoom(state.room)
      characters.value = state.characters
      onlinePlayers.value = state.onlinePlayers
      syncRoleFromPlayers()
    } catch (e) {
      error.value = (e as Error).message || '获取房间状态失败'
      logStore.addLog('system', `获取房间状态失败：${error.value}`)
    }
  }

  /** 玩家加入处理 */
  function handlePlayerJoined(player: RoomPlayer) {
    if (!currentRoom.value) return
    const exists = currentRoom.value.players.some((p) => p.id === player.id)
    if (!exists) {
      currentRoom.value.players.push(player)
    }
    if (player.isConnected !== false && !onlinePlayers.value.includes(player.id)) {
      onlinePlayers.value.push(player.id)
    }
    logStore.addLog('system', `${player.name} 加入了房间`)
  }

  /** 玩家离开/掉线处理 */
  function handlePlayerLeft(leftPlayerId: string) {
    if (!currentRoom.value) return
    const left = currentRoom.value.players.find((p) => p.id === leftPlayerId)
    currentRoom.value.players = currentRoom.value.players.filter((p) => p.id !== leftPlayerId)
    onlinePlayers.value = onlinePlayers.value.filter((id) => id !== leftPlayerId)
    if (left) logStore.addLog('system', `${left.name} 离开了房间`)
  }

  /** 玩家被踢处理：若为自己则标记并清空 */
  function handlePlayerKicked(kickedPlayerId: string) {
    if (kickedPlayerId === playerId.value) {
      kicked.value = true
      logStore.addLog('system', '你已被踢出房间')
      disconnectSocket()
      clearStorage()
      reset()
    } else if (currentRoom.value) {
      const kickedPlayer = currentRoom.value.players.find((p) => p.id === kickedPlayerId)
      handlePlayerLeft(kickedPlayerId)
      if (kickedPlayer) logStore.addLog('system', `${kickedPlayer.name} 被踢出房间`)
    }
  }

  /** DM 踢出玩家 */
  function kickPlayer(targetId: string) {
    const { emit } = useSocket()
    emit('room:kick', { playerId: targetId })
  }

  /** 从 localStorage 恢复（用于刷新重连），返回是否恢复成功 */
  function initFromStorage(): boolean {
    const pid = localStorage.getItem(STORAGE_KEYS.playerId)
    const rc = localStorage.getItem(STORAGE_KEYS.roomCode)
    const pn = localStorage.getItem(STORAGE_KEYS.playerName)
    const r = localStorage.getItem(STORAGE_KEYS.role) as Role | null
    const rs = localStorage.getItem(STORAGE_KEYS.ruleSystem) as RuleSet | null
    if (pid && rc) {
      playerId.value = pid
      playerName.value = pn
      role.value = r
      // 占位房间，完整数据由 fetchRoomState 拉取
      currentRoom.value = {
        id: '',
        code: rc,
        ruleSystem: rs ?? 'dnd5e',
        dmId: '',
        players: [],
        storyId: null,
        createdAt: 0,
      }
      if (rs) uiStore.syncThemeFromRuleSet(rs)
      return true
    }
    return false
  }

  /** 重置所有状态 */
  function reset() {
    currentRoom.value = null
    playerId.value = null
    playerName.value = null
    role.value = null
    isConnected.value = false
    onlinePlayers.value = []
    characters.value = []
    error.value = ''
    clearStorage()
  }

  return {
    // 状态
    currentRoom,
    playerId,
    playerName,
    role,
    isConnected,
    onlinePlayers,
    characters,
    loading,
    error,
    kicked,
    // Getters
    isDM,
    ruleSystem,
    code,
    players,
    playerCount,
    onlinePlayerCount,
    dm,
    me,
    // Actions
    createRoom,
    joinRoom,
    leaveRoom,
    connectSocket,
    disconnectSocket,
    fetchRoomState,
    handlePlayerJoined,
    handlePlayerLeft,
    handlePlayerKicked,
    kickPlayer,
    initFromStorage,
    reset,
  }
})
