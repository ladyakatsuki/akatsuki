// 事件日志与骰子结果状态管理

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { formatTime } from '@/utils/format'
import type { DiceRollResultEvent, LogEvent } from '@/types/socket'

/** 本地日志类型（兼容旧调用，同时承载 Socket 推送的 LogEvent 字段） */
export type LogType = 'system' | 'dice' | 'combat' | 'story' | 'chat' | 'character'

export interface LogEntry {
  id: string
  type: LogType
  message: string
  timestamp: string
  /** 原始时间戳，用于排序 */
  rawTime: number
  /** 关联玩家 ID（Socket 日志） */
  playerId?: string
  /** 关联玩家名（Socket 日志） */
  playerName?: string
  /** 是否暗骰 */
  isHidden?: boolean
  /** 原始数据（Socket 日志的 data 字段） */
  data?: unknown
}

export const useLogStore = defineStore('log', () => {
  /** 日志列表（按时间正序，展示时倒序） */
  const logs = ref<LogEntry[]>([])
  /** 骰子结果列表（按时间正序，展示时倒序） */
  const diceResults = ref<DiceRollResultEvent[]>([])

  const MAX_LOGS = 200
  const MAX_DICE_RESULTS = 100

  /** 添加一条本地日志（保留旧签名以兼容现有调用） */
  function addLog(type: LogType, message: string) {
    const now = Date.now()
    const entry: LogEntry = {
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      message,
      timestamp: formatTime(now),
      rawTime: now,
    }
    logs.value.push(entry)
    if (logs.value.length > MAX_LOGS) {
      logs.value = logs.value.slice(-MAX_LOGS)
    }
  }

  /** 添加一条 Socket 推送的日志事件 */
  function addLogEvent(log: LogEvent) {
    const entry: LogEntry = {
      id: log.id,
      type: log.type as LogType,
      message: log.message,
      timestamp: formatTime(log.timestamp),
      rawTime: log.timestamp,
      playerId: log.playerId,
      playerName: log.playerName,
      isHidden: log.isHidden,
      data: log.data,
    }
    // 去重（同一 id 不重复添加）
    if (logs.value.some((l) => l.id === entry.id)) return
    logs.value.push(entry)
    if (logs.value.length > MAX_LOGS) {
      logs.value = logs.value.slice(-MAX_LOGS)
    }
  }

  /** 添加一条骰子结果 */
  function addDiceResult(result: DiceRollResultEvent) {
    // 去重
    if (diceResults.value.some((r) => r.id === result.id)) return
    diceResults.value.push(result)
    if (diceResults.value.length > MAX_DICE_RESULTS) {
      diceResults.value = diceResults.value.slice(-MAX_DICE_RESULTS)
    }
  }

  /** 清空所有日志与骰子结果 */
  function clearLogs() {
    logs.value = []
    diceResults.value = []
  }

  /** 仅清空日志（保留旧接口） */
  function clear() {
    logs.value = []
  }

  return {
    logs,
    diceResults,
    addLog,
    addLogEvent,
    addDiceResult,
    clearLogs,
    clear,
  }
})
