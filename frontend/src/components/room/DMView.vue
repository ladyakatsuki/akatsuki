<script setup lang="ts">
// DM 视图布局：多面板（故事、地图、战斗、玩家监控、NPC 管理）
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import CharacterStatus from '@/components/character/CharacterStatus.vue'
import CreateCharacterModal from '@/components/character/CreateCharacterModal.vue'
import AssetManager from '@/components/asset/AssetManager.vue'
import InitiativeList from '@/components/combat/InitiativeList.vue'
import ParticipantManager from '@/components/combat/ParticipantManager.vue'
import TurnControls from '@/components/combat/TurnControls.vue'
import CombatLog from '@/components/combat/CombatLog.vue'
import MapView from '@/components/map/MapView.vue'
import FogToolbar from '@/components/map/FogToolbar.vue'
import MapConfigPanel from '@/components/map/MapConfigPanel.vue'
import TokenPalette from '@/components/map/TokenPalette.vue'
import StoryControlPanel from '@/components/story/StoryControlPanel.vue'
import { useRoomStore } from '@/stores/room'
import { useCharacterStore } from '@/stores/character'

const roomStore = useRoomStore()
const characterStore = useCharacterStore()
const { players, onlinePlayers, code, playerCount, playerId } = storeToRefs(roomStore)
const { playerCharacters, npcs, isLoading } = storeToRefs(characterStore)

/** 玩家（不含 DM） */
const playerMembers = computed(() => players.value.filter((p) => p.role === 'player'))

/** NPC 创建对话框 */
const showNpcModal = ref(false)

/** 地图侧边栏标签 */
const mapTab = ref<'palette' | 'config'>('palette')
/** 迷雾编辑状态 */
const fogEditable = ref(false)
const fogMode = ref<'add' | 'remove'>('add')
const fogBrushSize = ref(1)

/** 素材管理面板 */
const showAssetManager = ref(false)

/** 玩家名映射（用于状态条显示） */
const playerNameMap = computed(() => {
  const map: Record<string, string> = {}
  for (const p of players.value) {
    map[p.id] = p.name
  }
  return map
})

function isOnline(targetPlayerId: string): boolean {
  return onlinePlayers.value.includes(targetPlayerId)
}

function onKick(targetPlayerId: string, playerName: string) {
  if (window.confirm(`确定踢出玩家「${playerName}」吗？`)) {
    roomStore.kickPlayer(targetPlayerId)
  }
}

/** 创建 NPC */
async function handleCreateNpc(name: string, isNpc: boolean) {
  if (!code.value || !playerId.value) return
  const created = await characterStore.createCharacter(code.value, playerId.value, name, isNpc)
  if (created) {
    showNpcModal.value = false
  }
}

/** 删除角色 */
async function handleDeleteCharacter(characterId: string) {
  if (!playerId.value) return
  await characterStore.deleteCharacter(characterId, playerId.value)
}
</script>

