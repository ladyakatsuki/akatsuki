import type {
  Character,
  CombatParticipant,
  CombatState,
  GridType,
  MapState,
  MapToken,
  Room,
  Story,
} from './models.js';
import type { SuccessLevel } from './rules.js';

/**
 * Socket 事件类型定义
 */

// ============ 通用 Payload 类型 ============

/** 加入房间 Payload */
export interface RoomJoinPayload {
  roomCode: string;
  playerName: string;
}

/** 房间状态事件（推送给客户端的完整房间状态） */
export interface RoomStateEvent {
  room: Room;
  /** 房间内所有角色 */
  characters: unknown[];
  /** 在线玩家 ID 列表 */
  onlinePlayers: string[];
}

// ============ 骰子相关类型 ============

/** 骰子掷骰请求 */
export interface DiceRollRequest {
  /** 骰子表达式，如 '2d20kh1+5'、'1d100' */
  expression: string;
  /** 标签，如 '攻击检定'、'SAN 检定' */
  label?: string;
  /** DND 优势 */
  advantage?: boolean;
  /** DND 劣势 */
  disadvantage?: boolean;
  /** COC 奖金骰数量 */
  bonusDice?: number;
  /** COC 惩罚骰数量 */
  penaltyDice?: number;
  /** 目标值（COC 技能检定用） */
  target?: number;
  /** 关联角色（可选） */
  characterId?: string;
  /** 是否暗骰（仅 DM 和掷骰者可见） */
  isHidden?: boolean;
}

/** 骰子结果事件 */
export interface DiceRollResultEvent {
  /** 结果 ID */
  id: string;
  playerId: string;
  playerName: string;
  expression: string;
  label?: string;
  /** 所有骰子结果 */
  rolls: number[];
  /** 保留的骰子 */
  kept: number[];
  modifier: number;
  total: number;
  /** COC 成功等级 */
  successLevel?: SuccessLevel;
  /** 目标值 */
  target?: number;
  characterId?: string;
  isHidden: boolean;
  timestamp: number;
  /** SAN 检定实际扣除值（仅 SAN 检定有） */
  sanLossApplied?: number;
}

// ============ 日志相关类型 ============

/** 日志事件类型 */
export interface LogEvent {
  id: string;
  type: 'dice' | 'combat' | 'story' | 'system' | 'character';
  /** 可读消息 */
  message: string;
  /** 原始数据 */
  data?: unknown;
  playerId?: string;
  playerName?: string;
  timestamp: number;
  /** 暗骰日志 */
  isHidden?: boolean;
}

// ============ 地图相关类型 ============

/** Token 移动 Payload */
export interface MapTokenMovePayload {
  tokenId: string;
  x: number;
  y: number;
}

/** Token 添加 Payload */
export interface MapTokenAddPayload {
  token: Omit<MapToken, 'id'>;
}

/** Token 更新 Payload */
export interface MapTokenUpdatePayload {
  tokenId: string;
  patch: Partial<MapToken>;
}

/** 迷雾切换 Payload */
export interface MapFogTogglePayload {
  /** 要切换迷雾的单元格列表 */
  cells: string[];
  /** 添加或移除迷雾 */
  mode: 'add' | 'remove';
}

/** 地图配置 Payload */
export interface MapConfigPayload {
  gridType?: GridType;
  gridSize?: number;
  width?: number;
  height?: number;
  backgroundUrl?: string | null;
}

/** 地图状态事件（推送给客户端的完整地图状态） */
export interface MapStateEvent {
  mapState: MapState;
}

/** 玩家视角的地图状态事件（过滤不可见 Token） */
export interface PlayerMapStateEvent {
  mapState: Omit<MapState, 'fogCells'> & {
    tokens: MapToken[];
    fogCells: string[];
  };
}

// ============ 故事相关类型 ============

/** 故事推进请求 Payload */
export interface StoryAdvancePayload {
  /** 跳转到指定章节（Markdown 格式用） */
  targetChapter?: number;
  /** 跳转到指定场景（JSON 格式用） */
  targetScene?: string;
}

/** 故事事件 Payload（DM 触发的故事事件，如 NPC 出现、遇敌等） */
export interface StoryEventPayload {
  /** 事件类型 */
  type: 'chapter' | 'scene' | 'npc' | 'encounter' | 'choice';
  /** 事件数据 */
  data: unknown;
}

/** 故事状态事件（推送给客户端的完整故事状态） */
export interface StoryStateEvent {
  story: Story | null;
}

// ============ 客户端 -> 服务端 事件 ============

