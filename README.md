# 多人联机跑团平台

支持 **DND 5E** 与 **COC 7版** 双规则集的实时在线跑团平台。创建房间、邀请伙伴、掷骰定命，共赴一场跨越现实的冒险。

## 项目简介

本平台为桌游跑团（TRPG）提供完整的在线联机解决方案，支持 DM（主持人）与玩家实时协同，覆盖跑团全流程：房间管理、角色卡、掷骰检定、战斗回合、地图 Token、故事书同步。内置 DND 5E 与 COC 7版两套规则系统，并通过规则系统抽象层支持扩展更多规则集。

## 功能特性

- **房间管理**：创建/加入房间，房间码邀请，DM 踢人，断线重连
- **双规则集**：DND 5E（6 属性 18 技能，优势/劣势）与 COC 7版（8 属性 d100 制，奖金骰/惩罚骰，SAN 检定）
- **角色卡管理**：按规则系统生成角色卡模板，支持立绘上传、数据编辑、NPC 管理
- **实时掷骰**：通用掷骰、技能检定、SAN 检定，支持暗骰（仅 DM 和掷骰者可见）
- **战斗系统**：先攻轮次、HP/AC 管理、状态条件、回合推进/回退
- **地图协同**：网格地图、Token 移动、战争迷雾（DM 可见/玩家不可见分离）
- **故事书**：Markdown/JSON 双格式，章节/场景同步推进
- **素材管理**：立绘、地图、Token 图片上传与管理
- **双主题**：DND 暗色奇幻主题与 COC 诡异暗绿主题，按规则集自动切换

## 技术栈

### 后端

| 技术 | 用途 |
| --- | --- |
| Node.js + TypeScript | 运行时与开发语言 |
| Express | HTTP 服务框架 |
| Socket.IO | 实时双向通信 |
| better-sqlite3 | SQLite 持久化 |
| Multer | 文件上传 |
| Vitest | 单元测试 |

### 前端

| 技术 | 用途 |
| --- | --- |
| Vue 3 + Vite + TypeScript | 核心框架与类型安全 |
| Pinia | 状态管理 |
| Vue Router | 路由 |
| Socket.IO Client | 实时通信 |
| Axios | HTTP 请求 |
| Tailwind CSS | 原子化样式（双主题） |
| VueUse | 工具组合式 API |

## 目录结构

```
前端/
├── backend/                    # 后端服务
│   ├── src/
│   │   ├── config/             # 环境变量配置
│   │   ├── db/                 # SQLite 数据库与仓储层
│   │   ├── middleware/         # 鉴权、权限、错误处理中间件
│   │   ├── routes/             # REST API 路由
│   │   ├── rules/              # 规则系统（DND 5E / COC 7版 / 注册中心）
│   │   ├── services/           # 业务逻辑层
│   │   ├── socket/             # Socket.IO 事件处理器
│   │   ├── types/              # 共享类型定义
│   │   └── utils/              # 工具函数
│   ├── tests/                  # 单元测试
│   └── package.json
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── api/                # Axios 封装与各模块 API
│   │   ├── components/         # Vue 组件（按业务模块组织）
│   │   ├── composables/        # 组合式函数
│   │   ├── router/             # 路由配置
│   │   ├── stores/             # Pinia 状态管理
│   │   ├── types/              # 共享类型定义
│   │   ├── views/              # 页面视图
│   │   └── utils/              # 工具函数
│   └── package.json
├── docs/                       # 项目文档
│   ├── SOCKET_PROTOCOL.md      # Socket 事件协议
│   └── DEPLOYMENT.md           # 部署文档
└── README.md                   # 本文件
```

## 快速开始

### 环境要求

- Node.js `>=18.0.0`（推荐 20.x LTS 或 22.x LTS）
- npm `>=9.0.0`

### 后端启动

```bash
cd backend

# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 默认配置即可用于开发，按需修改 PORT/CORS_ORIGIN 等

# 3. 开发模式（热重载）
npm run dev
```

后端默认监听 `http://localhost:3000`，健康检查：`GET /health`。

