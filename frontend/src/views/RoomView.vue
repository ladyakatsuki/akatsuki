<script setup lang="ts">
// 房间页：恢复房间状态、建立 Socket、根据角色渲染 DM/玩家视图
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import AppShell from '@/components/layout/AppShell.vue'
import DMView from '@/components/room/DMView.vue'
import PlayerView from '@/components/room/PlayerView.vue'
import { useRoomStore } from '@/stores/room'
import { useCharacterStore } from '@/stores/character'
import { useCombatStore } from '@/stores/combat'
import { useMapStore } from '@/stores/map'
import { useStoryStore } from '@/stores/story'
import { useTheme } from '@/composables/useTheme'
import { normalizeRoomCode } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const roomStore = useRoomStore()
const characterStore = useCharacterStore()
const combatStore = useCombatStore()
const mapStore = useMapStore()
const storyStore = useStoryStore()
const { isDM, code, ruleSystem, isConnected, error, kicked } = storeToRefs(roomStore)
const { applyStoredTheme } = useTheme()

const routeCode = normalizeRoomCode(String(route.params.code ?? ''))

/** 初始化房间：从 store 或 localStorage 恢复，拉取状态并连接 Socket */
async function initRoom() {
  // 若 store 无房间或房间码不匹配，尝试从 localStorage 恢复
  if (!roomStore.currentRoom || roomStore.code !== routeCode) {
    const restored = roomStore.initFromStorage()
    if (!restored || roomStore.code !== routeCode) {
      // 无有效房间信息，返回大厅
      router.replace('/')
      return
    }
  }

  // 拉取最新房间状态（占位房间或刷新后都需要）
  await roomStore.fetchRoomState()
  // 建立 Socket 连接
  roomStore.connectSocket()

  // 拉取角色数据并订阅角色 Socket 事件
  if (roomStore.code && roomStore.playerId) {
    await Promise.all([
      characterStore.fetchRoomCharacters(roomStore.code),
      characterStore.fetchMyCharacters(roomStore.code, roomStore.playerId),
    ])
    characterStore.connectSocket(roomStore.playerId)
  }

  // 订阅战斗 Socket 事件
  combatStore.connectSocket()

  // 拉取地图状态并订阅地图 Socket 事件
  await mapStore.fetchMapState()
  mapStore.connectSocket()

  // 拉取故事状态并订阅故事 Socket 事件
  if (roomStore.code) {
    await storyStore.fetchStory(roomStore.code)
  }
  storyStore.connectSocket()
}

onMounted(() => {
  applyStoredTheme()
  void initRoom()
})

onBeforeUnmount(() => {
  // 组件卸载时断开 Socket（离开动作由路由守卫处理）
  roomStore.disconnectSocket()
  characterStore.reset()
  combatStore.reset()
  mapStore.reset()
  storyStore.reset()
})

// 被踢出时自动返回大厅
watch(kicked, (val) => {
  if (val) {
    router.replace('/')
  }
})

// 路由离开守卫：确认离开并调用 leaveRoom（被踢情况跳过）
onBeforeRouteLeave(async () => {
  if (kicked.value) {
    // 被踢出，直接放行并重置标记
    kicked.value = false
    return true
  }
  if (!roomStore.currentRoom) {
    // 已无房间状态（如初始化失败重定向），直接放行
    return true
  }
  const confirmed = window.confirm('确定要离开房间吗？离开后将断开实时连接。')
  if (!confirmed) return false
  await roomStore.leaveRoom()
  return true
})
</script>

<template>
  <AppShell>
    <!-- 顶部状态条 -->
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2 text-xs text-text-muted">
        <span
          class="badge-ruleset"
          :class="
            ruleSystem === 'coc7'
              ? 'border-success/50 text-success'
              : 'border-accent/50 text-accent'
          "
        >
          {{ ruleSystem === 'coc7' ? 'COC 7版' : 'DND 5E' }}
        </span>
        <span
          >房间码：<span
            class="font-mono text-primary"
            style="text-shadow: 0 0 8px rgb(var(--color-primary) / 0.4)"
            >{{ code }}</span
          ></span
        >
        <span
          class="inline-flex items-center gap-1"
          :class="isConnected ? 'text-success' : 'text-text-muted'"
        >
          <span
            class="inline-block h-1.5 w-1.5 rounded-full"
            :class="isConnected ? 'bg-success animate-glow-pulse' : 'bg-text-muted/50'"
          />
          {{ isConnected ? '已连接' : '连接中…' }}
        </span>
      </div>
    </div>

    <!-- 错误提示条 -->
    <div
      v-if="error"
      class="mb-3 flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger animate-fade-in"
    >
      <span class="mt-0.5">⚠</span>
      <span>{{ error }}</span>
    </div>

    <!-- 根据角色渲染视图 -->
    <div class="h-[calc(100%-3.5rem)]">
      <DMView v-if="isDM" />
      <PlayerView v-else />
    </div>
  </AppShell>
</template>
