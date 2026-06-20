<script setup lang="ts">
// 主布局壳：顶栏 + 侧边栏 + 主内容区 + 日志面板（可折叠）
import { storeToRefs } from 'pinia'
import { useUiStore } from '@/stores/ui'
import TopBar from './TopBar.vue'
import Sidebar from './Sidebar.vue'
import LogPanel from './LogPanel.vue'

const uiStore = useUiStore()
const { sidebarOpen, logPanelOpen } = storeToRefs(uiStore)
</script>

<template>
  <div class="flex h-screen w-full flex-col overflow-hidden bg-background">
    <TopBar />

    <div class="flex min-h-0 flex-1">
      <!-- 侧边栏 -->
      <Transition name="slide-x">
        <aside
          v-show="sidebarOpen"
          class="app-sidebar relative z-10 w-72 shrink-0 border-r border-border bg-surface/60 backdrop-blur-md xl:w-80"
        >
          <Sidebar />
        </aside>
      </Transition>

      <!-- 主内容区 -->
      <main class="relative min-w-0 flex-1 overflow-auto p-4">
        <slot />
      </main>

      <!-- 日志面板 -->
      <Transition name="slide-x-reverse">
        <aside
          v-show="logPanelOpen"
          class="app-logpanel relative z-10 w-80 shrink-0 border-l border-border bg-surface/60 backdrop-blur-md xl:w-96"
        >
          <LogPanel />
        </aside>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
/* 侧边栏 / 日志面板：顶部内嵌高光，增强金属边框感 */
.app-sidebar,
.app-logpanel {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.04),
    inset 0 0 32px rgb(0 0 0 / 0.25);
  background-image: linear-gradient(
    180deg,
    rgb(var(--color-surface) / 0.7),
    rgb(var(--color-background) / 0.5)
  );
}

.slide-x-enter-active,
.slide-x-leave-active,
.slide-x-reverse-enter-active,
.slide-x-reverse-leave-active {
  transition:
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.3s ease;
}
.slide-x-enter-from,
.slide-x-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}
.slide-x-reverse-enter-from,
.slide-x-reverse-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* 平板及以下：侧边栏/日志面板收窄 */
@media (max-width: 1024px) {
  .app-sidebar {
    width: 16rem;
  }
  .app-logpanel {
    width: 18rem;
  }
}
</style>
