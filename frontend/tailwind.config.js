/** @type {import('tailwindcss').Config} */
// Tailwind 双主题配置：DND（暗色奇幻）与 COC（诡异暗绿）
// 通过 CSS 变量切换主题，html[data-theme="coc"] 时启用 COC 配色
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: ['class', '[data-theme="coc"]'],
  theme: {
    extend: {
      colors: {
        // 主题色全部映射到 CSS 变量，便于运行时切换
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        background: 'rgb(var(--color-background) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-hover': 'rgb(var(--color-surface-hover) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        text: 'rgb(var(--color-text) / <alpha-value>)',
        'text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
      },
      fontFamily: {
        display: ['"Cinzel"', '"Noto Serif SC"', 'serif'],
        body: ['"Noto Sans SC"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px rgb(var(--color-primary) / 0.35)',
        'glow-lg': '0 0 32px rgb(var(--color-primary) / 0.45), 0 0 8px rgb(var(--color-primary) / 0.3)',
        inset: 'inset 0 0 24px rgb(0 0 0 / 0.5)',
        frame: '0 0 0 1px rgb(var(--color-border)), 0 8px 24px rgb(0 0 0 / 0.5)',
        deep: '0 24px 60px rgb(0 0 0 / 0.6), 0 8px 24px rgb(0 0 0 / 0.5)',
      },
      backgroundImage: {
        'parchment': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0.83 0 0 0 0 0.65 0 0 0 0 0.45 0 0 0 0.08 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        // HP 下降：红色闪烁
        'hp-damage': {
          '0%': { backgroundColor: 'rgb(var(--color-danger) / 0)' },
          '30%': { backgroundColor: 'rgb(var(--color-danger) / 0.45)', boxShadow: '0 0 16px rgb(var(--color-danger) / 0.8)' },
          '100%': { backgroundColor: 'rgb(var(--color-danger) / 0)' },
        },
        // HP 恢复：绿色闪烁
        'hp-heal': {
          '0%': { backgroundColor: 'rgb(var(--color-success) / 0)' },
          '30%': { backgroundColor: 'rgb(var(--color-success) / 0.45)', boxShadow: '0 0 16px rgb(var(--color-success) / 0.8)' },
          '100%': { backgroundColor: 'rgb(var(--color-success) / 0)' },
        },
        // SAN 损失：诡异绿色波纹
        'san-loss': {
          '0%': { boxShadow: '0 0 0 0 rgb(var(--color-success) / 0.7)' },
          '50%': { boxShadow: '0 0 24px 4px rgb(var(--color-success) / 0.5)' },
          '100%': { boxShadow: '0 0 0 0 rgb(var(--color-success) / 0)' },
        },
        // 状态效果图标弹入
        'status-pop': {
          '0%': { transform: 'scale(0) rotate(-45deg)', opacity: '0' },
          '60%': { transform: 'scale(1.25) rotate(8deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(0)', opacity: '1' },
        },
        // 死亡灰度淡入
        'death-fade': {
          '0%': { filter: 'grayscale(0) brightness(1)' },
          '100%': { filter: 'grayscale(1) brightness(0.55)' },
        },
        // 横向滑入（详情面板）
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        // 数字跳动
        'number-bump': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.4)' },
          '100%': { transform: 'scale(1)' },
        },
        // 卡片悬浮微动
        'card-float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        // 符文闪烁（角落装饰）
        'rune-flicker': {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '0.8' },
        },
        // 模态框缩放进入
        'modal-pop': {
          '0%': { transform: 'scale(0.92) translateY(10px)', opacity: '0' },
          '100%': { transform: 'scale(1) translateY(0)', opacity: '1' },
        },
        // 进度条流光
        'bar-shine': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
        // 雾气漂浮（COC）
        'fog-drift': {
          '0%': { transform: 'translate3d(0, 0, 0) scale(1)', opacity: '0.7' },
          '50%': { transform: 'translate3d(2%, -1%, 0) scale(1.05)', opacity: '1' },
          '100%': { transform: 'translate3d(-2%, 1%, 0) scale(1.02)', opacity: '0.8' },
        },
        // 标签指示器滑动
        'tab-underline': {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out both',
        'glow-pulse': 'glow-pulse 2.4s ease-in-out infinite',
        'shimmer': 'shimmer 3s linear infinite',
        'hp-damage': 'hp-damage 1s ease-out',
        'hp-heal': 'hp-heal 1s ease-out',
        'san-loss': 'san-loss 1.2s ease-out',
        'status-pop': 'status-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'death-fade': 'death-fade 0.8s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.3s ease-out both',
        'number-bump': 'number-bump 0.4s ease-out',
        'card-float': 'card-float 4s ease-in-out infinite',
        'rune-flicker': 'rune-flicker 3s ease-in-out infinite',
        'modal-pop': 'modal-pop 0.3s cubic-bezier(0.34, 1.3, 0.64, 1) both',
        'bar-shine': 'bar-shine 2.4s ease-in-out infinite',
        'fog-drift': 'fog-drift 16s ease-in-out infinite alternate',
        'tab-underline': 'tab-underline 0.25s ease-out both',
      },
    },
  },
  plugins: [],
}
