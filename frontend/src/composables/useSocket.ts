// Socket.IO 连接与事件封装（单例，带房间鉴权）

import { io, type Socket } from 'socket.io-client'
import { computed, ref } from 'vue'
import { DEFAULT_SOCKET_URL } from '@/utils/constants'
import type { ClientToServerEvents, ConnectionStatus, ServerToClientEvents } from '@/types/socket'

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

let socket: AppSocket | null = null

/** 连接状态（全局共享，响应式） */
const status = ref<ConnectionStatus>('disconnected')

function createSocket(): AppSocket {
  const url = import.meta.env.VITE_SOCKET_URL || DEFAULT_SOCKET_URL
  return io(url, {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    transports: ['websocket', 'polling'],
  }) as AppSocket
}

/** 获取单例 Socket（懒创建并绑定基础状态监听） */
export function getSocket(): AppSocket {
  if (!socket) {
    socket = createSocket()

    socket.on('connect', () => {
      status.value = 'connected'
    })
    socket.on('disconnect', () => {
      status.value = 'disconnected'
    })
    socket.io.on('reconnect_attempt', () => {
      status.value = 'reconnecting'
    })
    socket.io.on('reconnect_failed', () => {
      status.value = 'error'
    })
    socket.on('connect_error', () => {
      status.value = 'error'
    })
  }
  return socket
}

/** 是否已连接（由 status 派生，响应式） */
export const isConnected = computed(() => status.value === 'connected')

/**
 * Socket 组合式函数
 * 提供连接管理（带房间鉴权）、事件订阅与发送方法
 */
export function useSocket() {
  /** 建立连接，auth 携带 roomCode 与 playerId */
  function connect(roomCode: string, playerId: string) {
    const s = getSocket()
    // 设置鉴权信息（重连时也会携带）
    s.auth = { roomCode, playerId }
    if (!s.connected) {
      status.value = 'connecting'
      s.connect()
    }
  }

  /** 断开连接 */
  function disconnect() {
    const s = getSocket()
    if (s.connected) s.disconnect()
    status.value = 'disconnected'
  }

  /** 订阅服务端事件，返回取消订阅函数 */
  function on<K extends keyof ServerToClientEvents>(
    event: K,
    handler: ServerToClientEvents[K],
  ): () => void {
    const s = getSocket()
    // 注：socket.io 的严格泛型重载在联合事件类型下难以匹配，此处放宽监听器类型
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    s.on(event, handler as any)
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      s.off(event, handler as any)
    }
  }

  /** 仅触发一次的订阅 */
  function once<K extends keyof ServerToClientEvents>(
    event: K,
    handler: ServerToClientEvents[K],
  ): void {
    const s = getSocket()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    s.once(event, handler as any)
  }

  /** 发送事件到服务端（类型安全） */
  function emit<K extends keyof ClientToServerEvents>(
    event: K,
    ...args: Parameters<ClientToServerEvents[K]>
  ): void {
    const s = getSocket()
    s.emit(event, ...args)
  }

  return {
    status,
    isConnected,
    connect,
    disconnect,
    on,
    once,
    emit,
  }
}
