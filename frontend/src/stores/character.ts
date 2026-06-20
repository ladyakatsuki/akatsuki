// 角色状态管理（对接后端 REST + Socket 契约）

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { charactersApi } from '@/api/characters'
import { useSocket } from '@/composables/useSocket'
import { useLogStore } from '@/stores/log'
import type { Character } from '@/types/models'

/** 防抖延迟（毫秒） */
const UPDATE_DEBOUNCE_MS = 500

export const useCharacterStore = defineStore('character', () => {
  const logStore = useLogStore()

  // ===== 状态 =====
  /** 我的角色（当前玩家创建的角色，含 NPC） */
  const myCharacters = ref<Character[]>([])
  /** 房间内所有角色 */
  const roomCharacters = ref<Character[]>([])
  /** 当前编辑的角色 */
  const currentCharacter = ref<Character | null>(null)
  /** 加载状态 */
  const isLoading = ref(false)
  /** 错误信息 */
  const error = ref<string | null>(null)

  /** 待同步的角色卡数据（characterId -> data），用于防抖合并 */
  const pendingDataMap = ref<Map<string, Record<string, unknown>>>(new Map())
  /** 防抖定时器（characterId -> timer） */
  let debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {}
  /** Socket 事件清理函数集合 */
  let socketCleanups: Array<() => void> = []

  // ===== Getters =====
  /** 我的第一个非 NPC 角色 */
  const myCharacter = computed(() => myCharacters.value.find((c) => !c.isNpc) ?? null)
  /** DM 的 NPC 列表 */
  const npcs = computed(() => roomCharacters.value.filter((c) => c.isNpc))
  /** 玩家角色列表（非 NPC） */
  const playerCharacters = computed(() => roomCharacters.value.filter((c) => !c.isNpc))

  // ===== 内部工具 =====
  /** 在列表中 upsert 角色 */
  function upsertInList(list: Character[], character: Character): Character[] {
    const idx = list.findIndex((c) => c.id === character.id)
    if (idx >= 0) {
      const next = list.slice()
      next[idx] = character
      return next
    }
    return [...list, character]
  }

  /** 从列表中移除角色 */
  function removeFromList(list: Character[], id: string): Character[] {
    return list.filter((c) => c.id !== id)
  }

  // ===== Actions =====
  /** 获取房间所有角色 */
  async function fetchRoomCharacters(roomCode: string) {
    isLoading.value = true
    error.value = null
    try {
      const list = await charactersApi.getByRoom(roomCode)
      roomCharacters.value = list
    } catch (e) {
      error.value = (e as Error).message || '获取房间角色失败'
      logStore.addLog('system', `获取房间角色失败：${error.value}`)
    } finally {
      isLoading.value = false
    }
  }

  /** 获取我的角色 */
  async function fetchMyCharacters(roomCode: string, playerId: string) {
    isLoading.value = true
    error.value = null
    try {
      const list = await charactersApi.getMine(roomCode, playerId)
      myCharacters.value = list
    } catch (e) {
      error.value = (e as Error).message || '获取我的角色失败'
      logStore.addLog('system', `获取我的角色失败：${error.value}`)
    } finally {
      isLoading.value = false
    }
  }

  /** 创建角色（通过 REST，Socket 会广播 created 事件） */
  async function createCharacter(
    roomCode: string,
    playerId: string,
    name: string,
    isNpc?: boolean,
  ): Promise<Character | null> {
    isLoading.value = true
    error.value = null
    try {
      const character = await charactersApi.create(roomCode, playerId, name, isNpc)
      // 乐观更新（Socket 广播也会触发 handleCharacterCreated）
      myCharacters.value = upsertInList(myCharacters.value, character)
      roomCharacters.value = upsertInList(roomCharacters.value, character)
      logStore.addLog('character', `创建了角色「${name}」`)
      return character
    } catch (e) {
      error.value = (e as Error).message || '创建角色失败'
      logStore.addLog('system', `创建角色失败：${error.value}`)
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 更新角色卡数据（通过 Socket，带防抖）
   * 本地立即更新，500ms 内的多次修改合并为一次 Socket 发送
   */
  function updateCharacterData(characterId: string, data: Record<string, unknown>) {
    // 本地立即更新（乐观更新）
    const applyData = (list: Character[]) => {
      const idx = list.findIndex((c) => c.id === characterId)
      if (idx >= 0) {
        const next = list.slice()
        next[idx] = { ...next[idx], data: { ...next[idx].data, ...data } }
        return next
      }
      return list
    }
    myCharacters.value = applyData(myCharacters.value)
    roomCharacters.value = applyData(roomCharacters.value)
    if (currentCharacter.value?.id === characterId) {
      currentCharacter.value = {
        ...currentCharacter.value,
        data: { ...currentCharacter.value.data, ...data },
      }
    }

    // 合并待发送数据
    const existing = pendingDataMap.value.get(characterId) ?? {}
    pendingDataMap.value.set(characterId, { ...existing, ...data })

    // 清除旧定时器，设置新定时器
    if (debounceTimers[characterId]) {
      clearTimeout(debounceTimers[characterId])
    }
    debounceTimers[characterId] = setTimeout(() => {
      flushCharacterData(characterId)
    }, UPDATE_DEBOUNCE_MS)
  }

  /** 立即发送待同步的角色卡数据 */
  function flushCharacterData(characterId: string) {
    const data = pendingDataMap.value.get(characterId)
    if (!data) return
    pendingDataMap.value.delete(characterId)
    delete debounceTimers[characterId]

    const { emit } = useSocket()
    emit('character:updateData', { characterId, data })
  }

  /** 上传立绘 */
  async function uploadPortrait(
    characterId: string,
    playerId: string,
    file: File,
  ): Promise<Character | null> {
    isLoading.value = true
    error.value = null
    try {
      const updated = await charactersApi.uploadPortrait(characterId, playerId, file)
      myCharacters.value = upsertInList(myCharacters.value, updated)
      roomCharacters.value = upsertInList(roomCharacters.value, updated)
      if (currentCharacter.value?.id === characterId) {
        currentCharacter.value = updated
      }
      logStore.addLog('character', `角色「${updated.name}」立绘已更新`)
      return updated
    } catch (e) {
      error.value = (e as Error).message || '上传立绘失败'
      logStore.addLog('system', `上传立绘失败：${error.value}`)
      return null
    } finally {
      isLoading.value = false
    }
  }

  /** 删除角色 */
  async function deleteCharacter(characterId: string, playerId: string): Promise<boolean> {
    isLoading.value = true
    error.value = null
    try {
      await charactersApi.delete(characterId, playerId)
      myCharacters.value = removeFromList(myCharacters.value, characterId)
      roomCharacters.value = removeFromList(roomCharacters.value, characterId)
      if (currentCharacter.value?.id === characterId) {
        currentCharacter.value = null
      }
      logStore.addLog('character', '角色已删除')
      return true
    } catch (e) {
      error.value = (e as Error).message || '删除角色失败'
      logStore.addLog('system', `删除角色失败：${error.value}`)
      return false
    } finally {
      isLoading.value = false
    }
  }

  /** 设置当前编辑的角色 */
  function setCurrentCharacter(character: Character | null) {
    currentCharacter.value = character
  }

  // ===== Socket 事件处理 =====
  /** 角色已创建：添加到列表 */
  function handleCharacterCreated(character: Character) {
    roomCharacters.value = upsertInList(roomCharacters.value, character)
    // 如果是自己的角色，也加入 myCharacters
    // 注意：此处无法直接判断是否为当前玩家，由调用方在绑定事件时处理
  }

  /** 角色基本信息已更新 */
  function handleCharacterUpdated(character: Character) {
    roomCharacters.value = upsertInList(roomCharacters.value, character)
    myCharacters.value = upsertInList(myCharacters.value, character)
    if (currentCharacter.value?.id === character.id) {
      currentCharacter.value = character
    }
  }

  /** 角色卡数据已更新 */
  function handleCharacterDataUpdated(payload: {
    characterId: string
    data: Record<string, unknown>
  }) {
    const { characterId, data } = payload
    const updateData = (list: Character[]) => {
      const idx = list.findIndex((c) => c.id === characterId)
      if (idx >= 0) {
        const next = list.slice()
        next[idx] = { ...next[idx], data }
        return next
      }
      return list
    }
    roomCharacters.value = updateData(roomCharacters.value)
    myCharacters.value = updateData(myCharacters.value)
    if (currentCharacter.value?.id === characterId) {
      currentCharacter.value = { ...currentCharacter.value, data }
    }
  }

  /** 角色已删除：从列表移除 */
  function handleCharacterDeleted(characterId: string) {
    roomCharacters.value = removeFromList(roomCharacters.value, characterId)
    myCharacters.value = removeFromList(myCharacters.value, characterId)
    if (currentCharacter.value?.id === characterId) {
      currentCharacter.value = null
    }
  }

  /** 订阅 Socket 角色事件 */
  function connectSocket(currentPlayerId: string) {
    disconnectSocket()
    const { on } = useSocket()

    socketCleanups.push(
      on('character:created', ({ character }) => {
        handleCharacterCreated(character)
        // 如果是当前玩家创建的角色，加入 myCharacters
        if (character.playerId === currentPlayerId) {
          myCharacters.value = upsertInList(myCharacters.value, character)
        }
      }),
    )
    socketCleanups.push(
      on('character:updated', ({ character }) => {
        handleCharacterUpdated(character)
      }),
    )
    socketCleanups.push(
      on('character:dataUpdated', (payload) => {
        handleCharacterDataUpdated(payload)
      }),
    )
    socketCleanups.push(
      on('character:deleted', ({ characterId }) => {
        handleCharacterDeleted(characterId)
      }),
    )
  }

  /** 取消 Socket 事件订阅 */
  function disconnectSocket() {
    socketCleanups.forEach((fn) => fn())
    socketCleanups = []
    // 清理所有防抖定时器
    for (const id of Object.keys(debounceTimers)) {
      clearTimeout(debounceTimers[id])
    }
    debounceTimers = {}
    pendingDataMap.value.clear()
  }

  /** 重置所有状态 */
  function reset() {
    disconnectSocket()
    myCharacters.value = []
    roomCharacters.value = []
    currentCharacter.value = null
    isLoading.value = false
    error.value = null
  }

  return {
    // 状态
    myCharacters,
    roomCharacters,
    currentCharacter,
    isLoading,
    error,
    // Getters
    myCharacter,
    npcs,
    playerCharacters,
    // Actions
    fetchRoomCharacters,
    fetchMyCharacters,
    createCharacter,
    updateCharacterData,
    flushCharacterData,
    uploadPortrait,
    deleteCharacter,
    setCurrentCharacter,
    // Socket
    connectSocket,
    disconnectSocket,
    handleCharacterCreated,
    handleCharacterUpdated,
    handleCharacterDataUpdated,
    handleCharacterDeleted,
    reset,
  }
})
