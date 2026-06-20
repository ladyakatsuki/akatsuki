/**
 * 数据库建表 SQL
 *
 * 包含以下表：
 * - rooms: 房间
 * - characters: 角色
 * - stories: 故事书
 * - assets: 素材
 * - map_states: 地图状态
 * - combat_states: 战斗状态
 */

/** 所有建表语句，按依赖顺序排列 */
export const SCHEMA_SQL = `
-- 房间表
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY NOT NULL,
  code TEXT UNIQUE NOT NULL,
  rule_system TEXT NOT NULL,
  dm_id TEXT NOT NULL,
  players TEXT NOT NULL DEFAULT '[]',
  story_id TEXT,
  created_at INTEGER NOT NULL
);

-- 角色表
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  name TEXT NOT NULL,
  rule_system TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  portrait_url TEXT,
  is_npc INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_characters_room_id ON characters(room_id);
CREATE INDEX IF NOT EXISTS idx_characters_player_id ON characters(player_id);

-- 故事书表
CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL,
  format TEXT NOT NULL,
  title TEXT NOT NULL,
  chapters TEXT NOT NULL DEFAULT '[]',
  scenes TEXT NOT NULL DEFAULT '[]',
  npcs TEXT NOT NULL DEFAULT '[]',
  encounters TEXT NOT NULL DEFAULT '[]',
  current_chapter INTEGER NOT NULL DEFAULT 0,
  current_scene TEXT,
  assets TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stories_room_id ON stories(room_id);

-- 素材表
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT NOT NULL,
  type TEXT NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  url TEXT NOT NULL,
  size INTEGER NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_assets_room_id ON assets(room_id);

-- 地图状态表（每个房间一条）
CREATE TABLE IF NOT EXISTS map_states (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT UNIQUE NOT NULL,
  grid_type TEXT NOT NULL DEFAULT 'square',
  grid_size INTEGER NOT NULL DEFAULT 50,
  width INTEGER NOT NULL DEFAULT 20,
  height INTEGER NOT NULL DEFAULT 20,
  background_url TEXT,
  tokens TEXT NOT NULL DEFAULT '[]',
  fog_cells TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL
);

-- 战斗状态表（每个房间一条）
CREATE TABLE IF NOT EXISTS combat_states (
  id TEXT PRIMARY KEY NOT NULL,
  room_id TEXT UNIQUE NOT NULL,
  current_turn INTEGER NOT NULL DEFAULT 0,
  round INTEGER NOT NULL DEFAULT 0,
  participants TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
`;
