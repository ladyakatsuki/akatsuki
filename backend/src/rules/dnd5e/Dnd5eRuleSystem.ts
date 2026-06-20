import type {
  AttributeDef,
  CombatRules,
  DiceType,
  RuleSystem,
  SheetFieldDef,
  SheetSection,
  SheetTemplate,
  SkillDef,
  StatusEffectDef,
} from '../../types/rules.js';
import { Dnd5eRollResolver } from './Dnd5eRollResolver.js';

/**
 * DND 5E 简版规则系统
 *
 * 实现龙与地下城第五版核心规则，包括：
 * - 6 项属性（STR/DEX/CON/INT/WIS/CHA）
 * - 18 项技能（含关联属性）
 * - 角色卡模板（7 个分页）
 * - 战斗规则（先攻、状态效果）
 * - 熟练加值按等级计算
 */

/** 属性 key 列表 */
const ATTRIBUTE_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

/** DND 5E 属性模式（6 项） */
const attributeSchema: AttributeDef[] = [
  {
    key: 'str',
    name: '力量',
    abbreviation: 'STR',
    description: '衡量角色体能与爆发力',
    defaultValue: 10,
    min: 1,
    max: 30,
  },
  {
    key: 'dex',
    name: '敏捷',
    abbreviation: 'DEX',
    description: '衡量角色灵活与协调性',
    defaultValue: 10,
    min: 1,
    max: 30,
  },
  {
    key: 'con',
    name: '体质',
    abbreviation: 'CON',
    description: '衡量角色耐力与生命力',
    defaultValue: 10,
    min: 1,
    max: 30,
  },
  {
    key: 'int',
    name: '智力',
    abbreviation: 'INT',
    description: '衡量角色记忆与推理能力',
    defaultValue: 10,
    min: 1,
    max: 30,
  },
  {
    key: 'wis',
    name: '感知',
    abbreviation: 'WIS',
    description: '衡量角色洞察与意志力',
    defaultValue: 10,
    min: 1,
    max: 30,
  },
  {
    key: 'cha',
    name: '魅力',
    abbreviation: 'CHA',
    description: '衡量角色感染力与领导力',
    defaultValue: 10,
    min: 1,
    max: 30,
  },
];

/** DND 5E 技能模式（18 项） */
const skillSchema: SkillDef[] = [
  // 力量
  { key: 'athletics', name: '运动', attribute: 'str', defaultValue: 0, category: '力量' },
  // 敏捷
  { key: 'acrobatics', name: '杂技', attribute: 'dex', defaultValue: 0, category: '敏捷' },
  { key: 'sleightOfHand', name: '巧手', attribute: 'dex', defaultValue: 0, category: '敏捷' },
  { key: 'stealth', name: '隐匿', attribute: 'dex', defaultValue: 0, category: '敏捷' },
  // 智力
  { key: 'arcana', name: '奥秘', attribute: 'int', defaultValue: 0, category: '智力' },
  { key: 'history', name: '历史', attribute: 'int', defaultValue: 0, category: '智力' },
  { key: 'investigation', name: '调查', attribute: 'int', defaultValue: 0, category: '智力' },
  { key: 'nature', name: '自然', attribute: 'int', defaultValue: 0, category: '智力' },
  { key: 'religion', name: '宗教', attribute: 'int', defaultValue: 0, category: '智力' },
  // 感知
  { key: 'animalHandling', name: '驯兽', attribute: 'wis', defaultValue: 0, category: '感知' },
  { key: 'insight', name: '洞察', attribute: 'wis', defaultValue: 0, category: '感知' },
  { key: 'medicine', name: '医药', attribute: 'wis', defaultValue: 0, category: '感知' },
  { key: 'perception', name: '察觉', attribute: 'wis', defaultValue: 0, category: '感知' },
  { key: 'survival', name: '求生', attribute: 'wis', defaultValue: 0, category: '感知' },
  // 魅力
  { key: 'deception', name: '欺瞒', attribute: 'cha', defaultValue: 0, category: '魅力' },
  { key: 'intimidation', name: '威吓', attribute: 'cha', defaultValue: 0, category: '魅力' },
  { key: 'performance', name: '表演', attribute: 'cha', defaultValue: 0, category: '魅力' },
  { key: 'persuasion', name: '说服', attribute: 'cha', defaultValue: 0, category: '魅力' },
];

/** 角色卡分页 */
const sections: SheetSection[] = [
  { key: 'basic', title: '基础', icon: 'user' },
  { key: 'attributes', title: '属性', icon: 'star' },
  { key: 'combat', title: '战斗', icon: 'sword' },
  { key: 'skills', title: '技能', icon: 'list' },
  { key: 'spells', title: '法术', icon: 'magic' },
  { key: 'background', title: '背景', icon: 'book' },
  { key: 'inventory', title: '物品', icon: 'bag' },
];

/** 法术施法属性选项 */
const SPELLCASTING_OPTIONS = ['none', 'str', 'dex', 'con', 'int', 'wis', 'cha'];

