import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createInMemoryDb,
  setDbInstance,
  closeDb,
} from '../../src/db/index.js';
import { MapService } from '../../src/services/MapService.js';
import { mapRepository } from '../../src/db/repositories/MapRepository.js';
import { roomRepository } from '../../src/db/repositories/RoomRepository.js';
import { characterRepository } from '../../src/db/repositories/CharacterRepository.js';
import { AppError } from '../../src/middleware/errorHandler.js';
import type { MapToken } from '../../src/types/models.js';

describe('MapService', () => {
  let service: MapService;
  let roomId: string;
  let dmId: string;
  let playerId: string;
  let playerCharacterId: string;

  beforeEach(() => {
    const db = createInMemoryDb();
    setDbInstance(db);
    service = new MapService();

    // 创建测试房间（DM + 1 玩家）
    const room = roomRepository.create('dnd5e', 'dm-1', 'DM');
    roomId = room.id;
    dmId = 'dm-1';
    playerId = 'player-1';
    roomRepository.addPlayer(roomId, {
      id: playerId,
      name: '玩家1',
      role: 'player',
      joinedAt: Date.now(),
    });

    // 为玩家创建角色（用于 Token 关联）
    const character = characterRepository.create({
      roomId,
      playerId,
      name: '英雄',
      ruleSystem: 'dnd5e',
      data: { name: '英雄' },
      portraitUrl: null,
      isNpc: false,
    });
    playerCharacterId = character.id;
  });

  afterEach(() => {
    closeDb();
  });

  /** 构造测试 Token 输入（不含 id） */
  function buildTokenInput(overrides: Partial<Omit<MapToken, 'id'>> = {}): Omit<MapToken, 'id'> {
    return {
      name: '英雄',
      type: 'player' as const,
      x: 0,
      y: 0,
      color: '#ff0000',
      size: 1,
      isVisible: true,
      ...overrides,
    };
  }

  /** 通过 DM 添加一个 Token 并返回 */
  function addToken(input: Omit<MapToken, 'id'>): MapToken {
    const mapState = service.addToken(roomId, dmId, { token: input });
    return mapState.tokens[mapState.tokens.length - 1];
  }

  describe('getMapState', () => {
    it('不存在时应自动创建默认地图', () => {
      const mapState = service.getMapState(roomId);
      expect(mapState.roomId).toBe(roomId);
      expect(mapState.width).toBe(20);
      expect(mapState.height).toBe(20);
      expect(mapState.gridSize).toBe(50);
      expect(mapState.gridType).toBe('square');
      expect(mapState.tokens).toEqual([]);
      expect(mapState.fogCells).toEqual([]);
    });

    it('已存在时应返回现有地图', () => {
      const first = service.getMapState(roomId);
      const second = service.getMapState(roomId);
      expect(second.id).toBe(first.id);
    });

    it('房间不存在时应抛 404', () => {
      try {
        service.getMapState('not-exist');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(404);
      }
    });
  });

  describe('getPlayerMapState', () => {
    it('应过滤不可见 Token', () => {
      service.getMapState(roomId);
      addToken(buildTokenInput({ name: '可见Token', isVisible: true }));
      addToken(buildTokenInput({ name: '隐藏Token', isVisible: false }));

      const playerView = service.getPlayerMapState(roomId);
      expect(playerView.mapState.tokens).toHaveLength(1);
      expect(playerView.mapState.tokens[0].name).toBe('可见Token');
    });

    it('迷雾单元格应原样返回（由前端处理渲染）', () => {
      service.getMapState(roomId);
      service.toggleFog(roomId, dmId, ['0,0', '1,1'], 'add');

      const playerView = service.getPlayerMapState(roomId);
      expect(playerView.mapState.fogCells).toEqual(['0,0', '1,1']);
    });
  });

  describe('moveToken', () => {
    it('玩家应能移动自己的 Token', () => {
      const token = addToken(
        buildTokenInput({ characterId: playerCharacterId }),
      );

      const updated = service.moveToken(roomId, playerId, token.id, 5, 3);
      const movedToken = updated.tokens.find((t) => t.id === token.id);
      expect(movedToken?.x).toBe(5);
      expect(movedToken?.y).toBe(3);
    });

    it('玩家不能移动他人的 Token，应抛 403', () => {
      // 为 DM 创建一个角色
      const dmCharacter = characterRepository.create({
        roomId,
        playerId: dmId,
        name: 'NPC 角色',
        ruleSystem: 'dnd5e',
        data: { name: 'NPC' },
        portraitUrl: null,
        isNpc: true,
      });
      const token = addToken(
        buildTokenInput({ characterId: dmCharacter.id }),
      );

      try {
        service.moveToken(roomId, playerId, token.id, 5, 3);
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });

    it('玩家不能移动无 characterId 的 Token，应抛 403', () => {
      const token = addToken(buildTokenInput({ type: 'object' }));

      try {
        service.moveToken(roomId, playerId, token.id, 5, 3);
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });

    it('DM 可移动所有 Token', () => {
      const token = addToken(
        buildTokenInput({ characterId: playerCharacterId }),
      );

      const updated = service.moveToken(roomId, dmId, token.id, 10, 10);
      const movedToken = updated.tokens.find((t) => t.id === token.id);
      expect(movedToken?.x).toBe(10);
      expect(movedToken?.y).toBe(10);
    });

    it('Token 不存在时应抛 404', () => {
      try {
        service.moveToken(roomId, dmId, 'not-exist', 0, 0);
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(404);
      }
    });
  });

  describe('addToken', () => {
    it('DM 应能添加 Token', () => {
      const mapState = service.addToken(roomId, dmId, {
        token: buildTokenInput({ name: '新Token' }),
      });
      expect(mapState.tokens).toHaveLength(1);
      expect(mapState.tokens[0].name).toBe('新Token');
      expect(mapState.tokens[0].id.startsWith('token_')).toBe(true);
    });

    it('玩家不能添加 Token，应抛 403', () => {
      try {
        service.addToken(roomId, playerId, {
          token: buildTokenInput({ name: '新Token' }),
        });
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });

    it('Token 名称为空时应抛 400', () => {
      try {
        service.addToken(roomId, dmId, {
          token: buildTokenInput({ name: '' }),
        });
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });

    it('Token 类型无效时应抛 400', () => {
      try {
        service.addToken(roomId, dmId, {
          token: buildTokenInput({ type: 'invalid' as MapToken['type'] }),
        });
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });
  });

  describe('removeToken', () => {
    it('DM 应能移除 Token', () => {
      const token = addToken(buildTokenInput({ name: 'Token1' }));
      const mapState = service.removeToken(roomId, dmId, token.id);
      expect(mapState.tokens).toHaveLength(0);
    });

    it('玩家不能移除 Token，应抛 403', () => {
      const token = addToken(buildTokenInput({ name: 'Token1' }));
      try {
        service.removeToken(roomId, playerId, token.id);
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });

    it('Token 不存在时应抛 404', () => {
      try {
        service.removeToken(roomId, dmId, 'not-exist');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(404);
      }
    });
  });

  describe('updateToken', () => {
    it('DM 应能更新 Token', () => {
      const token = addToken(buildTokenInput({ name: '原名' }));
      const updated = service.updateToken(roomId, dmId, token.id, {
        name: '新名',
        isVisible: false,
      });
      expect(updated.name).toBe('新名');
      expect(updated.isVisible).toBe(false);
    });

    it('玩家不能更新 Token，应抛 403', () => {
      const token = addToken(buildTokenInput({ name: 'Token1' }));
      try {
        service.updateToken(roomId, playerId, token.id, { name: '篡改' });
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });

    it('Token 不存在时应抛 404', () => {
      try {
        service.updateToken(roomId, dmId, 'not-exist', { name: '新名' });
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(404);
      }
    });
  });

  describe('toggleFog', () => {
    it('DM 应能添加迷雾', () => {
      service.getMapState(roomId);
      const fogCells = service.toggleFog(roomId, dmId, ['0,0', '1,1'], 'add');
      expect(fogCells).toHaveLength(2);
      expect(fogCells).toContain('0,0');
      expect(fogCells).toContain('1,1');
    });

    it('DM 应能移除迷雾', () => {
      service.getMapState(roomId);
      service.toggleFog(roomId, dmId, ['0,0', '1,1'], 'add');
      const fogCells = service.toggleFog(roomId, dmId, ['0,0'], 'remove');
      expect(fogCells).toHaveLength(1);
      expect(fogCells).toContain('1,1');
    });

    it('添加重复迷雾单元格不应重复', () => {
      service.getMapState(roomId);
      service.toggleFog(roomId, dmId, ['0,0'], 'add');
      const fogCells = service.toggleFog(roomId, dmId, ['0,0'], 'add');
      expect(fogCells).toHaveLength(1);
    });

    it('玩家不能切换迷雾，应抛 403', () => {
      service.getMapState(roomId);
      try {
        service.toggleFog(roomId, playerId, ['0,0'], 'add');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });
  });

  describe('clearFog', () => {
    it('DM 应能清空所有迷雾', () => {
      service.getMapState(roomId);
      service.toggleFog(roomId, dmId, ['0,0', '1,1', '2,2'], 'add');
      const fogCells = service.clearFog(roomId, dmId);
      expect(fogCells).toEqual([]);

      const mapState = mapRepository.findByRoom(roomId);
      expect(mapState?.fogCells).toEqual([]);
    });

    it('玩家不能清空迷雾，应抛 403', () => {
      service.getMapState(roomId);
      try {
        service.clearFog(roomId, playerId);
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });
  });

  describe('setConfig', () => {
    it('DM 应能设置网格类型', () => {
      const mapState = service.setConfig(roomId, dmId, { gridType: 'hex' });
      expect(mapState.gridType).toBe('hex');
    });

    it('DM 应能设置格子大小', () => {
      const mapState = service.setConfig(roomId, dmId, { gridSize: 32 });
      expect(mapState.gridSize).toBe(32);
    });

    it('DM 应能设置宽高', () => {
      const mapState = service.setConfig(roomId, dmId, { width: 30, height: 40 });
      expect(mapState.width).toBe(30);
      expect(mapState.height).toBe(40);
    });

    it('DM 应能设置背景图', () => {
      const mapState = service.setConfig(roomId, dmId, {
        backgroundUrl: '/uploads/bg.png',
      });
      expect(mapState.backgroundUrl).toBe('/uploads/bg.png');
    });

    it('无效网格类型应抛 400', () => {
      try {
        service.setConfig(roomId, dmId, {
          gridType: 'invalid' as 'square',
        });
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });

    it('非正数 gridSize 应抛 400', () => {
      try {
        service.setConfig(roomId, dmId, { gridSize: 0 });
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });

    it('玩家不能设置配置，应抛 403', () => {
      try {
        service.setConfig(roomId, playerId, { gridType: 'hex' });
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });
  });

  describe('setBackground', () => {
    it('DM 应能设置背景图', () => {
      const mapState = service.setBackground(roomId, dmId, '/uploads/bg.png');
      expect(mapState.backgroundUrl).toBe('/uploads/bg.png');
    });

    it('DM 应能清除背景图（传 null）', () => {
      service.setBackground(roomId, dmId, '/uploads/bg.png');
      const mapState = service.setBackground(roomId, dmId, null);
      expect(mapState.backgroundUrl).toBeNull();
    });

    it('玩家不能设置背景图，应抛 403', () => {
      try {
        service.setBackground(roomId, playerId, '/uploads/bg.png');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });
  });

  describe('完整流程', () => {
    it('添加 Token -> 移动 -> 更新 -> 移除 完整流程', () => {
      // 1. 添加 Token
      const token = addToken(
        buildTokenInput({
          name: '英雄',
          characterId: playerCharacterId,
        }),
      );

      // 2. 玩家移动自己的 Token
      const moved = service.moveToken(roomId, playerId, token.id, 5, 5);
      expect(moved.tokens[0].x).toBe(5);

      // 3. DM 更新 Token
      const updated = service.updateToken(roomId, dmId, token.id, {
        isVisible: false,
      });
      expect(updated.isVisible).toBe(false);

      // 4. 玩家视角应看不到该 Token
      const playerView = service.getPlayerMapState(roomId);
      expect(playerView.mapState.tokens).toHaveLength(0);

      // 5. DM 移除 Token
      const afterRemove = service.removeToken(roomId, dmId, token.id);
      expect(afterRemove.tokens).toHaveLength(0);
    });
  });
});