export interface ClientToServerEvents {
  /** 加入房间（已在 auth 中间件校验，这里仅加入 Socket.IO room 并广播） */
  'room:join': (payload: { roomId: string }, ack: (res: SocketAck) => void) => void;
  /** 离开房间 */
  'room:leave': (ack: (res: SocketAck) => void) => void;
  /** DM 踢出玩家 */
  'room:kick': (
    payload: { playerId: string },
    ack: (res: SocketAck) => void,
  ) => void;
  /** 房间内广播状态变更 */
  'room:sync': (payload: { type: string; data: unknown }, ack: (res: SocketAck) => void) => void;

  /** 角色卡更新（基本信息） */
  'character:update': (
    payload: {
      characterId: string;
      patch: Partial<Pick<Character, 'name'>>;
    },
    ack: (res: SocketAck<Character>) => void,
  ) => void;
  /** 角色卡数据更新 */
  'character:updateData': (
    payload: {
      characterId: string;
      data: Record<string, unknown>;
    },
    ack: (res: SocketAck<Character>) => void,
  ) => void;
  /** 创建角色 */
  'character:create': (
    payload: { name: string; isNpc?: boolean },
    ack: (res: SocketAck<Character>) => void,
  ) => void;
  /** 删除角色 */
  'character:delete': (
    payload: { characterId: string },
    ack: (res: SocketAck) => void,
  ) => void;
  /** 角色卡共享给房间 */
  'character:share': (
    payload: { characterId: string },
    ack: (res: SocketAck) => void,
  ) => void;

  /** 掷骰子 */
  'dice:roll': (
    payload: DiceRollRequest,
    ack: (res: SocketAck<DiceRollResultEvent>) => void,
  ) => void;
  /** 技能检定掷骰 */
  'dice:rollSkill': (
    payload: { characterId: string; skillKey: string },
    ack: (res: SocketAck<DiceRollResultEvent>) => void,
  ) => void;
  /** SAN 检定掷骰（COC 专用） */
  'dice:rollSan': (
    payload: { characterId: string; sanLossExpression: string },
    ack: (res: SocketAck<DiceRollResultEvent>) => void,
  ) => void;

  /** 战斗开始（DM only） */
  'combat:start': (
    payload: CombatStartPayload,
    ack: (res: SocketAck<CombatState>) => void,
  ) => void;
  /** 战斗结束（DM only） */
  'combat:end': (ack: (res: SocketAck) => void) => void;
  /** 添加参与者（DM only） */
  'combat:addParticipant': (
    payload: CombatAddParticipantPayload,
    ack: (res: SocketAck<CombatState>) => void,
  ) => void;
  /** 移除参与者（DM only） */
  'combat:removeParticipant': (
    payload: { participantId: string },
    ack: (res: SocketAck<CombatState>) => void,
  ) => void;
  /** 更新参与者状态（DM only） */
  'combat:updateParticipant': (
    payload: CombatUpdateParticipantPayload,
    ack: (res: SocketAck<CombatState>) => void,
  ) => void;
  /** 下一回合（DM only） */
  'combat:nextTurn': (ack: (res: SocketAck<CombatState>) => void) => void;
  /** 上一回合（DM only） */
  'combat:prevTurn': (ack: (res: SocketAck<CombatState>) => void) => void;
  /** 为指定参与者重新掷先攻（DM only） */
  'combat:rollInitiative': (
    payload: { participantId: string },
    ack: (res: SocketAck<CombatState>) => void,
  ) => void;

  /** 获取地图状态（DM 获取完整，玩家获取过滤版） */
  'map:getState': (ack: (res: SocketAck<MapState | PlayerMapStateEvent>) => void) => void;
  /** 移动 Token（玩家只能移动自己的，DM 可移动所有） */
  'map:token:move': (
    payload: MapTokenMovePayload,
    ack: (res: SocketAck) => void,
  ) => void;
  /** 添加 Token（DM only） */
  'map:token:add': (
    payload: MapTokenAddPayload,
    ack: (res: SocketAck<MapState>) => void,
  ) => void;
  /** 移除 Token（DM only） */
  'map:token:remove': (
    payload: { tokenId: string },
    ack: (res: SocketAck) => void,
  ) => void;
  /** 更新 Token（DM only） */
  'map:token:update': (
    payload: MapTokenUpdatePayload,
    ack: (res: SocketAck<MapToken>) => void,
  ) => void;
  /** 切换迷雾（DM only） */
  'map:fog:toggle': (
    payload: MapFogTogglePayload,
    ack: (res: SocketAck) => void,
  ) => void;
  /** 清空迷雾（DM only） */
  'map:fog:clear': (ack: (res: SocketAck) => void) => void;
  /** 设置地图配置（DM only） */
  'map:config:set': (
    payload: MapConfigPayload,
    ack: (res: SocketAck<MapState>) => void,
  ) => void;
  /** 设置背景图（DM only） */
  'map:background:set': (
    payload: { url: string | null },
    ack: (res: SocketAck<MapState>) => void,
  ) => void;

