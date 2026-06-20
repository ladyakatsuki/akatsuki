import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

// 加载 .env 文件（若存在）
dotenv.config();

/**
 * 读取环境变量，未提供默认值时若缺失则抛错
 */
function readEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined || value === '') {
    throw new Error(`环境变量 ${key} 未设置，请在 .env 文件中配置`);
  }
  return value;
}

function readInt(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') {
    return defaultValue;
  }
  const num = Number.parseInt(raw, 10);
  if (Number.isNaN(num)) {
    throw new Error(`环境变量 ${key} 必须为整数，当前值：${raw}`);
  }
  return num;
}

/**
 * 确保目录存在，不存在则递归创建
 */
function ensureDir(dirPath: string): string {
  const absolute = path.resolve(process.cwd(), dirPath);
  fs.mkdirSync(absolute, { recursive: true });
  return absolute;
}

export interface EnvConfig {
  port: number;
  uploadDir: string;
  corsOrigin: string;
  dbPath: string;
}

let cachedConfig: EnvConfig | null = null;

/**
 * 获取并校验环境变量配置（单例）
 */
export function getEnv(): EnvConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const port = readInt('PORT', 3000);
  const uploadDir = readEnv('UPLOAD_DIR', './uploads');
  const corsOrigin = readEnv('CORS_ORIGIN', '*');
  const dbPath = readEnv('DB_PATH', './data/app.db');

  // 运行时目录自动创建
  const absoluteUploadDir = ensureDir(uploadDir);
  const absoluteDbPath = path.resolve(process.cwd(), dbPath);
  ensureDir(path.dirname(absoluteDbPath));

  cachedConfig = {
    port,
    uploadDir: absoluteUploadDir,
    corsOrigin,
    dbPath: absoluteDbPath,
  };

  return cachedConfig;
}

/**
 * 重置环境变量配置缓存（用于测试）
 * 下次调用 getEnv() 将重新读取环境变量
 */
export function resetEnv(): void {
  cachedConfig = null;
}
