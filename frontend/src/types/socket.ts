// Socket.IO 事件类型定义（与后端契约一致）

import type {
  Character,
  CombatParticipant,
  CombatParticipantType,
  CombatState,
  GridType,
  MapState,
  MapToken,
  RoomPlayer,
  RoomStateEvent,
  Story,
} from './models'

/** COC 成功等级 */
export type SuccessLevel = 'critical' | 'extreme' | 'hard' | 'regular' | 'fumble' | null

/** 骰子掷骰请求（C→S dice:roll payload） */
export interface DiceRollRequest {
  /** 骰子表达式，如 '2d20kh1+5'、'1d100' */
  expression: string
  /** 标签，如 '攻击检定'、'SAN 检定' */
  label?: string
  /** DND 优势 */
  advantage?: boolean
  /** DND 劣势 */
  disadvantage?: boolean
  /** COC 奖金骰数量 */
  bonusDice?: number
  /** COC 惩罚骰数量 */
  penaltyDice?: number
  /** 目标值（COC 技能检定用） */
  target?: number
  /** 关联角色（可选） */
  characterId?: string
  /** 是否暗骰（仅 DM 和掷骰者可见） */
  isHidden?: boolean
}

/** 骰子结果事件（S→C dice:result） */
export interface DiceRollResultEvent {
  /** 结果 ID */
  id: string
  playerId: string
  playerName: string
  expression: string
  label?: string
  /** 所有骰子结果 */
  rolls: number[]
  /** 保留的骰子 */
  kept: number[]
  modifier: number
  total: number
  /** COC 成功等级 */
  successLevel?: SuccessLevel
  /** 目标值 */
  target?: number
  characterId?: string
  isHidden: boolean
  timestamp: number
  /** SAN 检定实际扣除值（仅 SAN 检定有） */
  sanLossApplied?: number
}

/** 日志事件类型 */
export type LogEventType = 'dice' | 'combat' | 'story' | 'system' | 'character'

/** 日志事件（S→C log:add） */
export interface LogEvent {
  id: string
  type: LogEventType
  /** 可读消息 */
  message: string
  /** 原始数据 */
  data?: unknown
  playerId?: string
  playerName?: string
  timestamp: number
  /** 暗骰日志 */
  isHidden?: boolean
}

/** Socket 连接鉴权信息 */
export interface SocketAuth {
  roomCode: string
  playerId: string
}

/** 地图状态事件（S→C map:state，承载完整地图状态） */
export type MapStateEvent = MapState

/** DM 添加 Token 载荷（C→S map:token:add） */
export interface MapTokenAddPayload {
  characterId?: string
  name: string
  type: MapToken['type']
  x: number
  y: number
  imageUrl?: string
  color: string
  size: number
  isVisible?: boolean
  notes?: string
}

/** DM 更新 Token 载荷（C→S map:token:update） */
export interface MapTokenUpdatePayload {
  tokenId: string
  name?: string
  type?: MapToken['type']
  x?: number
  y?: number
  imageUrl?: string
  color?: string
  size?: number
  isVisible?: boolean
  notes?: string
}

/** 迷雾切换载荷（C→S map:fog:toggle） */
export interface MapFogTogglePayload {
  /** 格子列表，格式 "x,y" */
  cells: string[]
  /** add=添加迷雾，remove=移除迷雾 */
  mode: 'add' | 'remove'
}

/** 地图配置载荷（C→S map:config:set） */
export interface MapConfigPayload {
  gridType?: GridType
  gridSize?: number
  width?: number
  height?: number
}

/** 战斗参与者添加载荷（C→S combat:addParticipant） */
export interface CombatAddParticipantPayload {
  /** 关联角色 ID（手动添加可省略） */
  characterId?: string
  name: string
  type: CombatParticipantType
  initiative: number
  hp: number
  maxHp: number
  ac?: number
  statusEffects?: string[]
  notes?: string
}

/** 战斗参与者更新载荷（C→S combat:updateParticipant） */
export interface CombatUpdateParticipantPayload {
  participantId: string
  /** 部分更新字段 */
  patch: Partial<Omit<CombatParticipant, 'id'>>
}

