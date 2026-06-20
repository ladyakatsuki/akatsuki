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
import { Coc7RollResolver } from './Coc7RollResolver.js';

/**
 * COC 7版规则系统
 *
 * 实现克苏鲁的呼唤第七版核心规则，包括：
 * - 8 项核心属性（STR/CON/SIZ/DEX/APP/INT/POW/EDU，d100 制）
 * - 派生属性（HP/MP/SAN/DB/Build/MOV/Luck）
 * - 完整技能列表（按战斗/调查/行动/社交/学识分类）
 * - 角色卡模板（分页）
 * - 战斗规则（先攻、状态效果）
 * - d100 检定、奖金骰/惩罚骰、成功等级判定
 */

/** 属性 key 列表 */
const ATTRIBUTE_KEYS = [
  'str',
  'con',
  'siz',
  'dex',
  'app',
  'int',
  'pow',
  'edu',
] as const;

/** COC 7版属性模式（8 项核心属性，d100 制） */
const attributeSchema: AttributeDef[] = [
  {
    key: 'str',
    name: '力量',
    abbreviation: 'STR',
    description: '衡量角色肌肉力量与爆发力',
    defaultValue: 50,
    min: 1,
    max: 100,
  },
  {
    key: 'con',
    name: '体质',
    abbreviation: 'CON',
    description: '衡量角色健康、体格与生命力',
    defaultValue: 50,
    min: 1,
    max: 100,
  },
  {
    key: 'siz',
    name: '体格',
    abbreviation: 'SIZ',
    description: '衡量角色身高与体重',
    defaultValue: 50,
    min: 1,
    max: 100,
  },
  {
    key: 'dex',
    name: '敏捷',
    abbreviation: 'DEX',
    description: '衡量角色灵活、反应与协调性',
    defaultValue: 50,
    min: 1,
    max: 100,
  },
  {
    key: 'app',
    name: '外貌',
    abbreviation: 'APP',
    description: '衡量角色魅力与外表',
    defaultValue: 50,
    min: 1,
    max: 100,
  },
  {
    key: 'int',
    name: '智力',
    abbreviation: 'INT',
    description: '衡量角色推理、学习与记忆能力',
    defaultValue: 50,
    min: 1,
    max: 100,
  },
  {
    key: 'pow',
    name: '意志',
    abbreviation: 'POW',
    description: '衡量角色精神力与意志坚定度',
    defaultValue: 50,
    min: 1,
    max: 100,
  },
  {
    key: 'edu',
    name: '教育',
    abbreviation: 'EDU',
    description: '衡量角色所掌握的知识量',
    defaultValue: 50,
    min: 1,
    max: 100,
  },
];

