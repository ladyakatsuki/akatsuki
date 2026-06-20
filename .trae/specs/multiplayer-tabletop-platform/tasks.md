# Tasks

## 阶段一：项目初始化与基础设施

- [x] Task 1: 搭建后端项目骨架
  - [x] SubTask 1.1: 初始化 Node.js + TypeScript + Express 项目，配置 ESLint/Prettier
  - [x] SubTask 1.2: 集成 Socket.IO，实现房间命名空间与连接鉴权中间件
  - [x] SubTask 1.3: 集成 SQLite（better-sqlite3）与数据访问层，建表 rooms/characters/stories/assets
  - [x] SubTask 1.4: 集成 Multer，实现素材上传接口（按房间/类型分目录存储）
  - [x] SubTask 1.5: 配置 CORS、静态文件服务、环境变量（PORT/UPLOAD_DIR/CORS_ORIGIN）

- [x] Task 2: 搭建前端项目骨架
  - [x] SubTask 2.1: 初始化 Vue 3 + Vite + TypeScript 项目，配置 ESLint/Prettier
  - [x] SubTask 2.2: 集成 Pinia、Vue Router、Socket.IO Client、Axios
  - [x] SubTask 2.3: 集成 Tailwind CSS + 自定义主题（DND 暗色奇幻 / COC 诡异暗绿双主题）
  - [x] SubTask 2.4: 搭建基础布局组件（AppShell、侧边栏、顶栏、日志面板）
  - [x] SubTask 2.5: 配置 API 封装与 Socket 事件封装（composables）

## 阶段二：规则系统抽象与双规则实现

- [x] Task 3: 设计并实现规则系统抽象层
  - [x] SubTask 3.1: 定义 `RuleSystem` 接口及类型（属性/技能/骰子/战斗规则/角色卡模板）
  - [x] SubTask 3.2: 实现规则系统注册中心与工厂（按 id 加载）
  - [x] SubTask 3.3: 编写规则系统接口单元测试（mock 实现）

- [x] Task 4: 实现 DND 5E 规则集
  - [x] SubTask 4.1: 定义 6 项属性、调整值计算、熟练加值
  - [x] SubTask 4.2: 定义技能列表与属性关联、被动察觉
  - [x] SubTask 4.3: 定义 HP/HD/AC/速度/法术位字段
  - [x] SubTask 4.4: 实现 d20 掷骰解析（含优势/劣势）
  - [x] SubTask 4.5: 实现先攻掷骰与状态效果列表
  - [x] SubTask 4.6: 编写 DND 5E 规则单元测试

- [x] Task 5: 实现 COC 7版规则集
  - [x] SubTask 5.1: 定义 8 项属性及派生值（SAN/HP/MP/移动/伤害加值/体格/构建）
  - [x] SubTask 5.2: 定义技能列表（战斗/调查/行动等分类）
  - [x] SubTask 5.3: 实现 d100 掷骰解析（普通/困难/极难成功判定）
  - [x] SubTask 5.4: 实现奖金骰/惩罚骰机制
  - [x] SubTask 5.5: 实现 SAN 检定与损失恢复、疯狂状态
  - [x] SubTask 5.6: 编写 COC 7版规则单元测试

## 阶段三：房间与认证系统

- [x] Task 6: 实现房间管理后端
  - [x] SubTask 6.1: 实现创建房间接口（生成 6 位唯一码，绑定 DM）
  - [x] SubTask 6.2: 实现加入房间接口（校验码/人数/规则集）
  - [x] SubTask 6.3: 实现房间状态查询接口（供重连）
  - [x] SubTask 6.4: 实现 Socket 房间加入与离开、状态广播
  - [x] SubTask 6.5: 实现房间内角色（DM/玩家）权限校验中间件
  - [x] SubTask 6.6: 编写房间管理接口与 Socket 事件测试

- [x] Task 7: 实现大厅与房间前端
  - [x] SubTask 7.1: 实现大厅页（创建房间表单：规则集选择；加入房间表单：房间码输入）
  - [x] SubTask 7.2: 实现房间页面路由与角色判定（DM/玩家布局分流）
  - [x] SubTask 7.3: 实现房间状态 Pinia store 与 Socket 同步
  - [x] SubTask 7.4: 实现玩家列表、DM 控制面板入口
  - [x] SubTask 7.5: 实现断线重连与状态恢复

## 阶段四：角色卡系统

- [x] Task 8: 实现角色卡后端
  - [x] SubTask 8.1: 实现角色 CRUD 接口（按房间+玩家隔离）
  - [x] SubTask 8.2: 实现角色数据 JSON Schema 校验（按规则集）
  - [x] SubTask 8.3: 实现 Socket `character:update` 事件（玩家编辑→全房间同步）
  - [x] SubTask 8.4: 实现立绘上传绑定到角色
  - [x] SubTask 8.5: 编写角色接口与 Socket 事件测试

