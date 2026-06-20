<script setup lang="ts">
// 故事书上传组件：格式选择、文件拖拽 / 点击上传、进度与预览
import { computed, ref } from 'vue'
import BaseButton from '@/components/common/BaseButton.vue'
import { useStoryStore } from '@/stores/story'
import { useRoomStore } from '@/stores/room'
import type { StoryFormat } from '@/types/models'

withDefaults(
  defineProps<{
    /** 是否在弹窗内显示（影响布局） */
    inline?: boolean
  }>(),
  {
    inline: false,
  },
)

const emit = defineEmits<{
  /** 上传成功 */
  success: []
  /** 取消 / 关闭 */
  cancel: []
}>()

const storyStore = useStoryStore()
const roomStore = useRoomStore()
const { code, playerId } = roomStore

/** 选中的格式 */
const format = ref<StoryFormat>('md')
/** 选中的文件 */
const selectedFile = ref<File | null>(null)
/** 拖拽状态 */
const isDragging = ref(false)
/** 隐藏的文件输入 */
const fileInput = ref<HTMLInputElement | null>(null)
/** 本地错误提示 */
const localError = ref('')
/** 预览文本（前 500 字） */
const previewText = ref('')

/** 是否正在上传 */
const isUploading = computed(() => storyStore.isUploading)
/** 上传进度 */
const progress = computed(() => storyStore.uploadProgress)

/** 格式说明 */
const formatOptions: { value: StoryFormat; label: string; hint: string; accept: string }[] = [
  {
    value: 'md',
    label: 'Markdown',
    hint: '纯文本章节，支持标题 / 段落 / 图片 / 列表',
    accept: '.md,.markdown,.txt',
  },
  {
    value: 'json',
    label: 'JSON 结构化',
    hint: '场景 / NPC / 遇敌 / 选择分支，支持交互',
    accept: '.json',
  },
]

/** 当前格式对应的 accept */
const currentAccept = computed(() => {
  return formatOptions.find((o) => o.value === format.value)?.accept ?? '.md,.json'
})

/** 触发文件选择 */
function triggerSelect() {
  if (isUploading.value) return
  fileInput.value?.click()
}

/** 处理文件选择 */
function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) handleFile(file)
  input.value = ''
}

/** 处理拖拽 */
function handleDragOver(e: DragEvent) {
  e.preventDefault()
  if (isUploading.value) return
  isDragging.value = true
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  if (isUploading.value) return
  const file = e.dataTransfer?.files?.[0]
  if (file) handleFile(file)
}

/** 校验并预览文件 */
async function handleFile(file: File) {
  localError.value = ''
  // 校验大小（5MB）
  if (file.size > 5 * 1024 * 1024) {
    localError.value = '文件大小不能超过 5MB'
    return
  }
  // 校验扩展名
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (format.value === 'md' && !['md', 'markdown', 'txt'].includes(ext)) {
    localError.value = 'Markdown 格式请上传 .md / .markdown / .txt 文件'
    return
  }
  if (format.value === 'json' && ext !== 'json') {
    localError.value = 'JSON 格式请上传 .json 文件'
    return
  }

  selectedFile.value = file

  // 读取预览
  try {
    const text = await file.text()
    if (format.value === 'json') {
      // JSON 校验
      const parsed = JSON.parse(text)
      previewText.value = JSON.stringify(parsed, null, 2).slice(0, 500)
    } else {
      previewText.value = text.slice(0, 500)
    }
  } catch (e) {
    localError.value =
      format.value === 'json'
        ? 'JSON 解析失败，请检查格式'
        : `文件读取失败：${(e as Error).message}`
    previewText.value = ''
  }
}

/** 确认上传 */
async function handleUpload() {
  if (!selectedFile.value || !code || !playerId) return
  const result = await storyStore.uploadStory(code, playerId, selectedFile.value, format.value)
  if (result) {
    emit('success')
    // 重置
    selectedFile.value = null
    previewText.value = ''
    localError.value = ''
  } else {
    localError.value = storyStore.error ?? '上传失败'
  }
}

/** 取消选择 */
function handleClear() {
  selectedFile.value = null
  previewText.value = ''
  localError.value = ''
}

