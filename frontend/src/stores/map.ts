// 地图状态管理（对接后端 Socket 地图契约）

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useSocket } from '@/composables/useSocket'
import { useLogStore } from '@/stores/log'
import type { GridType, MapState, MapToken } from '@/types/models'
import type {
  MapConfigPayload,
  MapFogTogglePayload,
  MapTokenAddPayload,
  MapTokenUpdatePayload,
  SocketAck,
} from '@/types/socket'

export const useMapStore = defineStore('map', () => {
  const logStore = useLogStore()

  // ===== 状态 =====
  /** 当前地图状态 */
  const mapState = ref<MapState | null>(null)
  /** 加载状态 */
  const isLoading = ref(false)

  /** Socket 事件清理函数集合 */
  let socketCleanups: Array<() => void> = []

  // ===== Getters =====
  /** Token 列表 */
  const tokens = computed<MapToken[]>(() => mapState.value?.tokens ?? [])
  /** 迷雾格子列表 */
  const fogCells = computed<string[]>(() => mapState.value?.fogCells ?? [])
  /** 背景图 URL */
  const backgroundUrl = computed<string | null>(() => mapState.value?.backgroundUrl ?? null)
  /** 网格类型 */
  const gridType = computed<GridType>(() => mapState.value?.gridType ?? 'square')
  /** 单格像素大小 */
  const gridSize = computed<number>(() => mapState.value?.gridSize ?? 50)
  /** 地图宽度（格数） */
  const width = computed<number>(() => mapState.value?.width ?? 20)
  /** 地图高度（格数） */
  const height = computed<number>(() => mapState.value?.height ?? 15)

  // ===== 内部工具 =====
  /** 更新单个 Token（本地 upsert） */
  function upsertToken(token: MapToken) {
    if (!mapState.value) return
    const idx = mapState.value.tokens.findIndex((t) => t.id === token.id)
    if (idx >= 0) {
      const next = mapState.value.tokens.slice()
      next[idx] = token
      mapState.value = { ...mapState.value, tokens: next }
    } else {
      mapState.value = { ...mapState.value, tokens: [...mapState.value.tokens, token] }
    }
  }

  /** 本地移动 Token */
  function applyTokenMove(tokenId: string, x: number, y: number) {
    if (!mapState.value) return
    const next = mapState.value.tokens.map((t) => (t.id === tokenId ? { ...t, x, y } : t))
    mapState.value = { ...mapState.value, tokens: next }
  }

  /** 本地移除 Token */
  function applyTokenRemove(tokenId: string) {
    if (!mapState.value) return
    mapState.value = {
      ...mapState.value,
      tokens: mapState.value.tokens.filter((t) => t.id !== tokenId),
    }
  }

  /** 本地更新迷雾 */
  function applyFog(cells: string[]) {
    if (!mapState.value) return
    mapState.value = { ...mapState.value, fogCells: cells }
  }

  // ===== Actions =====
  /** 通过 Socket 获取地图状态 */
  function fetchMapState(): Promise<void> {
    isLoading.value = true
    return new Promise((resolve) => {
      const { emit } = useSocket()
      emit('map:getState', (res: SocketAck<MapState>) => {
        isLoading.value = false
        if (res.ok && res.data) {
          mapState.value = res.data
        }
        resolve()
      })
    })
  }

  /** 移动 Token（本地乐观更新 + 广播） */
  function moveToken(tokenId: string, x: number, y: number) {
    applyTokenMove(tokenId, x, y)
    const { emit } = useSocket()
    emit('map:token:move', { tokenId, x, y })
  }

  /** DM 添加 Token（等待 ack 拿到服务端 id） */
  function addToken(payload: MapTokenAddPayload): Promise<MapToken | null> {
    return new Promise((resolve) => {
      const { emit } = useSocket()
      emit('map:token:add', payload, (res: SocketAck<MapToken>) => {
        if (res.ok && res.data) {
          upsertToken(res.data)
          logStore.addLog('system', `放置了 Token「${res.data.name}」`)
          resolve(res.data)
        } else {
          logStore.addLog('system', `添加 Token 失败：${res.error ?? '未知错误'}`)
          resolve(null)
        }
      })
    })
  }

  /** DM 移除 Token（本地乐观更新 + 广播） */
  function removeToken(tokenId: string) {
    applyTokenRemove(tokenId)
    const { emit } = useSocket()
    emit('map:token:remove', { tokenId })
  }

  /** DM 更新 Token（本地乐观更新 + 广播） */
  function updateToken(tokenId: string, patch: Omit<MapTokenUpdatePayload, 'tokenId'>) {
    if (!mapState.value) return
    const next = mapState.value.tokens.map((t) => (t.id === tokenId ? { ...t, ...patch } : t))
    mapState.value = { ...mapState.value, tokens: next }
    const { emit } = useSocket()
    emit('map:token:update', { tokenId, ...patch })
  }

  /** DM 切换迷雾（本地乐观更新 + 广播） */
  function toggleFog(cells: string[], mode: MapFogTogglePayload['mode']) {
    if (!mapState.value) return
    const set = new Set(mapState.value.fogCells)
    if (mode === 'add') {
      cells.forEach((c) => set.add(c))
    } else {
      cells.forEach((c) => set.delete(c))
    }
    applyFog(Array.from(set))
    const { emit } = useSocket()
    emit('map:fog:toggle', { cells, mode })
  }

  /** DM 清空迷雾 */
  function clearFog() {
    applyFog([])
    const { emit } = useSocket()
    emit('map:fog:clear')
  }

  /** DM 设置网格配置（本地乐观更新 + 广播） */
  function setConfig(config: MapConfigPayload) {
    if (!mapState.value) return
    mapState.value = { ...mapState.value, ...config }
    const { emit } = useSocket()
    emit('map:config:set', config)
  }

  /** DM 设置背景图（本地乐观更新 + 广播） */
  function setBackground(url: string) {
    if (!mapState.value) return
    mapState.value = { ...mapState.value, backgroundUrl: url }
    const { emit } = useSocket()
    emit('map:background:set', { url })
  }

  // ===== Socket 事件处理 =====
  /** 处理地图完整状态 */
  function handleMapState(state: MapState) {
    mapState.value = state
  }

  /** 处理 Token 移动 */
  function handleTokenMoved(payload: { tokenId: string; x: number; y: number }) {
    applyTokenMove(payload.tokenId, payload.x, payload.y)
  }

  /** 处理 Token 移除 */
  function handleTokenRemoved(payload: { tokenId: string }) {
    applyTokenRemove(payload.tokenId)
  }

  /** 处理 Token 更新 */
  function handleTokenUpdated(payload: { token: MapToken }) {
    upsertToken(payload.token)
  }

  /** 处理迷雾更新 */
  function handleFogUpdated(payload: { fogCells: string[] }) {
    applyFog(payload.fogCells)
  }

  /** 订阅 Socket 地图事件 */
  function connectSocket() {
    disconnectSocket()
    const { on } = useSocket()

    socketCleanups.push(
      on('map:state', (payload) => {
        handleMapState(payload)
      }),
    )
    socketCleanups.push(
      on('map:token:moved', (payload) => {
        handleTokenMoved(payload)
      }),
    )
    socketCleanups.push(
      on('map:token:removed', (payload) => {
        handleTokenRemoved(payload)
      }),
    )
    socketCleanups.push(
      on('map:token:updated', (payload) => {
        handleTokenUpdated(payload)
      }),
    )
    socketCleanups.push(
      on('map:fog:updated', (payload) => {
        handleFogUpdated(payload)
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
    mapState.value = null
    isLoading.value = false
  }

  return {
    // 状态
    mapState,
    isLoading,
    // Getters
    tokens,
    fogCells,
    backgroundUrl,
    gridType,
    gridSize,
    width,
    height,
    // Actions
    fetchMapState,
    moveToken,
    addToken,
    removeToken,
    updateToken,
    toggleFog,
    clearFog,
    setConfig,
    setBackground,
    // Socket
    connectSocket,
    disconnectSocket,
    handleMapState,
    handleTokenMoved,
    handleTokenRemoved,
    handleTokenUpdated,
    handleFogUpdated,
    reset,
  }
})
