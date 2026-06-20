// 素材状态管理（对接后端 REST 契约）

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { assetsApi } from '@/api/assets'
import { useLogStore } from '@/stores/log'
import type { Asset, AssetType } from '@/types/models'

export const useAssetStore = defineStore('asset', () => {
  const logStore = useLogStore()

  // ===== 状态 =====
  /** 房间内所有素材 */
  const assets = ref<Asset[]>([])
  /** 加载状态 */
  const isLoading = ref(false)
  /** 上传进度（0-100） */
  const uploadProgress = ref(0)
  /** 是否正在上传 */
  const isUploading = ref(false)
  /** 错误信息 */
  const error = ref<string | null>(null)

  // ===== Getters =====
  /** 按类型获取素材（getter 函数） */
  function getAssetsByType(type: AssetType): Asset[] {
    return assets.value.filter((a) => a.type === type)
  }

  /** 立绘素材 */
  const portraits = computed(() => assets.value.filter((a) => a.type === 'portrait'))
  /** 地图素材 */
  const maps = computed(() => assets.value.filter((a) => a.type === 'map'))
  /** Token 素材 */
  const tokens = computed(() => assets.value.filter((a) => a.type === 'token'))
  /** 其他素材 */
  const others = computed(() => assets.value.filter((a) => a.type === 'other'))

  // ===== 内部工具 =====
  /** 在列表中 upsert 素材 */
  function upsertAsset(list: Asset[], asset: Asset): Asset[] {
    const idx = list.findIndex((a) => a.id === asset.id)
    if (idx >= 0) {
      const next = list.slice()
      next[idx] = asset
      return next
    }
    return [asset, ...list]
  }

  /** 从列表中移除素材 */
  function removeAsset(list: Asset[], id: string): Asset[] {
    return list.filter((a) => a.id !== id)
  }

  // ===== Actions =====
  /** 获取房间素材 */
  async function fetchAssets(roomCode: string, type?: AssetType) {
    isLoading.value = true
    error.value = null
    try {
      const list = await assetsApi.getByRoom(roomCode, type)
      assets.value = list
    } catch (e) {
      error.value = (e as Error).message || '获取素材失败'
      logStore.addLog('system', `获取素材失败：${error.value}`)
    } finally {
      isLoading.value = false
    }
  }

  /** 上传素材 */
  async function uploadAsset(
    roomCode: string,
    playerId: string,
    file: File,
    type: AssetType,
  ): Promise<Asset | null> {
    isUploading.value = true
    uploadProgress.value = 0
    error.value = null
    try {
      // 模拟上传进度
      const progressTimer = setInterval(() => {
        uploadProgress.value = Math.min(90, uploadProgress.value + 10)
      }, 50)

      const asset = await assetsApi.upload(roomCode, playerId, file, type)
      clearInterval(progressTimer)
      uploadProgress.value = 100

      assets.value = upsertAsset(assets.value, asset)
      logStore.addLog('system', `素材「${asset.originalName}」已上传`)
      return asset
    } catch (e) {
      error.value = (e as Error).message || '上传素材失败'
      logStore.addLog('system', `上传素材失败：${error.value}`)
      return null
    } finally {
      isUploading.value = false
      setTimeout(() => {
        uploadProgress.value = 0
      }, 300)
    }
  }

  /** 删除素材 */
  async function deleteAsset(
    roomCode: string,
    playerId: string,
    assetId: string,
  ): Promise<boolean> {
    isLoading.value = true
    error.value = null
    try {
      await assetsApi.delete(roomCode, playerId, assetId)
      assets.value = removeAsset(assets.value, assetId)
      logStore.addLog('system', '素材已删除')
      return true
    } catch (e) {
      error.value = (e as Error).message || '删除素材失败'
      logStore.addLog('system', `删除素材失败：${error.value}`)
      return false
    } finally {
      isLoading.value = false
    }
  }

  /** 重置所有状态 */
  function reset() {
    assets.value = []
    isLoading.value = false
    isUploading.value = false
    uploadProgress.value = 0
    error.value = null
  }

  return {
    // 状态
    assets,
    isLoading,
    isUploading,
    uploadProgress,
    error,
    // Getters
    portraits,
    maps,
    tokens,
    others,
    getAssetsByType,
    // Actions
    fetchAssets,
    uploadAsset,
    deleteAsset,
    reset,
  }
})
