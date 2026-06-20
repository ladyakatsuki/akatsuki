import type { RuleSystem } from '../types/rules.js';

/**
 * 规则系统注册中心
 *
 * 管理所有已注册的规则系统（DND 5E、COC 7版等），
 * 提供按 id 查询、列出全部等能力，是规则系统的统一调度入口。
 */
export class RuleSystemRegistry {
  private systems = new Map<string, RuleSystem>();

  /**
   * 注册规则系统
   * @param system 规则系统实现
   * @throws 重复注册时抛错
   */
  register(system: RuleSystem): void {
    if (this.systems.has(system.id)) {
      throw new Error(`规则系统已注册: ${system.id}`);
    }
    this.systems.set(system.id, system);
  }

  /**
   * 获取规则系统
   * @param id 规则系统标识
   * @throws 不存在时抛错
   */
  get(id: string): RuleSystem {
    const system = this.systems.get(id);
    if (!system) {
      throw new Error(`规则系统不存在: ${id}`);
    }
    return system;
  }

  /**
   * 判断规则系统是否已注册
   */
  has(id: string): boolean {
    return this.systems.has(id);
  }

  /**
   * 列出所有已注册的规则系统
   */
  list(): RuleSystem[] {
    return Array.from(this.systems.values());
  }
}

/** 规则系统注册中心单例 */
export const ruleSystemRegistry = new RuleSystemRegistry();
