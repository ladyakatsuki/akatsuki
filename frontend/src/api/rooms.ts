// 房间相关 API（与后端 REST 契约对接）

import http from './client'
import type {
  CreateRoomResult,
  JoinRoomResult,
  RoomQueryResult,
  RoomStateEvent,
  RuleSet,
} from '@/types/models'

export const roomsApi = {
  /** 创建房间：POST /api/rooms */
  create(ruleSystem: RuleSet, dmName: string): Promise<CreateRoomResult> {
    return http.post<never, CreateRoomResult>('/api/rooms', { ruleSystem, dmName })
  },

  /** 加入房间：POST /api/rooms/:code/join */
  join(code: string, playerName: string): Promise<JoinRoomResult> {
    return http.post<never, JoinRoomResult>(`/api/rooms/${code}/join`, { playerName })
  },

  /** 查询房间：GET /api/rooms/:code */
  query(code: string): Promise<RoomQueryResult> {
    return http.get<never, RoomQueryResult>(`/api/rooms/${code}`)
  },

  /** 获取房间状态：GET /api/rooms/:code/state?playerId=xxx */
  getState(code: string, playerId: string): Promise<RoomStateEvent> {
    return http.get<never, RoomStateEvent>(`/api/rooms/${code}/state`, {
      params: { playerId },
    })
  },

  /** 离开房间：POST /api/rooms/:code/leave */
  leave(code: string, playerId: string): Promise<void> {
    return http.post<never, void>(`/api/rooms/${code}/leave`, { playerId })
  },
}

export default roomsApi
