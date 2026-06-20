import { randomInt } from 'node:crypto';
import type {
  DiceExpression,
  DiceRollResult,
  RollResolver,
  SuccessLevel,
} from '../types/rules.js';

/**
 * 骰子表达式正则
 * 语法：[count]d<sides>[kh<n>|kl<n>][+/-modifier]
 * 示例：d20、2d6、1d100+5、3d20kh1、2d20kl1、2d20kh1+5
 */
const DICE_REGEX = /^(\d+)?d(\d+)(?:(kh|kl)(\d+))?(?:([+-])(\d+))?$/i;

/**
 * 通用骰子解析器
 *
 * 实现骰子表达式解析与掷骰，使用 node:crypto 的 randomInt 确保真随机。
 * 支持保留最高/最低 N 个骰子（kh/kl）。
 *
 * 注意：DND 优势/劣势与 COC 奖金骰/惩罚骰、成功判定的具体逻辑
 * 在 Task 4（DND 5E）与 Task 5（COC 7版）规则集实现中扩展，
 * 此处只实现通用解析与掷骰。
 */
export class DiceRollResolver implements RollResolver {
  /**
   * 解析骰子表达式
   * @param expression 骰子表达式，如 '2d20kh1+5'
   * @returns 解析结果
   * @throws 表达式格式无效时抛错
   */
  parse(expression: string): DiceExpression {
    const trimmed = expression.trim();
    const match = trimmed.match(DICE_REGEX);
    if (!match) {
      throw new Error(`无效的骰子表达式: ${expression}`);
    }

    const [, countRaw, sidesRaw, keepDir, keepNRaw, modSign, modRaw] = match;

    const count = countRaw ? Number.parseInt(countRaw, 10) : 1;
    const sides = Number.parseInt(sidesRaw, 10);

    if (count < 1) {
      throw new Error(`骰子数量必须大于 0: ${expression}`);
    }
    if (sides < 1) {
      throw new Error(`骰子面数必须大于 0: ${expression}`);
    }

    const result: DiceExpression = {
      count,
      sides,
      modifier: 0,
    };

    if (keepDir && keepNRaw) {
      const keepN = Number.parseInt(keepNRaw, 10);
      if (keepN < 1) {
        throw new Error(`保留骰子数量必须大于 0: ${expression}`);
      }
      if (keepN > count) {
        throw new Error(`保留骰子数量不能超过骰子总数: ${expression}`);
      }
      const dir = keepDir.toLowerCase();
      if (dir === 'kh') {
        result.keepHigh = keepN;
      } else {
        result.keepLow = keepN;
      }
    }

    if (modSign && modRaw) {
      const mod = Number.parseInt(modRaw, 10);
      result.modifier = modSign === '-' ? -mod : mod;
    }

    return result;
  }

  /**
   * 掷骰
   * @param expression 骰子表达式字符串或已解析的 DiceExpression
   * @returns 掷骰结果
   */
  roll(expression: string | DiceExpression): DiceRollResult {
    const parsed = typeof expression === 'string' ? this.parse(expression) : expression;
    const originalExpr = typeof expression === 'string' ? expression : this.stringify(parsed);

    // 掷出所有骰子
    const rolls: number[] = [];
    for (let i = 0; i < parsed.count; i++) {
      rolls.push(this.rollDie(parsed.sides));
    }

    // 保留骰子
    const kept = this.keepDice(rolls, parsed);

    // 计算总计
    const diceSum = kept.reduce((sum, v) => sum + v, 0);
    const total = diceSum + parsed.modifier;

    return {
      expression: originalExpr,
      rolls,
      kept,
      modifier: parsed.modifier,
      total,
    };
  }

  /**
   * DND 优势/劣势掷骰
   *
   * 优势：掷两次取较高；劣势：掷两次取较低。
   * DND 5E 规则集（Task 4）可基于此扩展更具体的逻辑。
   */
  rollWithAdvantage(expression: string, advantage: boolean): DiceRollResult {
    const first = this.roll(expression);
    const second = this.roll(expression);
    const chosen = advantage
      ? first.total >= second.total
        ? first
        : second
      : first.total <= second.total
        ? first
        : second;
    return {
      ...chosen,
      label: advantage ? '优势' : '劣势',
    };
  }

  /**
   * COC 奖金骰/惩罚骰掷骰
   * 具体逻辑在 COC 7版规则系统（Task 5）中实现。
   */
  rollWithBonusPenalty(_expression: string, _bonus: number, _penalty: number): DiceRollResult {
    throw new Error('COC 奖金骰/惩罚骰逻辑在 COC 7版规则系统（Task 5）中实现');
  }

  /**
   * COC 成功判定
   * 具体逻辑在 COC 7版规则系统（Task 5）中实现。
   */
  evaluateSuccess(_roll: number, _target: number): SuccessLevel {
    throw new Error('COC 成功判定逻辑在 COC 7版规则系统（Task 5）中实现');
  }

  /**
   * 掷单个骰子，使用 crypto.randomInt 确保真随机
   * @param sides 面数
   * @returns [1, sides] 范围内的整数
   */
  private rollDie(sides: number): number {
    return randomInt(1, sides + 1);
  }

  /**
   * 根据保留规则筛选骰子
   */
  private keepDice(rolls: number[], parsed: DiceExpression): number[] {
    if (parsed.keepHigh !== undefined) {
      return [...rolls].sort((a, b) => b - a).slice(0, parsed.keepHigh);
    }
    if (parsed.keepLow !== undefined) {
      return [...rolls].sort((a, b) => a - b).slice(0, parsed.keepLow);
    }
    return [...rolls];
  }

  /**
   * 将 DiceExpression 转回字符串表示
   */
  private stringify(parsed: DiceExpression): string {
    let expr = `${parsed.count}d${parsed.sides}`;
    if (parsed.keepHigh !== undefined) {
      expr += `kh${parsed.keepHigh}`;
    }
    if (parsed.keepLow !== undefined) {
      expr += `kl${parsed.keepLow}`;
    }
    if (parsed.modifier !== 0) {
      expr += parsed.modifier > 0 ? `+${parsed.modifier}` : `${parsed.modifier}`;
    }
    return expr;
  }
}
