import { randomInt } from 'node:crypto';
import { DiceRollResolver } from '../DiceRollResolver.js';
import type { DiceRollResult, SuccessLevel } from '../../types/rules.js';

/**
 * COC 7版骰子解析器
 *
 * 继承通用 DiceRollResolver，扩展 COC 7版特有的掷骰逻辑：
 * - 奖金骰/惩罚骰掷骰（rollWithBonusPenalty）
 * - 成功等级判定（evaluateSuccess）
 * - 技能检定（rollSkill）
 * - SAN 检定（rollSan）
 * - 幸运检定（rollLuck）
 *
 * COC 7版使用 d100 制，成功等级分为：
 * - 大成功（critical）：掷出 1 且 ≤ 目标值
 * - 极难成功（extreme）：≤ 目标值/5，或掷出 1-5 且 ≤ 目标值
 * - 困难成功（hard）：≤ 目标值/2
 * - 普通成功（regular）：≤ 目标值
 * - 失败（null）：> 目标值且 < 96
 * - 大失败（fumble）：≥ 96（目标值 < 50 时）或 = 100（目标值 ≥ 50 时）
 */
export class Coc7RollResolver extends DiceRollResolver {
  /**
   * COC 7版奖金骰/惩罚骰掷骰
   *
   * 奖金骰：掷 1 个十位骰 + 多个个位骰（数量 = bonus），取个位最小值
   * 惩罚骰：掷 1 个十位骰 + 多个个位骰（数量 = penalty），取个位最大值
   * 奖金骰与惩罚骰同时存在时，相互抵消（取差值）。
   *
   * @param expression 骰子表达式，通常为 '1d100'
   * @param bonus 奖金骰数量
   * @param penalty 惩罚骰数量
   * @returns d100 掷骰结果
   */
  override rollWithBonusPenalty(
    expression: string,
    bonus: number,
    penalty: number,
  ): DiceRollResult {
    // 计算净奖金/惩罚骰数量（相互抵消）
    const netBonus = Math.max(0, bonus - penalty);
    const netPenalty = Math.max(0, penalty - bonus);

    // 十位骰：0-9，代表 0, 10, 20, ..., 90
    const tens = randomInt(0, 10);
    const tensValue = tens * 10;

    // 个位骰：至少 1 个
    const onesCount = Math.max(1, netBonus + netPenalty);
    const onesRolls: number[] = [];
    for (let i = 0; i < onesCount; i++) {
      onesRolls.push(randomInt(0, 10));
    }

    // 选择个位骰
    let chosenOnes: number;
    let label: string | undefined;
    if (netBonus > 0) {
      // 奖金骰：取个位最小值
      chosenOnes = Math.min(...onesRolls);
      label = '奖金骰';
    } else if (netPenalty > 0) {
      // 惩罚骰：取个位最大值
      chosenOnes = Math.max(...onesRolls);
      label = '惩罚骰';
    } else {
      // 无奖金/惩罚骰，取第一个个位骰
      chosenOnes = onesRolls[0];
    }

    // 计算 d100 结果（0 + 0 = 100）
    let total = tensValue + chosenOnes;
    if (total === 0) {
      total = 100;
    }

    return {
      expression,
      rolls: [tensValue, ...onesRolls],
      kept: [chosenOnes],
      modifier: 0,
      total,
      label,
    };
  }

  /**
   * COC 7版成功等级判定
   *
   * @param roll 掷骰结果（1-100）
   * @param target 目标值（技能值或属性值）
   * @returns 成功等级
   */
  override evaluateSuccess(roll: number, target: number): SuccessLevel {
    // 大失败：目标值 < 50 时 96-100 大失败；目标值 ≥ 50 时仅 100 大失败
    const fumbleThreshold = target < 50 ? 96 : 100;
    if (roll >= fumbleThreshold) {
      return 'fumble';
    }

    // 大成功：掷出 1 且 ≤ 目标值
    if (roll === 1 && roll <= target) {
      return 'critical';
    }

    // 极难成功：≤ 目标值/5，或掷出 1-5 且 ≤ 目标值
    const extremeThreshold = Math.floor(target / 5);
    if ((roll <= 5 && roll <= target) || roll <= extremeThreshold) {
      return 'extreme';
    }

    // 困难成功：≤ 目标值/2
    const hardThreshold = Math.floor(target / 2);
    if (roll <= hardThreshold) {
      return 'hard';
    }

    // 普通成功：≤ 目标值
    if (roll <= target) {
      return 'regular';
    }

    // 失败
    return null;
  }

  /**
   * 技能检定
   *
   * 公式：d100 vs 技能值
   *
   * @param skillKey 技能 key，如 'libraryUse'
   * @param character 角色数据，需包含技能值
   * @returns 掷骰结果（含成功等级）
   */
  rollSkill(
    skillKey: string,
    character: Record<string, unknown>,
  ): DiceRollResult {
    const target = this.getNumber(character, skillKey);
    const roll = this.roll('1d100');
    const successLevel = this.evaluateSuccess(roll.total, target);
    return {
      ...roll,
      successLevel,
      label: `技能检定(${skillKey})`,
    };
  }

  /**
   * SAN 检定
   *
   * 公式：d100 vs 当前 SAN
   * - 成功：扣除 sanLoss / 2（向下取整）
   * - 失败：扣除 sanLoss（全损）
   *
   * @param character 角色数据，需包含 san 字段
   * @param sanLoss 失败时扣除的 SAN 值
   * @returns 掷骰结果（含成功等级与 sanLoss 字段记录实际扣除值）
   */
  rollSan(
    character: Record<string, unknown>,
    sanLoss: number,
  ): DiceRollResult & { sanLossApplied: number } {
    const currentSan = this.getNumber(character, 'san');
    const roll = this.roll('1d100');
    const successLevel = this.evaluateSuccess(roll.total, currentSan);

    // 成功扣半损，失败扣全损
    const isSuccessful =
      successLevel === 'critical' ||
      successLevel === 'extreme' ||
      successLevel === 'hard' ||
      successLevel === 'regular';
    const sanLossApplied = isSuccessful
      ? Math.floor(sanLoss / 2)
      : sanLoss;

    return {
      ...roll,
      successLevel,
      label: 'SAN 检定',
      sanLossApplied,
    };
  }

  /**
   * 幸运检定
   *
   * 公式：d100 vs 幸运值（或目标值）
   * 幸运检定仅有成功（regular）或失败（null），无困难/极难/大成功等级。
   *
   * @param character 角色数据（保留以保持接口一致性）
   * @param target 目标值（通常为角色的幸运值）
   * @returns 掷骰结果（含成功等级）
   */
  rollLuck(
    character: Record<string, unknown>,
    target: number,
  ): DiceRollResult {
    void character;
    const roll = this.roll('1d100');
    const successLevel = roll.total <= target ? 'regular' : null;
    return {
      ...roll,
      successLevel,
      label: '幸运检定',
    };
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
}
