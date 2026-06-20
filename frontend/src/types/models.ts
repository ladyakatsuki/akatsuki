// 共享数据模型类型（与后端契约一致）

/** 规则集标识 */
export type RuleSet = 'dnd5e' | 'coc7'

/** 房间内角色身份 */
export type Role = 'dm' | 'player'

/** 用户信息 */
export interface User {
  id: string
  name: string
  avatar?: string
}

/** 房间玩家（对应后端 RoomPlayer） */
export interface RoomPlayer {
  id: string
  name: string
  role: Role
  joinedAt: number
  /** 是否在线（由 Socket 连接状态推导） */
  isConnected?: boolean
}

/** 房间信息（对应后端 Room） */
export interface Room {
  id: string
  code: string
  ruleSystem: RuleSet
  dmId: string
  players: RoomPlayer[]
  storyId: string | null
  createdAt: number
}

/** 房间状态查询结果（GET /api/rooms/:code） */
export interface RoomQueryResult {
  ruleSystem: string
  playerCount: number
  isFull: boolean
}

/** 房间完整状态（GET /api/rooms/:code/state 与 Socket room:state 事件） */
export interface RoomStateEvent {
  room: Room
  characters: Character[]
  onlinePlayers: string[]
}

/** 创建房间返回 */
export interface CreateRoomResult {
  room: Room
  playerId: string
}

/** 加入房间返回 */
export interface JoinRoomResult {
  room: Room
  playerId: string
}

/** 角色实体（与后端 Character 对齐） */
export interface Character {
  id: string
  roomId: string
  /** 所属玩家 ID（DM 的 NPC 也用 DM 的 playerId） */
  playerId: string
  name: string
  ruleSet: RuleSet
  /** 角色卡数据（按规则系统结构） */
  data: Record<string, unknown>
  /** 立绘 URL */
  portraitUrl: string | null
  /** 是否为 NPC（DM 创建的） */
  isNpc: boolean
  createdAt: number
  updatedAt: number
}

/** DND 5E 角色卡数据 */
export interface Dnd5eCharacterData {
  // 基础
  name: string
  class: string
  level: number
  race: string
  background: string
  alignment: string
  experience: number
  // 属性
  str: number
  dex: number
  con: number
  int: number
  wis: number
  cha: number
  // 属性调整值（computed）
  strMod: number
  dexMod: number
  conMod: number
  intMod: number
  wisMod: number
  chaMod: number
  // 豁免熟练
  strSaveProficient: boolean
  dexSaveProficient: boolean
  conSaveProficient: boolean
  intSaveProficient: boolean
  wisSaveProficient: boolean
  chaSaveProficient: boolean
  // 战斗
  hp: number
  maxHp: number
  ac: number
  speed: number
  initiative: number
  proficiencyBonus: number
  // 技能（18 项熟练度）
  athletics: boolean
  acrobatics: boolean
  sleightOfHand: boolean
  stealth: boolean
  arcana: boolean
  history: boolean
  investigation: boolean
  nature: boolean
  religion: boolean
  animalHandling: boolean
  insight: boolean
  medicine: boolean
  perception: boolean
  survival: boolean
  deception: boolean
  intimidation: boolean
  performance: boolean
  persuasion: boolean
  passivePerception: number
  // 法术
  spellcastingAbility: string
  spellSlot1: number
  spellSlot2: number
  spellSlot3: number
  spellSlot4: number
  spellSlot5: number
  spellSlot6: number
  spellSlot7: number
  spellSlot8: number
  spellSlot9: number
  // 背景
  personalityTraits: string
  ideals: string
  bonds: string
  flaws: string
  // 物品
  inventory: string
  [key: string]: unknown
}

/** COC 7版角色卡数据 */
export interface Coc7CharacterData {
  // 基础
  name: string
  occupation: string
  age: number
  sex: string
  residence: string
  birthplace: string
  // 核心属性（8 项）
  str: number
  con: number
  siz: number
  dex: number
  app: number
  int: number
  pow: number
  edu: number
  // 派生属性
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  san: number
  maxSan: number
  db: number
  build: number
  mov: number
  luck: number
  // 战斗技能
  brawl: number
  dodge: number
  sword: number
  handgun: number
  rifle: number
  throw: number
  choke: number
  melee: number
  // 调查技能
  libraryUse: number
  perception: number
  psychology: number
  occult: number
  archaeology: number
  history: number
  naturalWorld: number
  // 行动技能
  stealth: number
  listen: number
  climb: number
  jump: number
  driveAuto: number
  driveAircraft: number
  driveBoat: number
  ride: number
  swim: number
  survival: number
  track: number
  // 社交技能
  charm: number
  persuasion: number
  intimidate: number
  reputation: number
  sleightOfHand: number
  hypnosis: number
  performance: number
  // 学识技能
  psychoanalysis: number
  firstAid: number
  medicine: number
  law: number
  accounting: number
  anthropology: number
  biology: number
  chemistry: number
  electronics: number
  geology: number
  electronicRepair: number
  mechanicalRepair: number
  artAndCraft: number
  foreignLanguage: number
  nativeLanguage: number
  cthulhuMythos: number
  // 战斗
  dbCombat: number
  buildCombat: number
  weapons: string
  // 背景
  description: string
  // 物品
  inventory: string
  [key: string]: unknown
}

/** 故事/剧本条目（旧版故事流，保留兼容） */
export interface StoryEntry {
  id: string
  roomId: string
  type: 'narration' | 'dialogue' | 'system' | 'image'
  content: string
  authorId: string
  authorName: string
  createdAt: string
}

