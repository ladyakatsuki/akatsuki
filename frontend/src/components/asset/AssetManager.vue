<script setup lang="ts">
// DM 素材管理面板：分类标签、上传区域、素材网格预览
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import BaseModal from '@/components/common/BaseModal.vue'
import BaseButton from '@/components/common/BaseButton.vue'
import { useAssetStore } from '@/stores/asset'
import { useRoomStore } from '@/stores/room'
import type { Asset, AssetType } from '@/types/models'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
  }>(),
  {
    modelValue: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  select: [asset: Asset]
}>()

const assetStore = useAssetStore()
const roomStore = useRoomStore()
const { code, playerId } = storeToRefs(roomStore)
const { assets, isLoading, isUploading, uploadProgress, error } = storeToRefs(assetStore)

/** 当前选中的分类标签 */
const activeTab = ref<AssetType | 'all'>('all')

/** 拖拽状态 */
const isDragging = ref(false)

/** 隐藏的文件输入 */
const fileInput = ref<HTMLInputElement | null>(null)

/** 复制成功的素材 ID */
const copiedId = ref<string | null>(null)

/** 分类标签配置 */
const tabs: { key: AssetType | 'all'; label: string; icon: string }[] = [
  { key: 'all', label: '全部', icon: '◆' },
  { key: 'portrait', label: '立绘', icon: '👤' },
  { key: 'map', label: '地图', icon: '🗺' },
  { key: 'token', label: 'Token', icon: '⚔' },
  { key: 'other', label: '其他', icon: '📦' },
]

/** 当前分类下的素材 */
const filteredAssets = computed(() => {
  if (activeTab.value === 'all') return assets.value
  return assets.value.filter((a) => a.type === activeTab.value)
})

/** 各分类数量 */
const tabCounts = computed(() => {
  const counts: Record<string, number> = { all: assets.value.length }
  for (const a of assets.value) {
    counts[a.type] = (counts[a.type] ?? 0) + 1
  }
  return counts
})

/** 弹窗打开时加载素材 */
watch(
  () => props.modelValue,
  (open) => {
    if (open && code.value) {
      assetStore.fetchAssets(code.value)
    }
  },
)

/** 拼接完整 URL */
function fullUrl(url: string): string {
  if (url.startsWith('http')) return url
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  return `${apiBase}${url}`
}

/** 格式化文件大小 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** 类型标签 */
const typeLabels: Record<AssetType, string> = {
  portrait: '立绘',
  map: '地图',
  token: 'Token',
  other: '其他',
}

/** 触发文件选择 */
function triggerSelect() {
  if (isUploading.value) return
  fileInput.value?.click()
}

/** 处理文件选择 */
function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) handleUpload(file)
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
  if (file) handleUpload(file)
}

/** 上传文件 */
async function handleUpload(file: File) {
  if (!code.value || !playerId.value) return
  // 校验类型
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) {
    assetStore.error = '仅支持 JPG/PNG/WEBP/GIF 格式'
    return
  }
  // 校验大小
  if (file.size > 5 * 1024 * 1024) {
    assetStore.error = '文件大小不能超过 5MB'
    return
  }
  // 确定上传类型：根据当前标签，默认 other
  const uploadType: AssetType = activeTab.value === 'all' ? 'other' : activeTab.value
  await assetStore.uploadAsset(code.value, playerId.value, file, uploadType)
}

/** 删除素材 */
async function handleDelete(asset: Asset) {
  if (!code.value || !playerId.value) return
  if (!window.confirm(`确定删除素材「${asset.originalName}」吗？`)) return
  await assetStore.deleteAsset(code.value, playerId.value, asset.id)
}

/** 复制 URL */
async function copyUrl(asset: Asset) {
  const url = fullUrl(asset.url)
  try {
    await navigator.clipboard.writeText(url)
    copiedId.value = asset.id
    setTimeout(() => {
      copiedId.value = null
    }, 1500)
  } catch {
    // 降级方案
    const textarea = document.createElement('textarea')
    textarea.value = url
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    copiedId.value = asset.id
    setTimeout(() => {
      copiedId.value = null
    }, 1500)
  }
}

/** 选择素材（用于 AssetPicker 模式） */
function handleSelect(asset: Asset) {
  emit('select', asset)
  emit('update:modelValue', false)
}

/** 关闭弹窗 */
function handleClose() {
  emit('update:modelValue', false)
}
</script>

