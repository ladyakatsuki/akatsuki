/**
 * COC 7版规则系统入口
 *
 * 导出 COC 7版规则系统实例与骰子解析器，
 * 供 src/rules/index.ts 注册到 ruleSystemRegistry。
 */
export { coc7RuleSystem, ATTRIBUTE_KEYS, getDamageBonus, getBuild, getMov } from './Coc7RuleSystem.js';
export { Coc7RollResolver } from './Coc7RollResolver.js';
