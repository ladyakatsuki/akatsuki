<script setup lang="ts">
// 回合控制组件：DM 开始/结束战斗、推进回合、显示当前行动者
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import BaseButton from '@/components/common/BaseButton.vue'
import { useCombatStore } from '@/stores/combat'
import { useCharacterStore } from '@/stores/character'
import { useLogStore } from '@/stores/log'

const combatStore = useCombatStore()
const characterStore = useCharacterStore()
const logStore = useLogStore()

const { isActive, currentParticipant, round, participants, isLoading } = storeToRefs(combatStore)
const { roomCharacters } = storeToRefs(characterStore)

/** 发起战斗对话框 */
const showStartModal = ref(false)
/** 选中的初始参与者角色 ID */
const selectedIds = ref<string[]>([])
/** 是否自动掷先攻 */
const rollInitiative = ref(true)

/** 可选角色（房间内所有角色） */
const availableCharacters = computed(() => roomCharacters.value)

/** 已选数量 */
const selectedCount = computed(() => selectedIds.value.length)

/** 切换选中 */
function toggleSelect(id: string) {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) {
    selectedIds.value.splice(idx, 1)
  } else {
    selectedIds.value.push(id)
  }
}

/** 全选 */
function selectAll() {
  selectedIds.value = availableCharacters.value.map((c) => c.id)
}

/** 清空选择 */
function clearAll() {
  selectedIds.value = []
}

/** 确认发起战斗 */
function confirmStart() {
  if (selectedIds.value.length === 0) {
    logStore.addLog('system', '请至少选择一名参与者')
    return
  }
  combatStore.startCombat(selectedIds.value, rollInitiative.value)
  showStartModal.value = false
  selectedIds.value = []
}

/** 结束战斗 */
function onEndCombat() {
  if (window.confirm('确定结束当前战斗吗？所有战斗数据将被清空。')) {
    combatStore.endCombat()
  }
}

/** 下一回合 */
function onNextTurn() {
  combatStore.nextTurn()
}

/** 上一回合 */
function onPrevTurn() {
  combatStore.prevTurn()
}

/** 重新掷当前参与者先攻 */
function onRerollCurrent() {
  if (currentParticipant.value) {
    combatStore.rollInitiative(currentParticipant.value.id)
  }
}
</script>

<template>
  <div class="space-y-3">
    <!-- 战斗未开始：发起按钮 -->
    <div v-if="!isActive" class="space-y-2">
      <BaseButton variant="primary" block :loading="isLoading" @click="showStartModal = true">
        ⚔ 发起战斗
      </BaseButton>
      <p class="text-center text-[10px] text-text-muted">选择房间内角色加入战斗追踪</p>
    </div>

    <!-- 战斗进行中：回合控制 -->
    <div v-else class="space-y-3">
      <!-- 当前回合信息 -->
      <div class="rounded-md border border-primary/40 bg-primary/10 p-3 text-center">
        <p class="text-[10px] font-semibold uppercase tracking-widest text-text-muted">当前行动</p>
        <p class="mt-1 font-display text-lg font-bold text-gradient-gold">
          {{ currentParticipant?.name ?? '—' }}
        </p>
        <p class="mt-0.5 text-xs text-text-muted">第 {{ round }} 轮</p>
      </div>

      <!-- 回合控制按钮 -->
      <div class="grid grid-cols-2 gap-2">
        <BaseButton size="sm" variant="metal" @click="onPrevTurn">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          上一回合
        </BaseButton>
        <BaseButton size="sm" variant="primary" @click="onNextTurn">
          下一回合
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </BaseButton>
      </div>

      <!-- 辅助操作 -->
      <div class="grid grid-cols-2 gap-2">
        <BaseButton
          size="sm"
          variant="ghost"
          :disabled="!currentParticipant"
          @click="onRerollCurrent"
        >
          重新掷先攻
        </BaseButton>
        <BaseButton size="sm" variant="danger" @click="onEndCombat"> 结束战斗 </BaseButton>
      </div>

      <!-- 参与者计数 -->
      <div class="flex items-center justify-between text-xs text-text-muted">
        <span>参与者：{{ participants.length }}</span>
        <span>轮次：{{ round }}</span>
      </div>
    </div>

    <!-- 发起战斗对话框 -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showStartModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            class="absolute inset-0 bg-black/70 backdrop-blur-sm"
            @click="showStartModal = false"
          />
          <div class="frame-card relative z-10 w-full max-w-lg p-6 animate-fade-in">
            <header class="mb-4 flex items-center justify-between">
              <h3 class="font-display text-xl font-semibold text-gradient-gold">发起战斗</h3>
              <button
                class="text-text-muted transition-colors hover:text-danger"
                @click="showStartModal = false"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </header>

            <!-- 选项 -->
            <div class="mb-4">
              <label class="flex cursor-pointer items-center gap-2 text-sm text-text">
                <input v-model="rollInitiative" type="checkbox" class="accent-primary" />
                <span>自动为所有参与者掷先攻</span>
              </label>
              <p class="mt-1 text-[10px] text-text-muted">若不勾选，将使用角色卡中的先攻值</p>
            </div>

            <!-- 角色选择 -->
            <div class="mb-3 flex items-center justify-between">
              <p class="text-xs font-semibold uppercase tracking-widest text-text-muted">
                选择参与者（{{ selectedCount }}）
              </p>
              <div class="flex gap-2">
                <button class="text-[10px] text-primary hover:underline" @click="selectAll">
                  全选
                </button>
                <button class="text-[10px] text-text-muted hover:underline" @click="clearAll">
                  清空
                </button>
              </div>
            </div>

            <div class="max-h-64 space-y-1 overflow-auto">
              <label
                v-for="c in availableCharacters"
                :key="c.id"
                class="flex cursor-pointer items-center gap-2 rounded border border-border/40 bg-background/40 px-2 py-1.5 text-xs transition-colors hover:border-primary/40"
                :class="selectedIds.includes(c.id) ? 'border-primary/60 bg-primary/10' : ''"
              >
                <input
                  type="checkbox"
                  class="accent-primary"
                  :checked="selectedIds.includes(c.id)"
                  @change="toggleSelect(c.id)"
                />
                <span
                  class="rounded px-1 py-0.5 text-[9px] font-bold uppercase"
                  :class="c.isNpc ? 'bg-accent/20 text-accent' : 'bg-primary/20 text-primary'"
                >
                  {{ c.isNpc ? 'NPC' : '玩家' }}
                </span>
                <span class="flex-1 truncate text-text">{{ c.name }}</span>
              </label>
              <p
                v-if="availableCharacters.length === 0"
                class="py-4 text-center text-xs text-text-muted"
              >
                房间内暂无角色
              </p>
            </div>

            <footer class="mt-5 flex justify-end gap-3">
              <BaseButton variant="ghost" @click="showStartModal = false">取消</BaseButton>
              <BaseButton variant="primary" :disabled="selectedCount === 0" @click="confirmStart">
                开始战斗
              </BaseButton>
            </footer>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
