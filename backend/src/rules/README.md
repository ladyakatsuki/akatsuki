# 规则系统（rules）

本目录实现多人联机跑团平台的规则系统抽象层，支持 DND 5E 与 COC 7版双规则集。
抽象层为 Task 4（DND 5E）与 Task 5（COC 7版）的具体实现奠定基础。

## 目录结构

```
rules/
├── README.md              # 本文件
├── DiceRollResolver.ts    # 通用骰子解析器（表达式解析、掷骰、保留最高/最低）
├── Registry.ts            # 规则系统注册中心（注册、查询、列举）
└── MockRuleSystem.ts      # Mock 规则系统（用于测试抽象层）
```

后续 Task 将新增：

```
rules/
├── dnd5e/                 # DND 5E 规则实现（Task 4）
│   ├── index.ts           # 规则系统入口
│   ├── Dnd5eRollResolver.ts  # DND 骰子解析器（优势/劣势等）
│   └── ...
└── coc7/                  # COC 7版规则实现（Task 5）
    ├── index.ts           # 规则系统入口
    ├── Coc7RollResolver.ts   # COC 骰子解析器（奖金骰/惩罚骰、成功判定）
    └── ...
```

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

## 核心接口

所有类型定义见 `src/types/rules.ts`。

### RuleSystem

规则系统统一接口，每个规则集需实现：

- `id` / `name` / `version` / `theme`：元信息
- `diceTypes`：支持的骰子类型
- `attributeSchema` / `skillSchema`：属性与技能模式
- `characterSheetTemplate`：角色卡模板（分页 + 字段）
- `combatRules`：战斗规则（先攻公式、状态效果等）
- `rollResolver`：骰子解析器
- `createDefaultCharacter()`：创建默认角色数据
- `computeDerived(attributes)`：计算派生属性

### RollResolver

骰子解析器接口：

- `parse(expression)`：解析骰子表达式
- `roll(expression)`：掷骰
- `rollWithAdvantage(expression, advantage)`：DND 优势/劣势
- `rollWithBonusPenalty(expression, bonus, penalty)`：COC 奖金骰/惩罚骰
- `evaluateSuccess(roll, target)`：COC 成功判定

### 骰子表达式语法

```
[count]d<sides>[kh<n>|kl<n>][+/-modifier]
```

| 表达式       | 含义                          |
| ------------ | ----------------------------- |
| `d20`        | 掷 1 个 20 面骰               |
| `2d6`        | 掷 2 个 6 面骰                |
| `1d100+5`    | 掷 1 个 100 面骰并加 5        |
| `3d20kh1`    | 掷 3 个 20 面骰，保留最高 1 个 |
| `2d20kl1`    | 掷 2 个 20 面骰，保留最低 1 个 |
| `2d20kh1+5`  | 保留最高 1 个并加 5           |

- `kh<n>`：保留最高 N 个（keep high）
- `kl<n>`：保留最低 N 个（keep low）
- 大小写不敏感（`D20`、`KH1` 等价）

掷骰使用 `node:crypto` 的 `randomInt` 确保真随机。

## 如何接入新规则集

1. **实现 RollResolver**：基于 `DiceRollResolver` 扩展或重新实现规则特定的掷骰逻辑（如 DND 优势/劣势、COC 奖金骰/惩罚骰与成功判定）。

2. **定义属性与技能模式**：按规则集定义 `AttributeDef[]` 与 `SkillDef[]`。

3. **设计角色卡模板**：定义 `SheetTemplate`，包括分页（`SheetSection`）与字段（`SheetFieldDef`），计算字段标记 `computed: true` 并填写 `formula`。

4. **配置战斗规则**：定义 `CombatRules`，包括先攻公式、关联属性与状态效果。

5. **实现 RuleSystem**：组装上述组件，实现 `createDefaultCharacter()` 与 `computeDerived()`。

6. **注册到注册中心**：在应用启动时调用 `ruleSystemRegistry.register(system)`。

示例参见 `MockRuleSystem.ts`。

## 测试

测试位于 `tests/rules/`：

- `DiceRollResolver.test.ts`：骰子表达式解析与掷骰
- `Registry.test.ts`：注册中心
- `MockRuleSystem.test.ts`：Mock 规则系统

运行测试：

```bash
npm test
```

## 状态

- [x] Task 3：规则系统抽象层（类型定义、通用骰子解析器、注册中心、Mock）
- [ ] Task 4：DND 5E 规则系统
- [ ] Task 5：COC 7版规则系统
