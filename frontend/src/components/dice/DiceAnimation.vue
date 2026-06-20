<script setup lang="ts">
// 骰子 3D 翻滚动画 - 使用 CSS 3D 变换实现骰子翻滚效果
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import DiceIcon from './DiceIcon.vue'

const props = withDefaults(
  defineProps<{
    /** 是否正在掷骰 */
    rolling: boolean
    /** 骰子面数 */
    sides?: number
  }>(),
  {
    sides: 20,
  },
)

/** 动画显示的骰子面数标签 */
const diceLabel = computed(() => `d${props.sides}`)

/** 骰子立方体六面的数字（模拟翻滚时可见的面） */
const faceNumbers = computed(() => {
  const max = props.sides
  return Array.from({ length: 6 }, (_, i) => {
    if (max <= 6) return (i % max) + 1
    return Math.floor(Math.random() * max) + 1
  })
})

/** 翻滚计时器触发器 */
const tickValue = ref(0)
let refreshTimer: ReturnType<typeof setInterval> | null = null

watch(
  () => props.rolling,
  (isRolling) => {
    if (isRolling) {
      refreshTimer = setInterval(() => {
        tickValue.value++
      }, 150)
    } else if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
  },
)

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})

/** 当前显示的随机数字（翻滚中快速变化） */
const currentNumber = computed(() => {
  void tickValue.value
  return Math.floor(Math.random() * props.sides) + 1
})
</script>

<template>
  <Transition name="dice-anim">
    <div
      v-if="rolling"
      class="dice-animation-overlay fixed inset-0 z-50 flex items-center justify-center"
    >
      <!-- 半透明遮罩 -->
      <div class="absolute inset-0 bg-background/70 backdrop-blur-sm" />

      <!-- 3D 骰子容器 -->
      <div class="relative perspective-1000">
        <!-- 翻滚的骰子立方体 -->
        <div class="dice-cube rolling">
          <!-- 六个面 -->
          <div
            v-for="(num, i) in faceNumbers"
            :key="i"
            class="dice-face"
            :style="{
              transform: `rotateX(${i * 90}deg) rotateY(${i * 90}deg) translateZ(40px)`,
            }"
          >
            <div class="flex flex-col items-center justify-center">
              <DiceIcon :sides="sides" :size="32" class="text-primary/80" />
              <span class="mt-1 font-mono text-lg font-bold text-primary">{{ num }}</span>
            </div>
          </div>
        </div>

        <!-- 中央数字闪烁 -->
        <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <div class="dice-number-flash text-6xl font-display font-bold text-gradient-gold">
            {{ currentNumber }}
          </div>
          <div class="mt-2 font-mono text-sm text-primary">{{ diceLabel }}</div>
        </div>
      </div>

      <!-- 底部提示 -->
      <div class="absolute bottom-1/4 left-1/2 -translate-x-1/2 text-center">
        <p class="font-display text-lg text-primary animate-glow-pulse">投掷中…</p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.dice-animation-overlay {
  pointer-events: none;
}

/* 3D 透视 */
.perspective-1000 {
  perspective: 800px;
  perspective-origin: 50% 50%;
}

/* 立方体容器 */
.dice-cube {
  position: relative;
  width: 80px;
  height: 80px;
  transform-style: preserve-3d;
}

/* 翻滚动画 */
.dice-cube.rolling {
  animation: dice-tumble 1.2s ease-in-out infinite;
}

@keyframes dice-tumble {
  0% {
    transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(1);
  }
  25% {
    transform: rotateX(360deg) rotateY(180deg) rotateZ(90deg) scale(1.1);
  }
  50% {
    transform: rotateX(180deg) rotateY(360deg) rotateZ(180deg) scale(0.95);
  }
  75% {
    transform: rotateX(540deg) rotateY(540deg) rotateZ(270deg) scale(1.1);
  }
  100% {
    transform: rotateX(720deg) rotateY(720deg) rotateZ(360deg) scale(1);
  }
}

/* 骰子面 */
.dice-face {
  position: absolute;
  top: 0;
  left: 0;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(var(--color-surface) / 0.9);
  border: 2px solid rgb(var(--color-primary) / 0.5);
  border-radius: 12px;
  box-shadow:
    inset 0 0 20px rgb(var(--color-primary) / 0.15),
    0 0 20px rgb(var(--color-primary) / 0.2);
  backface-visibility: visible;
}

/* 中央数字闪烁 */
.dice-number-flash {
  animation: number-flash 0.3s ease-in-out infinite alternate;
  text-shadow: 0 0 20px rgb(var(--color-primary) / 0.6);
}

@keyframes number-flash {
  from {
    opacity: 0.7;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1.05);
  }
}

/* 进出场动画 */
.dice-anim-enter-active,
.dice-anim-leave-active {
  transition: opacity 0.25s ease;
}
.dice-anim-enter-from,
.dice-anim-leave-to {
  opacity: 0;
}
</style>
