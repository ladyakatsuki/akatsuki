# 规则系统扩展指南

本指南介绍如何为多人联机跑团平台接入新的规则集（如 FATE、PF2E、WOD 等）。
平台通过 `RuleSystem` 接口抽象规则系统，所有规则集实现统一接口后注册到 `ruleSystemRegistry`，即可被房间创建、角色卡、掷骰、战斗等模块使用。

## 目录

- [架构概览](#架构概览)
- [RuleSystem 接口说明](#rulesystem-接口说明)
- [RollResolver 接口说明](#rollresolver-接口说明)
- [接入步骤](#接入步骤)
- [完整示例：FATE 规则系统](#完整示例fate-规则系统)
- [测试要求](#测试要求)

## 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                   RuleSystemRegistry                    │
│            （注册中心，按 id 调度规则系统）                │
└──────────────┬───────────────────────┬──────────────────┘
               │                       │
        ┌──────▼──────┐         ┌──────▼──────┐
        │   DND 5E    │         │   COC 7版   │
        │ RuleSystem  │         │ RuleSystem  │
        └──────┬──────┘         └──────┬──────┘
               │                       │
        ┌──────▼──────┐         ┌──────▼──────┐
        │ Dnd5eRoll   │         │ Coc7Roll    │
        │ Resolver    │         │ Resolver    │
        └──────┬──────┘         └──────┬──────┘
               │                       │
               └───────────┬───────────┘
                           │
                  ┌────────▼────────┐
                  │ DiceRollResolver │
                  │ （通用骰子解析）  │
                  └─────────────────┘
```

所有类型定义见 `src/types/rules.ts`。

## RuleSystem 接口说明

```typescript
export interface RuleSystem {
  id: string;                      // 规则系统标识，如 'dnd5e' | 'coc7' | 'fate'
  name: string;                    // 显示名，如 'DND 5E'
  version: string;                 // 规则版本，如 '5e'、'7版'
  description: string;             // 描述
  theme: RuleSystemTheme;          // 主题标识：'dnd' | 'coc'
  diceTypes: DiceType[];           // 支持的骰子类型
  attributeSchema: AttributeDef[]; // 属性模式
  skillSchema: SkillDef[];         // 技能模式
  characterSheetTemplate: SheetTemplate; // 角色卡模板
  combatRules: CombatRules;        // 战斗规则
  rollResolver: RollResolver;      // 骰子解析器
  createDefaultCharacter(): Record<string, unknown>;       // 创建默认角色数据
  computeDerived(attributes: Record<string, number>): Record<string, number>; // 计算派生属性
}
```

### 各字段含义

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `string` | 规则系统唯一标识，用于房间创建时指定（如 `'fate'`）。需全局唯一，重复注册会抛错。 |
| `name` | `string` | 显示名，用于前端 UI 展示。 |
| `version` | `string` | 规则版本号，如 `'5e'`、`'7版'`、`'4th'`。 |
| `description` | `string` | 规则系统简介。 |
| `theme` | `'dnd' \| 'coc'` | 主题标识，前端据此切换配色。新增规则集可复用现有主题。 |
| `diceTypes` | `DiceType[]` | 支持的骰子类型，可选值：`'d4' \| 'd6' \| 'd8' \| 'd10' \| 'd12' \| 'd20' \| 'd100'`。 |
| `attributeSchema` | `AttributeDef[]` | 属性定义列表，每项含 `key`/`name`/`abbreviation`/`defaultValue`/`min`/`max`。 |
| `skillSchema` | `SkillDef[]` | 技能定义列表，每项含 `key`/`name`/`attribute`（关联属性）/`defaultValue`/`category`。 |
| `characterSheetTemplate` | `SheetTemplate` | 角色卡模板，含分页（`sections`）与字段（`fields`），计算字段标记 `computed: true` 并填写 `formula`。 |
| `combatRules` | `CombatRules` | 战斗规则，含先攻公式（`initiativeFormula`）、关联属性、状态效果列表（`statusEffects`）。 |
| `rollResolver` | `RollResolver` | 骰子解析器实例，负责表达式解析与掷骰。 |
| `createDefaultCharacter()` | 方法 | 返回包含所有字段默认值的角色数据对象，包括计算后的派生属性。 |
| `computeDerived(attributes)` | 方法 | 根据属性值计算派生属性（如调整值、熟练加值、HP 等）。 |

## RollResolver 接口说明

```typescript
export interface RollResolver {
  parse(expression: string): DiceExpression;
  roll(expression: string | DiceExpression): DiceRollResult;
  rollWithAdvantage(expression: string, advantage: boolean): DiceRollResult;
  rollWithBonusPenalty(expression: string, bonus: number, penalty: number): DiceRollResult;
  evaluateSuccess(roll: number, target: number): SuccessLevel;
}
```

| 方法 | 说明 |
| --- | --- |
| `parse(expression)` | 解析骰子表达式（如 `'2d20kh1+5'`）为 `DiceExpression` 结构。 |
| `roll(expression)` | 掷骰，返回 `DiceRollResult`（含 `rolls`/`kept`/`total` 等）。 |
| `rollWithAdvantage(expression, advantage)` | DND 优势/劣势掷骰，`advantage=true` 保留最高，`false` 保留最低。 |
| `rollWithBonusPenalty(expression, bonus, penalty)` | COC 奖金骰/惩罚骰掷骰。 |
| `evaluateSuccess(roll, target)` | COC 成功判定，返回 `'critical' \| 'extreme' \| 'hard' \| 'regular' \| 'fumble' \| null`。 |

> 若新规则集无特殊掷骰逻辑，可直接复用通用 `DiceRollResolver`，无需重新实现。

### 骰子表达式语法

```
[count]d<sides>[kh<n>|kl<n>][+/-modifier]
```

| 表达式 | 含义 |
| --- | --- |
| `d20` | 掷 1 个 20 面骰 |
| `2d6` | 掷 2 个 6 面骰 |
| `1d100+5` | 掷 1 个 100 面骰并加 5 |
| `3d20kh1` | 掷 3 个 20 面骰，保留最高 1 个 |
| `2d20kl1` | 掷 2 个 20 面骰，保留最低 1 个 |

掷骰使用 `node:crypto` 的 `randomInt` 确保真随机。

## 接入步骤

### 1. 创建规则系统目录

在 `backend/src/rules/` 下新建目录，以规则系统 id 命名：

```
backend/src/rules/
├── fate/                    # 新增规则集
│   ├── index.ts             # 入口，导出规则系统实例与解析器
│   ├── FateRuleSystem.ts    # RuleSystem 实现
│   └── FateRollResolver.ts  # 骰子解析器（如需特殊骰子）
├── dnd5e/
├── coc7/
├── DiceRollResolver.ts
├── Registry.ts
└── index.ts
```

### 2. 实现 RuleSystem 接口

参考 `MockRuleSystem.ts` 与 `dnd5e/Dnd5eRuleSystem.ts`，定义属性模式、技能模式、角色卡模板、战斗规则，并实现 `createDefaultCharacter()` 与 `computeDerived()`。

### 3. 实现骰子解析器（如需特殊骰子）

若规则集有特殊掷骰逻辑（如 FATE 骰子、COC 奖金骰），继承或包装 `DiceRollResolver` 实现自定义逻辑；否则直接复用 `new DiceRollResolver()`。

### 4. 注册到 ruleSystemRegistry

在 `backend/src/rules/index.ts` 中导入并注册新规则系统：

```typescript
import { ruleSystemRegistry } from './Registry.js';
import { dnd5eRuleSystem } from './dnd5e/index.js';
import { coc7RuleSystem } from './coc7/index.js';
import { fateRuleSystem } from './fate/index.js'; // 新增

ruleSystemRegistry.register(dnd5eRuleSystem);
ruleSystemRegistry.register(coc7RuleSystem);
ruleSystemRegistry.register(fateRuleSystem); // 新增
```

### 5. 更新房间创建校验

在 `backend/src/routes/rooms.ts` 的创建房间接口中，将新规则系统 id 加入合法值校验：

```typescript
if (ruleSystem !== 'dnd5e' && ruleSystem !== 'coc7' && ruleSystem !== 'fate') {
  throw new AppError(400, 'ruleSystem 必须为 dnd5e、coc7 或 fate');
}
```

同时更新 `backend/src/types/models.ts` 中的 `RuleSystem` 类型：

```typescript
export type RuleSystem = 'dnd5e' | 'coc7' | 'fate';
```

### 6. 前端适配（可选）

前端 `frontend/src/types/models.ts` 同步更新 `RuleSystem` 类型，并在大厅创建房间表单中加入新规则集选项。

## 完整示例：FATE 规则系统

以下为接入 FATE 规则系统的完整示例（FATE 使用 4dF 骰子，结果为 -4 到 +4）。

### `backend/src/rules/fate/FateRollResolver.ts`

```typescript
import { DiceRollResolver } from '../DiceRollResolver.js';
import type {
  DiceExpression,
  DiceRollResult,
  RollResolver,
  SuccessLevel,
} from '../../types/rules.js';

/**
 * FATE 骰子解析器
 *
 * FATE 骰子（dF）为 6 面骰，结果为 -1/0/+1。
 * 4dF 结果范围为 -4 到 +4。
 */
export class FateRollResolver implements RollResolver {
  private base = new DiceRollResolver();

  parse(expression: string): DiceExpression {
    // 将 4dF 转换为 4d6-8（4 个骰子，每个减 2，等效于 -1/0/+1）
    if (expression.toLowerCase().includes('df')) {
      const match = expression.match(/(\d+)dF/i);
      const count = match ? Number.parseInt(match[1], 10) : 4;
      return { count, sides: 6, modifier: -count * 2 };
    }
    return this.base.parse(expression);
  }

  roll(expression: string | DiceExpression): DiceRollResult {
    if (typeof expression === 'string' && expression.toLowerCase().includes('df')) {
      const parsed = this.parse(expression);
      const result = this.base.roll(parsed);
      result.label = 'FATE 骰子';
      return result;
    }
    return this.base.roll(expression);
  }

  // FATE 无优势/劣势概念，直接复用通用掷骰
  rollWithAdvantage(expression: string, _advantage: boolean): DiceRollResult {
    return this.roll(expression);
  }

  // FATE 无奖金骰/惩罚骰概念
  rollWithBonusPenalty(expression: string, _bonus: number, _penalty: number): DiceRollResult {
    return this.roll(expression);
  }

  // FATE 无 COC 式成功等级
  evaluateSuccess(_roll: number, _target: number): SuccessLevel {
    return null;
  }
}
```

### `backend/src/rules/fate/FateRuleSystem.ts`

```typescript
import type {
  AttributeDef,
  CombatRules,
  DiceType,
  RuleSystem,
  SheetTemplate,
  SkillDef,
} from '../../types/rules.js';
import { FateRollResolver } from './FateRollResolver.js';

const attributeSchema: AttributeDef[] = [
  {
    key: 'careful',
    name: '谨慎',
    abbreviation: 'CAR',
    description: '细致、耐心与观察力',
    defaultValue: 0,
    min: -4,
    max: 8,
  },
  {
    key: 'clever',
    name: '聪慧',
    abbreviation: 'CLE',
    description: '智力、推理与学识',
    defaultValue: 0,
    min: -4,
    max: 8,
  },
  {
    key: 'forceful',
    name: '强势',
    abbreviation: 'FOR',
    description: '力量、威慑与体魄',
    defaultValue: 0,
    min: -4,
    max: 8,
  },
];

const skillSchema: SkillDef[] = [
  { key: 'athletics', name: '运动', attribute: 'forceful', defaultValue: 0, category: '体能' },
  { key: 'investigation', name: '调查', attribute: 'clever', defaultValue: 0, category: '学识' },
  { key: 'notice', name: '察觉', attribute: 'careful', defaultValue: 0, category: '感知' },
];

const characterSheetTemplate: SheetTemplate = {
  sections: [
    { key: 'basic', title: '基础', icon: 'user' },
    { key: 'approaches', title: '途径', icon: 'star' },
  ],
  fields: [
    { key: 'name', label: '姓名', type: 'text', defaultValue: '', section: 'basic' },
    { key: 'careful', label: '谨慎', type: 'number', defaultValue: 0, section: 'approaches' },
    { key: 'clever', label: '聪慧', type: 'number', defaultValue: 0, section: 'approaches' },
    { key: 'forceful', label: '强势', type: 'number', defaultValue: 0, section: 'approaches' },
  ],
};

const combatRules: CombatRules = {
  initiativeFormula: '4dF',
  initiativeAttribute: 'careful',
  statusEffects: [
    { key: 'aspect', name: '特征', description: '可被调用或强制的影响因素', duration: 'permanent' },
  ],
};

const diceTypes: DiceType[] = ['d6', 'd20'];

export const fateRuleSystem: RuleSystem = {
  id: 'fate',
  name: 'FATE Accelerated',
  version: '加速版',
  description: 'FATE 加速版规则系统，使用途径（Approaches）与 4dF 骰子',
  theme: 'dnd',
  diceTypes,
  attributeSchema,
  skillSchema,
  characterSheetTemplate,
  combatRules,
  rollResolver: new FateRollResolver(),

  createDefaultCharacter(): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    for (const attr of attributeSchema) {
      data[attr.key] = attr.defaultValue;
    }
    for (const skill of skillSchema) {
      data[skill.key] = skill.defaultValue;
    }
    for (const field of characterSheetTemplate.fields) {
      if (field.computed) continue;
      if (data[field.key] === undefined) {
        data[field.key] = field.defaultValue;
      }
    }
    return data;
  },

  computeDerived(_attributes: Record<string, number>): Record<string, number> {
    // FATE 无派生属性
    return {};
  },
};
```

### `backend/src/rules/fate/index.ts`

```typescript
export { fateRuleSystem } from './FateRuleSystem.js';
export { FateRollResolver } from './FateRollResolver.js';
```

## 测试要求

新规则集需编写单元测试，覆盖以下场景：

### 测试文件位置

```
backend/tests/rules/fate/
├── FateRollResolver.test.ts   # 骰子解析器测试
└── FateRuleSystem.test.ts     # 规则系统测试
```

### 测试覆盖点

1. **骰子解析器**（`FateRollResolver.test.ts`）：
   - 表达式解析正确性（`4dF` 解析为 4 个 d6，modifier 为 -8）
   - 掷骰结果范围（4dF 结果在 -4 到 +4 之间）
   - 通用表达式（如 `1d20+5`）仍可正常掷骰

2. **规则系统**（`FateRuleSystem.test.ts`）：
   - `id`/`name`/`version` 等元信息正确
   - `attributeSchema`/`skillSchema` 字段完整
   - `createDefaultCharacter()` 返回所有字段默认值
   - `computeDerived()` 返回正确派生属性
   - 注册到 `ruleSystemRegistry` 后可通过 `get('fate')` 获取

### 测试示例

```typescript
import { describe, it, expect } from 'vitest';
import { fateRuleSystem } from '../../../src/rules/fate/index.js';

describe('FateRuleSystem', () => {
  it('应有正确的元信息', () => {
    expect(fateRuleSystem.id).toBe('fate');
    expect(fateRuleSystem.name).toBe('FATE Accelerated');
  });

  it('createDefaultCharacter 应返回所有字段默认值', () => {
    const character = fateRuleSystem.createDefaultCharacter();
    expect(character.careful).toBe(0);
    expect(character.clever).toBe(0);
    expect(character.forceful).toBe(0);
    expect(character.name).toBe('');
  });

  it('4dF 掷骰结果应在 -4 到 +4 之间', () => {
    const result = fateRuleSystem.rollResolver.roll('4dF');
    expect(result.total).toBeGreaterThanOrEqual(-4);
    expect(result.total).toBeLessThanOrEqual(4);
  });
});
```

### 运行测试

```bash
cd backend
npm test
```

## 参考实现

| 规则集 | 目录 | 说明 |
| --- | --- | --- |
| DND 5E | `src/rules/dnd5e/` | 6 属性 18 技能，优势/劣势掷骰，熟练加值按等级计算 |
| COC 7版 | `src/rules/coc7/` | 8 属性 d100 制，奖金骰/惩罚骰，成功等级判定，SAN 检定 |
| Mock | `src/rules/MockRuleSystem.ts` | 最简实现，用于测试抽象层 |