  /** 获取故事状态（通过 ack 返回） */
  'story:getState': (ack: (res: SocketAck<Story | null>) => void) => void;
  /** 推进故事（DM only）：跳转章节或场景 */
  'story:advance': (
    payload: StoryAdvancePayload,
    ack: (res: SocketAck<Story | null>) => void,
  ) => void;
  /** 触发故事事件（DM only）：NPC 出现、遇敌等 */
  'story:event': (
    payload: StoryEventPayload,
    ack: (res: SocketAck<StoryEventPayload>) => void,
  ) => void;
}

// ============ 服务端 -> 客户端 事件 ============

export interface ServerToClientEvents {
  /** 房间完整状态（加入者收到） */
  'room:state': (payload: RoomStateEvent) => void;
  /** 玩家加入房间（房间内其他人收到） */
  'room:playerJoined': (payload: { player: { id: string; name: string } }) => void;
  /** 玩家离开房间 */
  'room:playerLeft': (payload: { playerId: string }) => void;
  /** 玩家断线（允许重连，不移除） */
  'room:playerDisconnected': (payload: { playerId: string }) => void;
  /** 玩家被踢出（被踢者收到） */
  'room:playerKicked': (payload: { playerId: string; by: string }) => void;
  /** 玩家重连成功 */
  'room:playerReconnected': (payload: { playerId: string }) => void;

  /** 角色基本信息已更新（广播给全房间） */
  'character:updated': (payload: { character: Character }) => void;
  /** 角色卡数据已更新 */
  'character:dataUpdated': (payload: {
    characterId: string;
    data: Record<string, unknown>;
  }) => void;
  /** 角色已创建 */
  'character:created': (payload: { character: Character }) => void;
  /** 角色已删除 */
  'character:deleted': (payload: { characterId: string }) => void;

  'dice:result': (payload: DiceRollResultEvent) => void;

  /** 日志事件（用于显示日志面板） */
  'log:add': (payload: LogEvent) => void;

  /** 战斗状态变更（全房间广播） */
  'combat:state': (payload: CombatStateEvent) => void;
  /** 回合变更 */
  'combat:turn': (payload: {
    round: number;
    currentTurn: number;
    participant: CombatParticipant;
  }) => void;

  /** 地图状态（全房间广播，DM 收到完整版，玩家收到过滤版） */
  'map:state': (payload: MapStateEvent) => void;
  /** Token 已移动（全房间广播） */
  'map:token:moved': (payload: { tokenId: string; x: number; y: number }) => void;
  /** Token 已移除（全房间广播） */
  'map:token:removed': (payload: { tokenId: string }) => void;
  /** Token 已更新（全房间广播） */
  'map:token:updated': (payload: { token: MapToken }) => void;
  /** 迷雾已更新（全房间广播） */
  'map:fog:updated': (payload: { fogCells: string[] }) => void;

  /** 故事状态变更（全房间广播） */
  'story:state': (payload: StoryStateEvent) => void;
  /** 故事事件触发（全房间广播） */
  'story:event': (payload: StoryEventPayload) => void;
}

// ============ 通用类型 ============

export interface SocketAck<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
}

export interface DiceResult {
  expression: string;
  rolls: number[];
  total: number;
  modifier: number;
  reason?: string;
}

// ============ 战斗相关类型 ============

/** 战斗开始请求 */
export interface CombatStartPayload {
  /** 角色 ID 列表（玩家角色 + NPC） */
  participantIds: string[];
  /** 是否自动掷先攻 */
  rollInitiative: boolean;
}

/** 添加战斗参与者请求 */
export interface CombatAddParticipantPayload {
  /** 关联角色 ID（NPC 可为空） */
  characterId?: string;
  name: string;
  type: 'player' | 'npc';
  hp: number;
  maxHp: number;
  ac?: number;
  /** 手动指定先攻 */
  initiative?: number;
}

/** 更新战斗参与者请求 */
export interface CombatUpdateParticipantPayload {
  participantId: string;
  patch: Partial<CombatParticipant>;
}

/** 战斗状态事件（推送给客户端） */
export interface CombatStateEvent {
  combat: CombatState | null;
}
