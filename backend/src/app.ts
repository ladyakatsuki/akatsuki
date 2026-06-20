import express from 'express';
import cors from 'cors';
import { getEnv } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { roomsRouter } from './routes/rooms.js';
import { charactersRouter } from './routes/characters.js';
import { storiesRouter } from './routes/stories.js';
import { assetsRouter } from './routes/assets.js';

/**
 * 创建并配置 Express 应用
 *
 * - 启用 CORS
 * - 解析 JSON 请求体
 * - 静态文件服务（/uploads 映射到 uploads 目录）
 * - 挂载各业务路由
 * - 注册错误处理中间件
 */
export function createApp(): express.Application {
  const env = getEnv();
  const app = express();

  // CORS
  app.use(
    cors({
      origin: env.corsOrigin,
    }),
  );

  // JSON 解析
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  // 静态文件服务：/uploads -> uploads 目录
  app.use('/uploads', express.static(env.uploadDir));

  // 健康检查
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // 业务路由挂载
  app.use('/api/rooms', roomsRouter);
  // 角色路由同时包含 /rooms/:code/characters 与 /characters/:id 两类路径
  app.use('/api', charactersRouter);
  // 故事路由包含 /rooms/:code/story 系列路径
  app.use('/api/rooms', storiesRouter);
  // 素材路由包含 /rooms/:code/assets 路径
  app.use('/api', assetsRouter);

  // 404 处理
  app.use(notFoundHandler);

  // 错误处理（必须最后注册）
  app.use(errorHandler);

  return app;
}
