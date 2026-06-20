<script setup lang="ts">
// 侧边栏：实时角色状态（DM/玩家标识、在线状态、HP/SAN/MP 条、状态效果、战斗回合高亮）
// DM 视角可点击角色展开详情面板
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoomStore } from '@/stores/room'
import { useCharacterStore } from '@/stores/character'
import { useCombatStore } from '@/stores/combat'
import { RULE_SETS } from '@/utils/constants'
import CharacterStatus from '@/components/character/CharacterStatus.vue'
import CharacterDetailPanel from '@/components/character/CharacterDetailPanel.vue'
import type { Character } from '@/types/models'

const roomStore = useRoomStore()
const characterStore = useCharacterStore()
const combatStore = useCombatStore()
const { players, onlinePlayers, ruleSystem, isDM, code, playerCount } = storeToRefs(roomStore)
const { roomCharacters } = storeToRefs(characterStore)
const { isActive, currentParticipant, participants } = storeToRefs(combatStore)

const ruleMeta = computed(() => (ruleSystem.value ? RULE_SETS[ruleSystem.value] : null))

/** 按玩家 ID 分组的角色 */
const charactersByPlayer = computed(() => {
  const map: Record<string, Character[]> = {}
  for (const char of roomCharacters.value) {
    if (!map[char.playerId]) map[char.playerId] = []
    map[char.playerId].push(char)
  }
  return map
})

/** 当前战斗回合的角色 ID（用于高亮） */
const currentTurnCharacterId = computed(() => {
  if (!isActive.value || !currentParticipant.value) return null
  return currentParticipant.value.characterId ?? null
})

/** 战斗参与者状态效果映射（characterId -> statusEffects） */
const statusEffectsMap = computed(() => {
  const map: Record<string, string[]> = {}
  for (const p of participants.value) {
    if (p.characterId) {
      map[p.characterId] = p.statusEffects
    }
  }
  return map
})

function isOnline(playerId: string): boolean {
  return onlinePlayers.value.includes(playerId)
}

// ===== DM 详情面板 =====
/** 当前查看的角色 */
const detailCharacter = ref<Character | null>(null)
/** 是否显示详情面板 */
const showDetail = ref(false)

/** 点击角色（DM 视角） */
function onCharacterClick(character: Character) {
  if (!isDM.value) return
  detailCharacter.value = character
  showDetail.value = true
}

/** 关闭详情面板 */
function closeDetail() {
  showDetail.value = false
  detailCharacter.value = null
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- 标题 -->
    <div class="sidebar-header border-b border-border p-4">
      <div class="title-divider mb-2">
        <span class="title-ornament text-xs">◆</span>
      </div>
      <h2 class="panel-title">角色状态</h2>
      <p class="mt-0.5 text-xs text-text-muted">
        {{ ruleMeta?.label }} · {{ isDM ? 'DM 视角' : '玩家视角' }}
      </p>
    </div>

    <!-- 角色列表 -->
    <div class="flex-1 space-y-2 overflow-auto p-3">
      <template v-if="players.length">
        <div v-for="p in players" :key="p.id" class="frame-card frame-card-hover p-3">
          <div class="mb-1.5 flex items-center gap-2">
            <!-- 头像 -->
            <div class="relative">
              <div
                class="player-avatar flex h-9 w-9 items-center justify-center rounded-full border font-display text-sm font-bold"
                :class="
                  p.role === 'dm'
                    ? 'border-primary/60 bg-primary/10 text-primary'
                    : 'border-border bg-background text-text'
                "
              >
                {{ p.name.charAt(0) }}
              </div>
              <!-- 在线状态点 -->
              <span
                class="absolute -bottom-0.5 -right-0.5 inline-block h-2.5 w-2.5 rounded-full border-2 border-surface"
                :class="isOnline(p.id) ? 'bg-success animate-glow-pulse' : 'bg-text-muted/40'"
                :title="isOnline(p.id) ? '在线' : '离线'"
              />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-text">{{ p.name }}</p>
              <p class="text-[10px] uppercase tracking-wider text-text-muted">
                <span :class="p.role === 'dm' ? 'text-primary' : ''">
                  {{ p.role === 'dm' ? 'DM · 主持人' : '玩家' }}
                </span>
              </p>
            </div>
          </div>
          <!-- 角色状态条 -->
          <div v-if="charactersByPlayer[p.id]?.length" class="space-y-1.5">
            <CharacterStatus
              v-for="char in charactersByPlayer[p.id]"
              :key="char.id"
              :character="char"
              :compact="true"
              :show-player-name="false"
              :player-name="p.name"
              :status-effects="statusEffectsMap[char.id] ?? []"
              :is-current-turn="currentTurnCharacterId === char.id"
              :is-online="isOnline(p.id)"
              :clickable="isDM"
              @click="onCharacterClick"
            />
          </div>
          <div
            v-else
            class="rounded border border-border/40 bg-background/40 px-2 py-1 text-xs text-text-muted/70"
          >
            角色卡：未创建
          </div>
        </div>
      </template>

      <!-- 占位空状态 -->
      <div v-else class="flex h-full flex-col items-center justify-center px-4 text-center">
        <div class="title-ornament mb-3 text-4xl opacity-30">◆</div>
        <p class="text-sm text-text-muted">暂无玩家</p>
        <p class="mt-1 text-xs text-text-muted/70">等待玩家加入房间</p>
      </div>
    </div>

    <!-- 底部房间信息 -->
    <div v-if="code" class="sidebar-footer border-t border-border p-3">
      <div class="flex items-center justify-between text-xs">
        <span class="text-text-muted">房间码</span>
        <span
          class="font-mono text-primary"
          style="text-shadow: 0 0 8px rgb(var(--color-primary) / 0.4)"
          >{{ code }}</span
        >
      </div>
      <div class="mt-1 flex items-center justify-between text-xs">
        <span class="text-text-muted">在线 / 总数</span>
        <span class="font-mono">
          <span class="text-success">{{ onlinePlayers.length }}</span>
          <span class="text-text-muted/60"> / {{ playerCount }}</span>
        </span>
      </div>
    </div>

    <!-- DM 详情面板 -->
    <CharacterDetailPanel :character="detailCharacter" :show="showDetail" @close="closeDetail" />
  </div>
</template>

<style scoped>
.sidebar-header {
  background-image: linear-gradient(180deg, rgb(var(--color-surface) / 0.6), transparent);
}
.sidebar-footer {
  background-image: linear-gradient(0deg, rgb(var(--color-surface) / 0.6), transparent);
}
.player-avatar {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.1),
    0 2px 6px rgb(0 0 0 / 0.4);
}
</style>
