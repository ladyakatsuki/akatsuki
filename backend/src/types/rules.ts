/**
 * 规则系统类型定义
 *
 * 定义 DND 5E 与 COC 7版规则系统的统一接口，包括骰子表达式、
 * 属性/技能模式、角色卡模板、战斗规则以及规则系统接口。
 * 本文件为 Task 4（DND 5E）与 Task 5（COC 7版）实现奠定基础。
 */

/** 骰子类型 */
export type DiceType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

/** 成功等级（COC d100 用） */
export type SuccessLevel = 'critical' | 'extreme' | 'hard' | 'regular' | 'fumble' | null;

/** 骰子表达式解析结果 */
export interface DiceExpression {
  /** 骰子数量 */
  count: number;
  /** 面数 */
  sides: number;
  /** 加值 */
  modifier: number;
  /** 保留最高 N 个（优势） */
  keepHigh?: number;
  /** 保留最低 N 个（劣势） */
  keepLow?: number;
  /** 奖金骰数量（COC） */
  bonusDice?: number;
  /** 惩罚骰数量（COC） */
  penaltyDice?: number;
}

/** 骰子掷骰结果 */
export interface DiceRollResult {
  /** 原始表达式 */
  expression: string;
  /** 所有骰子结果 */
  rolls: number[];
  /** 保留的骰子 */
  kept: number[];
  /** 加值 */
  modifier: number;
  /** 总计 */
  total: number;
  /** 标签（如"优势"、"奖金骰"） */
  label?: string;
  /** 成功等级（COC 用） */
  successLevel?: SuccessLevel;
}

/** 属性定义 */
export interface AttributeDef {
  /** 属性 key，如 'str', 'con' */
  key: string;
  /** 显示名，如"力量" */
  name: string;
  /** 缩写，如"STR" */
  abbreviation: string;
  /** 描述 */
  description?: string;
  defaultValue: number;
  /** 最小值 */
  min?: number;
  /** 最大值 */
  max?: number;
}

/** 技能定义 */
export interface SkillDef {
  /** 技能 key，如 'athletics' */
  key: string;
  /** 显示名 */
  name: string;
  /** 关联属性 key */
  attribute: string;
  defaultValue: number;
  /** 分类（如"战斗"、"调查"） */
  category?: string;
  /** 描述 */
  description?: string;
}

/** 角色卡字段类型 */
export type SheetFieldType = 'number' | 'text' | 'textarea' | 'select' | 'checkbox';

/** 角色卡字段定义 */
export interface SheetFieldDef {
  key: string;
  label: string;
  type: SheetFieldType;
  defaultValue: string | number | boolean;
  /** select 选项 */
  options?: string[];
  /** 是否为计算字段（只读） */
  computed?: boolean;
  /** 计算公式 */
  formula?: string;
  /** 所属分页 key */
  section?: string;
}

/** 角色卡分页 */
export interface SheetSection {
  key: string;
  title: string;
  icon?: string;
}

/** 角色卡模板 */
export interface SheetTemplate {
  /** 分页 */
  sections: SheetSection[];
  /** 所有字段 */
  fields: SheetFieldDef[];
}

/** 状态效果持续类型 */
export type StatusEffectDuration = 'round' | 'minute' | 'hour' | 'permanent';

/** 状态效果定义 */
export interface StatusEffectDef {
  key: string;
  name: string;
  description: string;
  icon?: string;
  duration?: StatusEffectDuration;
}

/** 战斗规则 */
export interface CombatRules {
  /** 先攻公式 */
  initiativeFormula: string;
  /** 先攻关联属性 */
  initiativeAttribute?: string;
  /** 速度关联属性 */
  speedAttribute?: string;
  /** 防御关联属性（DND AC） */
  acAttribute?: string;
  /** 状态效果列表 */
  statusEffects: StatusEffectDef[];
}

/** 骰子解析器接口 */
export interface RollResolver {
  /** 解析骰子表达式 */
  parse(expression: string): DiceExpression;
  /** 掷骰 */
  roll(expression: string | DiceExpression): DiceRollResult;
  /** DND 优势/劣势掷骰 */
  rollWithAdvantage(expression: string, advantage: boolean): DiceRollResult;
  /** COC 奖金骰/惩罚骰掷骰 */
  rollWithBonusPenalty(expression: string, bonus: number, penalty: number): DiceRollResult;
  /** COC 成功判定 */
  evaluateSuccess(roll: number, target: number): SuccessLevel;
}

/** 规则系统主题标识 */
export type RuleSystemTheme = 'dnd' | 'coc';

/** 规则系统接口 */
export interface RuleSystem {
  /** 规则系统标识，如 'dnd5e' | 'coc7' */
  id: string;
  /** 显示名 */
  name: string;
  /** 规则版本 */
  version: string;
  /** 描述 */
  description: string;
  /** 主题标识 */
  theme: RuleSystemTheme;
  /** 支持的骰子类型 */
  diceTypes: DiceType[];
  /** 属性模式 */
  attributeSchema: AttributeDef[];
  /** 技能模式 */
  skillSchema: SkillDef[];
  /** 角色卡模板 */
  characterSheetTemplate: SheetTemplate;
  /** 战斗规则 */
  combatRules: CombatRules;
  /** 骰子解析器 */
  rollResolver: RollResolver;
  /** 创建默认角色数据 */
  createDefaultCharacter(): Record<string, unknown>;
  /** 计算派生属性 */
  computeDerived(attributes: Record<string, number>): Record<string, number>;
}
