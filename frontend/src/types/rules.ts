// 规则系统相关类型（占位，Task 3-5 实现）

import type { RuleSet } from './models'

/** 规则集元信息 */
export interface RuleSetMeta {
  key: RuleSet
  label: string
  shortLabel: string
  description: string
  /** 主题标识，对应 html[data-theme] */
  theme: 'dnd' | 'coc'
}

/** DND 5E 能力值 */
export interface DndAbilityScores {
  strength: number
  dexterity: number
  constitution: number
  intelligence: number
  wisdom: number
  charisma: number
}

/** COC 7版属性 */
export interface CocAttributes {
  str: number
  con: number
  siz: number
  dex: number
  app: number
  int: number
  pow: number
  edu: number
}

/** 规则集校验结果 */
export interface RuleValidationResult {
  valid: boolean
  errors: string[]
}
