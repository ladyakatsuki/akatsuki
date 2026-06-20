/**
 * DND 5E 规则系统入口
 *
 * 导出 DND 5E 规则系统实例与骰子解析器，
 * 供 src/rules/index.ts 注册到 ruleSystemRegistry。
 */
export { dnd5eRuleSystem } from './Dnd5eRuleSystem.js';
export { Dnd5eRollResolver } from './Dnd5eRollResolver.js';
