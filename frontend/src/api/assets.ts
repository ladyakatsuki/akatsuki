// 素材资源 API（与后端 REST 契约对接）

import http from './client'
import type { Asset, AssetType } from '@/types/models'

/** 统一拼接 playerId 到 query */
function withPlayerId(playerId: string) {
  return { params: { playerId } }
}

export const assetsApi = {
  /**
   * 上传素材：POST /api/rooms/:code/assets
   * multipart/form-data, field: file
   * query: type, playerId
   */
  upload(roomCode: string, playerId: string, file: File, type: AssetType): Promise<Asset> {
    const form = new FormData()
    form.append('file', file)
    return http.post<never, Asset>(`/api/rooms/${roomCode}/assets`, form, {
      ...withPlayerId(playerId),
      params: { ...withPlayerId(playerId).params, type },
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  /**
   * 获取房间素材：GET /api/rooms/:code/assets
   * query: type?（可选过滤）
   */
  getByRoom(roomCode: string, type?: AssetType): Promise<Asset[]> {
    const params = type ? { type } : undefined
    return http.get<never, Asset[]>(`/api/rooms/${roomCode}/assets`, { params })
  },

  /**
   * 删除素材：DELETE /api/rooms/:code/assets/:id
   * query: playerId（仅 DM）
   */
  delete(roomCode: string, playerId: string, assetId: string): Promise<void> {
    return http.delete<never, void>(
      `/api/rooms/${roomCode}/assets/${assetId}`,
      withPlayerId(playerId),
    )
  },
}

export default assetsApi
