// 故事书 API（与后端 REST 契约对接）
// - POST   /api/rooms/:code/story/upload  上传故事书（multipart, field: file, query: format, playerId）
// - GET    /api/rooms/:code/story         获取故事
// - DELETE /api/rooms/:code/story         删除故事（query: playerId）

import http from './client'
import type { Story, StoryFormat } from '@/types/models'

export const storiesApi = {
  /**
   * 上传故事书
   * @param roomCode  房间码
   * @param playerId  操作者 ID（DM）
   * @param file      故事书文件（.md / .json）
   * @param format    故事格式
   * @param onProgress 上传进度回调（0-100）
   */
  upload(
    roomCode: string,
    playerId: string,
    file: File,
    format: StoryFormat,
    onProgress?: (percent: number) => void,
  ): Promise<Story> {
    const form = new FormData()
    form.append('file', file)
    return http.post<never, Story>(`/api/rooms/${roomCode}/story/upload`, form, {
      params: { format, playerId },
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (!onProgress) return
        const total = e.total ?? 0
        const loaded = e.loaded ?? 0
        if (total > 0) {
          onProgress(Math.round((loaded / total) * 100))
        }
      },
    })
  },

  /**
   * 获取房间故事
   * @returns 故事实体，无故事时返回 null
   */
  get(roomCode: string): Promise<Story | null> {
    return http.get<never, Story | null>(`/api/rooms/${roomCode}/story`)
  },

  /**
   * 删除故事（仅 DM）
   * @param roomCode  房间码
   * @param playerId  操作者 ID
   */
  delete(roomCode: string, playerId: string): Promise<void> {
    return http.delete<never, void>(`/api/rooms/${roomCode}/story`, {
      params: { playerId },
    })
  },
}

export default storiesApi
