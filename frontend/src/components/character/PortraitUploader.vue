<script setup lang="ts">
// 立绘上传组件：支持点击上传与拖拽上传，带预览与进度
import { computed, ref } from 'vue'
import BaseButton from '@/components/common/BaseButton.vue'

const props = withDefaults(
  defineProps<{
    /** 当前立绘 URL */
    portraitUrl?: string | null
    /** 是否禁用 */
    disabled?: boolean
    /** 头像尺寸（px） */
    size?: number
  }>(),
  {
    portraitUrl: null,
    disabled: false,
    size: 120,
  },
)

const emit = defineEmits<{
  upload: [file: File]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const isUploading = ref(false)
const progress = ref(0)
const errorMsg = ref('')

/** 完整的立绘 URL（拼接后端地址） */
const fullUrl = computed(() => {
  if (!props.portraitUrl) return ''
  if (props.portraitUrl.startsWith('http')) return props.portraitUrl
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  return `${apiBase}${props.portraitUrl}`
})

const containerStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
}))

/** 触发文件选择 */
function triggerSelect() {
  if (props.disabled || isUploading.value) return
  fileInput.value?.click()
}

/** 处理文件选择 */
function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) handleFile(file)
  // 重置 input 以便重复选择同一文件
  input.value = ''
}

/** 处理拖拽进入 */
function handleDragOver(e: DragEvent) {
  e.preventDefault()
  if (props.disabled || isUploading.value) return
  isDragging.value = true
}

/** 处理拖拽离开 */
function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
}

/** 处理拖拽放下 */
function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  if (props.disabled || isUploading.value) return
  const file = e.dataTransfer?.files?.[0]
  if (file) handleFile(file)
}

/** 校验并上传文件 */
function handleFile(file: File) {
  errorMsg.value = ''
  // 校验类型
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    errorMsg.value = '仅支持 JPG/PNG/WEBP/GIF 格式'
    return
  }
  // 校验大小（5MB）
  const maxSize = 5 * 1024 * 1024
  if (file.size > maxSize) {
    errorMsg.value = '文件大小不能超过 5MB'
    return
  }

  // 模拟上传进度（实际上传由父组件通过 API 处理）
  isUploading.value = true
  progress.value = 0
  const timer = setInterval(() => {
    progress.value = Math.min(90, progress.value + 10)
  }, 50)

  // 通知父组件上传
  emit('upload', file)

  // 父组件负责调用 API，这里在 500ms 后结束进度模拟
  // 父组件可通过更新 portraitUrl 来反映上传完成
  setTimeout(() => {
    clearInterval(timer)
    progress.value = 100
    setTimeout(() => {
      isUploading.value = false
      progress.value = 0
    }, 300)
  }, 500)
}
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <!-- 上传区域 -->
    <div
      class="portrait-zone relative cursor-pointer overflow-hidden rounded-lg border-2 border-dashed transition-all duration-200"
      :class="[
        isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/60',
        disabled || isUploading ? 'cursor-not-allowed opacity-60' : '',
      ]"
      :style="containerStyle"
      @click="triggerSelect"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <!-- 立绘预览 -->
      <img
        v-if="fullUrl && !isUploading"
        :src="fullUrl"
        alt="立绘"
        class="h-full w-full object-cover"
      />
      <!-- 占位图标 -->
      <div
        v-else-if="!isUploading"
        class="flex h-full w-full flex-col items-center justify-center gap-1 text-text-muted"
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span class="text-[10px]">点击或拖拽</span>
      </div>
      <!-- 上传进度 -->
      <div
        v-if="isUploading"
        class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface/80 backdrop-blur-sm"
      >
        <div class="h-1 w-3/4 overflow-hidden rounded-full bg-background">
          <div
            class="h-full bg-primary transition-all duration-100"
            :style="{ width: `${progress}%` }"
          />
        </div>
        <span class="text-[10px] text-text-muted">{{ progress }}%</span>
      </div>
      <!-- 边框装饰 -->
      <div
        class="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-inset ring-primary/20"
      />
    </div>

    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      class="hidden"
      @change="handleFileChange"
    />

    <!-- 操作按钮 -->
    <BaseButton
      size="sm"
      variant="ghost"
      :disabled="disabled || isUploading"
      @click="triggerSelect"
    >
      {{ portraitUrl ? '更换立绘' : '上传立绘' }}
    </BaseButton>

    <!-- 错误提示 -->
    <p v-if="errorMsg" class="text-[10px] text-danger">{{ errorMsg }}</p>
  </div>
</template>
