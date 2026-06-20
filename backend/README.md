# 多人联机跑团平台后端

支持 **DND 5E** 与 **COC 7版** 双规则集的实时跑团平台后端服务。

## 项目简介

本服务为多人联机跑团平台提供后端支持，主要功能包括：

- 房间管理（创建、加入、离开、踢人、断线重连）
- 角色卡管理（DND 5E / COC 7版双规则集，立绘上传，NPC 管理）
- 实时掷骰与检定（通用掷骰、技能检定、SAN 检定、暗骰）
- 战斗回合管理（先攻、回合、HP、状态条件）
- 地图与 Token 协同（网格、战争迷雾、DM/玩家视角分离）
- 故事书章节同步（Markdown / JSON 双格式）
- 素材上传与管理（立绘、地图、Token 图片）

## 技术栈

| 技术 | 用途 |
| --- | --- |
| Node.js + TypeScript | 运行时与开发语言 |
| Express | HTTP 服务框架 |
| Socket.IO | 实时双向通信 |
| better-sqlite3 | SQLite 持久化 |
| Multer | 文件上传 |
| CORS | 跨域支持 |
| Vitest | 单元测试 |
| ESLint + Prettier | 代码规范 |

## 目录结构

```
backend/
├── src/
│   ├── index.ts              # 入口，启动 Express + Socket.IO
│   ├── app.ts                # Express app 配置（CORS、JSON、静态文件、路由挂载）
│   ├── config/
│   │   └── env.ts            # 环境变量读取与校验
│   ├── db/
│   │   ├── index.ts          # SQLite 初始化与连接
│   │   ├── schema.ts         # 建表 SQL
│   │   └── repositories/     # 数据访问层
│   │       ├── RoomRepository.ts
│   │       ├── CharacterRepository.ts
│   │       ├── CombatRepository.ts
│   │       ├── MapRepository.ts
│   │       ├── StoryRepository.ts
│   │       └── AssetRepository.ts
│   ├── middleware/
│   │   ├── auth.ts           # Socket 连接鉴权中间件
│   │   ├── permission.ts     # DM/玩家权限校验
│   │   └── errorHandler.ts   # 统一错误处理
│   ├── routes/
│   │   ├── rooms.ts          # 房间创建/加入/查询/离开
│   │   ├── characters.ts     # 角色 CRUD、立绘上传
│   │   ├── stories.ts        # 故事书上传/查询/删除
│   │   └── assets.ts         # 素材上传/查询/删除
│   ├── rules/                # 规则系统
│   │   ├── README.md         # 规则系统说明
│   │   ├── EXTENDING.md      # 规则系统扩展指南
│   │   ├── Registry.ts       # 规则系统注册中心
│   │   ├── DiceRollResolver.ts  # 通用骰子解析器
│   │   ├── MockRuleSystem.ts    # Mock 规则系统（测试用）
│   │   ├── dnd5e/            # DND 5E 规则实现
│   │   │   ├── Dnd5eRuleSystem.ts
│   │   │   ├── Dnd5eRollResolver.ts
│   │   │   └── index.ts
│   │   └── coc7/             # COC 7版规则实现
│   │       ├── Coc7RuleSystem.ts
│   │       ├── Coc7RollResolver.ts
│   │       └── index.ts
│   ├── services/             # 业务逻辑层
│   │   ├── RoomService.ts
│   │   ├── CharacterService.ts
│   │   ├── DiceService.ts
│   │   ├── CombatService.ts
│   │   ├── MapService.ts
│   │   ├── StoryService.ts
│   │   ├── AssetService.ts
│   │   ├── MarkdownStoryParser.ts
│   │   └── JsonStoryParser.ts
│   ├── socket/               # Socket.IO 事件处理器
│   │   ├── index.ts          # Socket.IO 初始化与事件注册
│   │   ├── roomHandler.ts    # 房间事件
│   │   ├── characterHandler.ts
│   │   ├── diceHandler.ts
│   │   ├── combatHandler.ts
│   │   ├── mapHandler.ts
│   │   └── storyHandler.ts
│   ├── types/                # 共享类型
│   │   ├── socket.ts         # Socket 事件类型
│   │   ├── models.ts         # 数据模型类型
│   │   └── rules.ts          # 规则系统类型
│   └── utils/
│       ├── logger.ts         # 简单日志
│       └── id.ts             # ID/房间码生成
├── tests/                    # 单元测试
│   ├── rooms/
│   ├── characters/
│   ├── dice/
│   ├── combat/
│   ├── map/
│   ├── story/
│   ├── assets/
│   └── rules/
├── uploads/                  # 上传文件目录（运行时创建）
├── data/                     # SQLite 数据目录（运行时创建）
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .prettierrc
├── .env.example
└── README.md
```

## 启动命令

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并按需修改：

