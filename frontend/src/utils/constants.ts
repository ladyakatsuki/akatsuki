// 全局常量

import type { RuleSetMeta } from '@/types/rules'

/** 房间码长度 */
export const ROOM_CODE_LENGTH = 6

/** 最大房间人数 */
export const MAX_ROOM_MEMBERS = 8

/** 规则集元信息表 */
export const RULE_SETS: Record<string, RuleSetMeta> = {
  dnd5e: {
    key: 'dnd5e',
    label: 'DND 5E',
    shortLabel: 'D&D',
    description: '龙与地下城第五版 · 暗色奇幻冒险',
    theme: 'dnd',
  },
  coc7: {
    key: 'coc7',
    label: 'COC 7版',
    shortLabel: 'COC',
    description: '克苏鲁的呼唤第七版 · 诡异悬疑恐怖',
    theme: 'coc',
  },
}

/** 规则集选项（用于表单下拉） */
export const RULE_SET_OPTIONS = Object.values(RULE_SETS)

/** 日志事件类型与配色 */
export const LOG_TYPES = {
  system: { label: '系统', color: 'text-text-muted' },
  dice: { label: '骰子', color: 'text-warning' },
  combat: { label: '战斗', color: 'text-danger' },
  story: { label: '故事', color: 'text-primary' },
  chat: { label: '聊天', color: 'text-text' },
  character: { label: '角色', color: 'text-success' },
} as const

/** 默认 API 与 Socket 地址（兜底） */
export const DEFAULT_API_URL = 'http://localhost:3000'
export const DEFAULT_SOCKET_URL = 'http://localhost:3000'

/** localStorage 存储键（用于刷新重连） */
export const STORAGE_KEYS = {
  playerId: 'trpg_player_id',
  roomCode: 'trpg_room_code',
  playerName: 'trpg_player_name',
  role: 'trpg_role',
  ruleSystem: 'trpg_rule_system',
} as const
