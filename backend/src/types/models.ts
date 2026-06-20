/**
 * 数据模型类型定义
 */

/** 支持的规则系统 */
export type RuleSystem = 'dnd5e' | 'coc7';

/** 玩家在房间中的角色 */
export type PlayerRole = 'dm' | 'player';

/** 房间内玩家信息 */
export interface RoomPlayer {
  id: string;
  name: string;
  role: PlayerRole;
  joinedAt: number;
  /** 在线状态（可选，未连接时为 false 或 undefined） */
  isConnected?: boolean;
}

/** 房间实体 */
export interface Room {
  id: string;
  code: string;
  ruleSystem: RuleSystem;
  dmId: string;
  players: RoomPlayer[];
  storyId: string | null;
  createdAt: number;
}

/** 角色实体 */
export interface Character {
  id: string;
  roomId: string;
  /** 所属玩家 ID（DM 的 NPC 也用 DM 的 playerId） */
  playerId: string;
  name: string;
  ruleSystem: RuleSystem;
  /** 角色卡数据（按规则系统结构） */
  data: Record<string, unknown>;
  /** 立绘 URL */
  portraitUrl: string | null;
  /** 是否为 NPC（DM 创建的） */
  isNpc: boolean;
  createdAt: number;
  updatedAt: number;
}

/** 故事书格式：Markdown 或 JSON */
export type StoryFormat = 'md' | 'json';

/** 故事章节 */
export interface StoryChapter {
  /** 章节 ID */
  id: string;
  /** 章节标题 */
  title: string;
  /** 章节内容（Markdown 或纯文本） */
  content: string;
  /** 排序 */
  order: number;
}

/** 故事选择分支 */
export interface StoryChoice {
  /** 选项 ID */
  id: string;
  /** 选项文本 */
  text: string;
  /** 跳转场景 ID */
  targetSceneId?: string;
  /** 动作描述 */
  action?: string;
}

/** 故事场景（JSON 格式用） */
export interface StoryScene {
  /** 场景 ID */
  id: string;
  /** 所属章节 ID */
  chapterId: string;
  /** 场景标题 */
  title: string;
  /** 场景描述 */
  description: string;
  /** 关联 NPC */
  npcIds?: string[];
  /** 关联遇敌 */
  encounterIds?: string[];
  /** 选择分支 */
  choices?: StoryChoice[];
}

/** 故事 NPC（JSON 格式用） */
export interface StoryNpc {
  /** NPC ID */
  id: string;
  /** NPC 名称 */
  name: string;
  /** NPC 描述 */
  description: string;
  /** 头像 URL */
  portraitUrl?: string;
}

/** 故事遇敌（JSON 格式用） */
export interface StoryEncounter {
  /** 遇敌 ID */
  id: string;
  /** 遇敌名称 */
  name: string;
  /** 遇敌描述 */
  description: string;
  /** 敌人描述列表 */
  enemies: string[];
  /** 难度 */
  difficulty?: string;
}

/** 故事书实体 */
export interface Story {
  id: string;
  roomId: string;
  /** 故事格式：md / json */
  format: StoryFormat;
  title: string;
  /** 章节列表（Markdown 格式用） */
  chapters: StoryChapter[];
  /** 场景列表（JSON 格式用） */
  scenes: StoryScene[];
  /** NPC 列表（JSON 格式用） */
  npcs: StoryNpc[];
  /** 遇敌列表（JSON 格式用） */
  encounters: StoryEncounter[];
  /** 当前章节索引 */
  currentChapter: number;
  /** 当前场景 ID（JSON 格式用） */
  currentScene: string | null;
  /** 关联素材 URL */
  assets: string[];
  createdAt: number;
  updatedAt: number;
}

/** 素材类型：立绘 / 地图 / Token / 其他 */
export type AssetType = 'portrait' | 'map' | 'token' | 'other';

/** 素材实体 */
export interface Asset {
  id: string;
  roomId: string;
  /** 素材类型 */
  type: AssetType;
  /** 存储文件名 */
  filename: string;
  /** 原始文件名 */
  originalName: string;
  /** 访问 URL */
  url: string;
  /** 文件大小（字节） */
  size: number;
  /** 上传者 playerId */
  uploadedBy: string;
  createdAt: number;
}

/** 网格类型 */
export type GridType = 'square' | 'hex';

/** Token 类型 */
export type MapTokenType = 'player' | 'npc' | 'object';

/** 地图上的 token */
export interface MapToken {
  /** Token ID */
  id: string;
  /** 关联角色 ID（玩家 Token 关联角色） */
  characterId?: string;
  /** 显示名 */
  name: string;
  /** Token 类型：player / npc / object */
  type: MapTokenType;
  /** 格子 X 坐标 */
  x: number;
  /** 格子 Y 坐标 */
  y: number;
  /** Token 图标 URL */
  imageUrl?: string;
  /** 颜色（无图标时用） */
  color: string;
  /** 大小（占几格，默认 1） */
  size: number;
  /** 玩家是否可见 */
  isVisible: boolean;
  /** DM 备注 */
  notes?: string;
}

/** 地图状态实体 */
export interface MapState {
  id: string;
  roomId: string;
  /** 网格类型：square / hex */
  gridType: GridType;
  /** 格子大小（像素） */
  gridSize: number;
  /** 地图宽度（格子数） */
  width: number;
  /** 地图高度（格子数） */
  height: number;
  /** 背景图 URL */
  backgroundUrl: string | null;
  /** Token 列表 */
  tokens: MapToken[];
  /** 迷雾单元格（"x,y" 格式） */
  fogCells: string[];
  updatedAt: number;
}

/** 战斗参与者 */
export interface CombatParticipant {
  id: string;
  /** 关联角色 ID（NPC 可能为空） */
  characterId?: string;
  name: string;
  /** 类型：玩家角色 / NPC */
  type: 'player' | 'npc';
  /** 先攻值 */
  initiative: number;
  /** 当前 HP */
  hp: number;
  /** 最大 HP */
  maxHp: number;
  /** AC（DND） */
  ac?: number;
  /** 状态效果 key 列表 */
  statusEffects: string[];
  /** 备注 */
  notes?: string;
}

/** 战斗状态实体 */
export interface CombatState {
  id: string;
  roomId: string;
  isActive: boolean;
  /** 当前轮次 */
  round: number;
  /** 当前回合索引（participants 数组索引） */
  currentTurn: number;
  /** 参与者列表（按先攻降序排序） */
  participants: CombatParticipant[];
  /** 战斗开始时间 */
  startedAt: number;
  updatedAt: number;
}
