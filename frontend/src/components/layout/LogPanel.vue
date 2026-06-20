<script setup lang="ts">
// 事件日志面板 - 支持标签切换（全部/骰子/战斗/故事/系统）、搜索过滤、特殊渲染
import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useLogStore, type LogEntry, type LogType } from '@/stores/log'
import { useRoomStore } from '@/stores/room'
import { LOG_TYPES } from '@/utils/constants'
import DiceLog from '@/components/dice/DiceLog.vue'
import type { DiceRollResultEvent, SuccessLevel } from '@/types/socket'

const logStore = useLogStore()
const roomStore = useRoomStore()
const { logs, diceResults } = storeToRefs(logStore)
const { isDM, players } = storeToRefs(roomStore)

const scrollRef = ref<HTMLElement | null>(null)

/** 标签类型：'all' 全部 | 'dice' 骰子 | 'combat' 战斗 | 'story' 故事 | 'system' 系统 | 'diceHistory' 骰子历史 */
type TabKey = 'all' | 'dice' | 'combat' | 'story' | 'system' | 'diceHistory'

/** 当前标签 */
const activeTab = ref<TabKey>('all')

/** 标签配置 */
const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'all', label: '全部', icon: '◆' },
  { key: 'dice', label: '骰子', icon: '🎲' },
  { key: 'combat', label: '战斗', icon: '⚔' },
  { key: 'story', label: '故事', icon: '📖' },
  { key: 'system', label: '系统', icon: '⚙' },
]

/** 搜索关键词 */
const searchKeyword = ref('')
/** 按玩家过滤（'all' = 全部玩家） */
const filterPlayerId = ref<string>('all')

/** 展开的日志 ID 集合 */
const expandedLogIds = ref<Set<string>>(new Set())

/** 日志类型图标映射 */
const LOG_TYPE_ICONS: Record<LogType, string> = {
  system: '⚙',
  dice: '🎲',
  combat: '⚔',
  story: '📖',
  chat: '💬',
  character: '👤',
}

/** 成功等级配置（中文 + 配色） */
const SUCCESS_LEVEL_META: Record<NonNullable<SuccessLevel>, { label: string; color: string }> = {
  critical: { label: '大成功', color: 'text-success border-success/60 bg-success/15' },
  extreme: { label: '极难成功', color: 'text-primary border-primary/60 bg-primary/15' },
  hard: { label: '困难成功', color: 'text-warning border-warning/60 bg-warning/15' },
  regular: { label: '普通成功', color: 'text-text border-border bg-surface/40' },
  fumble: { label: '大失败', color: 'text-danger border-danger/60 bg-danger/15' },
}

/** 当前标签下过滤后的日志（倒序，最新在前） */
const filteredLogs = computed<LogEntry[]>(() => {
  let list = logs.value

  // 按标签过滤
  if (activeTab.value !== 'all') {
    list = list.filter((l) => l.type === activeTab.value)
  }

  // 按玩家过滤
  if (filterPlayerId.value !== 'all') {
    list = list.filter((l) => l.playerId === filterPlayerId.value)
  }

  // 关键词搜索（消息 + 玩家名）
  const kw = searchKeyword.value.trim().toLowerCase()
  if (kw) {
    list = list.filter(
      (l) =>
        l.message.toLowerCase().includes(kw) || (l.playerName?.toLowerCase().includes(kw) ?? false),
    )
  }

  return [...list].reverse()
})

/** 各类型日志计数 */
const logCountByType = computed(() => {
  const counts: Record<string, number> = {
    all: logs.value.length,
    dice: 0,
    combat: 0,
    story: 0,
    system: 0,
  }
  for (const l of logs.value) {
    if (counts[l.type] !== undefined) counts[l.type]++
    else if (l.type === 'character') counts.story++
  }
  return counts
})

/** 玩家选项（用于过滤下拉） */
const playerOptions = computed(() => {
  return [
    { id: 'all', name: '全部玩家' },
    ...players.value.map((p) => ({ id: p.id, name: p.name })),
  ]
})

/** 自动滚动到顶部（最新日志） */
watch(
  () => filteredLogs.value.length,
  async () => {
    if (activeTab.value === 'diceHistory') return
    await nextTick()
    if (scrollRef.value) {
      scrollRef.value.scrollTop = 0
    }
  },
)

/** 切换标签 */
function switchTab(tab: TabKey) {
  activeTab.value = tab
}

/** 切换日志展开 */
function toggleExpand(logId: string) {
  if (expandedLogIds.value.has(logId)) {
    expandedLogIds.value.delete(logId)
  } else {
    expandedLogIds.value.add(logId)
  }
}

/** 是否展开 */
function isExpanded(logId: string): boolean {
  return expandedLogIds.value.has(logId)
}

/** 清空日志（DM only） */
function onClearLogs() {
  if (!isDM.value) return
  if (window.confirm('确定清空所有日志与骰子记录吗？此操作不可撤销。')) {
    logStore.clearLogs()
  }
}

