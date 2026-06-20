import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createInMemoryDb,
  setDbInstance,
  closeDb,
} from '../../src/db/index.js';
import { RoomService } from '../../src/services/RoomService.js';
import { roomRepository } from '../../src/db/repositories/RoomRepository.js';
import { AppError } from '../../src/middleware/errorHandler.js';

describe('RoomService', () => {
  let service: RoomService;

  beforeEach(() => {
    const db = createInMemoryDb();
    setDbInstance(db);
    service = new RoomService();
  });

  afterEach(() => {
    closeDb();
  });

  describe('createRoom', () => {
    it('应创建房间并自动加入 DM', () => {
      const result = service.createRoom({
        ruleSystem: 'dnd5e',
        dmName: 'DM 玩家',
      });
      expect(result.room).toBeTruthy();
      expect(result.playerId).toBeTruthy();
      expect(result.room.ruleSystem).toBe('dnd5e');
      expect(result.room.players).toHaveLength(1);
      expect(result.room.players[0].id).toBe(result.playerId);
      expect(result.room.players[0].name).toBe('DM 玩家');
      expect(result.room.players[0].role).toBe('dm');
      expect(result.room.dmId).toBe(result.playerId);
    });

    it('应生成 UUID v4 格式的 DM ID', () => {
      const result = service.createRoom({
        ruleSystem: 'coc7',
        dmName: 'DM',
      });
      expect(result.playerId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });

    it('dmName 为空时应抛错', () => {
      expect(() =>
        service.createRoom({ ruleSystem: 'dnd5e', dmName: '' }),
      ).toThrow(AppError);
    });

    it('ruleSystem 无效时应抛错', () => {
      expect(() =>
        service.createRoom({
          ruleSystem: 'invalid' as 'dnd5e',
          dmName: 'DM',
        }),
      ).toThrow(AppError);
    });
  });

  describe('joinRoom', () => {
    it('应加入房间并返回玩家 ID', () => {
      const created = service.createRoom({
        ruleSystem: 'dnd5e',
        dmName: 'DM',
      });
      const result = service.joinRoom({
        code: created.room.code,
        playerName: '玩家1',
      });
      expect(result.room).toBeTruthy();
      expect(result.playerId).toBeTruthy();
      expect(result.room.players).toHaveLength(2);
      const newPlayer = result.room.players.find(
        (p) => p.id === result.playerId,
      );
      expect(newPlayer).toBeTruthy();
      expect(newPlayer?.name).toBe('玩家1');
      expect(newPlayer?.role).toBe('player');
    });

    it('房间不存在时应抛 404', () => {
      expect(() =>
        service.joinRoom({ code: 'NOTEXS', playerName: '玩家1' }),
      ).toThrow(AppError);
      try {
        service.joinRoom({ code: 'NOTEXS', playerName: '玩家1' });
      } catch (err) {
        expect((err as AppError).statusCode).toBe(404);
      }
    });

    it('房间满员时应抛 409', () => {
      const created = service.createRoom({
        ruleSystem: 'dnd5e',
        dmName: 'DM',
      });
      // 添加 5 个玩家达到上限（1 DM + 5 玩家 = 6）
      for (let i = 1; i <= 5; i++) {
        service.joinRoom({
          code: created.room.code,
          playerName: `玩家${i}`,
        });
      }
      // 第 6 个玩家应被拒绝
      try {
        service.joinRoom({
          code: created.room.code,
          playerName: '玩家6',
        });
        expect.fail('应抛出满员错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(409);
      }
    });

    it('playerName 为空时应抛错', () => {
      const created = service.createRoom({
        ruleSystem: 'dnd5e',
        dmName: 'DM',
      });
      expect(() =>
        service.joinRoom({ code: created.room.code, playerName: '' }),
      ).toThrow(AppError);
    });
  });

  describe('leaveRoom', () => {
    it('普通玩家离开应从玩家列表移除', () => {
      const created = service.createRoom({
        ruleSystem: 'dnd5e',
        dmName: 'DM',
      });
      const joined = service.joinRoom({
        code: created.room.code,
        playerName: '玩家1',
      });
      const updated = service.leaveRoom({
        roomId: created.room.id,
        playerId: joined.playerId,
      });
      expect(updated?.players).toHaveLength(1);
      expect(updated?.players.find((p) => p.id === joined.playerId)).toBeUndefined();
    });

    it('DM 离开应关闭房间（返回 null）', () => {
      const created = service.createRoom({
        ruleSystem: 'dnd5e',
        dmName: 'DM',
      });
      const result = service.leaveRoom({
        roomId: created.room.id,
        playerId: created.playerId,
      });
      expect(result).toBeNull();
      // 房间应已删除
      expect(() => service.getRoom(created.room.id)).toThrow(AppError);
    });

    it('房间不存在时应抛 404', () => {
      expect(() =>
        service.leaveRoom({ roomId: 'not-exist', playerId: 'p-1' }),
      ).toThrow(AppError);
    });

    it('玩家不在房间内时应抛错', () => {
      const created = service.createRoom({
        ruleSystem: 'dnd5e',
        dmName: 'DM',
      });
      try {
        service.leaveRoom({
          roomId: created.room.id,
          playerId: 'not-in-room',
        });
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });
  });

  describe('getRoomState', () => {
    it('应返回房间完整状态', () => {
      const created = service.createRoom({
        ruleSystem: 'dnd5e',
        dmName: 'DM',
      });
      const state = service.getRoomState(created.room.id);
      expect(state.room).toBeTruthy();
      expect(state.room.id).toBe(created.room.id);
      expect(state.characters).toEqual([]);
      expect(state.onlinePlayers).toEqual([]);
    });

    it('应包含在线玩家列表', () => {
      const created = service.createRoom({
        ruleSystem: 'dnd5e',
        dmName: 'DM',
      });
      // 模拟 DM 在线
      roomRepository.updatePlayerConnection(
        created.room.id,
        created.playerId,
        true,
      );
      const state = service.getRoomState(created.room.id);
      expect(state.onlinePlayers).toContain(created.playerId);
    });

    it('房间不存在时应抛 404', () => {
      expect(() => service.getRoomState('not-exist')).toThrow(AppError);
    });
  });

  describe('kickPlayer', () => {
    it('DM 应能踢出玩家', () => {
      const created = service.createRoom({
        ruleSystem: 'dnd5e',
        dmName: 'DM',
      });
      const joined = service.joinRoom({
        code: created.room.code,
        playerName: '玩家1',
      });
      const updated = service.kickPlayer({
        roomId: created.room.id,
        dmId: created.playerId,
        playerId: joined.playerId,
      });
      expect(updated.players).toHaveLength(1);
      expect(updated.players.find((p) => p.id === joined.playerId)).toBeUndefined();
    });

    it('非 DM 踢人应抛 403', () => {
      const created = service.createRoom({
        ruleSystem: 'dnd5e',
        dmName: 'DM',
      });
      const p1 = service.joinRoom({
        code: created.room.code,
        playerName: '玩家1',
      });
      const p2 = service.joinRoom({
        code: created.room.code,
        playerName: '玩家2',
      });
      try {
        service.kickPlayer({
          roomId: created.room.id,
          dmId: p1.playerId,
          playerId: p2.playerId,
        });
        expect.fail('应抛出权限错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });

    it('DM 踢自己应抛错', () => {
      const created = service.createRoom({
        ruleSystem: 'dnd5e',
        dmName: 'DM',
      });
      try {
        service.kickPlayer({
          roomId: created.room.id,
          dmId: created.playerId,
          playerId: created.playerId,
        });
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });

    it('踢不在房间内的玩家应抛错', () => {
      const created = service.createRoom({
        ruleSystem: 'dnd5e',
        dmName: 'DM',
      });
      try {
        service.kickPlayer({
          roomId: created.room.id,
          dmId: created.playerId,
          playerId: 'not-in-room',
        });
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });
  });

  describe('reconnect', () => {
    it('应更新玩家在线状态为 true', () => {
      const created = service.createRoom({
        ruleSystem: 'dnd5e',
        dmName: 'DM',
      });
      const updated = service.reconnect({
        roomId: created.room.id,
        playerId: created.playerId,
      });
      const dm = updated.players.find((p) => p.id === created.playerId);
      expect(dm?.isConnected).toBe(true);
    });

    it('玩家不在房间内时应抛错', () => {
      const created = service.createRoom({
        ruleSystem: 'dnd5e',
        dmName: 'DM',
      });
      try {
        service.reconnect({
          roomId: created.room.id,
          playerId: 'not-in-room',
        });
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });
  });

  describe('previewRoom', () => {
    it('应返回房间预览信息', () => {
      const created = service.createRoom({
        ruleSystem: 'dnd5e',
        dmName: 'DM',
      });
      const preview = service.previewRoom(created.room.code);
      expect(preview.ruleSystem).toBe('dnd5e');
      expect(preview.playerCount).toBe(1);
      expect(preview.isFull).toBe(false);
    });

    it('房间满员时 isFull 应为 true', () => {
      const created = service.createRoom({
        ruleSystem: 'dnd5e',
        dmName: 'DM',
      });
      for (let i = 1; i <= 5; i++) {
        service.joinRoom({
          code: created.room.code,
          playerName: `玩家${i}`,
        });
      }
      const preview = service.previewRoom(created.room.code);
      expect(preview.playerCount).toBe(6);
      expect(preview.isFull).toBe(true);
    });

    it('房间不存在时应抛 404', () => {
      expect(() => service.previewRoom('NOTEXS')).toThrow(AppError);
    });
  });
});
