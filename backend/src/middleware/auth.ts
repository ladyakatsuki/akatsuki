import type { Server, Socket } from 'socket.io';
import { roomRepository } from '../db/repositories/RoomRepository.js';
import type { PlayerRole } from '../types/models.js';
import { logger } from '../utils/logger.js';

/**
 * Socket 连接鉴权信息（从 handshake.auth 读取）
 */
export interface SocketAuthPayload {
  roomCode: string;
  playerId: string;
}

/** 挂载到 socket.data 上的鉴权上下文 */
export interface SocketAuthData {
  roomId: string;
  playerId: string;
  role: PlayerRole;
  playerName: string;
}

/**
 * Socket 连接鉴权中间件
 *
 * 校验流程：
 * 1. 从 socket.handshake.auth 读取 roomCode 与 playerId
 * 2. 校验房间码存在
 * 3. 校验玩家在该房间内
 * 4. 校验通过后将 roomId / playerId / role / playerName 挂到 socket.data
 *
 * 校验失败则拒绝连接（callback(new Error('...'))）
 */
export function createAuthMiddleware(): (
  socket: Socket,
  next: (err?: Error) => void,
) => void {
  return (socket, next) => {
    try {
      const auth = socket.handshake.auth as Partial<SocketAuthPayload>;
      const { roomCode, playerId } = auth;

      if (!roomCode || !playerId) {
        logger.warn('Socket 连接缺少 roomCode 或 playerId', { auth });
        return next(new Error('缺少 roomCode 或 playerId'));
      }

      const room = roomRepository.findByCode(roomCode);
      if (!room) {
        logger.warn('Socket 连接房间码无效', { roomCode });
        return next(new Error('房间码无效'));
      }

      // DM 直接放行
      let role: PlayerRole;
      let playerName: string;
      if (room.dmId === playerId) {
        role = 'dm';
        const dmPlayer = room.players.find((p) => p.id === playerId);
        playerName = dmPlayer?.name ?? 'DM';
      } else {
        // 校验玩家是否在房间玩家列表中
        const player = room.players.find((p) => p.id === playerId);
        if (!player) {
          logger.warn('Socket 连接玩家不在房间内', { roomCode, playerId });
          return next(new Error('玩家不在房间内'));
        }
        role = 'player';
        playerName = player.name;
      }

      const authData: SocketAuthData = {
        roomId: room.id,
        playerId,
        role,
        playerName,
      };
      socket.data = { ...socket.data, ...authData };

      logger.info('Socket 鉴权通过', { roomCode, playerId, role, playerName });
      next();
    } catch (err) {
      logger.error('Socket 鉴权异常', err);
      next(err instanceof Error ? err : new Error('鉴权失败'));
    }
  };
}

/**
 * 类型守卫：从 socket.data 中安全读取鉴权信息
 */
export function getSocketAuth(socket: Socket): SocketAuthData | null {
  const data = socket.data as Partial<SocketAuthData> & Record<string, unknown>;
  if (data.roomId && data.playerId && data.role && data.playerName) {
    return {
      roomId: data.roomId,
      playerId: data.playerId,
      role: data.role,
      playerName: data.playerName,
    };
  }
  return null;
}

/**
 * 在事件处理器中获取鉴权信息，缺失则通过 ack 返回错误
 */
export function requireSocketAuth(
  socket: Socket,
): SocketAuthData | { error: string } {
  const auth = getSocketAuth(socket);
  if (!auth) {
    return { error: '未鉴权' };
  }
  return auth;
}

// 引入 Server 类型避免未使用警告（用于扩展 io 类型时参考）
export type { Server };
