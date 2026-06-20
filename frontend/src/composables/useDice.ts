// 骰子逻辑组合式函数（基于 Socket.IO 与后端通信）

import { useSocket } from '@/composables/useSocket'
import type { DiceRollRequest, DiceRollResultEvent, SocketAck } from '@/types/socket'

/** 骰子表达式解析结果（本地辅助用） */
export interface DiceExpression {
  count: number
  sides: number
  modifier: number
}

/** 支持的快捷骰子面数 */
export const QUICK_DICE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const

/** 快捷骰子类型 */
export type QuickDiceSide = (typeof QUICK_DICE_SIDES)[number]

/** 解析简单骰子表达式，如 "2d6+3" */
export function parseDiceExpression(expr: string): DiceExpression | null {
  const match = expr
    .trim()
    .toLowerCase()
    .match(/^(\d+)d(\d+)(?:([+-])(\d+))?$/)
  if (!match) return null
  const count = parseInt(match[1], 10)
  const sides = parseInt(match[2], 10)
  const sign = match[3] === '-' ? -1 : 1
  const modifier = match[4] ? sign * parseInt(match[4], 10) : 0
  return { count, sides, modifier }
}

/**
 * 骰子组合式函数
 *
 * 提供：
 * - roll：通用掷骰（dice:roll）
 * - rollSkill：技能检定（dice:rollSkill）
 * - rollSan：SAN 检定（dice:rollSan）
 * - onResult：订阅 dice:result 事件
 */
export function useDice() {
  const { emit, on } = useSocket()

  /** 通用掷骰，可携带 ack 回调 */
  function roll(
    request: DiceRollRequest,
    ack?: (res: SocketAck<DiceRollResultEvent>) => void,
  ): void {
    emit('dice:roll', request, ack)
  }

  /** 技能检定掷骰 */
  function rollSkill(
    characterId: string,
    skillKey: string,
    ack?: (res: SocketAck<DiceRollResultEvent>) => void,
  ): void {
    emit('dice:rollSkill', { characterId, skillKey }, ack)
  }

  /** SAN 检定掷骰（COC 专用） */
  function rollSan(
    characterId: string,
    sanLossExpression: string,
    ack?: (res: SocketAck<DiceRollResultEvent>) => void,
  ): void {
    emit('dice:rollSan', { characterId, sanLossExpression }, ack)
  }

  /** 订阅掷骰结果，返回取消订阅函数 */
  function onResult(handler: (result: DiceRollResultEvent) => void): () => void {
    return on('dice:result', handler)
  }

  return { roll, rollSkill, rollSan, onResult }
}