/** 构建角色卡字段 */
function buildFields(): SheetFieldDef[] {
  const fields: SheetFieldDef[] = [];

  // 基础分页
  fields.push({ key: 'name', label: '姓名', type: 'text', defaultValue: '', section: 'basic' });
  fields.push({ key: 'class', label: '职业', type: 'text', defaultValue: '', section: 'basic' });
  fields.push({ key: 'level', label: '等级', type: 'number', defaultValue: 1, section: 'basic' });
  fields.push({ key: 'race', label: '种族', type: 'text', defaultValue: '', section: 'basic' });
  fields.push({ key: 'background', label: '背景', type: 'text', defaultValue: '', section: 'basic' });
  fields.push({ key: 'alignment', label: '阵营', type: 'text', defaultValue: '', section: 'basic' });
  fields.push({ key: 'experience', label: '经验值', type: 'number', defaultValue: 0, section: 'basic' });

  // 属性分页
  for (const attr of attributeSchema) {
    fields.push({
      key: attr.key,
      label: attr.name,
      type: 'number',
      defaultValue: attr.defaultValue,
      section: 'attributes',
    });
  }
  for (const attr of attributeSchema) {
    fields.push({
      key: `${attr.key}Mod`,
      label: `${attr.name}调整值`,
      type: 'number',
      defaultValue: 0,
      computed: true,
      formula: `floor((${attr.key} - 10) / 2)`,
      section: 'attributes',
    });
  }
  // 豁免熟练
  for (const attr of attributeSchema) {
    fields.push({
      key: `${attr.key}SaveProficient`,
      label: `${attr.name}豁免熟练`,
      type: 'checkbox',
      defaultValue: false,
      section: 'attributes',
    });
  }

  // 战斗分页
  fields.push({ key: 'hp', label: '当前生命值', type: 'number', defaultValue: 10, section: 'combat' });
  fields.push({ key: 'maxHp', label: '最大生命值', type: 'number', defaultValue: 10, section: 'combat' });
  fields.push({ key: 'ac', label: '防御等级', type: 'number', defaultValue: 10, section: 'combat' });
  fields.push({ key: 'speed', label: '速度', type: 'number', defaultValue: 30, section: 'combat' });
  fields.push({
    key: 'initiative',
    label: '先攻',
    type: 'number',
    defaultValue: 0,
    computed: true,
    formula: 'dexMod',
    section: 'combat',
  });
  fields.push({
    key: 'proficiencyBonus',
    label: '熟练加值',
    type: 'number',
    defaultValue: 2,
    computed: true,
    formula: 'byLevel',
    section: 'combat',
  });

  // 技能分页
  for (const skill of skillSchema) {
    fields.push({
      key: skill.key,
      label: skill.name,
      type: 'checkbox',
      defaultValue: false,
      section: 'skills',
    });
  }
  fields.push({
    key: 'passivePerception',
    label: '被动察觉',
    type: 'number',
    defaultValue: 10,
    computed: true,
    formula: '10 + wisMod + 熟练加值',
    section: 'skills',
  });

  // 法术分页
  fields.push({
    key: 'spellcastingAbility',
    label: '施法属性',
    type: 'select',
    defaultValue: 'none',
    options: SPELLCASTING_OPTIONS,
    section: 'spells',
  });
  for (let i = 1; i <= 9; i++) {
    fields.push({
      key: `spellSlot${i}`,
      label: `${i}环法术位`,
      type: 'number',
      defaultValue: 0,
      section: 'spells',
    });
  }

  // 背景分页
  fields.push({ key: 'personalityTraits', label: '性格特征', type: 'textarea', defaultValue: '', section: 'background' });
  fields.push({ key: 'ideals', label: '理想', type: 'textarea', defaultValue: '', section: 'background' });
  fields.push({ key: 'bonds', label: '羁绊', type: 'textarea', defaultValue: '', section: 'background' });
  fields.push({ key: 'flaws', label: '缺陷', type: 'textarea', defaultValue: '', section: 'background' });

  // 物品分页
  fields.push({ key: 'inventory', label: '物品栏', type: 'textarea', defaultValue: '', section: 'inventory' });

  return fields;
}

/** DND 5E 角色卡模板 */
const characterSheetTemplate: SheetTemplate = {
  sections,
  fields: buildFields(),
};

