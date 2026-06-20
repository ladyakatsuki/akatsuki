import { DiceRollResolver } from '../DiceRollResolver.js';
import type { DiceRollResult } from '../../types/rules.js';

/**
 * DND 5E 技能与关联属性映射
 *
 * 用于 rollSkill 检定时查找技能对应的属性调整值。
 * 与 Dnd5eRuleSystem 中的技能模式保持一致。
 */
const SKILL_ATTRIBUTES: Record<string, string> = {
  athletics: 'str',
  acrobatics: 'dex',
  sleightOfHand: 'dex',
  stealth: 'dex',
  arcana: 'int',
  history: 'int',
  investigation: 'int',
  nature: 'int',
  religion: 'int',
  animalHandling: 'wis',
  insight: 'wis',
  medicine: 'wis',
  perception: 'wis',
  survival: 'wis',
  deception: 'cha',
  intimidation: 'cha',
  performance: 'cha',
  persuasion: 'cha',
};

/** 属性调整值 key 列表，用于表达式替换 */
const ABILITY_MOD_KEYS = [
  'strMod',
  'conMod',
  'dexMod',
  'intMod',
  'wisMod',
  'chaMod',
];

/**
 * DND 5E 骰子解析器
 *
 * 继承通用 DiceRollResolver，扩展 DND 5E 特有的掷骰逻辑：
 * - 优势/劣势掷骰（rollWithAdvantage）
 * - 技能检定（rollSkill）
 * - 豁免检定（rollSave）
 * - 攻击检定（rollAttack）
 * - 伤害掷骰（rollDamage）
 */
export class Dnd5eRollResolver extends DiceRollResolver {
  /**
   * DND 5E 优势/劣势掷骰
   *
   * 优势：掷两次 d20 取较高；劣势：掷两次 d20 取较低。
   * 结果中 rolls 包含两次掷骰，kept 包含被保留的那次。
   *
   * @param expression 骰子表达式，如 '1d20' 或 '1d20+5'
   * @param advantage true 为优势，false 为劣势
   */
  override rollWithAdvantage(
    expression: string,
    advantage: boolean,
  ): DiceRollResult {
    const first = this.roll(expression);
    const second = this.roll(expression);
    // 合并两次掷骰的原始骰子结果
    const allRolls = [...first.rolls, ...second.rolls];
    // 选择较高/较低的总计
    const chosen = advantage
      ? first.total >= second.total
        ? first
        : second
      : first.total <= second.total
        ? first
        : second;

    return {
      expression,
      rolls: allRolls,
      kept: chosen.kept,
      modifier: chosen.modifier,
      total: chosen.total,
      label: advantage ? '优势' : '劣势',
    };
  }

  /**
   * 技能检定
   *
   * 公式：d20 + 属性调整值 + 熟练加值×熟练等级
   * 熟练等级：0=未熟练、1=熟练、2=精通
   *
   * @param skillKey 技能 key，如 'athletics'
   * @param character 角色数据，需包含属性调整值、技能熟练度、熟练加值
   */
  rollSkill(
    skillKey: string,
    character: Record<string, unknown>,
  ): DiceRollResult {
    const attrKey = SKILL_ATTRIBUTES[skillKey];
    if (!attrKey) {
      throw new Error(`未知技能: ${skillKey}`);
    }

    const attrMod = this.getNumber(character, `${attrKey}Mod`);
    const proficiencyLevel = this.getSkillProficiency(character, skillKey);
    const proficiencyBonus = this.getNumber(character, 'proficiencyBonus');

    const bonus = attrMod + proficiencyLevel * proficiencyBonus;
    return this.rollWithBonus('1d20', bonus, skillKey);
  }

  /**
   * 豁免检定
   *
   * 公式：d20 + 属性调整值 +（熟练时）熟练加值
   *
   * @param attributeKey 属性 key，如 'dex'
   * @param character 角色数据，需包含属性调整值、豁免熟练、熟练加值
   */
  rollSave(
    attributeKey: string,
    character: Record<string, unknown>,
  ): DiceRollResult {
    const attrMod = this.getNumber(character, `${attributeKey}Mod`);
    const isProficient = this.getBoolean(
      character,
      `${attributeKey}SaveProficient`,
    );
    const proficiencyBonus = this.getNumber(character, 'proficiencyBonus');

    const bonus = attrMod + (isProficient ? proficiencyBonus : 0);
    return this.rollWithBonus('1d20', bonus, `${attributeKey}豁免`);
  }