/** COC 7版技能模式（按分类组织） */
const skillSchema: SkillDef[] = [
  // 战斗技能
  { key: 'brawl', name: '斗殴', attribute: 'str', defaultValue: 50, category: '战斗' },
  { key: 'dodge', name: '闪避', attribute: 'dex', defaultValue: 0, category: '战斗', description: '初始 = DEX×2' },
  { key: 'sword', name: '剑术', attribute: 'str', defaultValue: 20, category: '战斗' },
  { key: 'handgun', name: '射击(手枪)', attribute: 'dex', defaultValue: 20, category: '战斗' },
  { key: 'rifle', name: '射击(步枪)', attribute: 'dex', defaultValue: 25, category: '战斗' },
  { key: 'throw', name: '投掷', attribute: 'str', defaultValue: 20, category: '战斗' },
  { key: 'choke', name: '锁喉', attribute: 'str', defaultValue: 20, category: '战斗' },
  { key: 'melee', name: '近战', attribute: 'str', defaultValue: 20, category: '战斗' },
  // 调查技能
  { key: 'libraryUse', name: '图书馆使用', attribute: 'int', defaultValue: 20, category: '调查' },
  { key: 'perception', name: '察觉', attribute: 'int', defaultValue: 20, category: '调查' },
  { key: 'psychology', name: '心理学', attribute: 'int', defaultValue: 10, category: '调查' },
  { key: 'occult', name: '神秘学', attribute: 'int', defaultValue: 5, category: '调查' },
  { key: 'archaeology', name: '考古', attribute: 'edu', defaultValue: 1, category: '调查' },
  { key: 'history', name: '历史', attribute: 'edu', defaultValue: 20, category: '调查' },
  { key: 'naturalWorld', name: '自然', attribute: 'edu', defaultValue: 10, category: '调查' },
  // 行动技能
  { key: 'stealth', name: '潜行', attribute: 'dex', defaultValue: 20, category: '行动' },
  { key: 'listen', name: '聆听', attribute: 'int', defaultValue: 20, category: '行动' },
  { key: 'climb', name: '攀爬', attribute: 'str', defaultValue: 20, category: '行动' },
  { key: 'jump', name: '跳跃', attribute: 'str', defaultValue: 20, category: '行动' },
  { key: 'driveAuto', name: '驾驶(汽车)', attribute: 'dex', defaultValue: 20, category: '行动' },
  { key: 'driveAircraft', name: '驾驶飞行器', attribute: 'dex', defaultValue: 1, category: '行动' },
  { key: 'driveBoat', name: '驾驶船艇', attribute: 'dex', defaultValue: 1, category: '行动' },
  { key: 'ride', name: '骑术', attribute: 'dex', defaultValue: 5, category: '行动' },
  { key: 'swim', name: '潜泳', attribute: 'str', defaultValue: 20, category: '行动' },
  { key: 'survival', name: '生存', attribute: 'int', defaultValue: 10, category: '行动' },
  { key: 'track', name: '追踪', attribute: 'int', defaultValue: 10, category: '行动' },
  // 社交技能
  { key: 'charm', name: '魅惑', attribute: 'app', defaultValue: 5, category: '社交' },
  { key: 'persuasion', name: '说服', attribute: 'app', defaultValue: 10, category: '社交' },
  { key: 'intimidate', name: '恐吓', attribute: 'str', defaultValue: 25, category: '社交' },
  { key: 'reputation', name: '信誉', attribute: 'app', defaultValue: 15, category: '社交' },
  { key: 'sleightOfHand', name: '妙手', attribute: 'dex', defaultValue: 10, category: '社交' },
  { key: 'hypnosis', name: '催眠', attribute: 'pow', defaultValue: 1, category: '社交' },
  { key: 'performance', name: '表演', attribute: 'app', defaultValue: 5, category: '社交' },
  // 学识技能
  { key: 'psychoanalysis', name: '精神分析', attribute: 'int', defaultValue: 10, category: '学识' },
  { key: 'firstAid', name: '急救', attribute: 'int', defaultValue: 30, category: '学识' },
  { key: 'medicine', name: '医学', attribute: 'edu', defaultValue: 5, category: '学识' },
  { key: 'law', name: '法律', attribute: 'edu', defaultValue: 5, category: '学识' },
  { key: 'accounting', name: '会计', attribute: 'edu', defaultValue: 5, category: '学识' },
  { key: 'anthropology', name: '人类学', attribute: 'edu', defaultValue: 1, category: '学识' },
  { key: 'biology', name: '生物学', attribute: 'edu', defaultValue: 1, category: '学识' },
  { key: 'chemistry', name: '化学', attribute: 'edu', defaultValue: 1, category: '学识' },
  { key: 'electronics', name: '电子学', attribute: 'edu', defaultValue: 1, category: '学识' },
  { key: 'geology', name: '地质学', attribute: 'edu', defaultValue: 1, category: '学识' },
  { key: 'electronicRepair', name: '电子维修', attribute: 'dex', defaultValue: 10, category: '学识' },
  { key: 'mechanicalRepair', name: '机械维修', attribute: 'dex', defaultValue: 10, category: '学识' },
  { key: 'artAndCraft', name: '艺术与手艺', attribute: 'dex', defaultValue: 1, category: '学识' },
  { key: 'foreignLanguage', name: '外语', attribute: 'int', defaultValue: 1, category: '学识' },
  { key: 'nativeLanguage', name: '母语', attribute: 'edu', defaultValue: 0, category: '学识', description: '初始 = EDU×5' },
  { key: 'cthulhuMythos', name: '克苏鲁神话', attribute: 'int', defaultValue: 0, category: '学识' },
];

