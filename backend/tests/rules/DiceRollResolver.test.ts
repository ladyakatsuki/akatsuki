import { describe, it, expect } from 'vitest';
import { DiceRollResolver } from '../../src/rules/DiceRollResolver.js';

describe('DiceRollResolver', () => {
  const resolver = new DiceRollResolver();

  describe('parse', () => {
    it('应解析 d20（省略数量默认为 1）', () => {
      const result = resolver.parse('d20');
      expect(result).toEqual({ count: 1, sides: 20, modifier: 0 });
    });

    it('应解析 2d6', () => {
      const result = resolver.parse('2d6');
      expect(result).toEqual({ count: 2, sides: 6, modifier: 0 });
    });

    it('应解析 1d100+5（正加值）', () => {
      const result = resolver.parse('1d100+5');
      expect(result).toEqual({ count: 1, sides: 100, modifier: 5 });
    });

    it('应解析 d20-3（负加值）', () => {
      const result = resolver.parse('d20-3');
      expect(result).toEqual({ count: 1, sides: 20, modifier: -3 });
    });

    it('应解析 3d20kh1（保留最高 1 个）', () => {
      const result = resolver.parse('3d20kh1');
      expect(result).toEqual({ count: 3, sides: 20, modifier: 0, keepHigh: 1 });
    });

    it('应解析 2d20kl1（保留最低 1 个）', () => {
      const result = resolver.parse('2d20kl1');
      expect(result).toEqual({ count: 2, sides: 20, modifier: 0, keepLow: 1 });
    });

    it('应解析 2d20kh1+5（保留最高与加值）', () => {
      const result = resolver.parse('2d20kh1+5');
      expect(result).toEqual({ count: 2, sides: 20, modifier: 5, keepHigh: 1 });
    });

    it('应支持大写 D 与 KH/KL', () => {
      const result = resolver.parse('2D20KH1');
      expect(result).toEqual({ count: 2, sides: 20, modifier: 0, keepHigh: 1 });
    });

    it('应对空白表达式抛错', () => {
      expect(() => resolver.parse('')).toThrow();
    });

    it('应对无效表达式抛错', () => {
      expect(() => resolver.parse('abc')).toThrow();
      expect(() => resolver.parse('d')).toThrow();
      expect(() => resolver.parse('2d')).toThrow();
      expect(() => resolver.parse('d0')).toThrow();
    });

    it('应对保留数量超过骰子总数抛错', () => {
      expect(() => resolver.parse('2d20kh3')).toThrow();
    });
  });

  describe('roll', () => {
    it('d20 掷骰结果应在 [1, 20] 范围内', () => {
      const result = resolver.roll('d20');
      expect(result.rolls).toHaveLength(1);
      expect(result.kept).toHaveLength(1);
      expect(result.rolls[0]).toBeGreaterThanOrEqual(1);
      expect(result.rolls[0]).toBeLessThanOrEqual(20);
      expect(result.total).toBe(result.rolls[0]);
      expect(result.modifier).toBe(0);
    });

    it('2d6 掷骰结果应在 [2, 12] 范围内', () => {
      const result = resolver.roll('2d6');
      expect(result.rolls).toHaveLength(2);
      expect(result.kept).toHaveLength(2);
      result.rolls.forEach((r) => {
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(6);
      });
      expect(result.total).toBe(result.rolls[0] + result.rolls[1]);
    });

    it('1d100+5 总计应在 [6, 105] 范围内', () => {
      const result = resolver.roll('1d100+5');
      expect(result.rolls).toHaveLength(1);
      expect(result.modifier).toBe(5);
      expect(result.total).toBe(result.rolls[0] + 5);
      expect(result.total).toBeGreaterThanOrEqual(6);
      expect(result.total).toBeLessThanOrEqual(105);
    });

    it('3d20kh1 应保留最高 1 个骰子', () => {
      const result = resolver.roll('3d20kh1');
      expect(result.rolls).toHaveLength(3);
      expect(result.kept).toHaveLength(1);
      const max = Math.max(...result.rolls);
      expect(result.kept[0]).toBe(max);
      expect(result.total).toBe(max);
    });

    it('2d20kl1 应保留最低 1 个骰子', () => {
      const result = resolver.roll('2d20kl1');
      expect(result.rolls).toHaveLength(2);
      expect(result.kept).toHaveLength(1);
      const min = Math.min(...result.rolls);
      expect(result.kept[0]).toBe(min);
      expect(result.total).toBe(min);
    });

    it('2d20kh1+5 应正确计算加值', () => {
      const result = resolver.roll('2d20kh1+5');
      expect(result.rolls).toHaveLength(2);
      expect(result.kept).toHaveLength(1);
      expect(result.modifier).toBe(5);
      const max = Math.max(...result.rolls);
      expect(result.total).toBe(max + 5);
    });

    it('应支持传入 DiceExpression 对象', () => {
      const result = resolver.roll({ count: 2, sides: 6, modifier: 3 });
      expect(result.rolls).toHaveLength(2);
      expect(result.modifier).toBe(3);
      expect(result.total).toBe(result.rolls[0] + result.rolls[1] + 3);
    });

    it('expression 字段应保留原始表达式', () => {
      const result = resolver.roll('1d20+2');
      expect(result.expression).toBe('1d20+2');
    });

    it('多次掷骰应产生不同结果（随机性）', () => {
      const results = new Set<number>();
      for (let i = 0; i < 50; i++) {
        results.add(resolver.roll('d20').total);
      }
      // 50 次 d20 至少应出现 2 个不同值
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('rollWithAdvantage', () => {
    it('优势应掷两次并取较高', () => {
      const result = resolver.rollWithAdvantage('d20', true);
      expect(result.label).toBe('优势');
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(20);
    });

    it('劣势应掷两次并取较低', () => {
      const result = resolver.rollWithAdvantage('d20', false);
      expect(result.label).toBe('劣势');
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(20);
    });
  });

  describe('未实现的 COC 方法', () => {
    it('rollWithBonusPenalty 应抛错', () => {
      expect(() => resolver.rollWithBonusPenalty('1d100', 1, 0)).toThrow();
    });

    it('evaluateSuccess 应抛错', () => {
      expect(() => resolver.evaluateSuccess(50, 60)).toThrow();
    });
  });
});
