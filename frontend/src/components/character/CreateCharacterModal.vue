<script setup lang="ts">
// 创建角色对话框
import { ref } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import BaseInput from '@/components/common/BaseInput.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    /** 是否 NPC 模式（DM 创建 NPC） */
    isNpc?: boolean
    /** 加载中 */
    loading?: boolean
  }>(),
  {
    isNpc: false,
    loading: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [name: string, isNpc: boolean]
}>()

const name = ref('')
const npcFlag = ref(props.isNpc)
const error = ref('')

/** 提交创建 */
function onSubmit() {
  const trimmed = name.value.trim()
  if (!trimmed) {
    error.value = '角色名称不能为空'
    return
  }
  if (trimmed.length > 30) {
    error.value = '角色名称不能超过 30 个字符'
    return
  }
  error.value = ''
  emit('submit', trimmed, npcFlag.value)
}

/** 关闭对话框 */
function onClose() {
  name.value = ''
  error.value = ''
  emit('update:modelValue', false)
}
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    title="创建角色"
    width="max-w-md"
    @update:model-value="onClose"
  >
    <div class="space-y-4">
      <BaseInput
        v-model="name"
        label="角色名称"
        placeholder="输入你的角色名称"
        :error="error"
        :maxlength="30"
        @enter="onSubmit"
      />

      <!-- NPC 选项（仅 DM 可见时显示） -->
      <label
        v-if="isNpc"
        class="flex cursor-pointer items-center gap-2 rounded border border-border/50 bg-background/40 px-3 py-2"
      >
        <input v-model="npcFlag" type="checkbox" class="h-4 w-4 accent-primary" />
        <span class="text-sm text-text">创建为 NPC（非玩家角色）</span>
      </label>

      <p class="text-xs text-text-muted">
        角色卡将根据房间规则系统自动生成默认数据，创建后可在角色卡界面编辑详细属性。
      </p>
    </div>

    <template #footer>
      <BaseButton variant="ghost" @click="onClose">取消</BaseButton>
      <BaseButton variant="primary" :loading="loading" @click="onSubmit"> 创建 </BaseButton>
    </template>
  </BaseModal>
</template>