/** DND 5E 状态效果列表（15 项标准状态） */
const statusEffects: StatusEffectDef[] = [
  {
    key: 'blinded',
    name: '目盲',
    description: '无法视物，攻击检定劣势，对可见目标的攻击检定优势，依赖视觉的察觉检定劣势。',
    duration: 'minute',
  },
  {
    key: 'charmed',
    name: '魅惑',
    description: '无法攻击魅惑者，魅惑者对你的社交检定有能力检定优势。',
    duration: 'minute',
  },
  {
    key: 'deafened',
    name: '耳聋',
    description: '无法听见，依赖听觉的察觉检定劣势。',
    duration: 'minute',
  },
  {
    key: 'frightened',
    name: '恐惧',
    description: '恐惧源在视线内时属性检定与攻击检定劣势，不能自愿靠近恐惧源。',
    duration: 'minute',
  },
  {
    key: 'grappled',
    name: '擒抱',
    description: '速度降为 0，结束擒抱者效应时解除。',
    duration: 'round',
  },
  {
    key: 'incapacitated',
    name: '失能',
    description: '无法行动或反应，专注被打破。',
    duration: 'round',
  },
  {
    key: 'invisible',
    name: '隐形',
    description: '无法被视觉察觉，攻击检定优势，对自身的攻击检定劣势。',
    duration: 'minute',
  },
  {
    key: 'paralyzed',
    name: '麻痹',
    description: '失能且无法移动或说话，敏捷豁免检定失败，对麻痹者的近战攻击优势且为暴击。',
    duration: 'minute',
  },
  {
    key: 'petrified',
    name: '石化',
    description: '变为石质雕像，失能且无法移动或说话，攻击检定优势，敏捷豁免检定失败。',
    duration: 'permanent',
  },
  {
    key: 'poisoned',
    name: '中毒',
    description: '攻击检定与属性检定劣势。',
    duration: 'minute',
  },
  {
    key: 'prone',
    name: '倒地',
    description: '爬行移动，近战攻击劣势，5 尺内攻击优势，5 尺外攻击劣势。',
    duration: 'round',
  },
  {
    key: 'restrained',
    name: '束缚',
    description: '速度降为 0，攻击检定与敏捷豁免检定劣势，对自身的攻击检定优势。',
    duration: 'minute',
  },
  {
    key: 'stunned',
    name: '压制',
    description: '失能且无法移动，豁免检定失败，对压制者的攻击检定优势。',
    duration: 'round',
  },
  {
    key: 'unconscious',
    name: '昏迷',
    description: '失能且无法移动或行动，倒地且无法感知周围，攻击检定优势且为暴击。',
    duration: 'round',
  },
  {
    key: 'exhaustion',
    name: '力竭',
    description: '分 6 级，每级能力检定减半，移动速度减半，6 级死亡。',
    duration: 'permanent',
  },
];

/** DND 5E 战斗规则 */
const combatRules: CombatRules = {
  initiativeFormula: '1d20+dexMod',
  initiativeAttribute: 'dex',
  speedAttribute: 'speed',
  // AC 为独立字段，无关联属性
  acAttribute: undefined,
  statusEffects,
};

/** DND 5E 支持的骰子类型 */
const diceTypes: DiceType[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

/**
 * 计算熟练加值
 *
 * 1-4 级：+2，5-8 级：+3，9-12 级：+4，
 * 13-16 级：+5，17-20 级：+6
 */
function getProficiencyBonus(level: number): number {
  const clamped = Math.max(1, Math.min(20, level));
  return Math.floor((clamped - 1) / 4) + 2;
}

/**
 * 计算属性调整值
 * 公式：floor((value - 10) / 2)
 */
function getAbilityModifier(value: number): number {
  return Math.floor((value - 10) / 2);
}

/**
 * DND 5E 规则系统实例
 */
export const dnd5eRuleSystem: RuleSystem = {
  id: 'dnd5e',
  name: 'DND 5E',
  version: '5e',
  description: '龙与地下城第五版简版规则系统',
  theme: 'dnd',
  diceTypes,
  attributeSchema,
  skillSchema,
  characterSheetTemplate,
  combatRules,
  rollResolver: new Dnd5eRollResolver(),

  /**
   * 创建默认角色数据
   *
   * 返回包含所有字段默认值的角色数据对象，包括计算后的派生属性。
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

    // 角色卡字段默认值（跳过计算字段）
    for (const field of characterSheetTemplate.fields) {
      if (field.computed) continue;
      if (data[field.key] === undefined) {
        data[field.key] = field.defaultValue;
      }
    }

    // 计算派生属性
    const attributes: Record<string, number> = {};
    for (const attr of attributeSchema) {
      attributes[attr.key] = attr.defaultValue;
    }
    attributes.level = data.level as number;
    const derived = this.computeDerived(attributes);
    for (const [key, value] of Object.entries(derived)) {
      data[key] = value;
    }

    // 被动察觉 = 10 + wisMod +（察觉熟练时）熟练加值
    const wisMod = derived.wisMod;
    const profBonus = derived.proficiencyBonus;
    const perceptionProficient = data.perception as number;
    const perceptionLevel =
      typeof perceptionProficient === 'number' ? perceptionProficient : 0;
    data.passivePerception = 10 + wisMod + perceptionLevel * profBonus;

    // 先攻 = dexMod
    data.initiative = derived.dexMod;

    return data;
  },

  /**
   * 计算派生属性
   *
   * 返回各属性调整值与熟练加值。
   * level 从 attributes 读取，未提供时默认 1 级。
   */
  computeDerived(attributes: Record<string, number>): Record<string, number> {
    const result: Record<string, number> = {};

    // 各属性调整值
    for (const attr of attributeSchema) {
      const value = attributes[attr.key] ?? attr.defaultValue;
      result[`${attr.key}Mod`] = getAbilityModifier(value);
    }

    // 熟练加值（按等级）
    const level = attributes.level ?? 1;
    result.proficiencyBonus = getProficiencyBonus(level);

    return result;
  },
};

export { ATTRIBUTE_KEYS };
