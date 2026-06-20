import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/socket.js';
import { getSocketAuth } from '../middleware/auth.js';
import { requireDm } from '../middleware/permission.js';
import { roomRepository } from '../db/repositories/RoomRepository.js';
import { roomService } from '../services/RoomService.js';
import { logger } from '../utils/logger.js';

/** Socket 服务器类型 */
export type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;
/** Socket 客户端类型 */
export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/**
 * 注册房间事件处理器
 *
 * 事件：
 * - room:join    加入 Socket.IO room，广播 playerJoined，向加入者发送 state
 * - room:leave   离开，广播 playerLeft，从 Socket.IO room 移除
 * - disconnect   断线，更新在线状态，广播 playerDisconnected（不移除玩家，允许重连）
 * - room:kick    DM 踢人，校验权限，广播 playerKicked，从房间移除被踢者
 */
export function registerRoomHandler(io: AppServer, socket: AppSocket): void {
  const auth = getSocketAuth(socket);
  if (!auth) {
    logger.warn('[roomHandler] Socket 未鉴权', { socketId: socket.id });
    return;
  }
  const { roomId, playerId, playerName, role } = auth;

  // ============ room:join ============
  socket.on('room:join', (payload, ack) => {
    try {
      // 校验 roomId 一致（auth 中已校验过，这里仅防御）
      if (payload.roomId !== roomId) {
        ack({ ok: false, error: 'roomId 与鉴权信息不匹配' });
        return;
      }

      // 加入 Socket.IO room
      void socket.join(roomId);

      // 更新在线状态为 true
      roomRepository.updatePlayerConnection(roomId, playerId, true);

      // 向加入者发送房间完整状态
      const state = roomService.getRoomState(roomId);
      socket.emit('room:state', state);

      // 广播给房间内其他人
      socket.to(roomId).emit('room:playerJoined', {
        player: { id: playerId, name: playerName },
      });

      logger.info('[room:join] 玩家加入 Socket 房间', {
        socketId: socket.id,
        roomId,
        playerId,
        role,
      });
      ack({ ok: true });
    } catch (err) {
      logger.error('[room:join] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '加入房间失败',
      });
    }
  });

  // ============ room:leave ============
  socket.on('room:leave', (ack) => {
    try {
      // 广播给房间内其他人
      socket.to(roomId).emit('room:playerLeft', { playerId });

      // 从 Socket.IO room 移除
      void socket.leave(roomId);

      // 更新在线状态为 false
      roomRepository.updatePlayerConnection(roomId, playerId, false);

      logger.info('[room:leave] 玩家离开 Socket 房间', {
        socketId: socket.id,
        roomId,
        playerId,
      });
      ack({ ok: true });
    } catch (err) {
      logger.error('[room:leave] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '离开房间失败',
      });
    }
  });

  // ============ room:kick ============
  socket.on('room:kick', (payload, ack) => {
    try {
      // 校验 DM 权限
      const dmCheck = requireDm(socket);
      if (!dmCheck.ok) {
        ack({ ok: false, error: dmCheck.error });
        return;
      }

      const { playerId: targetPlayerId } = payload;
      if (!targetPlayerId) {
        ack({ ok: false, error: '缺少参数: playerId' });
        return;
      }

      // 不能踢自己
      if (targetPlayerId === playerId) {
        ack({ ok: false, error: 'DM 不能踢出自己' });
        return;
      }

      // 通过 Service 执行踢出逻辑（含权限与存在性校验）
      roomService.kickPlayer({ roomId, dmId: playerId, playerId: targetPlayerId });

      // 找到被踢者的 socket 并通知
      const sockets = io.sockets.sockets;
      for (const [, s] of sockets) {
        const sAuth = getSocketAuth(s);
        if (sAuth && sAuth.playerId === targetPlayerId && sAuth.roomId === roomId) {
          s.emit('room:playerKicked', { playerId: targetPlayerId, by: playerId });
          // 强制断开被踢者连接
          s.disconnect(true);
          break;
        }
      }

      // 广播给房间内其他人
      socket.to(roomId).emit('room:playerLeft', { playerId: targetPlayerId });

      logger.info('[room:kick] DM 踢出玩家', {
        socketId: socket.id,
        roomId,
        dmId: playerId,
        targetPlayerId,
      });
      ack({ ok: true });
    } catch (err) {
      logger.error('[room:kick] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '踢出玩家失败',
      });
    }
  });

  // ============ disconnect ============
  socket.on('disconnect', (reason) => {
    try {
      // 更新在线状态为 false（不移除玩家，允许重连）
      roomRepository.updatePlayerConnection(roomId, playerId, false);

      // 广播给房间内其他人
      socket.to(roomId).emit('room:playerDisconnected', { playerId });

      logger.info('[disconnect] 玩家断线', {
        socketId: socket.id,
        roomId,
        playerId,
        reason,
      });
    } catch (err) {
      logger.error('[disconnect] 处理失败', err);
    }
  });

  // ============ room:sync ============
  socket.on('room:sync', (payload, ack) => {
    try {
      // 通用状态同步：广播给房间内其他人
      // 具体业务事件（角色/地图/战斗等）由各自 handler 处理，这里仅作通用转发
      logger.debug('[room:sync] 收到状态变更', {
        socketId: socket.id,
        roomId,
        type: payload.type,
      });
      ack({ ok: true });
    } catch (err) {
      logger.error('[room:sync] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '同步状态失败',
      });
    }
  });
}