/** 角色卡分页 */
const sections: SheetSection[] = [
  { key: 'basic', title: '基础', icon: 'user' },
  { key: 'attributes', title: '属性', icon: 'star' },
  { key: 'combat_skills', title: '战斗技能', icon: 'sword' },
  { key: 'investigation_skills', title: '调查技能', icon: 'search' },
  { key: 'action_skills', title: '行动技能', icon: 'run' },
  { key: 'social_skills', title: '社交技能', icon: 'chat' },
  { key: 'knowledge_skills', title: '学识技能', icon: 'book' },
  { key: 'combat', title: '战斗', icon: 'crosshair' },
  { key: 'background', title: '背景', icon: 'book' },
  { key: 'inventory', title: '物品', icon: 'bag' },
];

/** 技能分类到分页 key 的映射 */
const CATEGORY_TO_SECTION: Record<string, string> = {
  战斗: 'combat_skills',
  调查: 'investigation_skills',
  行动: 'action_skills',
  社交: 'social_skills',
  学识: 'knowledge_skills',
};

/** 构建角色卡字段 */
function buildFields(): SheetFieldDef[] {
  const fields: SheetFieldDef[] = [];

  // 基础分页
  fields.push({ key: 'name', label: '姓名', type: 'text', defaultValue: '', section: 'basic' });
  fields.push({ key: 'occupation', label: '职业', type: 'text', defaultValue: '', section: 'basic' });
  fields.push({ key: 'age', label: '年龄', type: 'number', defaultValue: 30, section: 'basic' });
  fields.push({ key: 'sex', label: '性别', type: 'text', defaultValue: '', section: 'basic' });
  fields.push({ key: 'residence', label: '居住地', type: 'text', defaultValue: '', section: 'basic' });
  fields.push({ key: 'birthplace', label: '出生地', type: 'text', defaultValue: '', section: 'basic' });

  // 属性分页：8 项核心属性
  for (const attr of attributeSchema) {
    fields.push({
      key: attr.key,
      label: attr.name,
      type: 'number',
      defaultValue: attr.defaultValue,
      section: 'attributes',
    });
  }
  // 派生属性
  fields.push({ key: 'hp', label: '生命值', type: 'number', defaultValue: 10, section: 'attributes' });
  fields.push({ key: 'maxHp', label: '最大生命值', type: 'number', defaultValue: 10, computed: true, formula: 'floor((con+siz)/10)', section: 'attributes' });
  fields.push({ key: 'mp', label: '魔法值', type: 'number', defaultValue: 10, computed: true, formula: 'floor(pow/5)', section: 'attributes' });
  fields.push({ key: 'maxMp', label: '最大魔法值', type: 'number', defaultValue: 10, computed: true, formula: 'floor(pow/5)', section: 'attributes' });
  fields.push({ key: 'san', label: '理智值', type: 'number', defaultValue: 50, section: 'attributes' });
  fields.push({ key: 'maxSan', label: '最大理智值', type: 'number', defaultValue: 99, computed: true, formula: '99-cthulhuMythos', section: 'attributes' });
  fields.push({ key: 'db', label: '伤害加值', type: 'number', defaultValue: 0, computed: true, formula: 'byStrSiz', section: 'attributes' });
  fields.push({ key: 'build', label: '体格', type: 'number', defaultValue: 0, computed: true, formula: 'byStrSiz', section: 'attributes' });
  fields.push({ key: 'mov', label: '移动力', type: 'number', defaultValue: 8, computed: true, formula: 'byDexStrSizAge', section: 'attributes' });
  fields.push({ key: 'luck', label: '幸运', type: 'number', defaultValue: 50, section: 'attributes' });

  // 技能分页（按分类映射到对应分页 key）
  for (const skill of skillSchema) {
    const sectionKey = CATEGORY_TO_SECTION[skill.category ?? ''] ?? 'knowledge_skills';
    fields.push({
      key: skill.key,
      label: skill.name,
      type: 'number',
      defaultValue: skill.defaultValue,
      section: sectionKey,
    });
  }

  // 战斗分页
  fields.push({ key: 'dbCombat', label: '伤害加值', type: 'number', defaultValue: 0, computed: true, formula: 'byStrSiz', section: 'combat' });
  fields.push({ key: 'buildCombat', label: '体格', type: 'number', defaultValue: 0, computed: true, formula: 'byStrSiz', section: 'combat' });
  fields.push({ key: 'weapons', label: '武器列表', type: 'textarea', defaultValue: '', section: 'combat' });

  // 背景分页
  fields.push({ key: 'description', label: '背景描述', type: 'textarea', defaultValue: '', section: 'background' });

  // 物品分页
  fields.push({ key: 'inventory', label: '物品栏', type: 'textarea', defaultValue: '', section: 'inventory' });

  return fields;
}

