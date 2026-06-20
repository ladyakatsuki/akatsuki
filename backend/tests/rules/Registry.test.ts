import { describe, it, expect, beforeEach } from 'vitest';
import { RuleSystemRegistry } from '../../src/rules/Registry.js';
import { mockRuleSystem } from '../../src/rules/MockRuleSystem.js';
import type { RuleSystem } from '../../src/types/rules.js';

/** 构造一个最小规则系统用于测试 */
function makeSystem(id: string): RuleSystem {
  return {
    id,
    name: `测试规则系统 ${id}`,
    version: '0.0.1',
    description: '测试用',
    theme: 'dnd',
    diceTypes: ['d20'],
    attributeSchema: [],
    skillSchema: [],
    characterSheetTemplate: { sections: [], fields: [] },
    combatRules: { initiativeFormula: '1d20', statusEffects: [] },
    rollResolver: mockRuleSystem.rollResolver,
    createDefaultCharacter: () => ({}),
    computeDerived: () => ({}),
  };
}

describe('RuleSystemRegistry', () => {
  let registry: RuleSystemRegistry;

  beforeEach(() => {
    registry = new RuleSystemRegistry();
  });

  it('应注册并获取规则系统', () => {
    const system = makeSystem('test1');
    registry.register(system);
    expect(registry.has('test1')).toBe(true);
    expect(registry.get('test1')).toBe(system);
  });

  it('重复注册应抛错', () => {
    registry.register(makeSystem('dup'));
    expect(() => registry.register(makeSystem('dup'))).toThrow();
  });

  it('获取不存在的规则系统应抛错', () => {
    expect(() => registry.get('not-exist')).toThrow();
  });

  it('has 对未注册的 id 应返回 false', () => {
    expect(registry.has('not-exist')).toBe(false);
  });

  it('list 应返回所有已注册的规则系统', () => {
    registry.register(makeSystem('a'));
    registry.register(makeSystem('b'));
    registry.register(makeSystem('c'));
    const list = registry.list();
    expect(list).toHaveLength(3);
    const ids = list.map((s) => s.id).sort();
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('空注册中心 list 应返回空数组', () => {
    expect(registry.list()).toEqual([]);
  });
});
