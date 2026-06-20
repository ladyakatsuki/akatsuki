<script setup lang="ts">
// 通用卡片组件：金属边框、角标装饰、悬浮微动
withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    glow?: boolean
    padded?: boolean
    /** 是否启用悬浮上浮效果 */
    hoverable?: boolean
  }>(),
  {
    glow: false,
    padded: true,
    hoverable: false,
  },
)
</script>

<template>
  <div
    class="frame-card flex flex-col"
    :class="[glow ? 'shadow-glow' : '', hoverable ? 'frame-card-hover' : '', padded ? 'p-4' : '']"
  >
    <header v-if="title || $slots.header" class="mb-3">
      <slot name="header">
        <div class="title-divider mb-1">
          <span class="title-ornament text-xs">◆</span>
        </div>
        <h3 v-if="title" class="mt-1 font-display text-lg font-semibold text-primary">
          {{ title }}
        </h3>
        <p v-if="subtitle" class="mt-0.5 text-xs text-text-muted">{{ subtitle }}</p>
      </slot>
    </header>
    <div class="flex-1">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="mt-3 border-t border-border/50 pt-3">
      <slot name="footer" />
    </footer>
  </div>
</template>