/** COC 7版角色卡模板 */
const characterSheetTemplate: SheetTemplate = {
  sections,
  fields: buildFields(),
};

/** COC 7版状态效果列表 */
const statusEffects: StatusEffectDef[] = [
  {
    key: 'temporaryInsanity',
    name: '临时疯狂',
    description: '角色陷入短暂的疯狂状态，持续 1d10 轮。',
    duration: 'round',
  },
  {
    key: 'insanity',
    name: '疯狂',
    description: '角色陷入持续疯狂状态，需进行治疗才能恢复。',
    duration: 'hour',
  },
  {
    key: 'unconscious',
    name: '昏迷',
    description: '角色失去意识，无法行动或反应。',
    duration: 'minute',
  },
  {
    key: 'dying',
    name: '濒死',
    description: '角色生命值降为 0，每轮需进行体质检定，失败则死亡。',
    duration: 'round',
  },
  {
    key: 'dead',
    name: '死亡',
    description: '角色已死亡，无法行动。',
    duration: 'permanent',
  },
  {
    key: 'panic',
    name: '恐慌',
    description: '角色陷入恐慌，无法冷静行动。',
    duration: 'round',
  },
  {
    key: 'hysteria',
    name: '歇斯底里',
    description: '角色陷入歇斯底里状态，行为失控。',
    duration: 'minute',
  },
  {
    key: 'paranoia',
    name: '偏执',
    description: '角色陷入偏执状态，对周围事物过度怀疑。',
    duration: 'hour',
  },
  {
    key: 'phobia',
    name: '恐惧症',
    description: '角色获得某种恐惧症，面对特定事物时需进行 SAN 检定。',
    duration: 'permanent',
  },
];

/** COC 7版战斗规则 */
const combatRules: CombatRules = {
  initiativeFormula: '1d100',
  initiativeAttribute: 'dex',
  speedAttribute: 'mov',
  statusEffects,
};

