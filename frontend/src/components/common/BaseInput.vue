<script setup lang="ts">
// 通用输入框组件
import { computed } from 'vue'

withDefaults(
  defineProps<{
    modelValue?: string
    label?: string
    placeholder?: string
    type?: string
    disabled?: boolean
    error?: string
    hint?: string
    maxlength?: number
  }>(),
  {
    modelValue: '',
    type: 'text',
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  blur: [e: FocusEvent]
  enter: []
}>()

const inputId = computed(() => `input-${Math.random().toString(36).slice(2, 8)}`)

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="w-full">
    <label
      v-if="label"
      :for="inputId"
      class="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-text-muted"
    >
      {{ label }}
    </label>
    <input
      :id="inputId"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :maxlength="maxlength"
      class="input-field"
      :class="error ? 'border-danger' : ''"
      @input="onInput"
      @blur="emit('blur', $event)"
      @keyup.enter="emit('enter')"
    />
    <p v-if="error" class="mt-1 text-xs text-danger">{{ error }}</p>
    <p v-else-if="hint" class="mt-1 text-xs text-text-muted">{{ hint }}</p>
  </div>
</template>
