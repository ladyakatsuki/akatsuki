<script setup lang="ts">
// 状态条组件（HP/SAN 等）：渐变填充 + 流光动画 + 高光
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    value: number
    max: number
    label?: string
    /** 颜色主题：hp 红色、san 绿色、custom 自定义 */
    variant?: 'hp' | 'san' | 'custom'
    color?: string
    showText?: boolean
    height?: number
  }>(),
  {
    variant: 'hp',
    showText: true,
    height: 14,
  },
)

const percent = computed(() => {
  if (props.max <= 0) return 0
  return Math.max(0, Math.min(100, (props.value / props.max) * 100))
})

const barColor = computed(() => {
  if (props.variant === 'custom' && props.color) return props.color
  if (props.variant === 'san') return 'rgb(var(--color-success))'
  // hp：根据百分比变色
  if (percent.value > 60) return 'rgb(var(--color-success))'
  if (percent.value > 30) return 'rgb(var(--color-warning))'
  return 'rgb(var(--color-danger))'
})

const barColorEnd = computed(() => {
  if (props.variant === 'custom' && props.color) return props.color
  if (props.variant === 'san') return 'rgb(var(--color-primary))'
  if (percent.value > 60) return 'rgb(var(--color-primary))'
  if (percent.value > 30) return 'rgb(var(--color-danger))'
  return 'rgb(var(--color-accent))'
})

const fillStyle = computed(() => ({
  background: `linear-gradient(90deg, ${barColor.value}, ${barColorEnd.value})`,
  boxShadow: `0 0 10px ${barColor.value}, inset 0 1px 0 rgb(255 255 255 / 0.3)`,
  width: `${percent.value}%`,
  height: `${props.height}px`,
}))

/** 低血量警告（<25% 时闪烁） */
const isLow = computed(() => props.variant === 'hp' && percent.value > 0 && percent.value < 25)
</script>

<template>
  <div class="w-full">
    <div v-if="label || showText" class="mb-1 flex items-center justify-between text-xs">
      <span class="font-semibold uppercase tracking-widest text-text-muted">{{ label }}</span>
      <span v-if="showText" class="font-mono text-text">
        <span :class="isLow ? 'text-danger' : ''">{{ value }}</span>
        <span class="text-text-muted/60"> / {{ max }}</span>
      </span>
    </div>
    <div
      class="stat-bar-track relative w-full overflow-hidden rounded-sm border border-border bg-background/80"
      :class="isLow ? 'animate-glow-pulse' : ''"
      :style="{ height: `${height}px` }"
    >
      <!-- 填充条 -->
      <div class="stat-bar-fill h-full transition-all duration-500 ease-out" :style="fillStyle" />
      <!-- 流光高光 -->
      <div
        v-if="percent > 0"
        class="stat-bar-shine pointer-events-none absolute inset-y-0"
        :style="{ width: `${percent}%` }"
      >
        <span class="stat-bar-shine-line" />
      </div>
      <!-- 顶部高光 -->
      <div
        class="pointer-events-none absolute inset-0 opacity-40"
        style="background: linear-gradient(180deg, rgba(255, 255, 255, 0.35), transparent 50%)"
      />
    </div>
  </div>
</template>

<style scoped>
.stat-bar-track {
  box-shadow:
    inset 0 1px 3px rgb(0 0 0 / 0.5),
    inset 0 0 0 1px rgb(0 0 0 / 0.2);
}

/* 流光容器：裁剪到填充宽度 */
.stat-bar-shine {
  overflow: hidden;
}
/* 流光线条 */
.stat-bar-shine-line {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 40%;
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.35), transparent);
  animation: bar-shine 2.4s ease-in-out infinite;
}
</style>
