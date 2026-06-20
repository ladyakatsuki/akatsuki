/**
 * 规则系统注册入口
 *
 * 将所有规则系统注册到 ruleSystemRegistry，
 * 应用启动时导入本模块即可完成注册。
 */
import { ruleSystemRegistry } from './Registry.js';
import { dnd5eRuleSystem } from './dnd5e/index.js';
import { coc7RuleSystem } from './coc7/index.js';

// 注册 DND 5E 规则系统
ruleSystemRegistry.register(dnd5eRuleSystem);

// 注册 COC 7版规则系统
ruleSystemRegistry.register(coc7RuleSystem);

export { ruleSystemRegistry } from './Registry.js';
export { dnd5eRuleSystem } from './dnd5e/index.js';
export { Dnd5eRollResolver } from './dnd5e/index.js';
export { coc7RuleSystem } from './coc7/index.js';
export { Coc7RollResolver } from './coc7/index.js';
export { DiceRollResolver } from './DiceRollResolver.js';
export { RuleSystemRegistry } from './Registry.js';
export { mockRuleSystem } from './MockRuleSystem.js';
