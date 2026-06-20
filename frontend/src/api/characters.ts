// 角色相关 API（与后端 REST 契约对接）

import http from './client'
import type { Character } from '@/types/models'

/** 统一拼接 playerId 到 query */
function withPlayerId(playerId: string) {
  return { params: { playerId } }
}

export const charactersApi = {
  /**
   * 创建角色：POST /api/rooms/:code/characters
   * Body: { name, isNpc? }
   */
  create(roomCode: string, playerId: string, name: string, isNpc?: boolean): Promise<Character> {
    return http.post<never, Character>(
      `/api/rooms/${roomCode}/characters`,
      { name, isNpc },
      withPlayerId(playerId),
    )
  },

  /** 获取房间所有角色：GET /api/rooms/:code/characters */
  getByRoom(roomCode: string): Promise<Character[]> {
    return http.get<never, Character[]>(`/api/rooms/${roomCode}/characters`)
  },

  /** 获取自己的角色：GET /api/rooms/:code/characters/mine?playerId=xxx */
  getMine(roomCode: string, playerId: string): Promise<Character[]> {
    return http.get<never, Character[]>(
      `/api/rooms/${roomCode}/characters/mine`,
      withPlayerId(playerId),
    )
  },

  /** 获取单个角色：GET /api/characters/:id */
  get(id: string): Promise<Character> {
    return http.get<never, Character>(`/api/characters/${id}`)
  },

  /**
   * 更新角色基本信息：PATCH /api/characters/:id
   * Body: { name? }
   */
  update(
    id: string,
    playerId: string,
    patch: Partial<Pick<Character, 'name'>>,
  ): Promise<Character> {
    return http.patch<never, Character>(`/api/characters/${id}`, patch, withPlayerId(playerId))
  },

  /**
   * 更新角色卡数据：PUT /api/characters/:id/data
   * Body: Record<string, unknown>
   */
  updateData(id: string, playerId: string, data: Record<string, unknown>): Promise<Character> {
    return http.put<never, Character>(`/api/characters/${id}/data`, data, withPlayerId(playerId))
  },

  /**
   * 上传立绘：POST /api/characters/:id/portrait
   * multipart/form-data, field: portrait
   */
  uploadPortrait(id: string, playerId: string, file: File): Promise<Character> {
    const form = new FormData()
    form.append('portrait', file)
    return http.post<never, Character>(`/api/characters/${id}/portrait`, form, {
      ...withPlayerId(playerId),
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  /** 删除角色：DELETE /api/characters/:id */
  delete(id: string, playerId: string): Promise<void> {
    return http.delete<never, void>(`/api/characters/${id}`, withPlayerId(playerId))
  },
}

export default charactersApi