/** COC 7版支持的骰子类型 */
const diceTypes: DiceType[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

/**
 * 查表获取伤害加值（DB）
 *
 * DB 编码：负数与 0 为固定加值；正数表示骰子表达式，
 * 其中 4=1d4，6=1d6，12=2d6，18=3d6，24=4d6，30=5d6，以此类推。
 *
 * @param strSiz STR + SIZ 合计
 * @returns DB 编码值
 */
function getDamageBonus(strSiz: number): number {
  if (strSiz <= 64) return -2;
  if (strSiz <= 84) return -1;
  if (strSiz <= 124) return 0;
  if (strSiz <= 164) return 4; // 1d4
  if (strSiz <= 204) return 6; // 1d6
  if (strSiz <= 284) return 12; // 2d6
  if (strSiz <= 364) return 18; // 3d6
  if (strSiz <= 444) return 24; // 4d6
  if (strSiz <= 524) return 30; // 5d6
  if (strSiz <= 604) return 36; // 6d6
  if (strSiz <= 684) return 42; // 7d6
  if (strSiz <= 764) return 48; // 8d6
  if (strSiz <= 844) return 54; // 9d6
  return 60; // 10d6+
}

/**
 * 查表获取体格（Build）
 *
 * @param strSiz STR + SIZ 合计
 * @returns 体格值
 */
function getBuild(strSiz: number): number {
  if (strSiz <= 64) return -2;
  if (strSiz <= 84) return -1;
  if (strSiz <= 124) return 0;
  if (strSiz <= 164) return 1;
  if (strSiz <= 204) return 2;
  if (strSiz <= 284) return 3;
  if (strSiz <= 364) return 4;
  if (strSiz <= 444) return 5;
  if (strSiz <= 524) return 6;
  if (strSiz <= 604) return 7;
  if (strSiz <= 684) return 8;
  if (strSiz <= 764) return 9;
  if (strSiz <= 844) return 10;
  return 11;
}

/**
 * 计算移动力（MOV）
 *
 * 人类基础 MOV：
 * - DEX < STR < SIZ 或 DEX < SIZ < STR → 7
 * - 其余 → 8
 *
 * 年龄修正：
 * - 40-49: -1，50-59: -2，60-69: -3，70-79: -4，80-89: -5
 *
 * @param dex DEX 值
 * @param str STR 值
 * @param siz SIZ 值
 * @param age 年龄
 * @returns MOV 值（最小为 0）
 */
function getMov(dex: number, str: number, siz: number, age: number): number {
  // 基础 MOV
  const dexBelowBoth = dex < str && dex < siz;
  let mov = dexBelowBoth ? 7 : 8;

  // 年龄修正
  if (age >= 80) mov -= 5;
  else if (age >= 70) mov -= 4;
  else if (age >= 60) mov -= 3;
  else if (age >= 50) mov -= 2;
  else if (age >= 40) mov -= 1;

  return Math.max(0, mov);
}

/**
 * COC 7版规则系统实例
 */
export const coc7RuleSystem: RuleSystem = {
  id: 'coc7',
  name: 'COC 7版',
  version: '7e',
  description: '克苏鲁的呼唤第七版规则系统',
  theme: 'coc',
  diceTypes,
  attributeSchema,
  skillSchema,
  characterSheetTemplate,
  combatRules,
  rollResolver: new Coc7RollResolver(),

  /**
   * 创建默认角色数据
   *
   * 返回包含所有字段默认值的角色数据对象，包括计算后的派生属性。
   * 闪避与母语为派生技能，按规则计算初始值。
   */
  createDefaultCharacter(): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    // 基础字段
    data.name = '';
    data.occupation = '';
    data.age = 30;
    data.sex = '';
    data.residence = '';
    data.birthplace = '';

    // 属性默认值
    for (const attr of attributeSchema) {
      data[attr.key] = attr.defaultValue;
    }

    // 幸运（独立属性）
    data.luck = 50;

    // 技能默认值
    for (const skill of skillSchema) {
      data[skill.key] = skill.defaultValue;
    }

    // 派生技能：闪避 = DEX×2，母语 = EDU×5
    data.dodge = (data.dex as number) * 2;
    data.nativeLanguage = (data.edu as number) * 5;

    // 计算派生属性
    const attributes: Record<string, number> = {};
    for (const attr of attributeSchema) {
      attributes[attr.key] = attr.defaultValue;
    }
    attributes.age = data.age as number;
    attributes.cthulhuMythos = data.cthulhuMythos as number;
    const derived = this.computeDerived(attributes);

    // 写入派生属性
    data.maxHp = derived.maxHp;
    data.hp = derived.maxHp;
    data.maxMp = derived.maxMp;
    data.mp = derived.maxMp;
    data.maxSan = derived.maxSan;
    data.san = data.pow; // 初始 SAN = POW
    data.db = derived.db;
    data.build = derived.build;
    data.mov = derived.mov;
    data.dbCombat = derived.db;
    data.buildCombat = derived.build;

    // 战斗与背景字段
    data.weapons = '';
    data.description = '';
    data.inventory = '';

    return data;
  },

  /**
   * 计算派生属性
   *
   * 返回 maxHp/maxMp/maxSan/db/build/mov 等。
   * age 与 cthulhuMythos 从 attributes 读取，未提供时使用默认值。
   */
  computeDerived(attributes: Record<string, number>): Record<string, number> {
    const result: Record<string, number> = {};

    const con = attributes.con ?? 50;
    const siz = attributes.siz ?? 50;
    const pow = attributes.pow ?? 50;
    const dex = attributes.dex ?? 50;
    const str = attributes.str ?? 50;
    const age = attributes.age ?? 30;
    const cthulhuMythos = attributes.cthulhuMythos ?? 0;

    // HP = (CON + SIZ) / 10 向下取整
    result.maxHp = Math.floor((con + siz) / 10);

    // MP = POW / 5 向下取整
    result.maxMp = Math.floor(pow / 5);

    // 最大 SAN = 99 - 克苏鲁神话技能
    result.maxSan = Math.max(0, 99 - cthulhuMythos);

    // DB 与 Build 查表（STR + SIZ）
    const strSiz = str + siz;
    result.db = getDamageBonus(strSiz);
    result.build = getBuild(strSiz);

    // MOV 查表
    result.mov = getMov(dex, str, siz, age);

    return result;
  },
};

export { ATTRIBUTE_KEYS, getDamageBonus, getBuild, getMov };
