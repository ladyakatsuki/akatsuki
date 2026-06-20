# 多人联机跑团平台 Spec

## Why
跑团爱好者需要一个无需安装、开箱即用的网页平台来组织 DND 5E 和 COC（克苏鲁的呼唤）跑团活动。现有工具要么功能分散（角色卡、地图、骰子各自分离），要么规则单一（仅支持 DND 或仅 COC），要么需要复杂安装。本平台旨在提供一个集成化、美观、支持双规则集的实时联机跑团解决方案。

## What Changes
- 新建 Vue 3 + Vite + TypeScript 前端项目，实现美观复杂的跑团界面
- 新建 Node.js + Express + Socket.IO 后端服务，支持房间制实时通信
- 实现房间码加入机制（DM 创建房间生成码，玩家凭码加入，最多 6 人）
- 实现可扩展的规则系统抽象层，支持 DND 5E 和 COC 7版双规则完整实现
- 实现角色卡制作系统（按规则集动态生成表单）
- 实现故事书导入（Markdown + JSON 双格式支持）
- 实现素材导入（人物立绘、地图素材等，服务器本地存储）
- 实现实时骰子掷骰与全房间广播
- 实现战斗回合管理（先攻表、回合制、HP/状态追踪）
- 实现网格地图与 Token 系统（移动、迷雾战争、距离计算）
- 实现故事推进与事件触发系统
- 实现实时角色状态查看（HP、状态、属性变化同步）
- **BREAKING** 全新项目，无历史兼容负担

## Impact
- Affected specs: 无（新项目）
- Affected code: 全新代码库
  - 前端：`frontend/` 目录
  - 后端：`backend/` 目录
  - 规则系统：`backend/src/rules/` + `frontend/src/rules/`
  - 数据持久化：SQLite（rooms、characters、stories、assets 元数据）

## 架构设计

### 整体架构
```
┌─────────────────────────────────────────────────┐
│                   浏览器前端                      │
│  Vue 3 + Pinia + Vue Router + Socket.IO Client  │
│  ┌──────────┬──────────┬──────────┬──────────┐  │
│  │ 大厅/房间 │ 角色卡   │ DM 控制台│ 玩家视图 │  │
│  ├──────────┼──────────┼──────────┼──────────┤  │
│  │ 骰子组件 │ 战斗追踪 │ 网格地图 │ 故事阅读 │  │
│  └──────────┴──────────┴──────────┴──────────┘  │
└────────────────────┬────────────────────────────┘
                     │ WebSocket (Socket.IO) + REST
┌────────────────────┴────────────────────────────┐
│              Node.js 后端服务                    │
│  Express (REST) + Socket.IO (实时) + Multer     │
│  ┌──────────┬──────────┬──────────┬──────────┐  │
│  │ 房间管理 │ 规则引擎 │ 故事解析 │ 素材存储 │  │
│  └──────────┴──────────┴──────────┴──────────┘  │
│         SQLite (持久化) + 本地文件系统            │
└─────────────────────────────────────────────────┘
```

### 规则系统抽象（核心扩展点）
```typescript
interface RuleSystem {
  id: string;                    // 'dnd5e' | 'coc7'
  name: string;                  // 显示名
  diceTypes: DiceType[];         // 支持的骰子
  attributeSchema: AttributeDef[];   // 属性定义
  skillSchema: SkillDef[];           // 技能定义
  characterSheetTemplate: SheetTemplate; // 角色卡模板
  combatRules: CombatRules;          // 战斗规则
  rollResolver: RollResolver;        // 骰子解析器
}
```
- DND5E 实现：d20 系统、6 项属性、技能熟练度、HD、法术位
- COC7 实现：d100 系统、8 项属性、技能点数、SAN 值、幸运、理智检定

### 房间与权限模型
- **DM（地下城主）**：房间创建者，拥有全部权限
  - 导入/编辑故事书、素材
  - 控制地图、迷雾、Token
  - 管理 NPC、战斗回合
  - 查看所有玩家角色状态
  - 踢出玩家、锁定房间
- **玩家**：凭房间码加入，权限受限
  - 编辑自己的角色卡
  - 掷骰子（自己可见 + 全房间广播结果）
  - 移动自己的 Token
  - 查看自己的角色状态 + DM 公开的信息

