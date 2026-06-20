// 房间相关逻辑组合式函数（store 的便捷封装）

import { storeToRefs } from 'pinia'
import { useRoomStore } from '@/stores/room'
import { useLogStore } from '@/stores/log'

export function useRoom() {
  const roomStore = useRoomStore()
  const logStore = useLogStore()
  const {
    currentRoom,
    code,
    ruleSystem,
    players,
    onlinePlayers,
    isDM,
    playerId,
    playerName,
    isConnected,
    loading,
    error,
  } = storeToRefs(roomStore)

  /** 创建并进入房间 */
  async function createRoom(rs: Parameters<typeof roomStore.createRoom>[0], dmName: string) {
    return roomStore.createRoom(rs, dmName)
  }

  /** 加入房间 */
  async function joinRoom(roomCode: string, name: string) {
    return roomStore.joinRoom(roomCode, name)
  }

  /** 离开房间 */
  async function leaveRoom() {
    return roomStore.leaveRoom()
  }

  /** 建立实时连接 */
  function connectSocket() {
    roomStore.connectSocket()
  }

  /** 记录一条系统日志 */
  function log(message: string) {
    logStore.addLog('system', message)
  }

  return {
    currentRoom,
    code,
    ruleSystem,
    players,
    onlinePlayers,
    isDM,
    playerId,
    playerName,
    isConnected,
    loading,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    connectSocket,
    log,
  }
}
