import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import type { Server as HttpServer } from 'http';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/socket.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { registerRoomHandler } from './roomHandler.js';
import { registerCharacterHandler } from './characterHandler.js';
import { registerDiceHandler } from './diceHandler.js';
import { registerCombatHandler } from './combatHandler.js';
import { registerMapHandler } from './mapHandler.js';
import { registerStoryHandler } from './storyHandler.js';

/** Socket 服务器类型 */
export type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;
/** Socket 客户端类型 */
export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/**
 * 初始化 Socket.IO 服务器并注册所有事件处理器
 *
 * @param httpServer HTTP 服务器实例
 * @param corsOrigin CORS 允许来源
 */
export function initSocketServer(httpServer: HttpServer, corsOrigin: string): AppServer {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
    },
  });

  // 注册鉴权中间件
  io.use(createAuthMiddleware());

  io.on('connection', (socket) => {
    const auth = socket.data as { roomId?: string; playerId?: string; role?: string };
    logger.info('Socket 已连接', {
      socketId: socket.id,
      roomId: auth.roomId,
      playerId: auth.playerId,
      role: auth.role,
    });

    // 加入房间 Socket.IO room（以 roomId 命名）
    if (auth.roomId) {
      void socket.join(auth.roomId);
    }

    // 注册各业务事件处理器
    registerRoomHandler(io, socket);
    registerCharacterHandler(io, socket);
    registerDiceHandler(io, socket);
    registerCombatHandler(io, socket);
    registerMapHandler(io, socket);
    registerStoryHandler(io, socket);

    socket.on('disconnect', (reason) => {
      logger.info('Socket 已断开', { socketId: socket.id, reason });
    });

    socket.on('error', (err) => {
      logger.error('Socket 错误', { socketId: socket.id, error: err.message });
    });
  });

  return io;
}
