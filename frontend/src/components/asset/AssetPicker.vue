<script setup lang="ts">
// 通用素材选择对话框：用于角色立绘、地图背景、Token 图标选择
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
    /** 限制的素材类型（可选），不传则显示全部 */
    type?: AssetType
    /** 标题 */
    title?: string
  }>(),
  {
    title: '选择素材',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  select: [asset: Asset]
}>()

const assetStore = useAssetStore()
const roomStore = useRoomStore()
const { code } = storeToRefs(roomStore)
const { assets, isLoading } = storeToRefs(assetStore)

/** 当前选中的类型筛选 */
const activeType = ref<AssetType | 'all'>('all')

/** 类型筛选选项 */
const typeOptions: { key: AssetType | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'portrait', label: '立绘' },
  { key: 'map', label: '地图' },
  { key: 'token', label: 'Token' },
  { key: 'other', label: '其他' },
]

/** 过滤后的素材列表 */
const filteredAssets = computed(() => {
  let list = assets.value
  // 如果指定了类型，只显示该类型
  if (props.type) {
    list = list.filter((a) => a.type === props.type)
  } else if (activeType.value !== 'all') {
    list = list.filter((a) => a.type === activeType.value)
  }
  return list
})

/** 是否显示类型筛选标签 */
const showTypeTabs = computed(() => !props.type)

/** 弹窗打开时加载素材 */
watch(
  () => props.modelValue,
  (open) => {
    if (open && code.value) {
      assetStore.fetchAssets(code.value)
      // 如果指定了类型，设置默认筛选
      if (props.type) {
        activeType.value = props.type
      } else {
        activeType.value = 'all'
      }
    }
  },
)

/** 拼接完整 URL */
function fullUrl(url: string): string {
  if (url.startsWith('http')) return url
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  return `${apiBase}${url}`
}

/** 选择素材 */
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
    :title="title"
    width="max-w-3xl"
    @update:model-value="handleClose"
  >
    <div class="space-y-4">
      <!-- 类型筛选标签 -->
      <div v-if="showTypeTabs" class="flex flex-wrap gap-2">
        <button
          v-for="opt in typeOptions"
          :key="opt.key"
          class="rounded-md border px-3 py-1 text-xs font-semibold transition-all duration-200"
          :class="
            activeType === opt.key
              ? 'border-primary bg-primary/20 text-primary'
              : 'border-border text-text-muted hover:border-primary/50 hover:text-text'
          "
          @click="activeType = opt.key"
        >
          {{ opt.label }}
        </button>
      </div>

      <!-- 加载中 -->
      <div v-if="isLoading" class="flex items-center justify-center py-8">
        <span
          class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"
        />
      </div>

      <!-- 素材网格 -->
      <div
        v-else-if="filteredAssets.length > 0"
        class="grid max-h-[400px] grid-cols-3 gap-3 overflow-auto sm:grid-cols-4 md:grid-cols-5"
      >
        <button
          v-for="asset in filteredAssets"
          :key="asset.id"
          class="group relative aspect-square overflow-hidden rounded-lg border border-border bg-background/40 transition-all duration-200 hover:border-primary hover:shadow-glow"
          @click="handleSelect(asset)"
        >
          <img
            :src="fullUrl(asset.url)"
            :alt="asset.originalName"
            class="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            loading="lazy"
          />
          <!-- 悬停遮罩 -->
          <div
            class="absolute inset-0 flex items-end bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          >
            <p class="w-full truncate text-[10px] text-text">{{ asset.originalName }}</p>
          </div>
          <!-- 选中指示器 -->
          <div
            class="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary/80 text-[10px] text-background opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          >
            ✓
          </div>
        </button>
      </div>

      <!-- 空状态 -->
      <div v-else class="flex flex-col items-center justify-center py-12 text-center">
        <div class="mb-2 text-4xl opacity-20">◆</div>
        <p class="font-display text-sm text-text-muted">暂无可用素材</p>
        <p class="mt-1 text-xs text-text-muted/70">请先在素材管理中上传图片</p>
      </div>
    </div>

    <template #footer>
      <BaseButton variant="ghost" @click="handleClose">取消</BaseButton>
    </template>
  </BaseModal>
</template>