/** 战斗回合事件载荷（S→C combat:turn） */
export interface CombatTurnEvent {
  round: number
  currentTurn: number
  participant: CombatParticipant
}

/** 战斗状态事件载荷（S→C combat:state） */
export interface CombatStateEvent {
  combat: CombatState | null
}

/** 故事推进请求 Payload（C→S story:advance） */
export interface StoryAdvancePayload {
  /** 跳转到指定章节（Markdown 格式用） */
  targetChapter?: number
  /** 跳转到指定场景（JSON 格式用） */
  targetScene?: string
}

/** 故事事件类型 */
export type StoryEventType = 'chapter' | 'scene' | 'npc' | 'encounter' | 'choice'

/** 故事事件 Payload（DM 触发的故事事件，如 NPC 出现、遇敌等） */
export interface StoryEventPayload {
  /** 事件类型 */
  type: StoryEventType
  /** 事件数据 */
  data: unknown
}

/** 故事状态事件（S→C story:state，承载完整故事状态） */
export interface StoryStateEvent {
  story: Story | null
}

/** 连接状态 */
export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'

/** Socket 应答（与后端 SocketAck 一致） */
export interface SocketAck<T = unknown> {
  ok: boolean
  error?: string
  data?: T
}

/**
 * 客户端 -> 服务端 事件
 * 房间加入/离开由 REST API 处理，Socket 承载实时同步、踢人与骰子掷骰
 */
export interface ClientToServerEvents {
  /** DM 踢出玩家 */
  'room:kick': (payload: { playerId: string }, ack?: (res: SocketAck) => void) => void
  /** 通用掷骰 */
  'dice:roll': (
    payload: DiceRollRequest,
    ack?: (res: SocketAck<DiceRollResultEvent>) => void,
  ) => void
  /** 技能检定掷骰 */
  'dice:rollSkill': (
    payload: { characterId: string; skillKey: string },
    ack?: (res: SocketAck<DiceRollResultEvent>) => void,
  ) => void
  /** SAN 检定掷骰（COC 专用） */
  'dice:rollSan': (
    payload: { characterId: string; sanLossExpression: string },
    ack?: (res: SocketAck<DiceRollResultEvent>) => void,
  ) => void
  /** 创建角色 */
  'character:create': (
    payload: { name: string; isNpc?: boolean },
    ack?: (res: SocketAck<Character>) => void,
  ) => void
  /** 更新角色卡数据 */
  'character:updateData': (
    payload: { characterId: string; data: Record<string, unknown> },
    ack?: (res: SocketAck<Character>) => void,
  ) => void
  /** 删除角色 */
  'character:delete': (payload: { characterId: string }, ack?: (res: SocketAck) => void) => void
  /** 获取地图状态（通过 ack 返回） */
  'map:getState': (ack?: (res: SocketAck<MapState>) => void) => void
  /** 移动 Token */
  'map:token:move': (payload: { tokenId: string; x: number; y: number }) => void
  /** DM 添加 Token */
  'map:token:add': (payload: MapTokenAddPayload, ack?: (res: SocketAck<MapToken>) => void) => void
  /** DM 移除 Token */
  'map:token:remove': (payload: { tokenId: string }) => void
  /** DM 更新 Token */
  'map:token:update': (payload: MapTokenUpdatePayload) => void
  /** DM 切换迷雾 */
  'map:fog:toggle': (payload: MapFogTogglePayload) => void
  /** DM 清空迷雾 */
  'map:fog:clear': () => void
  /** DM 设置网格配置 */
  'map:config:set': (payload: MapConfigPayload) => void
  /** DM 设置背景图 */
  'map:background:set': (payload: { url: string }) => void
  /** DM 发起战斗 */
  'combat:start': (
    payload: { participantIds: string[]; rollInitiative: boolean },
    ack?: (res: SocketAck<CombatState>) => void,
  ) => void
  /** DM 结束战斗 */
  'combat:end': (ack?: (res: SocketAck) => void) => void
  /** DM 添加战斗参与者 */
  'combat:addParticipant': (
    payload: CombatAddParticipantPayload,
    ack?: (res: SocketAck<CombatParticipant>) => void,
  ) => void
  /** DM 移除战斗参与者 */
  'combat:removeParticipant': (
    payload: { participantId: string },
    ack?: (res: SocketAck) => void,
  ) => void
  /** DM 更新战斗参与者 */
  'combat:updateParticipant': (
    payload: CombatUpdateParticipantPayload,
    ack?: (res: SocketAck<CombatParticipant>) => void,
  ) => void
  /** DM 推进到下一回合 */
  'combat:nextTurn': (ack?: (res: SocketAck<CombatTurnEvent>) => void) => void
  /** DM 回到上一回合 */
  'combat:prevTurn': (ack?: (res: SocketAck<CombatTurnEvent>) => void) => void
  /** DM 重新掷先攻 */
  'combat:rollInitiative': (
    payload: { participantId: string },
    ack?: (res: SocketAck<CombatParticipant>) => void,
  ) => void
  /** 获取故事状态（通过 ack 返回） */
  'story:getState': (ack?: (res: SocketAck<Story | null>) => void) => void
  /** DM 推进故事（章节 / 场景） */
  'story:advance': (
    payload: StoryAdvancePayload,
    ack?: (res: SocketAck<Story | null>) => void,
  ) => void
  /** DM 触发故事事件（NPC 出现、遇敌等） */
  'story:event': (
    payload: StoryEventPayload,
    ack?: (res: SocketAck<StoryEventPayload>) => void,
  ) => void
}