### 实时事件协议（Socket.IO）
| 事件 | 方向 | 说明 |
|------|------|------|
| `room:join` | C→S | 加入房间 |
| `room:state` | S→C | 同步房间完整状态 |
| `character:update` | C→S / S→C | 角色卡更新 |
| `dice:roll` | C→S | 请求掷骰 |
| `dice:result` | S→C | 广播骰子结果 |
| `combat:start` | C→S (DM) | 开始战斗 |
| `combat:turn` | S→C | 推送回合变更 |
| `map:token:move` | C→S / S→C | Token 移动 |
| `map:fog:toggle` | C→S (DM) | 切换迷雾 |
| `story:advance` | C→S (DM) | 推进故事章节 |
| `story:event` | S→C | 推送故事事件 |
| `asset:upload` | C→S (DM) | 上传素材 |

### 数据模型
- **Room**: id, code, ruleSystem, dmId, players[], storyId, mapState, combatState, createdAt
- **Character**: id, roomId, playerId, name, ruleSystem, data(JSON), portraitUrl, createdAt
- **Story**: id, roomId, format('md'|'json'), chapters[], currentChapter, assets[]
- **Asset**: id, roomId, type('portrait'|'map'|'token'|'other'), filename, url, uploadedBy
- **MapState**: id, roomId, gridSize, tokens[], fogCells[], backgroundUrl
- **CombatState**: id, roomId, initiative[], currentTurn, round, participants[]

### 前端页面结构
- `/` 大厅（创建/加入房间）
- `/room/:code` 房间（根据角色 DM/玩家显示不同布局）
  - DM 视图：故事面板 + 地图 + 战斗追踪 + 玩家状态监控 + NPC 管理
  - 玩家视图：角色卡 + 地图（受限） + 骰子 + 故事阅读
- 通用组件：骰子浮窗、聊天/日志面板、角色状态条

### UI 设计原则
- 深色奇幻主题（DND）/ 诡异暗绿主题（COC），按规则集切换
- 羊皮纸纹理、金属边框、魔法符文等装饰元素
- 角色卡采用仿纸质表单风格，支持折叠面板
- 地图支持网格/六边形切换、缩放、平移
- 骰子掷骰带 3D 翻滚动画
- 响应式布局，桌面优先，平板可用

## ADDED Requirements

### Requirement: 房间系统
系统 SHALL 支持基于房间码的多人联机，DM 创建房间时生成 6 位房间码，玩家凭码加入，单房间最多 6 人（1 DM + 5 玩家）。

#### Scenario: DM 创建房间
- **WHEN** 用户在大厅选择规则集（DND 5E / COC 7）并点击"创建房间"
- **THEN** 系统生成唯一 6 位房间码，创建房间，将该用户设为 DM，跳转到房间页面

#### Scenario: 玩家加入房间
- **WHEN** 用户在大厅输入房间码并点击"加入"
- **THEN** 系统校验房间码有效且未满员，将用户加入为玩家，同步当前房间状态

#### Scenario: 房间满员
- **WHEN** 房间已有 6 人且有新用户尝试加入
- **THEN** 系统拒绝加入并提示"房间已满"

### Requirement: 规则系统抽象
系统 SHALL 提供可扩展的规则系统抽象层，通过实现 `RuleSystem` 接口可接入新规则集，当前内置 DND 5E 和 COC 7版完整实现。

#### Scenario: 切换规则集
- **WHEN** DM 在创建房间时选择规则集
- **THEN** 房间内所有功能（角色卡模板、骰子类型、战斗规则）按所选规则集配置

### Requirement: DND 5E 规则实现
系统 SHALL 完整实现 DND 5E 简版规则，包括：
- 6 项属性（STR/DEX/CON/INT/WIS/CHA）及调整值
- 技能熟练度与被动察觉
- HP、HD、AC、速度
- 法术位（按施法者职业）
- d20 掷骰（含优势/劣势）
- 先攻掷骰与回合制战斗
- 状态效果（中毒、束缚等）

#### Scenario: DND 属性检定
- **WHEN** 玩家发起 STR 检定
- **THEN** 系统掷 d20 + STR 调整值 + 熟练加值（如熟练），广播结果

### Requirement: COC 7版规则实现
系统 SHALL 完整实现 COC 7版规则，包括：
- 8 项属性（STR/CON/SIZ/DEX/APP/INT/POW/EDU）及派生值
- 技能列表（含战斗技能、调查技能、行动技能）
- SAN 值与理智检定、SAN 损失恢复
- 幸运检定、奖金骰/惩罚骰
- d100 掷骰（普通/困难/极难成功判定）
- 状态效果（疯狂、临时疯狂等）

#### Scenario: COC 理智检定
- **WHEN** DM 触发 SAN 检定并指定损失骰（如 1d4）
- **THEN** 系统对目标玩家掷 d100 对比当前 SAN，判定成功/失败，扣除对应 SAN，若失败额外触发疯狂检定

