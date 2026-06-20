# 项目规则

## Node.js 环境

系统 PATH 中没有全局 Node.js。可用的 Node.js 路径：

**后端任务使用（v22.16.0）：**
```powershell
$env:PATH = 'c:\Users\admin\AppData\Roaming\TRAE SOLO CN\ModularData\ai-agent\vm\tools\node\;' + $env:PATH
```

**前端任务使用（v22.12.0）：**
```powershell
$env:PATH = 'D:\SillyTavern Launcher GUI\data\node\;' + $env:PATH
```

运行 npm 命令前务必先设置 PATH。

## 项目结构

- `backend/`：Node.js + Express + Socket.IO 后端
- `frontend/`：Vue 3 + Vite + TypeScript 前端
- `.trae/specs/multiplayer-tabletop-platform/`：规范文档

## 常用命令

### 后端（在 backend/ 目录）
- `npm run dev`：开发模式（tsx watch）
- `npm run build`：编译 TypeScript
- `npm run lint`：ESLint 检查
- `npm test`：运行 vitest 测试

### 前端（在 frontend/ 目录）
- `npm run dev`：开发服务器
- `npm run build`：构建（vue-tsc + vite build）
- `npm run lint`：ESLint 检查
- `npm run typecheck`：类型检查
- `npm test`：运行 vitest 测试

## 代码规范
- 后端：ESM 模块，strict TypeScript，无 any
- 前端：`<script setup lang="ts">`，strict TypeScript
- 注释用中文