/** 故事书格式：Markdown 或 JSON */
export type StoryFormat = 'md' | 'json'

/** 故事章节（Markdown 格式用） */
export interface StoryChapter {
  /** 章节 ID */
  id: string
  /** 章节标题 */
  title: string
  /** 章节内容（Markdown 或纯文本） */
  content: string
  /** 排序 */
  order: number
}

/** 故事选择分支（JSON 格式用） */
export interface StoryChoice {
  /** 选项 ID */
  id: string
  /** 选项文本 */
  text: string
  /** 跳转场景 ID */
  targetSceneId?: string
  /** 动作描述 */
  action?: string
}

/** 故事场景（JSON 格式用） */
export interface StoryScene {
  /** 场景 ID */
  id: string
  /** 所属章节 ID */
  chapterId: string
  /** 场景标题 */
  title: string
  /** 场景描述 */
  description: string
  /** 关联 NPC */
  npcIds?: string[]
  /** 关联遇敌 */
  encounterIds?: string[]
  /** 选择分支 */
  choices?: StoryChoice[]
}

/** 故事 NPC（JSON 格式用） */
export interface StoryNpc {
  /** NPC ID */
  id: string
  /** NPC 名称 */
  name: string
  /** NPC 描述 */
  description: string
  /** 头像 URL */
  portraitUrl?: string
}

/** 故事遇敌（JSON 格式用） */
export interface StoryEncounter {
  /** 遇敌 ID */
  id: string
  /** 遇敌名称 */
  name: string
  /** 遇敌描述 */
  description: string
  /** 敌人描述列表 */
  enemies: string[]
  /** 难度 */
  difficulty?: string
}

/** 故事书实体（与后端 Story 对齐） */
export interface Story {
  id: string
  roomId: string
  /** 故事格式：md / json */
  format: StoryFormat
  title: string
  /** 章节列表（Markdown 格式用） */
  chapters: StoryChapter[]
  /** 场景列表（JSON 格式用） */
  scenes: StoryScene[]
  /** NPC 列表（JSON 格式用） */
  npcs: StoryNpc[]
  /** 遇敌列表（JSON 格式用） */
  encounters: StoryEncounter[]
  /** 当前章节索引 */
  currentChapter: number
  /** 当前场景 ID（JSON 格式用） */
  currentScene: string | null
  /** 关联素材 URL */
  assets: string[]
  createdAt: number
  updatedAt: number
}

/** 素材类型：立绘 / 地图 / Token / 其他 */
export type AssetType = 'portrait' | 'map' | 'token' | 'other'

/** 素材资源 */
export interface Asset {
  id: string
  roomId: string
  /** 素材类型 */
  type: AssetType
  /** 存储文件名 */
  filename: string
  /** 原始文件名 */
  originalName: string
  /** 访问 URL */
  url: string
  /** 文件大小（字节） */
  size: number
  /** 上传者 playerId */
  uploadedBy: string
  createdAt: number
}

/** 网格类型 */
export type GridType = 'square' | 'hex'

/** 地图上的 Token（棋子） */
export interface MapToken {
  id: string
  /** 关联角色 ID（可选） */
  characterId?: string
  name: string
  type: 'player' | 'npc' | 'object'
  /** 格子坐标 X（列） */
  x: number
  /** 格子坐标 Y（行） */
  y: number
  /** 图标 URL（可选，无则用颜色填充圆形） */
  imageUrl?: string
  /** 颜色（无图标时填充） */
  color: string
  /** 占用格子数（直径，1=单格） */
  size: number
  /** 是否对玩家可见 */
  isVisible: boolean
  /** 备注（DM 用） */
  notes?: string
}

/** 地图完整状态 */
export interface MapState {
  id: string
  roomId: string
  gridType: GridType
  /** 单格像素大小（世界坐标） */
  gridSize: number
  /** 地图宽度（格数） */
  width: number
  /** 地图高度（格数） */
  height: number
  /** 背景图 URL */
  backgroundUrl: string | null
  tokens: MapToken[]
  /** 迷雾格子列表，格式 "x,y" */
  fogCells: string[]
  updatedAt: number
}

/** 骰子投掷结果 */
export interface DiceRoll {
  id: string
  roomId: string
  rollerId: string
  rollerName: string
  expression: string
  results: number[]
  total: number
  modifier: number
  createdAt: string
}

/** 战斗参与者类型 */
export type CombatParticipantType = 'player' | 'npc'

/** 战斗参与者（与后端 CombatParticipant 对齐） */
export interface CombatParticipant {
  id: string
  /** 关联角色 ID（手动添加的可为空） */
  characterId?: string
  name: string
  type: CombatParticipantType
  /** 先攻值 */
  initiative: number
  /** 当前 HP */
  hp: number
  /** 最大 HP */
  maxHp: number
  /** AC（DND 专用） */
  ac?: number
  /** 状态效果列表 */
  statusEffects: string[]
  /** 备注 */
  notes?: string
}

/** 战斗状态（与后端 CombatState 对齐） */
export interface CombatState {
  id: string
  roomId: string
  /** 是否进行中 */
  isActive: boolean
  /** 当前轮次 */
  round: number
  /** 当前行动索引（participants 数组下标） */
  currentTurn: number
  /** 参与者列表 */
  participants: CombatParticipant[]
  /** 开始时间戳 */
  startedAt: number
  /** 最后更新时间戳 */
  updatedAt: number
}
