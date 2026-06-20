import { roomRepository } from '../db/repositories/RoomRepository.js';
import { characterRepository } from '../db/repositories/CharacterRepository.js';
import type { Room, RoomPlayer, RuleSystem } from '../types/models.js';
import type { RoomStateEvent } from '../types/socket.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

/**
 * 房间业务逻辑服务
 *
 * 封装房间创建、加入、查询、踢人、重连等业务规则。
 */
export class RoomService {
  /**
   * 创建房间
   * - 自动生成 DM 玩家 ID（UUID v4）
   * - DM 自动加入房间
   * @returns 房间信息与 DM 玩家 ID
   */
  createRoom(params: {
    ruleSystem: RuleSystem;
    dmName: string;
  }): { room: Room; playerId: string } {
    const { ruleSystem, dmName } = params;
    if (!dmName || typeof dmName !== 'string') {
      throw new AppError(400, 'dmName 不能为空');
    }
    if (ruleSystem !== 'dnd5e' && ruleSystem !== 'coc7') {
      throw new AppError(400, 'ruleSystem 必须为 dnd5e 或 coc7');
    }

    const dmId = roomRepository.generatePlayerId();
    const room = roomRepository.create(ruleSystem, dmId, dmName);
    logger.info('房间已创建', { roomId: room.id, code: room.code, dmId });
    return { room, playerId: dmId };
  }

  /**
   * 玩家加入房间
   * - 自动生成玩家 ID（UUID v4）
   * - 校验房间码有效、未满员
   * @returns 房间信息与玩家 ID
   */
  joinRoom(params: {
    code: string;
    playerName: string;
  }): { room: Room; playerId: string } {
    const { code, playerName } = params;
    if (!code || typeof code !== 'string') {
      throw new AppError(400, '房间码不能为空');
    }
    if (!playerName || typeof playerName !== 'string') {
      throw new AppError(400, 'playerName 不能为空');
    }

    const room = roomRepository.findByCode(code);
    if (!room) {
      throw new AppError(404, '房间不存在');
    }

    if (room.players.length >= 6) {
      throw new AppError(409, '房间已满（最多 6 人）');
    }

    const playerId = roomRepository.generatePlayerId();
    const newPlayer: RoomPlayer = {
      id: playerId,
      name: playerName,
      role: 'player',
      joinedAt: Date.now(),
      isConnected: false,
    };

    const updatedRoom = roomRepository.addPlayer(room.id, newPlayer);
    logger.info('玩家加入房间', { roomId: room.id, playerId, playerName });
    return { room: updatedRoom, playerId };
  }

  /**
   * 玩家离开房间
   * - DM 离开则关闭房间（删除房间）
   * - 普通玩家离开则从玩家列表移除
   * @returns 更新后的房间（DM 离开返回 null）
   */
  leaveRoom(params: { roomId: string; playerId: string }): Room | null {
    const { roomId, playerId } = params;
    const room = roomRepository.findById(roomId);
    if (!room) {
      throw new AppError(404, '房间不存在');
    }

    // 校验玩家在房间内
    if (!roomRepository.isPlayerInRoom(roomId, playerId)) {
      throw new AppError(400, '玩家不在房间内');
    }

    // DM 离开则关闭房间
    if (room.dmId === playerId) {
      roomRepository.delete(roomId);
      logger.info('DM 离开，房间已关闭', { roomId, dmId: playerId });
      return null;
    }

    const updatedRoom = roomRepository.removePlayer(roomId, playerId);
    logger.info('玩家离开房间', { roomId, playerId });
    return updatedRoom;
  }

  /**
   * 获取房间完整状态（房间 + 角色 + 在线玩家）
   */
  getRoomState(roomId: string): RoomStateEvent {
    const room = roomRepository.findById(roomId);
    if (!room) {
      throw new AppError(404, '房间不存在');
    }
    const characters = characterRepository.findByRoom(roomId);
    const onlinePlayers = room.players
      .filter((p) => p.isConnected)
      .map((p) => p.id);
    return {
      room,
      characters,
      onlinePlayers,
    };
  }

  /**
   * DM 踢出玩家
   * @param roomId 房间 ID
   * @param dmId DM 玩家 ID（用于权限校验）
   * @param playerId 被踢玩家 ID
   * @returns 更新后的房间
   */
  kickPlayer(params: {
    roomId: string;
    dmId: string;
    playerId: string;
  }): Room {
    const { roomId, dmId, playerId } = params;
    const room = roomRepository.findById(roomId);
    if (!room) {
      throw new AppError(404, '房间不存在');
    }

    // 校验操作者为 DM
    if (room.dmId !== dmId) {
      throw new AppError(403, '仅 DM 可踢出玩家');
    }

    // 不能踢自己
    if (dmId === playerId) {
      throw new AppError(400, 'DM 不能踢出自己');
    }

    // 校验被踢者在房间内
    if (!roomRepository.isPlayerInRoom(roomId, playerId)) {
      throw new AppError(400, '被踢玩家不在房间内');
    }

    const updatedRoom = roomRepository.removePlayer(roomId, playerId);
    if (!updatedRoom) {
      throw new AppError(404, '房间不存在');
    }
    logger.info('DM 踢出玩家', { roomId, dmId, playerId });
    return updatedRoom;
  }

  /**
   * 玩家重连，更新在线状态
   * @returns 更新后的房间
   */
  reconnect(params: { roomId: string; playerId: string }): Room {
    const { roomId, playerId } = params;
    const room = roomRepository.findById(roomId);
    if (!room) {
      throw new AppError(404, '房间不存在');
    }
    if (!roomRepository.isPlayerInRoom(roomId, playerId)) {
      throw new AppError(400, '玩家不在房间内');
    }
    const updatedRoom = roomRepository.updatePlayerConnection(
      roomId,
      playerId,
      true,
    );
    if (!updatedRoom) {
      throw new AppError(404, '房间不存在');
    }
    logger.info('玩家重连', { roomId, playerId });
    return updatedRoom;
  }

  /**
   * 查询房间（按 ID）
   */
  getRoom(roomId: string): Room {
    const room = roomRepository.findById(roomId);
    if (!room) {
      throw new AppError(404, '房间不存在');
    }
    return room;
  }

  /**
   * 按房间码查询
   */
  getRoomByCode(code: string): Room {
    const room = roomRepository.findByCode(code);
    if (!room) {
      throw new AppError(404, '房间不存在');
    }
    return room;
  }

  /**
   * 房间预览信息（供加入前查询，只返回基本信息）
   */
  previewRoom(code: string): {
    ruleSystem: string;
    playerCount: number;
    isFull: boolean;
  } {
    const room = roomRepository.findByCode(code);
    if (!room) {
      throw new AppError(404, '房间不存在');
    }
    return {
      ruleSystem: room.ruleSystem,
      playerCount: room.players.length,
      isFull: room.players.length >= 6,
    };
  }
}

export const roomService = new RoomService();