- [x] Task 9: 实现角色卡前端组件
  - [x] SubTask 9.1: 实现动态角色卡渲染器（按规则集模板渲染表单）
  - [x] SubTask 9.2: 实现 DND 5E 角色卡 UI（属性/技能/战斗/法术/背景/物品分页）
  - [x] SubTask 9.3: 实现 COC 7版角色卡 UI（属性/派生/技能/SAN/背景/物品分页）
  - [x] SubTask 9.4: 实现立绘上传与预览组件
  - [x] SubTask 9.5: 实现角色卡实时编辑同步（防抖+冲突提示）
  - [x] SubTask 9.6: 实现角色状态条组件（HP/SAN 缩略显示，用于侧边栏）

## 阶段五：骰子系统

- [x] Task 10: 实现骰子后端
  - [x] SubTask 10.1: 实现骰子表达式解析器（如 `2d20kh1+5`、`1d100`、`3d6`）
  - [x] SubTask 10.2: 实现规则集掷骰解析（DND 优势/劣势、COC 奖金骰/惩罚骰）
  - [x] SubTask 10.3: 实现 Socket `dice:roll` / `dice:result` 事件（结果广播+日志记录）
  - [x] SubTask 10.4: 编写骰子解析器单元测试（覆盖各种表达式与边界）

- [x] Task 11: 实现骰子前端组件
  - [x] SubTask 11.1: 实现骰子浮窗组件（快捷骰子按钮：d4/d6/d8/d10/d12/d20/d100）
  - [x] SubTask 11.2: 实现自定义骰子表达式输入与解析预览
  - [x] SubTask 11.3: 实现 DND 优势/劣势切换、COC 奖金骰/惩罚骰切换
  - [x] SubTask 11.4: 实现骰子 3D 翻滚动画（CSS3D 或轻量 Three.js）
  - [x] SubTask 11.5: 实现骰子结果历史日志面板

## 阶段六：战斗回合管理

- [x] Task 12: 实现战斗系统后端
  - [x] SubTask 12.1: 实现战斗状态模型（先攻表、回合、轮次、参与者）
  - [x] SubTask 12.2: 实现 Socket `combat:start` / `combat:end` 事件（DM only）
  - [x] SubTask 12.3: 实现 `combat:nextTurn` / `combat:prevTurn` 与状态广播
  - [x] SubTask 12.4: 实现参与者 HP/状态效果实时更新
  - [x] SubTask 12.5: 编写战斗系统 Socket 事件测试

- [x] Task 13: 实现战斗追踪器前端
  - [x] SubTask 13.1: 实现先攻表组件（拖拽排序、当前回合高亮）
  - [x] SubTask 13.2: 实现添加/移除参与者（玩家角色 + NPC）
  - [x] SubTask 13.3: 实现回合控制按钮（开始/下一回合/结束战斗）
  - [x] SubTask 13.4: 实现参与者 HP/AC/状态效果快速编辑
  - [x] SubTask 13.5: 实现战斗日志面板

## 阶段七：网格地图与 Token

- [x] Task 14: 实现地图系统后端
  - [x] SubTask 14.1: 实现地图状态模型（网格类型/大小、背景、Token 列表、迷雾单元）
  - [x] SubTask 14.2: 实现 Socket `map:token:move` / `map:token:add` / `map:token:remove`
  - [x] SubTask 14.3: 实现 `map:fog:toggle`（DM only）与迷雾同步
  - [x] SubTask 14.4: 实现 `map:background:set` 与网格配置
  - [x] SubTask 14.5: 编写地图系统 Socket 事件测试

- [x] Task 15: 实现网格地图前端
  - [x] SubTask 15.1: 实现 Canvas 网格地图渲染（方格/六边形切换、缩放、平移）
  - [x] SubTask 15.2: 实现 Token 渲染与拖拽移动（含移动距离计算）
  - [x] SubTask 15.3: 实现迷雾战争绘制工具（DM 涂抹/擦除，玩家按权限显示）
  - [x] SubTask 15.4: 实现地图背景设置与网格尺寸配置面板
  - [x] SubTask 15.5: 实现 Token 放置面板（从素材库拖拽）

## 阶段八：故事书系统

- [x] Task 16: 实现故事书后端
  - [x] SubTask 16.1: 实现 Markdown 故事书解析器（按 `##` 分章节，提取图片引用）
  - [x] SubTask 16.2: 实现 JSON 故事书解析器（chapters/scenes/npcs/encounters schema 校验）
  - [x] SubTask 16.3: 实现故事书上传接口与存储
  - [x] SubTask 16.4: 实现 Socket `story:advance` / `story:event` 事件
  - [x] SubTask 16.5: 编写故事书解析器单元测试（含异常格式）