/** 服务端 -> 客户端 事件 */
export interface ServerToClientEvents {
  /** 房间完整状态（连接后推送 / 主动同步） */
  'room:state': (payload: RoomStateEvent) => void
  /** 玩家加入 */
  'room:playerJoined': (payload: { player: RoomPlayer }) => void
  /** 玩家主动离开 */
  'room:playerLeft': (payload: { playerId: string }) => void
  /** 玩家断开连接（掉线） */
  'room:playerDisconnected': (payload: { playerId: string }) => void
  /** 玩家被踢出 */
  'room:playerKicked': (payload: { playerId: string }) => void
  /** 骰子结果 */
  'dice:result': (payload: DiceRollResultEvent) => void
  /** 日志事件 */
  'log:add': (payload: LogEvent) => void
  /** 角色已创建 */
  'character:created': (payload: { character: Character }) => void
  /** 角色基本信息已更新 */
  'character:updated': (payload: { character: Character }) => void
  /** 角色卡数据已更新 */
  'character:dataUpdated': (payload: { characterId: string; data: Record<string, unknown> }) => void
  /** 角色已删除 */
  'character:deleted': (payload: { characterId: string }) => void
  /** 地图完整状态（连接后推送 / 主动同步） */
  'map:state': (payload: MapStateEvent) => void
  /** Token 已移动 */
  'map:token:moved': (payload: { tokenId: string; x: number; y: number }) => void
  /** Token 已移除 */
  'map:token:removed': (payload: { tokenId: string }) => void
  /** Token 已更新 */
  'map:token:updated': (payload: { token: MapToken }) => void
  /** 迷雾已更新 */
  'map:fog:updated': (payload: { fogCells: string[] }) => void
  /** 战斗状态同步（开始/结束/参与者变更等） */
  'combat:state': (payload: CombatStateEvent) => void
  /** 战斗回合变更 */
  'combat:turn': (payload: CombatTurnEvent) => void
  /** 故事完整状态（连接后推送 / DM 推进后同步） */
  'story:state': (payload: StoryStateEvent) => void
  /** 故事事件（DM 触发的 NPC、遇敌等事件） */
  'story:event': (payload: StoryEventPayload) => void
  /** 错误通知 */
  error: (payload: { message: string; code?: string }) => void
  /** 内置：连接成功 */
  connect: () => void
  /** 内置：断开连接 */
  disconnect: (reason: string) => void
  /** 内置：连接错误 */
  connect_error: (err: Error) => void
}