/** 切换格式时清空已选文件 */
function handleFormatChange(fmt: StoryFormat) {
  if (format.value === fmt) return
  format.value = fmt
  handleClear()
}
</script>

<template>
  <div class="space-y-4" :class="inline ? '' : 'p-1'">
    <!-- 格式选择 -->
    <div>
      <p class="mb-2 text-xs font-semibold uppercase tracking-widest text-text-muted">故事书格式</p>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="opt in formatOptions"
          :key="opt.value"
          type="button"
          class="rounded-md border p-2.5 text-left transition-all duration-200"
          :class="
            format === opt.value
              ? 'border-primary bg-primary/15 shadow-glow'
              : 'border-border bg-background/40 hover:border-primary/50'
          "
          :disabled="isUploading"
          @click="handleFormatChange(opt.value)"
        >
          <p
            class="font-display text-sm font-bold"
            :class="format === opt.value ? 'text-primary' : 'text-text'"
          >
            {{ opt.label }}
          </p>
          <p class="mt-0.5 text-[10px] leading-tight text-text-muted">{{ opt.hint }}</p>
        </button>
      </div>
    </div>

    <!-- 上传区域 -->
    <div
      class="upload-zone flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-all duration-200"
      :class="
        isDragging
          ? 'border-primary bg-primary/10'
          : 'border-border hover:border-primary/60 hover:bg-surface/40'
      "
      @click="triggerSelect"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
    >
      <!-- 上传进度 -->
      <div v-if="isUploading" class="w-full max-w-xs">
        <div class="mb-1 flex items-center justify-between text-xs text-text-muted">
          <span>上传中…</span>
          <span class="font-mono text-primary">{{ progress }}%</span>
        </div>
        <div class="h-1.5 overflow-hidden rounded-full bg-background">
          <div
            class="h-full bg-primary transition-all duration-100"
            :style="{ width: `${progress}%` }"
          />
        </div>
      </div>
      <!-- 默认提示 -->
      <template v-else>
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          class="text-text-muted"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p class="text-sm text-text-muted">点击或拖拽文件到此处</p>
        <p class="text-[10px] text-text-muted/70">支持 {{ currentAccept }}，最大 5MB</p>
      </template>
    </div>

    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInput"
      type="file"
      :accept="currentAccept"
      class="hidden"
      @change="handleFileChange"
    />

    <!-- 已选文件预览 -->
    <div
      v-if="selectedFile"
      class="rounded-md border border-border/60 bg-background/40 p-3 animate-fade-in"
    >
      <div class="mb-2 flex items-center justify-between">
        <div class="flex min-w-0 items-center gap-2">
          <span class="text-base">📄</span>
          <div class="min-w-0">
            <p class="truncate text-sm text-text">{{ selectedFile.name }}</p>
            <p class="text-[10px] text-text-muted">
              {{ (selectedFile.size / 1024).toFixed(1) }} KB · {{ format.toUpperCase() }}
            </p>
          </div>
        </div>
        <button
          class="text-text-muted transition-colors hover:text-danger"
          :disabled="isUploading"
          title="移除"
          @click="handleClear"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <!-- 预览内容 -->
      <div
        v-if="previewText"
        class="max-h-32 overflow-auto rounded bg-background/60 p-2 font-mono text-[11px] leading-relaxed text-text-muted"
      >
        <pre class="whitespace-pre-wrap break-all">{{ previewText }}<span
          v-if="previewText.length >= 500"
          class="text-primary"
        >…</span></pre>
      </div>
    </div>

    <!-- 错误提示 -->
    <div
      v-if="localError || storyStore.error"
      class="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
    >
      <span class="mt-0.5">⚠</span>
      <span>{{ localError || storyStore.error }}</span>
    </div>

    <!-- 操作按钮 -->
    <div class="flex justify-end gap-2">
      <BaseButton variant="ghost" :disabled="isUploading" @click="emit('cancel')">
        取消
      </BaseButton>
      <BaseButton
        variant="primary"
        :disabled="!selectedFile || isUploading"
        :loading="isUploading"
        @click="handleUpload"
      >
        上传故事书
      </BaseButton>
    </div>
  </div>
</template>