<template>
  <BaseModal
    :model-value="modelValue"
    title="素材管理"
    width="max-w-4xl"
    @update:model-value="handleClose"
  >
    <div class="space-y-4">
      <!-- 错误提示 -->
      <div
        v-if="error"
        class="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
      >
        <span class="mt-0.5">⚠</span>
        <span>{{ error }}</span>
      </div>

      <!-- 分类标签 -->
      <div class="flex flex-wrap gap-2">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="rounded-md border px-3 py-1.5 text-xs font-semibold transition-all duration-200"
          :class="
            activeTab === tab.key
              ? 'border-primary bg-primary/20 text-primary'
              : 'border-border text-text-muted hover:border-primary/50 hover:text-text'
          "
          @click="activeTab = tab.key"
        >
          <span class="mr-1">{{ tab.icon }}</span>
          {{ tab.label }}
          <span class="ml-1 text-[10px] opacity-60">({{ tabCounts[tab.key] ?? 0 }})</span>
        </button>
      </div>

      <!-- 上传区域 -->
      <div
        class="upload-zone flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-all duration-200"
        :class="
          isDragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/60'
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
            <span>{{ uploadProgress }}%</span>
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-background">
            <div
              class="h-full bg-primary transition-all duration-100"
              :style="{ width: `${uploadProgress}%` }"
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
          <p class="text-sm text-text-muted">点击或拖拽图片到此处上传</p>
          <p class="text-[10px] text-text-muted/70">支持 JPG/PNG/WEBP/GIF，最大 5MB</p>
        </template>
      </div>

      <!-- 隐藏的文件输入 -->
      <input
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        class="hidden"
        @change="handleFileChange"
      />

      <!-- 素材网格 -->
      <div
        v-if="filteredAssets.length > 0"
        class="grid max-h-[400px] grid-cols-2 gap-3 overflow-auto sm:grid-cols-3 md:grid-cols-4"
      >
        <div
          v-for="asset in filteredAssets"
          :key="asset.id"
          class="asset-card group relative overflow-hidden rounded-lg border border-border bg-background/40 transition-all duration-200 hover:border-primary/60"
        >
          <!-- 缩略图 -->
          <div class="aspect-square cursor-pointer overflow-hidden" @click="handleSelect(asset)">
            <img
              :src="fullUrl(asset.url)"
              :alt="asset.originalName"
              class="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
              loading="lazy"
            />
          </div>

          <!-- 信息栏 -->
          <div class="p-2">
            <p class="truncate text-xs text-text" :title="asset.originalName">
              {{ asset.originalName }}
            </p>
            <div class="mt-0.5 flex items-center justify-between">
              <span class="text-[10px] text-text-muted">{{ formatSize(asset.size) }}</span>
              <span class="rounded bg-surface px-1.5 py-0.5 text-[9px] text-text-muted">
                {{ typeLabels[asset.type] }}
              </span>
            </div>
          </div>

          <!-- 操作按钮（悬停显示） -->
          <div
            class="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          >
            <!-- 复制 URL -->
            <button
              class="flex h-6 w-6 items-center justify-center rounded bg-surface/90 text-text-muted transition-colors hover:text-primary"
              :title="copiedId === asset.id ? '已复制!' : '复制 URL'"
              @click.stop="copyUrl(asset)"
            >
              <span v-if="copiedId === asset.id" class="text-[10px] text-success">✓</span>
              <svg
                v-else
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
            <!-- 删除 -->
            <button
              class="flex h-6 w-6 items-center justify-center rounded bg-surface/90 text-text-muted transition-colors hover:text-danger"
              title="删除"
              @click.stop="handleDelete(asset)"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polyline points="3 6 5 6 21 6" />
                <path
                  d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div
        v-else-if="!isLoading"
        class="flex flex-col items-center justify-center py-12 text-center"
      >
        <div class="mb-2 text-4xl opacity-20">◆</div>
        <p class="font-display text-sm text-text-muted">暂无素材</p>
        <p class="mt-1 text-xs text-text-muted/70">上传图片以开始管理你的素材库</p>
      </div>

      <!-- 加载中 -->
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <span
          class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"
        />
      </div>
    </div>

    <template #footer>
      <BaseButton variant="ghost" @click="handleClose">关闭</BaseButton>
    </template>
  </BaseModal>
</template>
