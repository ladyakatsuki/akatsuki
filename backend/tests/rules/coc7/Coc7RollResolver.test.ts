import { describe, it, expect } from 'vitest';
import { Coc7RollResolver } from '../../../src/rules/coc7/Coc7RollResolver.js';

describe('Coc7RollResolver', () => {
  const resolver = new Coc7RollResolver();

  describe('rollWithBonusPenalty - 奖金骰/惩罚骰', () => {
    it('无奖金/惩罚骰时应返回 1-100 范围的结果', () => {
      const result = resolver.rollWithBonusPenalty('1d100', 0, 0);
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(100);
    });

    it('奖金骰应掷 1 个十位骰 + 多个个位骰', () => {
      const result = resolver.rollWithBonusPenalty('1d100', 2, 0);
      // rolls[0] 为十位骰（0, 10, 20, ..., 90），其余为个位骰（0-9）
      expect(result.rolls.length).toBe(3); // 1 十位 + 2 个位
      // 十位骰应为 0-90 中的 10 的倍数
      expect(result.rolls[0] % 10).toBe(0);
      expect(result.rolls[0]).toBeGreaterThanOrEqual(0);
      expect(result.rolls[0]).toBeLessThanOrEqual(90);
      // 个位骰应为 0-9
      for (let i = 1; i < result.rolls.length; i++) {
        expect(result.rolls[i]).toBeGreaterThanOrEqual(0);
        expect(result.rolls[i]).toBeLessThanOrEqual(9);
      }
      expect(result.label).toBe('奖金骰');
    });

    it('奖金骰应取个位最小值', () => {
      // 多次验证：奖金骰的 kept 应为个位骰中的最小值
      for (let i = 0; i < 20; i++) {
        const result = resolver.rollWithBonusPenalty('1d100', 3, 0);
        const onesRolls = result.rolls.slice(1); // 个位骰
        const minOnes = Math.min(...onesRolls);
        expect(result.kept[0]).toBe(minOnes);
        // 总计 = 十位骰 + 最小个位骰（0+0=100 的特殊情况）
        const tens = result.rolls[0];
        const expected = tens + minOnes === 0 ? 100 : tens + minOnes;
        expect(result.total).toBe(expected);
      }
    });

    it('惩罚骰应掷 1 个十位骰 + 多个个位骰', () => {
      const result = resolver.rollWithBonusPenalty('1d100', 0, 2);
      expect(result.rolls.length).toBe(3); // 1 十位 + 2 个位
      expect(result.rolls[0] % 10).toBe(0);
      expect(result.label).toBe('惩罚骰');
    });

    it('惩罚骰应取个位最大值', () => {
      // 多次验证：惩罚骰的 kept 应为个位骰中的最大值
      for (let i = 0; i < 20; i++) {
        const result = resolver.rollWithBonusPenalty('1d100', 0, 3);
        const onesRolls = result.rolls.slice(1); // 个位骰
        const maxOnes = Math.max(...onesRolls);
        expect(result.kept[0]).toBe(maxOnes);
        // 总计 = 十位骰 + 最大个位骰（0+0=100 的特殊情况）
        const tens = result.rolls[0];
        const expected = tens + maxOnes === 0 ? 100 : tens + maxOnes;
        expect(result.total).toBe(expected);
      }
    });

    it('奖金骰与惩罚骰同时存在时应相互抵消', () => {
      // bonus=2, penalty=2 → 净 0，无标签
      const result = resolver.rollWithBonusPenalty('1d100', 2, 2);
      expect(result.label).toBeUndefined();
      // 仅 1 个个位骰（净 0）
      expect(result.rolls.length).toBe(2); // 1 十位 + 1 个位
    });

    it('奖金骰多于惩罚骰时应取净奖金骰', () => {
      // bonus=3, penalty=1 → 净奖金 2
      const result = resolver.rollWithBonusPenalty('1d100', 3, 1);
      expect(result.label).toBe('奖金骰');
      // 1 十位 + 2 个位（净 2）
      expect(result.rolls.length).toBe(3);
    });

    it('惩罚骰多于奖金骰时应取净惩罚骰', () => {
      // bonus=1, penalty=3 → 净惩罚 2
      const result = resolver.rollWithBonusPenalty('1d100', 1, 3);
      expect(result.label).toBe('惩罚骰');
      // 1 十位 + 2 个位（净 2）
      expect(result.rolls.length).toBe(3);
    });

    it('结果应在 [1, 100] 范围内', () => {
      for (let i = 0; i < 50; i++) {
        const result = resolver.rollWithBonusPenalty('1d100', 2, 2);
        expect(result.total).toBeGreaterThanOrEqual(1);
        expect(result.total).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('evaluateSuccess - 成功等级判定', () => {
    it('掷出 1 且 ≤ 目标值应为大成功（critical）', () => {
      expect(resolver.evaluateSuccess(1, 50)).toBe('critical');
      expect(resolver.evaluateSuccess(1, 100)).toBe('critical');
    });

    it('掷出 1 但 > 目标值不应为大成功', () => {
      // 目标值为 0 时，1 > 0，不是大成功
      expect(resolver.evaluateSuccess(1, 0)).not.toBe('critical');
    });

    it('≤ 目标值/5 应为极难成功（extreme）', () => {
      // 目标 50，1/5=10
      expect(resolver.evaluateSuccess(10, 50)).toBe('extreme');
      expect(resolver.evaluateSuccess(8, 50)).toBe('extreme');
    });

    it('掷出 1-5 且 ≤ 目标值应为极难成功（extreme）', () => {
      // 目标 10，1/5=2，但 3 ≤ 5 且 3 ≤ 10，应为极难成功
      expect(resolver.evaluateSuccess(3, 10)).toBe('extreme');
      expect(resolver.evaluateSuccess(5, 10)).toBe('extreme');
    });

    it('≤ 目标值/2 应为困难成功（hard）', () => {
      // 目标 50，1/2=25
      expect(resolver.evaluateSuccess(25, 50)).toBe('hard');
      expect(resolver.evaluateSuccess(20, 50)).toBe('hard');
      expect(resolver.evaluateSuccess(15, 50)).toBe('hard');
    });

    it('≤ 目标值应为普通成功（regular）', () => {
      // 目标 50，1/2=25，1/5=10
      expect(resolver.evaluateSuccess(50, 50)).toBe('regular');
      expect(resolver.evaluateSuccess(40, 50)).toBe('regular');
      expect(resolver.evaluateSuccess(30, 50)).toBe('regular');
      expect(resolver.evaluateSuccess(26, 50)).toBe('regular');
    });

    it('> 目标值且 < 96 应为失败（null）', () => {
      expect(resolver.evaluateSuccess(51, 50)).toBeNull();
      expect(resolver.evaluateSuccess(80, 50)).toBeNull();
      expect(resolver.evaluateSuccess(95, 50)).toBeNull();
    });

    it('目标值 < 50 时 96-100 应为大失败（fumble）', () => {
      expect(resolver.evaluateSuccess(96, 40)).toBe('fumble');
      expect(resolver.evaluateSuccess(97, 40)).toBe('fumble');
      expect(resolver.evaluateSuccess(100, 40)).toBe('fumble');
    });

    it('目标值 ≥ 50 时仅 100 为大失败（fumble）', () => {
      // 目标 50，96-99 不是大失败
      expect(resolver.evaluateSuccess(96, 50)).not.toBe('fumble');
      expect(resolver.evaluateSuccess(99, 50)).not.toBe('fumble');
      // 100 是大失败
      expect(resolver.evaluateSuccess(100, 50)).toBe('fumble');
      expect(resolver.evaluateSuccess(100, 80)).toBe('fumble');
    });

    it('96-100 优先于成功判定', () => {
      // 目标 100，掷 96：目标 ≥ 50，仅 100 大失败，96 应为普通成功
      expect(resolver.evaluateSuccess(96, 100)).toBe('regular');
      // 目标 40，掷 96：目标 < 50，96-100 大失败
      expect(resolver.evaluateSuccess(96, 40)).toBe('fumble');
    });

    it('成功等级优先级：critical > extreme > hard > regular', () => {
      // 掷 1，目标 100：1 ≤ 5 且 ≤ 100，且 1 ≤ 100/5=20，应为 critical
      expect(resolver.evaluateSuccess(1, 100)).toBe('critical');
      // 掷 5，目标 100：5 ≤ 5 且 ≤ 100，且 5 ≤ 20，应为 extreme（非 critical）
      expect(resolver.evaluateSuccess(5, 100)).toBe('extreme');
      // 掷 6，目标 100：6 > 5，但 6 ≤ 20，应为 extreme
      expect(resolver.evaluateSuccess(6, 100)).toBe('extreme');
    });
  });

  describe('rollSkill - 技能检定', () => {
    it('应掷 d100 并返回成功等级', () => {
      const character = { libraryUse: 50 };
      const result = resolver.rollSkill('libraryUse', character);
      expect(result.rolls).toHaveLength(1);
      expect(result.rolls[0]).toBeGreaterThanOrEqual(1);
      expect(result.rolls[0]).toBeLessThanOrEqual(100);
      expect(result.label).toBe('技能检定(libraryUse)');
      // 成功等级应根据掷骰结果与目标值判定
      if (result.total <= 50) {
        expect(result.successLevel).not.toBeNull();
      } else {
        expect(result.successLevel === null || result.successLevel === 'fumble').toBe(true);
      }
    });

    it('技能值为 0 时应总是失败', () => {
      const character = { cthulhuMythos: 0 };
      const result = resolver.rollSkill('cthulhuMythos', character);
      // 0 目标值，任何掷骰都失败（除非 1，但 1 > 0 也不是 critical）
      expect(result.successLevel === null || result.successLevel === 'fumble').toBe(true);
    });

    it('应使用角色数据中的技能值作为目标', () => {
      const character = { brawl: 100 };
      const result = resolver.rollSkill('brawl', character);
      // 100 目标值，任何掷骰都成功（100 为大失败除外）
      if (result.total < 100) {
        expect(result.successLevel).not.toBeNull();
        expect(result.successLevel).not.toBe('fumble');
      }
    });
  });

  describe('rollSan - SAN 检定', () => {
    it('成功时应扣半损（向下取整）', () => {
      // SAN=50，sanLoss=10
      // 多次尝试直到出现成功
      for (let i = 0; i < 100; i++) {
        const character = { san: 50 };
        const result = resolver.rollSan(character, 10);
        if (
          result.successLevel === 'critical' ||
          result.successLevel === 'extreme' ||
          result.successLevel === 'hard' ||
          result.successLevel === 'regular'
        ) {
          // 成功扣半损：floor(10/2) = 5
          expect(result.sanLossApplied).toBe(5);
          return;
        }
      }
      // 如果 100 次都失败，说明随机性有问题
      throw new Error('100 次掷骰均失败，无法验证成功扣半损');
    });

    it('失败时应扣全损', () => {
      // SAN=50，sanLoss=10
      // 多次尝试直到出现失败
      for (let i = 0; i < 100; i++) {
        const character = { san: 50 };
        const result = resolver.rollSan(character, 10);
        if (result.successLevel === null || result.successLevel === 'fumble') {
          // 失败扣全损：10
          expect(result.sanLossApplied).toBe(10);
          return;
        }
      }
      throw new Error('100 次掷骰均成功，无法验证失败扣全损');
    });

    it('奇数 sanLoss 成功时应向下取整', () => {
      // SAN=50，sanLoss=5，成功扣 floor(5/2)=2
      for (let i = 0; i < 100; i++) {
        const character = { san: 50 };
        const result = resolver.rollSan(character, 5);
        if (
          result.successLevel === 'critical' ||
          result.successLevel === 'extreme' ||
          result.successLevel === 'hard' ||
          result.successLevel === 'regular'
        ) {
          expect(result.sanLossApplied).toBe(2);
          return;
        }
      }
      throw new Error('100 次掷骰均失败，无法验证奇数 sanLoss 向下取整');
    });

    it('应返回 SAN 检定标签', () => {
      const character = { san: 50 };
      const result = resolver.rollSan(character, 10);
      expect(result.label).toBe('SAN 检定');
    });

    it('应包含 sanLossApplied 字段', () => {
      const character = { san: 50 };
      const result = resolver.rollSan(character, 10);
      expect(result.sanLossApplied).toBeDefined();
      expect(typeof result.sanLossApplied).toBe('number');
    });
  });

  describe('rollLuck - 幸运检定', () => {
    it('应掷 d100 并返回成功等级', () => {
      const character = { luck: 50 };
      const result = resolver.rollLuck(character, 50);
      expect(result.rolls).toHaveLength(1);
      expect(result.rolls[0]).toBeGreaterThanOrEqual(1);
      expect(result.rolls[0]).toBeLessThanOrEqual(100);
      expect(result.label).toBe('幸运检定');
    });

    it('掷骰 ≤ 目标值时应为普通成功（regular）', () => {
      // 多次尝试直到出现成功
      for (let i = 0; i < 100; i++) {
        const character = { luck: 50 };
        const result = resolver.rollLuck(character, 50);
        if (result.total <= 50) {
          expect(result.successLevel).toBe('regular');
          return;
        }
      }
      throw new Error('100 次掷骰均失败，无法验证幸运检定成功');
    });

    it('掷骰 > 目标值时应为失败（null）', () => {
      // 多次尝试直到出现失败
      for (let i = 0; i < 100; i++) {
        const character = { luck: 50 };
        const result = resolver.rollLuck(character, 50);
        if (result.total > 50) {
          expect(result.successLevel).toBeNull();
          return;
        }
      }
      throw new Error('100 次掷骰均成功，无法验证幸运检定失败');
    });

    it('幸运检定不应返回困难/极难/大成功等级', () => {
      // 幸运检定仅有 regular 或 null
      for (let i = 0; i < 50; i++) {
        const character = { luck: 50 };
        const result = resolver.rollLuck(character, 50);
        expect(result.successLevel === 'regular' || result.successLevel === null).toBe(true);
      }
    });

    it('目标值为 100 时应总是成功', () => {
      const character = { luck: 100 };
      const result = resolver.rollLuck(character, 100);
      // 100 ≤ 100，应为 regular（除非掷出 100，但幸运检定不判定 fumble）
      if (result.total <= 100) {
        expect(result.successLevel).toBe('regular');
      }
    });
  });

  describe('继承通用骰子解析器', () => {
    it('应支持 parse 方法', () => {
      const parsed = resolver.parse('1d100+5');
      expect(parsed.count).toBe(1);
      expect(parsed.sides).toBe(100);
      expect(parsed.modifier).toBe(5);
    });

    it('应支持 roll 方法', () => {
      const result = resolver.roll('d100');
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(100);
    });

    it('应支持 rollWithAdvantage 方法（继承自基类）', () => {
      const result = resolver.rollWithAdvantage('d20', true);
      expect(result.label).toBe('优势');
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(20);
    });
  });
});