- [x] Task 17: 实现故事书前端
  - [x] SubTask 17.1: 实现 DM 故事控制面板（章节列表、跳转、事件触发按钮）
  - [x] SubTask 17.2: 实现玩家故事阅读器（Markdown 渲染、图片显示、章节同步）
  - [x] SubTask 17.3: 实现 JSON 故事书的场景/NPC/遇敌展示
  - [x] SubTask 17.4: 实现故事书上传与解析进度提示

## 阶段九：素材管理与实时状态

- [x] Task 18: 实现素材管理
  - [x] SubTask 18.1: 实现素材上传接口（类型/大小校验：图片 ≤ 5MB，仅 jpg/png/webp/gif）
  - [x] SubTask 18.2: 实现素材列表查询接口（按房间+类型）
  - [x] SubTask 18.3: 实现素材删除接口（DM only）
  - [x] SubTask 18.4: 实现 DM 素材管理面板 UI（分类、预览、删除、复制 URL）
  - [x] SubTask 18.5: 编写素材接口测试（含权限与文件校验）

- [x] Task 19: 实现实时角色状态侧边栏
  - [x] SubTask 19.1: 实现全房间角色状态侧边栏（立绘缩略图、HP/SAN 条、状态图标）
  - [x] SubTask 19.2: 实现 DM 视角的详细状态查看（点击角色展开详情）
  - [x] SubTask 19.3: 实现状态变化动画（HP 下降闪烁、SAN 下降特效）
  - [x] SubTask 19.4: 实现全局事件日志面板（骰子/战斗/故事/系统消息）

## 阶段十：UI 美化与扩展性

- [x] Task 20: UI 主题与视觉打磨
  - [x] SubTask 20.1: 实现 DND 暗色奇幻主题（羊皮纸纹理、金属边框、符文装饰）
  - [x] SubTask 20.2: 实现 COC 诡异暗绿主题（雾气效果、克苏鲁元素装饰）
  - [x] SubTask 20.3: 实现主题切换（按房间规则集自动切换）
  - [x] SubTask 20.4: 实现响应式布局适配（桌面优先，平板可用）
  - [x] SubTask 20.5: 实现过渡动画与微交互（按钮、面板、卡片）

- [x] Task 21: 扩展性预留与文档
  - [x] SubTask 21.1: 编写规则系统扩展指南（如何接入新规则集）
  - [x] SubTask 21.2: 编写 Socket 事件协议文档
  - [x] SubTask 21.3: 编写部署文档（环境变量、公网部署、反向代理示例）
  - [x] SubTask 21.4: 编写 README（启动命令、目录结构、技术栈说明）

## 阶段十一：端到端验证

- [x] Task 22: 集成测试与端到端验证
  - [x] SubTask 22.1: 编写完整跑团流程 E2E 测试（创建房间→加入→建角色→掷骰→战斗→故事推进）
  - [x]  SubTask 22.2: 编写双规则集切换验证测试
  - [x] SubTask 22.3: 编写并发性能测试（6 人房间满载压力测试）
  - [x] SubTask 22.4: 编写公网部署安全测试（未授权访问、恶意上传、CORS）

# Task Dependencies
- Task 2 依赖 Task 1（前端需后端接口契约）
- Task 3 依赖 Task 1/2（抽象层需前后端共享类型）
- Task 4/5 依赖 Task 3（规则实现依赖抽象层）
- Task 6 依赖 Task 1（房间管理依赖后端骨架）
- Task 7 依赖 Task 2/6（前端房间页依赖骨架与后端房间接口）
- Task 8 依赖 Task 4/5/6（角色卡依赖规则集与房间）
- Task 9 依赖 Task 2/8（角色卡前端依赖骨架与后端）
- Task 10 依赖 Task 4/5（骰子依赖规则集掷骰解析）
- Task 11 依赖 Task 2/10
- Task 12 依赖 Task 6/8（战斗依赖房间与角色）
- Task 13 依赖 Task 2/12
- Task 14 依赖 Task 6/18（地图依赖房间与素材）
- Task 15 依赖 Task 2/14
- Task 16 依赖 Task 1（故事书后端依赖骨架）
- Task 17 依赖 Task 2/16
- Task 18 依赖 Task 1（素材管理依赖后端骨架）
- Task 19 依赖 Task 9/12（状态侧边栏依赖角色与战斗）
- Task 20 依赖 Task 2/9/11/13/15/17（视觉打磨依赖所有功能组件）
- Task 21 可与各阶段并行
- Task 22 依赖所有功能任务
