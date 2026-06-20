<script setup lang="ts">
// 玩家视图布局：角色卡 + 地图 + 骰子 + 故事 + 战斗先攻表（只读）
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import BaseCard from '@/components/common/BaseCard.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import CharacterSheet from '@/components/character/CharacterSheet.vue'
import CreateCharacterModal from '@/components/character/CreateCharacterModal.vue'
import InitiativeList from '@/components/combat/InitiativeList.vue'
import MapView from '@/components/map/MapView.vue'
import StoryReader from '@/components/story/StoryReader.vue'
import { useRoomStore } from '@/stores/room'
import { useCharacterStore } from '@/stores/character'
import { useCombatStore } from '@/stores/combat'

const roomStore = useRoomStore()
const characterStore = useCharacterStore()
const combatStore = useCombatStore()
const { code, playerId } = storeToRefs(roomStore)
const { myCharacter, isLoading } = storeToRefs(characterStore)
const { isActive, currentParticipant, round } = storeToRefs(combatStore)

/** 创建角色对话框 */
const showCreateModal = ref(false)

/** 我的角色（用于显示） */
const currentChar = computed(() => myCharacter.value)

/** 是否轮到我行动 */
const isMyTurn = computed(() => {
  if (!currentParticipant.value || !currentChar.value) return false
  return currentParticipant.value.characterId === currentChar.value.id
})

/** 创建角色 */
async function handleCreate(name: string, isNpc: boolean) {
  if (!code.value || !playerId.value) return
  const created = await characterStore.createCharacter(code.value, playerId.value, name, isNpc)
  if (created) {
    showCreateModal.value = false
  }
}

/** 删除角色 */
async function handleDelete() {
  if (!currentChar.value || !playerId.value) return
  const ok = await characterStore.deleteCharacter(currentChar.value.id, playerId.value)
  if (ok) {
    characterStore.setCurrentCharacter(null)
  }
}
</script>

<template>
  <div class="player-grid grid h-full grid-cols-12 grid-rows-6 gap-3">
    <!-- 角色卡 -->
    <BaseCard
      title="角色卡"
      subtitle="你的冒险者档案"
      class="col-span-12 row-span-6 xl:col-span-3"
      :padded="false"
    >
      <div class="flex h-full flex-col p-3">
        <!-- 有角色：显示角色卡 -->
        <CharacterSheet
          v-if="currentChar"
          :character="currentChar"
          :default-editable="false"
          :show-edit-toggle="true"
          :show-portrait="true"
          :allow-delete="true"
          @delete="handleDelete"
        />

        <!-- 无角色：创建角色引导 -->
        <div v-else class="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
          <div class="title-ornament mb-2 text-5xl opacity-20">◆</div>
          <div>
            <p class="font-display text-lg text-text-muted">尚未创建角色</p>
            <p class="mt-1 text-xs text-text-muted/70">创建你的角色，开始冒险之旅</p>
          </div>
          <BaseButton variant="primary" :loading="isLoading" @click="showCreateModal = true">
            创建角色
          </BaseButton>
        </div>
      </div>
    </BaseCard>

    <!-- 故事阅读器（仿古书风格，自动同步 DM 推进） -->
    <BaseCard
      title="故事阅读"
      subtitle="跟随 DM 的叙事冒险"
      class="col-span-12 row-span-4 xl:col-span-5"
      :padded="false"
    >
      <StoryReader />
    </BaseCard>

    <!-- 骰子 -->
    <BaseCard
      title="骰子台"
      subtitle="投掷命运"
      class="col-span-12 row-span-2 xl:col-span-5"
      :padded="false"
    >
      <div class="flex h-full flex-col items-center justify-center p-4 text-center">
        <div class="title-ornament mb-2 text-4xl opacity-20">◆</div>
        <p class="font-display text-base text-text-muted">骰子</p>
        <p class="mt-1 text-xs text-text-muted/70">将在 Task 11 实现</p>
      </div>
    </BaseCard>

    <!-- 战斗先攻表（只读） -->
    <BaseCard
      title="战斗先攻表"
      subtitle="实时战斗追踪"
      class="col-span-12 row-span-3 lg:col-span-6 xl:col-span-4"
      :padded="false"
    >
      <div class="flex h-full flex-col">
        <!-- 当前回合提示条 -->
        <div
          v-if="isActive"
          class="border-b border-border/50 px-3 py-2 text-center"
          :class="isMyTurn ? 'bg-primary/15' : ''"
        >
          <p class="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            当前行动
          </p>
          <p
            class="mt-0.5 font-display text-base font-bold"
            :class="isMyTurn ? 'text-gradient-gold' : 'text-text'"
          >
            {{ currentParticipant?.name ?? '—' }}
          </p>
          <p class="mt-0.5 text-[10px] text-text-muted">第 {{ round }} 轮</p>
          <div
            v-if="isMyTurn"
            class="mt-1 inline-block rounded bg-primary/30 px-2 py-0.5 text-[10px] font-bold text-primary animate-glow-pulse"
          >
            轮到你行动！
          </div>
        </div>

        <!-- 先攻表（只读） -->
        <div class="flex-1 overflow-hidden">
          <InitiativeList :is-d-m="false" />
        </div>
      </div>
    </BaseCard>

    <!-- 地图（只读，玩家仅可拖动自己的 Token） -->
    <BaseCard
      title="战术地图"
      subtitle="探索与移动"
      class="col-span-12 row-span-3 lg:col-span-6 xl:col-span-4"
      :padded="false"
    >
      <MapView :is-d-m="false" :fog-editable="false" />
    </BaseCard>

    <!-- 创建角色对话框 -->
    <CreateCharacterModal v-model="showCreateModal" :loading="isLoading" @submit="handleCreate" />
  </div>
</template>

<style scoped>
/* 小屏：取消固定行高，改为自动流式布局 */
@media (max-width: 1279px) {
  .player-grid {
    grid-template-rows: none;
    grid-auto-rows: minmax(240px, auto);
    overflow-y: auto;
  }
}
</style>