### Requirement: 角色卡制作
系统 SHALL 提供按规则集动态生成的角色卡编辑器，支持属性/技能/背景/物品/立绘的录入与编辑，实时同步至全房间。

#### Scenario: 创建角色
- **WHEN** 玩家在房间内点击"创建角色"
- **THEN** 系统按当前规则集渲染空白角色卡表单，玩家填写后保存

#### Scenario: 上传立绘
- **WHEN** 玩家在角色卡点击"上传立绘"并选择图片
- **THEN** 系统上传至服务器，绑定到角色，全房间可见立绘更新

### Requirement: 故事书导入
系统 SHALL 支持导入 Markdown 和 JSON 双格式故事书，DM 可按章节推进，玩家端实时显示当前章节内容。

#### Scenario: 导入 Markdown 故事书
- **WHEN** DM 上传 .md 文件（用 `##` 分章节）
- **THEN** 系统解析为章节列表，DM 可选择起始章节

#### Scenario: 导入 JSON 故事书
- **WHEN** DM 上传符合 schema 的 .json 文件（含 chapters/scenes/npcs/encounters）
- **THEN** 系统解析为结构化故事，支持场景跳转和遇敌触发

#### Scenario: 推进故事
- **WHEN** DM 点击"下一章"
- **THEN** 全房间玩家端故事阅读器同步切换至新章节

### Requirement: 素材管理
系统 SHALL 提供 DM 专属的素材管理面板，支持上传人物立绘、地图背景、Token 图标等，存储于服务器本地，按房间隔离。

#### Scenario: 上传素材
- **WHEN** DM 在素材面板上传图片
- **THEN** 系统存储至 `uploads/{roomId}/{type}/`，返回 URL，素材列表实时更新

### Requirement: 实时骰子系统
系统 SHALL 提供多面骰子掷骰（d4/d6/d8/d10/d12/d20/d100），支持骰池、加值、优势/劣势（DND）、奖金骰/惩罚骰（COC），结果全房间广播并记入日志。

#### Scenario: DND 优势骰
- **WHEN** 玩家选择"优势"并掷 d20
- **THEN** 系统掷 2 个 d20 取较高值，加调整值，广播结果并标注"优势"

#### Scenario: COC 奖金骰
- **WHEN** 玩家选择"奖金骰"并掷 d100
- **THEN** 系统掷 1 个 d10（十位）+ 多个 d10（个位）取个位最小值，判定成功等级，广播

### Requirement: 战斗回合管理
系统 SHALL 提供战斗追踪器，DM 可发起战斗、添加参与者（玩家+NPC）、掷先攻、按先攻顺序推进回合，实时同步至全房间。

#### Scenario: 开始战斗
- **WHEN** DM 点击"开始战斗"并添加参与者
- **THEN** 系统为每个参与者掷先攻（或手动输入），生成先攻表，进入回合制

#### Scenario: 推进回合
- **WHEN** DM 点击"下一回合"
- **THEN** 系统高亮下一个参与者，全房间同步当前行动者

### Requirement: 网格地图与 Token
系统 SHALL 提供网格地图（支持方格/六边形），DM 可设置背景、放置/移动 Token、绘制迷雾战争，玩家可移动自己的 Token（DM 授权区域）。

#### Scenario: 移动 Token
- **WHEN** 玩家拖动自己的 Token 至新格子
- **THEN** 全房间同步 Token 位置，计算移动距离（按规则集速度规则）

#### Scenario: 迷雾战争
- **WHEN** DM 在地图上涂抹/擦除迷雾
- **THEN** 玩家端对应区域显示/隐藏，仅 DM 可见全图

### Requirement: 实时角色状态
系统 SHALL 在房间侧边栏实时显示所有角色状态（HP/SAN、状态效果、立绘缩略图），任何角色状态变化即时同步。

#### Scenario: HP 变化同步
- **WHEN** DM 对玩家角色造成伤害
- **THEN** 该玩家 HP 立即更新，全房间状态栏同步显示新 HP

### Requirement: 公网部署安全
系统 SHALL 支持公网部署，提供房间码访问控制、上传文件类型/大小校验、Socket 连接鉴权、CORS 配置，防止未授权访问和恶意上传。

#### Scenario: 未授权加入
- **WHEN** 用户尝试连接未提供有效房间码的 Socket
- **THEN** 系统拒绝连接

## MODIFIED Requirements
无（新项目）

## REMOVED Requirements
无（新项目）
