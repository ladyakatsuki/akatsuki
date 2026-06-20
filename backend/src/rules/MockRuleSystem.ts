import type {
  AttributeDef,
  CombatRules,
  DiceType,
  RuleSystem,
  SheetTemplate,
  SkillDef,
} from '../types/rules.js';
import { DiceRollResolver } from './DiceRollResolver.js';

/** Mock 规则系统属性模式 */
const attributeSchema: AttributeDef[] = [
  {
    key: 'str',
    name: '力量',
    abbreviation: 'STR',
    description: 'Mock 力量属性',
    defaultValue: 10,
    min: 1,
    max: 30,
  },
  {
    key: 'dex',
    name: '敏捷',
    abbreviation: 'DEX',
    description: 'Mock 敏捷属性',
    defaultValue: 10,
    min: 1,
    max: 30,
  },
];

/** Mock 规则系统技能模式 */
const skillSchema: SkillDef[] = [
  {
    key: 'athletics',
    name: '运动',
    attribute: 'str',
    defaultValue: 0,
    category: '体能',
    description: 'Mock 运动技能',
  },
  {
    key: 'stealth',
    name: '潜行',
    attribute: 'dex',
    defaultValue: 0,
    category: '体能',
    description: 'Mock 潜行技能',
  },
];

/** Mock 角色卡模板 */
const characterSheetTemplate: SheetTemplate = {
  sections: [
    { key: 'basic', title: '基础', icon: 'user' },
    { key: 'combat', title: '战斗', icon: 'sword' },
  ],
  fields: [
    { key: 'name', label: '姓名', type: 'text', defaultValue: '', section: 'basic' },
    { key: 'str', label: '力量', type: 'number', defaultValue: 10, section: 'basic' },
    { key: 'dex', label: '敏捷', type: 'number', defaultValue: 10, section: 'basic' },
    {
      key: 'strMod',
      label: '力量调整值',
      type: 'number',
      defaultValue: 0,
      computed: true,
      formula: 'floor((str - 10) / 2)',
      section: 'basic',
    },
    {
      key: 'dexMod',
      label: '敏捷调整值',
      type: 'number',
      defaultValue: 0,
      computed: true,
      formula: 'floor((dex - 10) / 2)',
      section: 'basic',
    },
    { key: 'athletics', label: '运动', type: 'number', defaultValue: 0, section: 'basic' },
    { key: 'stealth', label: '潜行', type: 'number', defaultValue: 0, section: 'basic' },
    { key: 'maxHp', label: '最大生命值', type: 'number', defaultValue: 10, section: 'combat' },
    { key: 'hp', label: '当前生命值', type: 'number', defaultValue: 10, section: 'combat' },
    { key: 'ac', label: '防御等级', type: 'number', defaultValue: 10, section: 'combat' },
  ],
};

/** Mock 战斗规则 */
const combatRules: CombatRules = {
  initiativeFormula: '1d20+dexMod',
  initiativeAttribute: 'dex',
  speedAttribute: 'dex',
  acAttribute: 'dex',
  statusEffects: [
    {
      key: 'poisoned',
      name: '中毒',
      description: '攻击检定与属性检定劣势',
      duration: 'minute',
    },
    {
      key: 'stunned',
      name: '眩晕',
      description: '无法行动',
      duration: 'round',
    },
  ],
};

/** Mock 支持的骰子类型 */
const diceTypes: DiceType[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

/**
 * Mock 规则系统
 *
 * 用于测试规则系统抽象层，包含 2 个属性、2 个技能、
 * 简单的角色卡模板与基础战斗规则，使用通用骰子解析器。
 */
export const mockRuleSystem: RuleSystem = {
  id: 'mock',
  name: 'Mock 规则系统',
  version: '0.1.0',
  description: '用于测试规则系统抽象层的 mock 实现',
  theme: 'dnd',
  diceTypes,
  attributeSchema,
  skillSchema,
  characterSheetTemplate,
  combatRules,
  rollResolver: new DiceRollResolver(),

  /**
   * 创建默认角色数据
   * 根据属性模式与角色卡模板生成默认值
   */
  createDefaultCharacter(): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    // 属性默认值
    for (const attr of attributeSchema) {
      data[attr.key] = attr.defaultValue;
    }

    // 技能默认值
    for (const skill of skillSchema) {
      data[skill.key] = skill.defaultValue;
    }

    // 角色卡字段默认值（跳过计算字段，由 computeDerived 计算）
    for (const field of characterSheetTemplate.fields) {
      if (field.computed) continue;
      if (data[field.key] === undefined) {
        data[field.key] = field.defaultValue;
      }
    }

    // 派生属性
    const attributes: Record<string, number> = {};
    for (const attr of attributeSchema) {
      attributes[attr.key] = attr.defaultValue;
    }
    const derived = this.computeDerived(attributes);
    for (const [key, value] of Object.entries(derived)) {
      data[key] = value;
    }

    return data;
  },

  /**
   * 计算派生属性
   * 调整值 = floor((属性值 - 10) / 2)
   */
  computeDerived(attributes: Record<string, number>): Record<string, number> {
    const result: Record<string, number> = {};
    for (const attr of attributeSchema) {
      const value = attributes[attr.key] ?? attr.defaultValue;
      result[`${attr.key}Mod`] = Math.floor((value - 10) / 2);
    }
    return result;
  },
};
