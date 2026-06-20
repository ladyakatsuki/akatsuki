# Tasks

- [x] Task 1: 搭建页面骨架与 CRT 外壳视觉
  - [x] SubTask 1.1: 创建 `index.html`，建立 HTML 基本结构（启动覆盖层、CRT 屏幕容器、Canvas 画布、扫描线/暗角/闪烁叠加层）
  - [x] SubTask 1.2: 编写 CRT 外壳 CSS：屏幕弧度（圆角+透视）、深色塑料边框、扫描线 repeating-linear-gradient、暗角 radial-gradient、整体闪烁 opacity 动画
  - [x] SubTask 1.3: 编写启动覆盖层样式与"点击启动"提示，绑定点击事件初始化 AudioContext 并隐藏覆盖层

- [x] Task 2: 实现雪花屏阶段（阶段一）
  - [x] SubTask 2.1: 初始化全屏 Canvas 与尺寸自适应（resize 处理）
  - [x] SubTask 2.2: 实现雪花噪点绘制（逐像素随机黑白值，ImageData 高效写入）
  - [x] SubTask 2.3: 实现雪花淡出逻辑（不透明度从 1.0 线性衰减至 0），淡出完成后进入阶段二

- [x] Task 3: 实现满屏乱码阶段（阶段二）
  - [x] SubTask 3.1: 定义乱码字符集常量（中文乱码集 + 拉丁/西里尔英文乱码集）
  - [x] SubTask 3.2: 实现等宽字符网格布局计算（按列宽/行高划分屏幕为字符单元）
  - [x] SubTask 3.3: 实现乱码跳动渲染（每帧为每个字符单元随机选取乱码字符绘制，带磷光 shadowBlur）

- [x] Task 4: 实现从左至右解密阶段（阶段三）
  - [x] SubTask 4.1: 定义目标文字"你是谁"及其在网格中的居中定位
  - [x] SubTask 4.2: 实现解密光标从左至右推进逻辑（按时间恒定速度推进列索引）
  - [x] SubTask 4.3: 实现字符锁定：光标扫过的位置稳定显示目标字符，未扫过位置继续跳动乱码
  - [x] SubTask 4.4: 解密完成后稳定显示"你是谁"并短暂停顿，触发阶段四

- [x] Task 5: 实现 Web Audio 合成音效
  - [x] SubTask 5.1: 实现白噪声生成器（AudioBufferSourceNode 填充随机值，循环播放）并接入增益节点
  - [x] SubTask 5.2: 实现雪花淡出时白噪声增益同步衰减
  - [x] SubTask 5.3: 实现电流嗡鸣（低频正弦振荡器持续背景音）
  - [x] SubTask 5.4: 实现解密咔哒声（短促噪声脉冲），随光标推进节奏触发

- [x] Task 6: 实现弹出新窗口继续解密（阶段四）
  - [x] SubTask 6.1: 编写弹窗页面 HTML/CSS/JS 字符串（内含独立解密动画，绿色荧光风格，解密出后续剧情文字）
  - [x] SubTask 6.2: 使用 Blob URL 将弹窗内容传给 `window.open` 打开新窗口
  - [x] SubTask 6.3: 处理弹窗被拦截情况：检测 `window.open` 返回 null，主屏显示拦截提示与重试按钮

- [x] Task 7: 阶段编排与整体串联
  - [x] SubTask 7.1: 实现阶段状态机（启动→雪花→乱码→解密→弹窗），按时间与条件推进
  - [x] SubTask 7.2: 使用 requestAnimationFrame 统一驱动渲染循环
  - [x] SubTask 7.3: 整体联调，调整各阶段时长与节奏使过渡自然

- [x] Task 8: 验证与打磨
  - [x] SubTask 8.1: 在 Chrome/Edge/Firefox 各浏览器测试动画与音效
  - [x] SubTask 8.2: 验证弹窗拦截处理与重试逻辑
  - [x] SubTask 8.3: 按 checklist.md 逐项核对

# Task Dependencies
- Task 2 依赖 Task 1（需 Canvas 与容器）
- Task 3 依赖 Task 2（雪花淡出后进入乱码）
- Task 4 依赖 Task 3（乱码基础上解密）
- Task 5 可与 Task 2/3/4 并行开发，但需在对应阶段接入
- Task 6 依赖 Task 4（解密完成后弹窗）
- Task 7 依赖 Task 1-6
- Task 8 依赖 Task 7
