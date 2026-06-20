<script setup lang="ts">
// 通用按钮组件：金属质感、悬浮发光、点击反馈
import { computed } from 'vue'

type Variant = 'metal' | 'primary' | 'accent' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    size?: Size
    block?: boolean
    loading?: boolean
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
  }>(),
  {
    variant: 'metal',
    size: 'md',
    block: false,
    loading: false,
    disabled: false,
    type: 'button',
  },
)

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'px-3 py-1.5 text-xs'
    case 'lg':
      return 'px-6 py-3 text-base'
    default:
      return 'px-4 py-2 text-sm'
  }
})

const variantClass = computed(() => {
  switch (props.variant) {
    case 'primary':
      return 'btn-primary'
    case 'accent':
      return 'btn-accent'
    case 'ghost':
      return 'btn-ghost'
    case 'danger':
      return 'btn-danger'
    default:
      return 'btn-metal'
  }
})
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="[
      'base-btn inline-flex items-center justify-center gap-2 rounded-md font-display font-semibold tracking-wide transition-all duration-200',
      sizeClass,
      variantClass,
      block ? 'w-full' : '',
      disabled || loading ? 'cursor-not-allowed opacity-50' : '',
    ]"
  >
    <span
      v-if="loading"
      class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
    <slot />
  </button>
</template>

<style scoped>
/* primary：金色金属主按钮 */
.btn-primary {
  position: relative;
  overflow: hidden;
  background: linear-gradient(
    180deg,
    rgb(var(--color-primary-soft)),
    rgb(var(--color-primary)) 55%,
    rgb(var(--color-accent) / 0.8)
  );
  border: 1px solid rgb(var(--color-primary) / 0.8);
  color: rgb(var(--color-background));
  text-shadow: 0 1px 1px rgb(255 255 255 / 0.25);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.35),
    inset 0 -1px 0 rgb(0 0 0 / 0.25),
    0 4px 12px rgb(var(--color-primary) / 0.3);
}
.btn-primary::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(180deg, rgb(255 255 255 / 0.25), transparent 45%);
}
.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.4),
    0 0 24px rgb(var(--color-primary) / 0.5),
    0 8px 20px rgb(0 0 0 / 0.5);
}
.btn-primary:active:not(:disabled) {
  transform: translateY(0);
  box-shadow:
    inset 0 2px 4px rgb(0 0 0 / 0.35),
    0 1px 2px rgb(0 0 0 / 0.3);
}

/* accent：暗红/暗紫强调按钮 */
.btn-accent {
  position: relative;
  overflow: hidden;
  background: linear-gradient(
    180deg,
    rgb(var(--color-accent) / 0.95),
    rgb(var(--color-accent) / 0.7)
  );
  border: 1px solid rgb(var(--color-accent));
  color: rgb(var(--color-text));
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.12),
    0 4px 12px rgb(0 0 0 / 0.4);
}
.btn-accent:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgb(var(--color-primary) / 0.5);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.15),
    0 0 18px rgb(var(--color-accent) / 0.5),
    0 6px 16px rgb(0 0 0 / 0.5);
}
.btn-accent:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: inset 0 2px 4px rgb(0 0 0 / 0.4);
}

/* ghost：透明幽灵按钮 */
.btn-ghost {
  background: transparent;
  border: 1px solid rgb(var(--color-border));
  color: rgb(var(--color-text-muted));
}
.btn-ghost:hover:not(:disabled) {
  color: rgb(var(--color-text));
  border-color: rgb(var(--color-primary) / 0.6);
  background: rgb(var(--color-primary) / 0.06);
  box-shadow: 0 0 12px rgb(var(--color-primary) / 0.15);
}
.btn-ghost:active:not(:disabled) {
  background: rgb(var(--color-primary) / 0.12);
}

/* danger：危险按钮 */
.btn-danger {
  position: relative;
  overflow: hidden;
  background: linear-gradient(
    180deg,
    rgb(var(--color-danger) / 0.95),
    rgb(var(--color-danger) / 0.7)
  );
  border: 1px solid rgb(var(--color-danger));
  color: rgb(var(--color-text));
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.12),
    0 4px 12px rgb(0 0 0 / 0.4);
}
.btn-danger:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.15),
    0 0 18px rgb(var(--color-danger) / 0.5),
    0 6px 16px rgb(0 0 0 / 0.5);
}
.btn-danger:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: inset 0 2px 4px rgb(0 0 0 / 0.4);
}

/* 通用：禁用态去除悬浮变换 */
.base-btn:disabled {
  transform: none !important;
}
</style>