### 前端启动

```bash
cd frontend

# 1. 安装依赖
npm install

# 2. 配置环境变量（已提供默认值，开发环境无需修改）
# VITE_API_URL=http://localhost:3000
# VITE_SOCKET_URL=http://localhost:3000

# 3. 开发服务器
npm run dev
```

前端默认监听 `http://localhost:5173`，浏览器访问即可进入大厅。

### 同时启动

开发时需同时运行后端（3000 端口）与前端（5173 端口），前端通过 `VITE_API_URL` 与 `VITE_SOCKET_URL` 连接后端。

## 使用指南

### 创建房间

1. 打开前端大厅页面（`http://localhost:5173`）
2. 在"创建房间"表单中：
   - 输入 DM 名称
   - 选择规则系统（DND 5E 或 COC 7版）
3. 点击"创建房间"，系统生成房间码（6 位字母数字）
4. 将房间码分享给玩家，DM 自动进入房间

### 加入房间

1. 打开前端大厅页面
2. 在"加入房间"表单中：
   - 输入房间码
   - 输入玩家名称
3. 点击"加入房间"，进入房间

### DM 操作

DM 拥有房间全部权限：

- **角色管理**：创建 NPC、编辑任意角色卡、上传立绘
- **战斗管理**：开始/结束战斗、添加/移除参与者、推进回合、重掷先攻
- **地图管理**：添加/移除/更新 Token、切换战争迷雾、设置背景图
- **故事推进**：上传故事书、推进章节/场景、触发故事事件
- **房间管理**：踢出玩家
- **掷骰**：支持暗骰（仅 DM 和掷骰者可见）

### 玩家操作

玩家拥有受限权限：

- **角色管理**：创建自己的角色、编辑自己的角色卡、上传立绘
- **掷骰**：通用掷骰、技能检定、SAN 检定
- **地图**：移动自己的 Token
- **查看**：查看房间状态、其他角色卡（共享后）、地图（DM 控制可见范围）、故事书

## 开发指南

### 代码规范

- **后端**：ESM 模块，strict TypeScript，无 `any`，ESLint + Prettier
- **前端**：`<script setup lang="ts">`，strict TypeScript，ESLint + Prettier
- **注释**：使用中文注释

### 测试命令

```bash
# 后端测试（在 backend/ 目录）
cd backend
npm test              # 运行 vitest 测试
npm run lint          # ESLint 检查

# 前端测试（在 frontend/ 目录）
cd frontend
npm run test          # 运行 vitest 测试
npm run typecheck     # 类型检查
npm run lint          # ESLint 检查
```

### 扩展规则集

平台通过 `RuleSystem` 接口抽象规则系统，支持扩展新规则集（如 FATE、PF2E 等）。详见 [规则系统扩展指南](backend/src/rules/EXTENDING.md)。

扩展步骤概览：

1. 在 `backend/src/rules/` 下创建规则系统目录（如 `fate/`）
2. 实现 `RuleSystem` 接口（属性模式、技能模式、角色卡模板、战斗规则）
3. 实现骰子解析器（如需特殊骰子，否则复用 `DiceRollResolver`）
4. 在 `backend/src/rules/index.ts` 中注册到 `ruleSystemRegistry`
5. 更新房间创建校验与 `RuleSystem` 类型
6. 编写单元测试

## 部署指南

生产环境部署详见 [部署文档](docs/DEPLOYMENT.md)，包含：

- 后端 PM2 进程管理
- 前端 Nginx 静态文件服务
- Nginx 反向代理（API + WebSocket）
- HTTPS 配置
- 公网安全注意事项

## 相关文档

- [Socket 事件协议](docs/SOCKET_PROTOCOL.md) — 实时通信事件定义
- [部署文档](docs/DEPLOYMENT.md) — 生产环境部署指南
- [规则系统扩展指南](backend/src/rules/EXTENDING.md) — 接入新规则集
- [后端 README](backend/README.md) — 后端技术细节
- [前端 README](frontend/README.md) — 前端技术细节

## 许可证

MIT