  /**
   * 攻击检定
   *
   * 公式：d20 + 攻击加值
   * 攻击加值可为数字、属性调整值引用（如 'strMod'）或骰子表达式（如 '1d4'）
   *
   * @param expression 攻击加值表达式
   * @param character 角色数据
   */
  rollAttack(
    expression: string,
    character: Record<string, unknown>,
  ): DiceRollResult {
    const bonus = this.resolveValue(expression, character);
    const d20 = this.roll('1d20');
    return {
      expression: `1d20+${expression}`,
      rolls: d20.rolls,
      kept: d20.kept,
      modifier: bonus,
      total: d20.total + bonus,
      label: '攻击',
    };
  }

  /**
   * 伤害掷骰
   *
   * 公式：表达式 + 属性调整值
   * 表达式中可包含属性调整值引用（如 '1d8+strMod'），会被替换为实际数值后掷骰。
   *
   * @param expression 伤害骰子表达式，如 '1d8+strMod'
   * @param character 角色数据
   */
  rollDamage(
    expression: string,
    character: Record<string, unknown>,
  ): DiceRollResult {
    const substituted = this.substituteAbilityMods(expression, character);
    return this.roll(substituted);
  }

  /**
   * 掷 d20 并加上固定加值
   */
  private rollWithBonus(
    baseExpr: string,
    bonus: number,
    label: string,
  ): DiceRollResult {
    const d20 = this.roll(baseExpr);
    return {
      expression: bonus >= 0 ? `${baseExpr}+${bonus}` : `${baseExpr}${bonus}`,
      rolls: d20.rolls,
      kept: d20.kept,
      modifier: bonus,
      total: d20.total + bonus,
      label,
    };
  }

  /**
   * 解析加值表达式
   *
   * 支持纯数字、属性调整值引用、骰子表达式。
   */
  private resolveValue(
    expression: string,
    character: Record<string, unknown>,
  ): number {
    const trimmed = expression.trim();
    // 属性调整值引用
    if (ABILITY_MOD_KEYS.includes(trimmed)) {
      return this.getNumber(character, trimmed);
    }
    // 纯数字
    const num = Number(trimmed);
    if (!Number.isNaN(num)) {
      return num;
    }
    // 骰子表达式
    return this.roll(trimmed).total;
  }

  /**
   * 替换表达式中的属性调整值引用为实际数值
   *
   * 正确处理前置符号，避免出现 ++ 或 +- 等非法表达式。
   * 例如 '1d8+strMod' 在 strMod=3 时变为 '1d8+3'，
   * '1d8+strMod' 在 strMod=-1 时变为 '1d8-1'。
   */
  private substituteAbilityMods(
    expression: string,
    character: Record<string, unknown>,
  ): string {
    let result = expression;
    for (const modKey of ABILITY_MOD_KEYS) {
      if (!result.includes(modKey)) continue;
      const value = this.getNumber(character, modKey);
      // 匹配可选的前置符号 + 属性调整值 key
      const regex = new RegExp(`([+-]?)${modKey}`, 'g');
      result = result.replace(regex, (_match: string, sign: string) => {
        if (sign === '-') {
          // -strMod：取反
          const negated = -value;
          return negated >= 0 ? `+${negated}` : `${negated}`;
        }
        // +strMod 或无符号 strMod
        return value >= 0 ? `+${value}` : `${value}`;
      });
    }
    return result;
  }

  /**
   * 从角色数据中安全读取数值
   */
  private getNumber(
    character: Record<string, unknown>,
    key: string,
  ): number {
    const value = character[key];
    if (typeof value === 'number') {
      return value;
    }
    return 0;
  }

  /**
   * 从角色数据中安全读取布尔值
   */
  private getBoolean(
    character: Record<string, unknown>,
    key: string,
  ): boolean {
    const value = character[key];
    return value === true;
  }

  /**
   * 获取技能熟练等级
   *
   * 支持数字（0/1/2）与布尔值（true=熟练=1，false=未熟练=0）
   */
  private getSkillProficiency(
    character: Record<string, unknown>,
    skillKey: string,
  ): number {
    const value = character[skillKey];
    if (typeof value === 'number') {
      return value;
    }
    if (value === true) {
      return 1;
    }
    return 0;
  }
}
