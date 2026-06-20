import http from 'node:http';
import { createApp } from './app.js';
import { getEnv } from './config/env.js';
import { getDb, closeDb } from './db/index.js';
import { initSocketServer } from './socket/index.js';
import { logger } from './utils/logger.js';

/**
 * 应用入口
 *
 * 启动流程：
 * 1. 读取并校验环境变量
 * 2. 初始化 SQLite 数据库
 * 3. 创建 Express 应用
 * 4. 创建 HTTP 服务器
 * 5. 初始化 Socket.IO 服务器
 * 6. 监听端口
 */
function main(): void {
  // 1. 环境变量
  const env = getEnv();
  logger.info('环境变量加载完成', {
    port: env.port,
    uploadDir: env.uploadDir,
    dbPath: env.dbPath,
    corsOrigin: env.corsOrigin,
  });

  // 2. 初始化数据库（触发建表）
  getDb();

  // 3. 创建 Express 应用
  const app = createApp();

  // 4. 创建 HTTP 服务器
  const httpServer = http.createServer(app);

  // 5. 初始化 Socket.IO
  initSocketServer(httpServer, env.corsOrigin);

  // 6. 监听端口
  httpServer.listen(env.port, () => {
    logger.info(`服务器已启动，监听端口 ${env.port}`);
    logger.info(`健康检查: http://localhost:${env.port}/health`);
    logger.info(`静态文件: http://localhost:${env.port}/uploads`);
  });

  // 优雅关闭
  const shutdown = (signal: string): void => {
    logger.info(`收到 ${signal} 信号，开始优雅关闭`);
    httpServer.close(() => {
      closeDb();
      logger.info('服务器已关闭');
      process.exit(0);
    });
    // 5 秒后强制退出
    setTimeout(() => {
      logger.error('优雅关闭超时，强制退出');
      process.exit(1);
    }, 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
