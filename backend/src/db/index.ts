import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { getEnv } from '../config/env.js';
import { SCHEMA_SQL } from './schema.js';
import { logger } from '../utils/logger.js';

let dbInstance: DatabaseType | null = null;

/**
 * 初始化并返回 SQLite 数据库连接（单例）
 * - 自动创建数据库文件
 * - 启用 WAL 模式提升并发性能
 * - 启用外键约束
 * - 执行建表 SQL
 */
export function getDb(): DatabaseType {
  if (dbInstance) {
    return dbInstance;
  }

  const { dbPath } = getEnv();
  logger.info('初始化 SQLite 数据库', { path: dbPath });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // 执行建表
  db.exec(SCHEMA_SQL);
  // 执行增量迁移（为旧版数据库补齐新字段）
  runMigrations(db);
  logger.info('数据库表初始化完成');

  dbInstance = db;
  return db;
}

/**
 * 数据库增量迁移
 *
 * 对已存在的旧表补充新字段。SQLite 的 ALTER TABLE ADD COLUMN 没有 IF NOT EXISTS，
 * 因此先通过 PRAGMA table_info 查询现有列，仅添加缺失列。
 */
function runMigrations(db: DatabaseType): void {
  // stories 表：补充 scenes / npcs / encounters / current_scene / updated_at
  const storyCols = db.prepare('PRAGMA table_info(stories)').all() as
    | { name: string }[]
    | [];
  const storyColNames = new Set(storyCols.map((c) => c.name));

  const storyNewCols: { name: string; def: string }[] = [
    { name: 'scenes', def: "TEXT NOT NULL DEFAULT '[]'" },
    { name: 'npcs', def: "TEXT NOT NULL DEFAULT '[]'" },
    { name: 'encounters', def: "TEXT NOT NULL DEFAULT '[]'" },
    { name: 'current_scene', def: 'TEXT' },
    { name: 'updated_at', def: 'INTEGER NOT NULL DEFAULT 0' },
  ];
  for (const col of storyNewCols) {
    if (!storyColNames.has(col.name)) {
      db.exec(`ALTER TABLE stories ADD COLUMN ${col.name} ${col.def};`);
      logger.info('迁移：stories 表新增列', { column: col.name });
    }
  }
}

/**
 * 关闭数据库连接（用于测试或优雅关闭）
 */
export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    logger.info('数据库连接已关闭');
  }
}

/**
 * 创建内存数据库并执行建表（用于测试隔离）
 * @returns 内存数据库实例
 */
export function createInMemoryDb(): DatabaseType {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  return db;
}

/**
 * 设置数据库实例（用于测试注入内存数据库）
 * 若已存在实例则先关闭
 */
export function setDbInstance(db: DatabaseType): void {
  if (dbInstance) {
    dbInstance.close();
  }
  dbInstance = db;
}

/**
 * 重置数据库单例（用于测试 beforeEach/afterEach）
 * 关闭现有连接，使下次 getDb() 重新初始化
 */
export function resetDb(): void {
  closeDb();
}
