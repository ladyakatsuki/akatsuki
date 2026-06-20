import type { AppServer, AppSocket } from './index.js';
import { getSocketAuth } from '../middleware/auth.js';
import { characterService } from '../services/CharacterService.js';
import { roomRepository } from '../db/repositories/RoomRepository.js';
import { logger } from '../utils/logger.js';
import type { Character } from '../types/models.js';

/**
 * 注册角色事件处理器
 *
 * 事件：
 * - character:update     更新角色基本信息，广播 character:updated
 * - character:updateData 更新角色卡数据，广播 character:dataUpdated
 * - character:create     创建角色，广播 character:created
 * - character:delete     删除角色，广播 character:deleted
 * - character:share      共享角色卡（占位）
 */
export function registerCharacterHandler(io: AppServer, socket: AppSocket): void {
  const auth = getSocketAuth(socket);
  if (!auth) {
    logger.warn('[characterHandler] Socket 未鉴权', { socketId: socket.id });
    return;
  }
  const { roomId, playerId } = auth;

  // ============ character:update ============
  socket.on('character:update', (payload, ack) => {
    try {
      const { characterId, patch } = payload;
      if (!characterId) {
        ack({ ok: false, error: '缺少参数: characterId' });
        return;
      }
      const character = characterService.updateCharacter(characterId, playerId, patch);

      // 广播给全房间（含发送者）
      io.to(roomId).emit('character:updated', { character });
      logger.info('[character:update] 角色已更新', {
        socketId: socket.id,
        roomId,
        characterId,
        playerId,
      });
      ack({ ok: true, data: character });
    } catch (err) {
      logger.error('[character:update] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '更新角色失败',
      });
    }
  });

  // ============ character:updateData ============
  socket.on('character:updateData', (payload, ack) => {
    try {
      const { characterId, data } = payload;
      if (!characterId) {
        ack({ ok: false, error: '缺少参数: characterId' });
        return;
      }
      if (!data || typeof data !== 'object') {
        ack({ ok: false, error: '缺少参数: data' });
        return;
      }
      const character = characterService.updateCharacterData(characterId, playerId, data);

      // 广播给全房间
      io.to(roomId).emit('character:dataUpdated', {
        characterId,
        data: character.data,
      });
      logger.info('[character:updateData] 角色卡数据已更新', {
        socketId: socket.id,
        roomId,
        characterId,
        playerId,
      });
      ack({ ok: true, data: character });
    } catch (err) {
      logger.error('[character:updateData] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '更新角色卡数据失败',
      });
    }
  });

  // ============ character:create ============
  socket.on('character:create', (payload, ack) => {
    try {
      const { name, isNpc } = payload;
      if (!name || typeof name !== 'string') {
        ack({ ok: false, error: '缺少参数: name' });
        return;
      }

      // 获取房间信息以确定规则系统
      const room = roomRepository.findById(roomId);
      if (!room) {
        ack({ ok: false, error: '房间不存在' });
        return;
      }

      const character: Character = characterService.createCharacter({
        roomId,
        playerId,
        ruleSystem: room.ruleSystem,
        name,
        isNpc: isNpc ?? false,
      });

      // 广播给全房间
      io.to(roomId).emit('character:created', { character });
      logger.info('[character:create] 角色已创建', {
        socketId: socket.id,
        roomId,
        characterId: character.id,
        playerId,
      });
      ack({ ok: true, data: character });
    } catch (err) {
      logger.error('[character:create] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '创建角色失败',
      });
    }
  });

  // ============ character:delete ============
  socket.on('character:delete', (payload, ack) => {
    try {
      const { characterId } = payload;
      if (!characterId) {
        ack({ ok: false, error: '缺少参数: characterId' });
        return;
      }
      characterService.deleteCharacter(characterId, playerId);

      // 广播给全房间
      io.to(roomId).emit('character:deleted', { characterId });
      logger.info('[character:delete] 角色已删除', {
        socketId: socket.id,
        roomId,
        characterId,
        playerId,
      });
      ack({ ok: true });
    } catch (err) {
      logger.error('[character:delete] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '删除角色失败',
      });
    }
  });

  // ============ character:share ============
  socket.on('character:share', (payload, ack) => {
    try {
      const { characterId } = payload;
      if (!characterId) {
        ack({ ok: false, error: '缺少参数: characterId' });
        return;
      }
      // 共享角色卡：获取角色并广播给房间
      const character = characterService.getCharacter(characterId);
      io.to(roomId).emit('character:updated', { character });
      logger.info('[character:share] 角色已共享', {
        socketId: socket.id,
        roomId,
        characterId,
        playerId,
      });
      ack({ ok: true });
    } catch (err) {
      logger.error('[character:share] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '共享角色失败',
      });
    }
  });
}