/** 从日志 data 中提取骰子结果（若为骰子日志） */
function extractDiceData(log: LogEntry): DiceRollResultEvent | null {
  if (log.type !== 'dice' || !log.data) return null
  const d = log.data as Partial<DiceRollResultEvent>
  if (!d.expression) return null
  return d as DiceRollResultEvent
}

/** 从日志 data 中提取战斗数据 */
function extractCombatData(log: LogEntry): Record<string, unknown> | null {
  if (log.type !== 'combat' || !log.data) return null
  return log.data as Record<string, unknown>
}

/** 从日志 data 中提取故事数据 */
function extractStoryData(log: LogEntry): Record<string, unknown> | null {
  if (log.type !== 'story' || !log.data) return null
  return log.data as Record<string, unknown>
}

/** 获取日志类型图标 */
function logIcon(type: LogType): string {
  return LOG_TYPE_ICONS[type] ?? '◆'
}

/** 获取日志类型配色 */
function logColor(type: LogType): string {
  return LOG_TYPES[type]?.color ?? 'text-text-muted'
}

/** 获取日志类型标签 */
function logLabel(type: LogType): string {
  return LOG_TYPES[type]?.label ?? type
}

/** 是否有详细数据可展开 */
function hasDetail(log: LogEntry): boolean {
  return !!log.data || log.type === 'dice'
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- 标题 + 操作 -->
    <div class="logpanel-header border-b border-border p-4 pb-0">
      <div class="mb-2 flex items-center justify-between">
        <div>
          <div class="title-divider mb-1">
            <span class="title-ornament text-xs">◆</span>
          </div>
          <h2 class="panel-title">事件日志</h2>
        </div>
        <button
          v-if="isDM"
          class="rounded px-2 py-1 text-xs text-text-muted transition-colors hover:bg-danger/15 hover:text-danger"
          title="清空所有日志（仅 DM）"
          @click="onClearLogs"
        >
          清空
        </button>
      </div>

      <!-- 标签切换 -->
      <div class="flex flex-wrap gap-1">
        <button
          v-for="tab in TABS"
          :key="tab.key"
          class="tab-btn"
          :class="activeTab === tab.key ? 'tab-btn-active' : ''"
          @click="switchTab(tab.key)"
        >
          <span class="text-[10px]">{{ tab.icon }}</span>
          <span>{{ tab.label }}</span>
          <span class="ml-0.5 text-[10px] opacity-70">({{ logCountByType[tab.key] ?? 0 }})</span>
        </button>
        <button
          class="tab-btn"
          :class="activeTab === 'diceHistory' ? 'tab-btn-active' : ''"
          @click="switchTab('diceHistory')"
        >
          <span class="text-[10px]">🎲</span>
          <span>骰子记录</span>
          <span class="ml-0.5 text-[10px] opacity-70">({{ diceResults.length }})</span>
        </button>
      </div>

      <!-- 搜索与过滤（仅非骰子历史标签显示） -->
      <div v-if="activeTab !== 'diceHistory'" class="flex items-center gap-2 py-2">
        <!-- 搜索框 -->
        <div class="relative flex-1">
          <input
            v-model="searchKeyword"
            class="input-field w-full py-1 pl-7 text-xs"
            placeholder="搜索日志…"
          />
          <span class="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted">🔍</span>
          <button
            v-if="searchKeyword"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-danger"
            @click="searchKeyword = ''"
          >
            ×
          </button>
        </div>
        <!-- 玩家过滤 -->
        <select v-model="filterPlayerId" class="input-field w-auto py-1 text-xs" title="按玩家过滤">
          <option v-for="p in playerOptions" :key="p.id" :value="p.id">
            {{ p.name }}
          </option>
        </select>
      </div>
    </div>

    <!-- 内容区 -->
    <div class="min-h-0 flex-1">
      <!-- 骰子历史记录 -->
      <div v-show="activeTab === 'diceHistory'" class="h-full">
        <DiceLog :show-header="false" />
      </div>

      <!-- 事件日志 -->
      <div
        v-show="activeTab !== 'diceHistory'"
        ref="scrollRef"
        class="h-full space-y-1.5 overflow-auto p-3"
      >
        <template v-if="filteredLogs.length">
          <div
            v-for="log in filteredLogs"
            :key="log.id"
            class="rounded border px-2.5 py-1.5 text-xs animate-fade-in transition-colors hover:bg-surface/60"
            :class="[
              log.isHidden ? 'border-warning/30 bg-warning/5' : 'border-border/40 bg-background/40',
              hasDetail(log) ? 'cursor-pointer' : '',
            ]"
            @click="hasDetail(log) && toggleExpand(log.id)"
          >
            <!-- 主行：图标 + 时间 + 类型 + 玩家 + 消息 -->
            <div class="flex items-start gap-1.5">
              <span class="shrink-0 text-sm" :class="logColor(log.type)">{{
                logIcon(log.type)
              }}</span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="shrink-0 font-mono text-[10px] text-text-muted/70">{{
                    log.timestamp
                  }}</span>
                  <span
                    class="shrink-0 rounded px-1 text-[10px] font-semibold"
                    :class="logColor(log.type)"
                  >
                    {{ logLabel(log.type) }}
                  </span>
                  <span
                    v-if="log.playerName"
                    class="shrink-0 rounded bg-accent/20 px-1 text-[10px] text-accent"
                  >
                    {{ log.playerName }}
                  </span>
                  <span
                    v-if="log.isHidden"
                    class="shrink-0 rounded bg-warning/20 px-1 text-[10px] text-warning"
                    title="暗骰"
                  >
                    暗骰
                  </span>
                  <span
                    v-if="hasDetail(log)"
                    class="ml-auto shrink-0 text-text-muted transition-transform"
                    :class="isExpanded(log.id) ? 'rotate-90' : ''"
                  >
                    ▶
                  </span>
                </div>
                <p class="mt-0.5 text-text/90">{{ log.message }}</p>
              </div>
            </div>

            <!-- 骰子日志特殊渲染 -->
            <div
              v-if="log.type === 'dice' && isExpanded(log.id) && extractDiceData(log)"
              class="mt-2 rounded border border-border/40 bg-surface/40 p-2"
            >
              <div class="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span
                  v-if="extractDiceData(log)?.label"
                  class="rounded bg-accent/20 px-1.5 py-0.5 font-semibold text-accent"
                >
                  {{ extractDiceData(log)?.label }}
                </span>
                <span class="font-mono text-text-muted">
                  {{ extractDiceData(log)?.expression }}
                </span>
                <span
                  v-if="extractDiceData(log)?.successLevel"
                  class="rounded border px-1.5 py-0.5 text-[10px] font-bold"
                  :class="SUCCESS_LEVEL_META[extractDiceData(log)!.successLevel!].color"
                >
                  {{ SUCCESS_LEVEL_META[extractDiceData(log)!.successLevel!].label }}
                </span>
              </div>
              <div class="mt-1.5 flex flex-wrap items-center gap-1">
                <span
                  v-for="(value, idx) in extractDiceData(log)?.rolls ?? []"
                  :key="idx"
                  class="flex h-6 w-6 items-center justify-center rounded border border-primary/60 bg-primary/15 font-mono text-xs font-bold text-primary"
                >
                  {{ value }}
                </span>
                <span
                  v-if="(extractDiceData(log)?.modifier ?? 0) !== 0"
                  class="font-mono text-xs text-text-muted"
                >
                  {{ (extractDiceData(log)?.modifier ?? 0) > 0 ? '+' : ''
                  }}{{ extractDiceData(log)?.modifier }}
                </span>
                <span class="ml-auto font-display text-lg font-bold text-gradient-gold">
                  {{ extractDiceData(log)?.total }}
                </span>
              </div>
            </div>

            <!-- 战斗日志特殊渲染 -->
            <div
              v-else-if="log.type === 'combat' && isExpanded(log.id) && extractCombatData(log)"
              class="mt-2 rounded border border-danger/30 bg-danger/5 p-2 text-[11px]"
            >
              <div class="flex flex-wrap gap-2">
                <template v-for="(value, key) in extractCombatData(log)" :key="key">
                  <span class="rounded bg-background/60 px-1.5 py-0.5">
                    <span class="text-text-muted">{{ key }}:</span>
                    <span class="ml-1 font-mono text-text">{{ value }}</span>
                  </span>
                </template>
              </div>
            </div>

            <!-- 故事日志特殊渲染 -->
            <div
              v-else-if="log.type === 'story' && isExpanded(log.id) && extractStoryData(log)"
              class="mt-2 rounded border border-primary/30 bg-primary/5 p-2 text-[11px]"
            >
              <div class="flex flex-wrap gap-2">
                <template v-for="(value, key) in extractStoryData(log)" :key="key">
                  <span class="rounded bg-background/60 px-1.5 py-0.5">
                    <span class="text-text-muted">{{ key }}:</span>
                    <span class="ml-1 font-mono text-text">{{ value }}</span>
                  </span>
                </template>
              </div>
            </div>

            <!-- 通用详细数据 -->
            <div
              v-else-if="isExpanded(log.id) && log.data"
              class="mt-2 rounded border border-border/40 bg-surface/40 p-2 text-[11px]"
            >
              <pre class="whitespace-pre-wrap break-all font-mono text-text-muted">{{
                JSON.stringify(log.data, null, 2)
              }}</pre>
            </div>
          </div>
        </template>

        <!-- 占位空状态 -->
        <div v-else class="flex h-full flex-col items-center justify-center px-4 text-center">
          <div class="title-ornament mb-3 text-4xl opacity-30">◆</div>
          <p class="text-sm text-text-muted">
            {{ searchKeyword || filterPlayerId !== 'all' ? '无匹配日志' : '暂无事件' }}
          </p>
          <p class="mt-1 text-xs text-text-muted/70">
            {{
              searchKeyword || filterPlayerId !== 'all'
                ? '尝试调整搜索条件'
                : '加入房间后将显示实时事件'
            }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.logpanel-header {
  background-image: linear-gradient(180deg, rgb(var(--color-surface) / 0.6), transparent);
}
</style>