```bash
cp .env.example .env
```

### 3. 开发模式（热重载）

```bash
npm run dev
```

### 4. 生产构建与启动

```bash
npm run build
npm start
```

### 5. 运行测试

```bash
npm test
```

### 6. 代码检查与格式化

```bash
npm run lint
```

## 环境变量说明

| 变量名 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 服务监听端口 |
| `UPLOAD_DIR` | `./uploads` | 上传文件存储目录（运行时自动创建） |
| `CORS_ORIGIN` | `*` | CORS 允许来源，生产环境建议指定具体域名 |
| `DB_PATH` | `./data/app.db` | SQLite 数据库文件路径（运行时自动创建） |

## API 概览

所有 API 返回统一格式：`{ ok: boolean, data?: T, error?: string }`。

### 健康检查

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 健康检查，返回 `{ "status": "ok" }` |

### 房间

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/rooms` | 创建房间（Body: `{ ruleSystem, dmName }`） |
| POST | `/api/rooms/:code/join` | 加入房间（Body: `{ playerName }`） |
| GET | `/api/rooms/:code` | 查询房间预览（规则系统、人数、是否满员） |
| GET | `/api/rooms/:code/state` | 获取房间完整状态（Query: `playerId`） |
| POST | `/api/rooms/:code/leave` | 离开房间（Body: `{ playerId }`） |

### 角色

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/rooms/:code/characters` | 创建角色（Body: `{ name, isNpc? }`） |
| GET | `/api/rooms/:code/characters` | 获取房间所有角色 |
| GET | `/api/rooms/:code/characters/mine` | 获取自己的角色（Query: `playerId`） |
| GET | `/api/characters/:id` | 获取单个角色 |
| PATCH | `/api/characters/:id` | 更新角色基本信息（Body: `{ name? }`） |
| PUT | `/api/characters/:id/data` | 更新角色卡数据（Body: `Record<string, unknown>`） |
| POST | `/api/characters/:id/portrait` | 上传立绘（multipart/form-data, field: `portrait`） |
| DELETE | `/api/characters/:id` | 删除角色 |

> 角色 API 需通过 `query.playerId` 或 `x-player-id` header 提供操作者 ID。

### 故事书

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/rooms/:code/story/upload` | 上传故事书（multipart/form-data, Query: `format=md\|json, playerId`） |
| GET | `/api/rooms/:code/story` | 获取故事书 |
| DELETE | `/api/rooms/:code/story` | 删除故事书（Query: `playerId`） |

### 素材

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/rooms/:code/assets` | 上传素材（仅 DM，multipart/form-data, Query: `type, playerId`） |
| GET | `/api/rooms/:code/assets` | 获取房间所有素材（Query: `type?`） |
| GET | `/api/rooms/:code/assets/:type` | 按类型获取素材 |
| DELETE | `/api/rooms/:code/assets/:id` | 删除素材（仅 DM，Query: `playerId`） |

素材类型：`portrait` / `map` / `token` / `other`，仅支持 jpg/png/webp/gif，单文件 5MB。

## Socket 事件

连接时需在 `handshake.auth` 中提供 `roomCode` 与 `playerId`：

```typescript
const socket = io(SOCKET_URL, {
  auth: { roomCode: 'ABCD1234', playerId: 'player_xxx' },
});
```

事件分类：

- **房间事件**（`room:*`）：加入、离开、踢人、状态同步
- **角色事件**（`character:*`）：创建、更新、删除、共享
- **骰子事件**（`dice:*`）：通用掷骰、技能检定、SAN 检定
- **战斗事件**（`combat:*`）：开始、结束、参与者管理、回合（DM only）
- **地图事件**（`map:*`）：Token 管理、迷雾、配置（部分 DM only）
- **故事事件**（`story:*`）：推进、事件触发（DM only）
- **日志事件**（`log:*`）：日志广播

完整事件定义详见 [Socket 事件协议文档](../docs/SOCKET_PROTOCOL.md)，类型定义见 `src/types/socket.ts`。

## 规则系统

支持 DND 5E 与 COC 7版双规则集，通过 `RuleSystem` 接口抽象，注册到 `ruleSystemRegistry` 统一调度。

- **DND 5E**：6 属性 18 技能，优势/劣势掷骰，熟练加值按等级计算，15 项标准状态
- **COC 7版**：8 属性 d100 制，奖金骰/惩罚骰，成功等级判定，SAN 检定，派生属性（HP/MP/SAN/DB/Build/MOV）

扩展新规则集详见 [规则系统扩展指南](src/rules/EXTENDING.md)。

## 测试命令

```bash
# 运行全部测试
npm test

# 代码检查
npm run lint

# 类型检查（通过构建）
npm run build
```

测试覆盖：仓储层、服务层、路由层、Socket 处理器、规则系统、骰子解析器。