<template>
  <div class="dm-grid grid h-full grid-cols-12 grid-rows-[repeat(12,minmax(0,1fr))] gap-3">
    <!-- 战术地图 -->
    <BaseCard
      title="战术地图"
      subtitle="棋盘与 token 部署"
      class="col-span-12 row-span-6 xl:col-span-8"
      :padded="false"
    >
      <div class="flex h-full">
        <!-- 地图主区 -->
        <div class="flex flex-1 flex-col overflow-hidden">
          <div class="relative flex-1">
            <MapView
              :is-d-m="true"
              :fog-editable="fogEditable"
              :fog-mode="fogMode"
              :fog-brush-size="fogBrushSize"
            />
          </div>
          <FogToolbar
            v-model:editable="fogEditable"
            v-model:mode="fogMode"
            v-model:brush-size="fogBrushSize"
            :is-d-m="true"
          />
        </div>
        <!-- 侧边工具栏 -->
        <div class="flex w-56 flex-col border-l border-border/50">
          <div class="flex border-b border-border/50">
            <button
              class="map-tab"
              :class="mapTab === 'palette' ? 'map-tab-active' : ''"
              @click="mapTab = 'palette'"
            >
              Token
            </button>
            <button
              class="map-tab"
              :class="mapTab === 'config' ? 'map-tab-active' : ''"
              @click="mapTab = 'config'"
            >
              配置
            </button>
          </div>
          <div class="flex-1 overflow-hidden">
            <TokenPalette v-show="mapTab === 'palette'" :is-d-m="true" />
            <MapConfigPanel v-show="mapTab === 'config'" :is-d-m="true" />
          </div>
        </div>
      </div>
    </BaseCard>

    <!-- 故事面板 -->
    <BaseCard
      title="故事叙述"
      subtitle="DM 叙事与剧情推进"
      class="col-span-12 row-span-6 xl:col-span-4"
      :padded="false"
    >
      <StoryControlPanel />
    </BaseCard>

    <!-- 玩家监控 + 角色状态 -->
    <BaseCard
      title="玩家监控"
      subtitle="实时玩家与角色状态"
      class="col-span-12 row-span-3 lg:col-span-6 xl:col-span-4"
      :padded="false"
    >
      <div class="flex h-full flex-col">
        <div class="flex items-center justify-between border-b border-border/50 px-3 py-2">
          <span class="text-xs text-text-muted">
            在线 {{ onlinePlayers.length }} / 总数 {{ playerCount }}
          </span>
          <span class="font-mono text-xs text-primary">{{ code }}</span>
        </div>
        <div class="flex-1 space-y-2 overflow-auto p-3">
          <!-- 玩家角色状态条 -->
          <CharacterStatus
            v-for="char in playerCharacters"
            :key="char.id"
            :character="char"
            :compact="true"
            :show-player-name="true"
            :player-name="playerNameMap[char.playerId] || '未知'"
          />

          <!-- 玩家列表（无角色的玩家） -->
          <div
            v-for="p in playerMembers.filter(
              (pl) => !playerCharacters.some((c) => c.playerId === pl.id),
            )"
            :key="p.id"
            class="mb-2 flex items-center gap-2 rounded border border-border/40 bg-background/40 px-3 py-2"
          >
            <span
              class="inline-block h-2 w-2 shrink-0 rounded-full"
              :class="isOnline(p.id) ? 'bg-success animate-glow-pulse' : 'bg-text-muted/40'"
            />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm text-text">{{ p.name }}</p>
              <p class="text-[10px] text-text-muted">未创建角色</p>
            </div>
            <BaseButton size="sm" variant="ghost" @click="onKick(p.id, p.name)"> 踢出 </BaseButton>
          </div>

          <p v-if="!playerMembers.length" class="py-4 text-center text-xs text-text-muted">
            暂无玩家加入
          </p>
        </div>
      </div>
    </BaseCard>

    <!-- 战斗追踪器：先攻表 + 回合控制 -->
    <BaseCard
      title="战斗追踪器"
      subtitle="先攻轮次与回合管理"
      class="col-span-12 row-span-3 lg:col-span-7 xl:col-span-5"
      :padded="false"
    >
      <div class="flex h-full flex-col">
        <!-- 回合控制条 -->
        <div class="border-b border-border/50 p-2">
          <TurnControls />
        </div>
        <!-- 先攻表 -->
        <div class="flex-1 overflow-hidden">
          <InitiativeList is-d-m />
        </div>
      </div>
    </BaseCard>

    <!-- 参与者管理 -->
    <BaseCard
      title="参与者管理"
      subtitle="添加 / 移除战斗参与者"
      class="col-span-12 row-span-3 lg:col-span-5 xl:col-span-3"
      :padded="false"
    >
      <ParticipantManager />
    </BaseCard>

    <!-- 战斗日志 -->
    <BaseCard
      title="战斗日志"
      subtitle="战斗事件记录"
      class="col-span-12 row-span-3 xl:col-span-6"
      :padded="false"
    >
      <CombatLog />
    </BaseCard>

    <!-- NPC 管理 -->
    <BaseCard
      title="NPC 管理"
      subtitle="非玩家角色列表"
      class="col-span-12 row-span-3 xl:col-span-6"
      :padded="false"
    >
      <div class="flex h-full flex-col">
        <div class="flex items-center justify-between border-b border-border/50 px-3 py-2">
          <span class="text-xs text-text-muted">NPC 数量：{{ npcs.length }}</span>
          <BaseButton size="sm" variant="primary" @click="showNpcModal = true">
            + 创建 NPC
          </BaseButton>
        </div>
        <div class="flex-1 space-y-2 overflow-auto p-3">
          <div
            v-for="npc in npcs"
            :key="npc.id"
            class="group relative rounded border border-border/40 bg-background/40 p-2"
          >
            <CharacterStatus :character="npc" :compact="true" />
            <button
              class="absolute right-1.5 top-1.5 hidden rounded bg-danger/80 px-1.5 py-0.5 text-[10px] text-text group-hover:block"
              @click="handleDeleteCharacter(npc.id)"
            >
              删除
            </button>
          </div>
          <p v-if="!npcs.length" class="py-4 text-center text-xs text-text-muted">
            暂无 NPC，点击右上角创建
          </p>
        </div>
      </div>
    </BaseCard>

    <!-- 创建 NPC 对话框 -->
    <CreateCharacterModal
      v-model="showNpcModal"
      :is-npc="true"
      :loading="isLoading"
      @submit="handleCreateNpc"
    />

    <!-- 素材管理面板 -->
    <AssetManager v-model="showAssetManager" />
  </div>
</template>

<style scoped>
/* 小屏：取消固定行高，改为自动流式布局，避免内容挤压 */
@media (max-width: 1279px) {
  .dm-grid {
    grid-template-rows: none;
    grid-auto-rows: minmax(220px, auto);
    overflow-y: auto;
  }
}

/* 地图侧边栏标签按钮 */
.map-tab {
  flex: 1;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.map-tab:hover {
  color: var(--color-text);
  background: var(--color-background);
}

.map-tab-active {
  color: var(--color-primary);
  background: var(--color-background);
  font-weight: 600;
  box-shadow: inset 0 -2px 0 var(--color-primary);
}
</style>
