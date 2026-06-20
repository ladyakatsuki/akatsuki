import { describe, it, expect } from 'vitest';
import { Dnd5eRollResolver } from '../../../src/rules/dnd5e/Dnd5eRollResolver.js';

describe('Dnd5eRollResolver', () => {
  const resolver = new Dnd5eRollResolver();

  describe('rollWithAdvantage', () => {
    it('优势应掷两次 d20 并取较高值', () => {
      const result = resolver.rollWithAdvantage('1d20', true);
      expect(result.label).toBe('优势');
      // 两次掷骰结果
      expect(result.rolls).toHaveLength(2);
      // 保留较高者
      expect(result.kept).toHaveLength(1);
      const max = Math.max(...result.rolls);
      expect(result.total).toBe(max);
    });

    it('劣势应掷两次 d20 并取较低值', () => {
      const result = resolver.rollWithAdvantage('1d20', false);
      expect(result.label).toBe('劣势');
      expect(result.rolls).toHaveLength(2);
      expect(result.kept).toHaveLength(1);
      const min = Math.min(...result.rolls);
      expect(result.total).toBe(min);
    });

    it('优势结果应在 [1, 20] 范围内', () => {
      const result = resolver.rollWithAdvantage('1d20', true);
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(20);
    });

    it('劣势结果应在 [1, 20] 范围内', () => {
      const result = resolver.rollWithAdvantage('1d20', false);
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(20);
    });

    it('带加值的优势掷骰应正确计算', () => {
      const result = resolver.rollWithAdvantage('1d20+5', true);
      expect(result.rolls).toHaveLength(2);
      expect(result.modifier).toBe(5);
      const max = Math.max(...result.rolls);
      expect(result.total).toBe(max + 5);
    });

    it('带加值的劣势掷骰应正确计算', () => {
      const result = resolver.rollWithAdvantage('1d20+3', false);
      expect(result.rolls).toHaveLength(2);
      expect(result.modifier).toBe(3);
      const min = Math.min(...result.rolls);
      expect(result.total).toBe(min + 3);
    });
  });

  describe('rollSkill - 技能检定', () => {
    it('未熟练技能 = d20 + 属性调整值', () => {
      // dex=10 → dexMod=0，杂技未熟练（0）
      const character = {
        dex: 10,
        dexMod: 0,
        acrobatics: 0,
        proficiencyBonus: 2,
      };
      const result = resolver.rollSkill('acrobatics', character);
      expect(result.rolls).toHaveLength(1);
      expect(result.rolls[0]).toBeGreaterThanOrEqual(1);
      expect(result.rolls[0]).toBeLessThanOrEqual(20);
      // 加值 = 0（属性调整值）+ 0（未熟练）= 0
      expect(result.modifier).toBe(0);
      expect(result.total).toBe(result.rolls[0] + 0);
    });

    it('熟练技能 = d20 + 属性调整值 + 熟练加值', () => {
      // dex=14 → dexMod=+2，杂技熟练（1），熟练加值 +2
      const character = {
        dex: 14,
        dexMod: 2,
        acrobatics: 1,
        proficiencyBonus: 2,
      };
      const result = resolver.rollSkill('acrobatics', character);
      // 加值 = 2（属性）+ 1*2（熟练）= 4
      expect(result.modifier).toBe(4);
      expect(result.total).toBe(result.rolls[0] + 4);
    });

    it('精通技能 = d20 + 属性调整值 + 2×熟练加值', () => {
      // int=16 → intMod=+3，奥秘精通（2），熟练加值 +3
      const character = {
        int: 16,
        intMod: 3,
        arcana: 2,
        proficiencyBonus: 3,
      };
      const result = resolver.rollSkill('arcana', character);
      // 加值 = 3（属性）+ 2*3（精通）= 9
      expect(result.modifier).toBe(9);
      expect(result.total).toBe(result.rolls[0] + 9);
    });

    it('运动技能关联 str 属性', () => {
      // str=18 → strMod=+4，运动熟练（1），熟练加值 +2
      const character = {
        str: 18,
        strMod: 4,
        athletics: 1,
        proficiencyBonus: 2,
      };
      const result = resolver.rollSkill('athletics', character);
      // 加值 = 4（属性）+ 1*2（熟练）= 6
      expect(result.modifier).toBe(6);
      expect(result.total).toBe(result.rolls[0] + 6);
    });

    it('察觉技能关联 wis 属性', () => {
      // wis=12 → wisMod=+1，察觉未熟练（0）
      const character = {
        wis: 12,
        wisMod: 1,
        perception: 0,
        proficiencyBonus: 2,
      };
      const result = resolver.rollSkill('perception', character);
      // 加值 = 1（属性）+ 0 = 1
      expect(result.modifier).toBe(1);
      expect(result.total).toBe(result.rolls[0] + 1);
    });

    it('说服技能关联 cha 属性', () => {
      // cha=16 → chaMod=+3，说服熟练（1），熟练加值 +4
      const character = {
        cha: 16,
        chaMod: 3,
        persuasion: 1,
        proficiencyBonus: 4,
      };
      const result = resolver.rollSkill('persuasion', character);
      // 加值 = 3（属性）+ 1*4（熟练）= 7
      expect(result.modifier).toBe(7);
      expect(result.total).toBe(result.rolls[0] + 7);
    });

    it('应支持 boolean 熟练值（true 视为熟练）', () => {
      // 杂技熟练（true）
      const character = {
        dex: 10,
        dexMod: 0,
        acrobatics: true,
        proficiencyBonus: 2,
      };
      const result = resolver.rollSkill('acrobatics', character);
      // 加值 = 0（属性）+ 1*2（熟练）= 2
      expect(result.modifier).toBe(2);
    });
  });

  describe('rollSave - 豁免检定', () => {
    it('未熟练豁免 = d20 + 属性调整值', () => {
      const character = {
        dex: 12,
        dexMod: 1,
        dexSaveProficient: false,
        proficiencyBonus: 2,
      };
      const result = resolver.rollSave('dex', character);
      expect(result.rolls).toHaveLength(1);
      expect(result.rolls[0]).toBeGreaterThanOrEqual(1);
      expect(result.rolls[0]).toBeLessThanOrEqual(20);
      // 加值 = 1（属性）+ 0（未熟练）= 1
      expect(result.modifier).toBe(1);
      expect(result.total).toBe(result.rolls[0] + 1);
    });

    it('熟练豁免 = d20 + 属性调整值 + 熟练加值', () => {
      const character = {
        dex: 14,
        dexMod: 2,
        dexSaveProficient: true,
        proficiencyBonus: 3,
      };
      const result = resolver.rollSave('dex', character);
      // 加值 = 2（属性）+ 3（熟练）= 5
      expect(result.modifier).toBe(5);
      expect(result.total).toBe(result.rolls[0] + 5);
    });

    it('力量豁免应使用 strMod', () => {
      const character = {
        str: 16,
        strMod: 3,
        strSaveProficient: true,
        proficiencyBonus: 2,
      };
      const result = resolver.rollSave('str', character);
      // 加值 = 3（属性）+ 2（熟练）= 5
      expect(result.modifier).toBe(5);
      expect(result.total).toBe(result.rolls[0] + 5);
    });

    it('感知豁免应使用 wisMod', () => {
      const character = {
        wis: 18,
        wisMod: 4,
        wisSaveProficient: false,
        proficiencyBonus: 4,
      };
      const result = resolver.rollSave('wis', character);
      // 加值 = 4（属性）+ 0 = 4
      expect(result.modifier).toBe(4);
      expect(result.total).toBe(result.rolls[0] + 4);
    });
  });

  describe('rollAttack - 攻击检定', () => {
    it('攻击检定 = d20 + 攻击加值（数字）', () => {
      const result = resolver.rollAttack('5', {});
      expect(result.rolls).toHaveLength(1);
      expect(result.rolls[0]).toBeGreaterThanOrEqual(1);
      expect(result.rolls[0]).toBeLessThanOrEqual(20);
      expect(result.modifier).toBe(5);
      expect(result.total).toBe(result.rolls[0] + 5);
    });

    it('攻击加值可使用属性调整值引用', () => {
      const character = { strMod: 4, proficiencyBonus: 3 };
      // 攻击加值 = strMod + proficiencyBonus
      const result = resolver.rollAttack('strMod', character);
      expect(result.modifier).toBe(4);
      expect(result.total).toBe(result.rolls[0] + 4);
    });

    it('攻击加值可为骰子表达式', () => {
      const result = resolver.rollAttack('1d4', {});
      expect(result.rolls).toHaveLength(1);
      // modifier 应为 1d4 的结果 [1,4]
      expect(result.modifier).toBeGreaterThanOrEqual(1);
      expect(result.modifier).toBeLessThanOrEqual(4);
      expect(result.total).toBe(result.rolls[0] + result.modifier);
    });
  });

  describe('rollDamage - 伤害掷骰', () => {
    it('伤害掷骰 = 表达式结果', () => {
      const result = resolver.rollDamage('1d8', {});
      expect(result.rolls).toHaveLength(1);
      expect(result.rolls[0]).toBeGreaterThanOrEqual(1);
      expect(result.rolls[0]).toBeLessThanOrEqual(8);
      expect(result.total).toBe(result.rolls[0]);
    });

    it('伤害掷骰应加上属性调整值', () => {
      // 1d8 + strMod(3)
      const character = { strMod: 3 };
      const result = resolver.rollDamage('1d8+strMod', character);
      expect(result.rolls).toHaveLength(1);
      expect(result.rolls[0]).toBeGreaterThanOrEqual(1);
      expect(result.rolls[0]).toBeLessThanOrEqual(8);
      // modifier 应包含 strMod
      expect(result.modifier).toBe(3);
      expect(result.total).toBe(result.rolls[0] + 3);
    });

    it('伤害掷骰支持多骰表达式', () => {
      const result = resolver.rollDamage('2d6', {});
      expect(result.rolls).toHaveLength(2);
      result.rolls.forEach((r) => {
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(6);
      });
      expect(result.total).toBe(result.rolls[0] + result.rolls[1]);
    });

    it('伤害掷骰支持负属性调整值', () => {
      // 1d6 + strMod(-1)
      const character = { strMod: -1 };
      const result = resolver.rollDamage('1d6+strMod', character);
      expect(result.rolls).toHaveLength(1);
      expect(result.modifier).toBe(-1);
      expect(result.total).toBe(result.rolls[0] - 1);
    });

    it('伤害掷骰支持 dexMod 引用', () => {
      const character = { dexMod: 4 };
      const result = resolver.rollDamage('1d6+dexMod', character);
      expect(result.modifier).toBe(4);
      expect(result.total).toBe(result.rolls[0] + 4);
    });
  });

  describe('继承通用骰子解析器', () => {
    it('应支持 parse 方法', () => {
      const parsed = resolver.parse('2d20kh1+5');
      expect(parsed.count).toBe(2);
      expect(parsed.sides).toBe(20);
      expect(parsed.keepHigh).toBe(1);
      expect(parsed.modifier).toBe(5);
    });

    it('应支持 roll 方法', () => {
      const result = resolver.roll('d20');
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(20);
    });
  });
});
