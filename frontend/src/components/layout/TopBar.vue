<script setup lang="ts">
// 顶栏：房间码（可复制）、规则集徽章、玩家数/在线数、离开房间、面板开关
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useRoomStore } from '@/stores/room'
import { useUiStore } from '@/stores/ui'
import { useTheme } from '@/composables/useTheme'
import { RULE_SETS } from '@/utils/constants'
import { formatRoomCode } from '@/utils/format'

const router = useRouter()
const roomStore = useRoomStore()
const uiStore = useUiStore()
const { code, ruleSystem, playerCount, onlinePlayerCount, isDM } = storeToRefs(roomStore)
const { sidebarOpen, logPanelOpen } = storeToRefs(uiStore)
const { theme, toggleTheme } = useTheme()

const copied = ref(false)

const ruleMeta = computed(() => (ruleSystem.value ? RULE_SETS[ruleSystem.value] : null))

async function copyCode() {
  if (!code.value) return
  try {
    await navigator.clipboard.writeText(code.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    // 剪贴板不可用时静默失败
  }
}

function leaveRoom() {
  router.push('/')
}
</script>

<template>
  <header
    class="app-topbar relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface/80 px-4 backdrop-blur-md"
  >
    <!-- 左侧：面板开关 + 房间信息 -->
    <div class="flex items-center gap-3">
      <button
        class="icon-btn rounded p-1.5 text-text-muted transition-all hover:bg-surface-hover hover:text-primary"
        :class="sidebarOpen ? 'text-primary bg-surface-hover/50' : ''"
        title="切换侧边栏"
        @click="uiStore.toggleSidebar()"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      </button>

      <button
        class="flex items-center gap-2 font-display text-lg font-bold text-gradient-gold transition-opacity hover:opacity-80"
        title="返回大厅"
        @click="leaveRoom"
      >
        <span class="title-ornament">◆</span>
        <span>TRPG Hall</span>
      </button>

      <!-- 房间码（可复制，突出显示） -->
      <button
        v-if="code"
        class="room-code-btn flex items-center gap-2 border-l border-border pl-3 transition-all hover:opacity-90"
        :title="copied ? '已复制！' : '点击复制房间码'"
        @click="copyCode"
      >
        <span class="text-xs uppercase tracking-widest text-text-muted">房间</span>
        <span class="room-code font-mono text-sm font-semibold text-primary">{{
          formatRoomCode(code)
        }}</span>
        <svg
          v-if="!copied"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="text-text-muted"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        <span v-else class="text-xs text-success">✓</span>
      </button>
    </div>

    <!-- 中间：规则集标识 + DM 徽章 -->
    <div v-if="code" class="hidden items-center gap-2 md:flex">
      <span
        v-if="ruleMeta"
        class="badge-ruleset"
        :class="theme === 'coc' ? 'border-success/50 text-success' : 'border-accent/50 text-accent'"
      >
        <span class="inline-block h-1.5 w-1.5 animate-glow-pulse rounded-full bg-current" />
        {{ ruleMeta.label }}
      </span>
      <span v-if="isDM" class="badge-ruleset border-primary/50 text-primary">DM</span>
    </div>

    <!-- 右侧：玩家数 + 主题切换 + 离开 + 日志开关 -->
    <div class="flex items-center gap-3">
      <!-- 玩家数 / 在线数 -->
      <div
        v-if="code"
        class="flex items-center gap-1.5 text-sm text-text-muted"
        title="在线 / 总玩家"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
          />
        </svg>
        <span class="font-mono">
          <span class="text-success">{{ onlinePlayerCount }}</span>
          <span class="text-text-muted/60">/{{ playerCount }}</span>
        </span>
      </div>

      <button
        class="icon-btn rounded p-1.5 text-text-muted transition-all hover:bg-surface-hover hover:text-primary"
        :title="theme === 'dnd' ? '当前 DND 主题，点击切换 COC' : '当前 COC 主题，点击切换 DND'"
        @click="toggleTheme()"
      >
        <svg
          v-if="theme === 'dnd'"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M12 2 9 9l-7 1 5 5-1 7 6-3 6 3-1-7 5-5-7-1z" />
        </svg>
        <svg
          v-else
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </button>

      <!-- 离开房间 -->
      <button
        v-if="code"
        class="icon-btn rounded p-1.5 text-text-muted transition-all hover:bg-danger/20 hover:text-danger"
        title="离开房间"
        @click="leaveRoom"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
        </svg>
      </button>

      <button
        class="icon-btn rounded p-1.5 text-text-muted transition-all hover:bg-surface-hover hover:text-primary"
        :class="logPanelOpen ? 'text-primary bg-surface-hover/50' : ''"
        title="切换日志面板"
        @click="uiStore.toggleLogPanel()"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
/* 顶栏：底部金属高光 + 内嵌阴影 */
.app-topbar {
  box-shadow:
    inset 0 -1px 0 rgb(var(--color-primary) / 0.15),
    inset 0 1px 0 rgb(255 255 255 / 0.04),
    0 4px 16px rgb(0 0 0 / 0.3);
  background-image: linear-gradient(
    180deg,
    rgb(var(--color-surface) / 0.9),
    rgb(var(--color-surface) / 0.7)
  );
}

/* 图标按钮：统一交互 */
.icon-btn {
  border: 1px solid transparent;
}
.icon-btn:hover {
  border-color: rgb(var(--color-primary) / 0.3);
}

/* 房间码：金属徽章感 */
.room-code-btn {
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}
.room-code-btn:hover {
  border-color: rgb(var(--color-primary) / 0.4);
  background: rgb(var(--color-primary) / 0.08);
}
.room-code {
  text-shadow: 0 0 8px rgb(var(--color-primary) / 0.5);
  letter-spacing: 0.15em;
}

/* 小屏隐藏部分文字以保持顶栏紧凑 */
@media (max-width: 768px) {
  .app-topbar {
    padding: 0 0.5rem;
  }
}
</style>
