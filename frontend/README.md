# TRPG Hall · 多人联机跑团平台前端

支持 **DND 5E** 与 **COC 7版** 双规则集的实时在线跑团平台前端。创建房间、邀请伙伴、掷骰定命，共赴一场跨越现实的冒险。

## 技术栈

| 技术 | 用途 |
| --- | --- |
| Vue 3 + Vite + TypeScript | 核心框架与类型安全 |
| Pinia | 状态管理 |
| Vue Router | 路由 |
| Socket.IO Client | 实时通信 |
| Axios | HTTP 请求 |
| Tailwind CSS | 原子化样式（双主题） |
| VueUse | 工具组合式 API |
| marked | Markdown 渲染（故事书） |
| Vitest | 单元测试 |
| ESLint + Prettier | 代码规范 |

## 目录结构

```
frontend/
├── src/
│   ├── main.ts               # 入口
│   ├── App.vue               # 根组件
│   ├── style.css             # 全局样式 + Tailwind + 双主题变量
│   ├── env.d.ts              # 环境变量类型
│   ├── router/               # 路由（/ 大厅，/room/:code 房间）
│   ├── stores/               # Pinia 状态管理
│   │   ├── room.ts           # 房间状态
│   │   ├── character.ts      # 角色状态
│   │   ├── combat.ts         # 战斗状态
│   │   ├── map.ts            # 地图状态
│   │   ├── story.ts          # 故事状态
│   │   ├── asset.ts          # 素材状态
│   │   ├── log.ts            # 日志状态
│   │   └── ui.ts             # UI 状态（主题等）
│   ├── api/                  # Axios 封装与各模块 API
│   │   ├── client.ts         # Axios 实例
│   │   ├── rooms.ts          # 房间 API
│   │   ├── characters.ts     # 角色 API
│   │   ├── stories.ts        # 故事书 API
│   │   └── assets.ts         # 素材 API
│   ├── composables/          # 组合式函数
│   │   ├── useSocket.ts      # Socket.IO 连接管理
│   │   ├── useRoom.ts        # 房间逻辑
│   │   ├── useDice.ts        # 掷骰逻辑
│   │   └── useTheme.ts       # 主题切换
│   ├── components/
│   │   ├── layout/           # 布局（AppShell/TopBar/Sidebar/LogPanel）
│   │   ├── common/           # 通用组件（Button/Input/Card/Modal/StatBar）
│   │   ├── lobby/            # 大厅（创建/加入房间表单）
│   │   ├── room/             # 房间（DMView/PlayerView）
│   │   ├── character/        # 角色卡（CharacterSheet/Coc7Sheet/Dnd5eSheet/PortraitUploader 等）
│   │   ├── dice/             # 骰子（DicePanel/DiceLog/DiceAnimation/DiceResultToast 等）
│   │   ├── combat/           # 战斗（InitiativeList/ParticipantManager/TurnControls/CombatLog 等）
│   │   ├── map/              # 地图（MapView/TokenPalette/FogToolbar/MapConfigPanel）
│   │   ├── story/            # 故事（StoryReader/StoryUploader/StoryControlPanel/MarkdownRenderer 等）
│   │   └── asset/            # 素材（AssetManager/AssetPicker）
│   ├── views/                # 页面（LobbyView/RoomView）
│   ├── rules/                # 规则系统前端适配
│   ├── types/                # 共享类型（socket/models/rules）
│   └── utils/                # 工具（format/constants/mapGrid）
├── public/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── .eslintrc.json
└── .prettierrc
```

## 启动命令

```bash
# 安装依赖
npm install

# 开发服务器（默认 http://localhost:5173）
npm run dev

# 类型检查 + 生产构建
npm run build

# 预览构建产物
npm run preview

# 代码检查
npm run lint

# 类型检查
npm run typecheck

# 单元测试
npm run test
```

## 环境变量

在 `.env` 中配置（已提供默认值）：

```
VITE_API_URL=http://localhost:3000      # 后端 API 地址
VITE_SOCKET_URL=http://localhost:3000   # Socket.IO 服务地址
```

生产环境构建时建议创建 `.env.production` 指定实际域名，详见 [部署文档](../docs/DEPLOYMENT.md)。

## 主题说明

平台内置两套主题，通过 `html[data-theme]` 属性切换，对应不同规则集的氛围：

### DND 主题（暗色奇幻）— 默认
| 变量 | 颜色 | 说明 |
| --- | --- | --- |
| primary | `#d4a574` | 琥珀金 |
| background | `#1a1410` | 深棕 |
| surface | `#2a2018` | 暗棕 |
| accent | `#8b3a3a` | 暗红 |
| text | `#e8dcc8` | 羊皮纸色 |

### COC 主题（诡异暗绿）
| 变量 | 颜色 | 说明 |
| --- | --- | --- |
| primary | `#4a7c59` | 诡异绿 |
| background | `#0d1410` | 深黑绿 |
| surface | `#1a2418` | 暗绿 |
| accent | `#5d4a6b` | 暗紫 |
| text | `#c8d0c8` | 雾灰 |

切换方式：
- 大厅页右上角按钮一键切换
- 选择规则集时自动预览对应主题
- 主题选择持久化到 `localStorage`

## 路由

| 路径 | 页面 | 说明 |
| --- | --- | --- |
| `/` | LobbyView | 大厅：创建/加入房间 |
| `/room/:code` | RoomView | 房间：根据 DM/玩家显示不同布局 |

## 功能模块

| 模块 | 说明 |
| --- | --- |
| 大厅 | 创建房间（选择规则集）、加入房间（房间码） |
| 房间 | DM 视图（全功能控制台）、玩家视图（角色卡 + 骰子 + 地图） |
| 角色卡 | DND 5E / COC 7版双规则集角色卡，立绘上传，NPC 管理 |
| 骰子 | 通用掷骰、技能检定、SAN 检定，掷骰动画与结果 Toast，暗骰支持 |
| 战斗 | 先攻列表、参与者管理、回合控制、战斗日志 |
| 地图 | 网格地图、Token 移动、战争迷雾（DM 控制）、背景图配置 |
| 故事 | Markdown / JSON 双格式故事书，章节同步推进 |
| 素材 | 立绘、地图、Token 图片上传与管理 |
| 日志 | 实时日志面板（骰子、战斗、故事、系统事件） |

## 测试命令

```bash
# 单元测试
npm run test

# 类型检查
npm run typecheck

# 代码检查
npm run lint

# 生产构建（含类型检查）
npm run build
```
