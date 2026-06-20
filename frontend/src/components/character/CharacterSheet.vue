<script setup lang="ts">
// 角色卡动态渲染器
// 根据角色 ruleSystem 渲染对应模板，管理编辑模式、立绘显示与数据同步
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import type { Character } from '@/types/models'
import Dnd5eSheet from './Dnd5eSheet.vue'
import Coc7Sheet from './Coc7Sheet.vue'
import PortraitUploader from './PortraitUploader.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import { useCharacterStore } from '@/stores/character'
import { useRoomStore } from '@/stores/room'

const props = withDefaults(
  defineProps<{
    /** 要显示的角色 */
    character: Character
    /** 是否默认编辑模式 */
    defaultEditable?: boolean
    /** 是否显示编辑切换按钮 */
    showEditToggle?: boolean
    /** 是否显示立绘区 */
    showPortrait?: boolean
    /** 是否允许删除 */
    allowDelete?: boolean
  }>(),
  {
    defaultEditable: false,
    showEditToggle: true,
    showPortrait: true,
    allowDelete: false,
  },
)

const emit = defineEmits<{
  delete: [character: Character]
}>()

const characterStore = useCharacterStore()
const roomStore = useRoomStore()
const { playerId } = storeToRefs(roomStore)

/** 编辑模式 */
const editable = ref(props.defaultEditable)

/** 是否 DND */
const isDnd = computed(() => props.character.ruleSet === 'dnd5e')

/** 是否 COC */
const isCoc = computed(() => props.character.ruleSet === 'coc7')

/** 立绘 URL */
const portraitUrl = computed(() => props.character.portraitUrl)

/** 是否 NPC */
const isNpc = computed(() => props.character.isNpc)

/** 是否可编辑（权限：自己的角色或 DM） */
const canEdit = computed(() => {
  if (!playerId.value) return false
  return props.character.playerId === playerId.value || roomStore.isDM
})

/** 切换编辑模式 */
function toggleEdit() {
  editable.value = !editable.value
  // 退出编辑时刷新待同步数据
  if (!editable.value) {
    characterStore.flushCharacterData(props.character.id)
  }
}

/** 处理字段更新（通过 store 防抖同步） */
function handleUpdate(key: string, value: unknown) {
  characterStore.updateCharacterData(props.character.id, { [key]: value })
}

/** 处理立绘上传 */
async function handlePortraitUpload(file: File) {
  if (!playerId.value) return
  await characterStore.uploadPortrait(props.character.id, playerId.value, file)
}

/** 处理删除 */
function handleDelete() {
  if (window.confirm(`确定删除角色「${props.character.name}」吗？`)) {
    emit('delete', props.character)
  }
}
</script>

<template>
  <div class="character-sheet flex flex-col">
    <!-- 顶部：立绘 + 角色名 + 操作 -->
    <div class="sheet-header mb-4 flex flex-wrap items-start gap-4">
      <!-- 立绘 -->
      <PortraitUploader
        v-if="showPortrait"
        :portrait-url="portraitUrl"
        :disabled="!canEdit"
        :size="100"
        @upload="handlePortraitUpload"
      />

      <!-- 角色名与标签 -->
      <div class="flex-1">
        <div class="flex items-center gap-2">
          <h3 class="font-display text-xl font-bold text-gradient-gold">
            {{ character.name || '未命名角色' }}
          </h3>
          <span
            v-if="isNpc"
            class="rounded bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-accent"
          >
            NPC
          </span>
          <span
            class="rounded px-2 py-0.5 text-[10px] font-semibold uppercase"
            :class="isCoc ? 'bg-success/20 text-success' : 'bg-primary/20 text-primary'"
          >
            {{ isCoc ? 'COC 7版' : 'DND 5E' }}
          </span>
        </div>
        <p class="mt-1 text-xs text-text-muted">
          最后更新：{{ new Date(character.updatedAt).toLocaleString('zh-CN') }}
        </p>
      </div>

      <!-- 操作按钮 -->
      <div v-if="showEditToggle && canEdit" class="flex gap-2">
        <BaseButton size="sm" :variant="editable ? 'primary' : 'ghost'" @click="toggleEdit">
          {{ editable ? '完成' : '编辑' }}
        </BaseButton>
        <BaseButton v-if="allowDelete" size="sm" variant="danger" @click="handleDelete">
          删除
        </BaseButton>
      </div>
    </div>

    <!-- 角色卡主体（根据规则系统渲染） -->
    <div class="sheet-body flex-1 overflow-auto pr-1">
      <Dnd5eSheet
        v-if="isDnd"
        :data="character.data"
        :editable="editable && canEdit"
        @update="handleUpdate"
      />
      <Coc7Sheet
        v-else-if="isCoc"
        :data="character.data"
        :editable="editable && canEdit"
        @update="handleUpdate"
      />
      <div v-else class="py-8 text-center text-text-muted">
        未知规则系统：{{ character.ruleSet }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.character-sheet {
  @apply h-full;
}

.sheet-header {
  @apply border-b border-border/50 pb-3;
}

.sheet-body {
  @apply pt-2;
}
</style>
