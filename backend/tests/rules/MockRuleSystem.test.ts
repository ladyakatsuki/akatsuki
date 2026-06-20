import { describe, it, expect } from 'vitest';
import { mockRuleSystem } from '../../src/rules/MockRuleSystem.js';

describe('MockRuleSystem', () => {
  describe('基础元信息', () => {
    it('应有正确的 id 与主题', () => {
      expect(mockRuleSystem.id).toBe('mock');
      expect(mockRuleSystem.theme).toBe('dnd');
      expect(mockRuleSystem.name).toBe('Mock 规则系统');
    });

    it('应包含 2 个属性与 2 个技能', () => {
      expect(mockRuleSystem.attributeSchema).toHaveLength(2);
      expect(mockRuleSystem.skillSchema).toHaveLength(2);
      const attrKeys = mockRuleSystem.attributeSchema.map((a) => a.key);
      expect(attrKeys).toEqual(['str', 'dex']);
      const skillKeys = mockRuleSystem.skillSchema.map((s) => s.key);
      expect(skillKeys).toEqual(['athletics', 'stealth']);
    });
  });

  describe('createDefaultCharacter', () => {
    const data = mockRuleSystem.createDefaultCharacter();

    it('应包含属性默认值', () => {
      expect(data.str).toBe(10);
      expect(data.dex).toBe(10);
    });

    it('应包含技能默认值', () => {
      expect(data.athletics).toBe(0);
      expect(data.stealth).toBe(0);
    });

    it('应包含角色卡字段默认值', () => {
      expect(data.name).toBe('');
      expect(data.maxHp).toBe(10);
      expect(data.hp).toBe(10);
      expect(data.ac).toBe(10);
    });

    it('应包含计算后的派生属性', () => {
      // 默认属性 10 → 调整值 0
      expect(data.strMod).toBe(0);
      expect(data.dexMod).toBe(0);
    });

    it('不应包含计算字段本身作为输入字段', () => {
      // 计算字段不应在 createDefaultCharacter 中以原始默认值覆盖派生值
      // strMod/dexMod 应来自 computeDerived
      expect(data.strMod).toBe(0);
    });
  });

  describe('computeDerived', () => {
    it('应正确计算属性调整值 floor((value - 10) / 2)', () => {
      const derived = mockRuleSystem.computeDerived({ str: 14, dex: 8 });
      expect(derived.strMod).toBe(2);
      expect(derived.dexMod).toBe(-1);
    });

    it('属性值为 10 时调整值应为 0', () => {
      const derived = mockRuleSystem.computeDerived({ str: 10, dex: 10 });
      expect(derived.strMod).toBe(0);
      expect(derived.dexMod).toBe(0);
    });

    it('属性值为奇数时应向下取整', () => {
      const derived = mockRuleSystem.computeDerived({ str: 13, dex: 7 });
      // (13 - 10) / 2 = 1.5 → floor = 1
      expect(derived.strMod).toBe(1);
      // (7 - 10) / 2 = -1.5 → floor = -2
      expect(derived.dexMod).toBe(-2);
    });

    it('缺失属性应使用默认值计算', () => {
      const derived = mockRuleSystem.computeDerived({});
      expect(derived.strMod).toBe(0);
      expect(derived.dexMod).toBe(0);
    });
  });

  describe('战斗规则', () => {
    it('应配置先攻公式与关联属性', () => {
      expect(mockRuleSystem.combatRules.initiativeFormula).toBe('1d20+dexMod');
      expect(mockRuleSystem.combatRules.initiativeAttribute).toBe('dex');
    });

    it('应包含状态效果列表', () => {
      expect(mockRuleSystem.combatRules.statusEffects.length).toBeGreaterThan(0);
      const keys = mockRuleSystem.combatRules.statusEffects.map((e) => e.key);
      expect(keys).toContain('poisoned');
      expect(keys).toContain('stunned');
    });
  });

  describe('角色卡模板', () => {
    it('应包含分页与字段', () => {
      expect(mockRuleSystem.characterSheetTemplate.sections.length).toBeGreaterThan(0);
      expect(mockRuleSystem.characterSheetTemplate.fields.length).toBeGreaterThan(0);
    });

    it('计算字段应标记 computed', () => {
      const computedFields = mockRuleSystem.characterSheetTemplate.fields.filter(
        (f) => f.computed,
      );
      expect(computedFields.length).toBeGreaterThan(0);
      const keys = computedFields.map((f) => f.key);
      expect(keys).toContain('strMod');
      expect(keys).toContain('dexMod');
    });
  });

  describe('骰子解析器', () => {
    it('应使用通用骰子解析器', () => {
      const result = mockRuleSystem.rollResolver.roll('d20');
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(20);
    });
  });
});
