<script setup lang="ts">
// 根组件：应用启动时应用持久化主题
import { onMounted } from 'vue'
import { useTheme } from '@/composables/useTheme'

const { applyStoredTheme } = useTheme()

onMounted(() => {
  applyStoredTheme()
})
</script>

<template>
  <RouterView v-slot="{ Component }">
    <Transition name="page" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
</template>

<style>
/* 页面切换过渡 */
.page-enter-active,
.page-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
