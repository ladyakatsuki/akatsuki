import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createInMemoryDb,
  setDbInstance,
  closeDb,
} from '../../src/db/index.js';
import {
  MapRepository,
  DEFAULT_MAP_WIDTH,
  DEFAULT_MAP_HEIGHT,
  DEFAULT_GRID_SIZE,
  DEFAULT_GRID_TYPE,
} from '../../src/db/repositories/MapRepository.js';
import { roomRepository } from '../../src/db/repositories/RoomRepository.js';
import type { MapToken } from '../../src/types/models.js';

describe('MapRepository', () => {
  let repo: MapRepository;
  let roomId: string;

  beforeEach(() => {
    const db = createInMemoryDb();
    setDbInstance(db);
    repo = new MapRepository();

    // 创建测试房间
    const room = roomRepository.create('dnd5e', 'dm-1', 'DM');
    roomId = room.id;
  });

  afterEach(() => {
    closeDb();
  });

  /** 构造测试 Token */
  function buildToken(overrides: Partial<MapToken> = {}): MapToken {
    return {
      id: 'token-1',
      name: '英雄',
      type: 'player',
      x: 0,
      y: 0,
      color: '#ff0000',
      size: 1,
      isVisible: true,
      ...overrides,
    };
  }

  describe('create', () => {
    it('应创建默认地图状态（20x20 方格，50px）', () => {
      const mapState = repo.create(roomId);
      expect(mapState.id).toBeTruthy();
      expect(mapState.id.startsWith('map_')).toBe(true);
      expect(mapState.roomId).toBe(roomId);
      expect(mapState.gridType).toBe(DEFAULT_GRID_TYPE);
      expect(mapState.gridType).toBe('square');
      expect(mapState.gridSize).toBe(DEFAULT_GRID_SIZE);
      expect(mapState.gridSize).toBe(50);
      expect(mapState.width).toBe(DEFAULT_MAP_WIDTH);
      expect(mapState.width).toBe(20);
      expect(mapState.height).toBe(DEFAULT_MAP_HEIGHT);
      expect(mapState.height).toBe(20);
      expect(mapState.backgroundUrl).toBeNull();
      expect(mapState.tokens).toEqual([]);
      expect(mapState.fogCells).toEqual([]);
      expect(mapState.updatedAt).toBeGreaterThan(0);
    });
  });

  describe('findByRoom', () => {
    it('应按房间 ID 查询到地图状态', () => {
      const created = repo.create(roomId);
      const found = repo.findByRoom(roomId);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.roomId).toBe(roomId);
    });

    it('查询不存在的房间应返回 null', () => {
      expect(repo.findByRoom('not-exist')).toBeNull();
    });
  });

  describe('update', () => {
    it('应更新网格类型', () => {
      repo.create(roomId);
      const updated = repo.update(roomId, { gridType: 'hex' });
      expect(updated).not.toBeNull();
      expect(updated?.gridType).toBe('hex');
    });

    it('应更新格子大小', () => {
      repo.create(roomId);
      const updated = repo.update(roomId, { gridSize: 32 });
      expect(updated).not.toBeNull();
      expect(updated?.gridSize).toBe(32);
    });

    it('应更新宽高', () => {
      repo.create(roomId);
      const updated = repo.update(roomId, { width: 30, height: 40 });
      expect(updated).not.toBeNull();
      expect(updated?.width).toBe(30);
      expect(updated?.height).toBe(40);
    });

    it('应更新背景图 URL', () => {
      repo.create(roomId);
      const updated = repo.update(roomId, { backgroundUrl: '/uploads/bg.png' });
      expect(updated).not.toBeNull();
      expect(updated?.backgroundUrl).toBe('/uploads/bg.png');
    });

    it('应更新 Token 列表', () => {
      repo.create(roomId);
      const token = buildToken();
      const updated = repo.update(roomId, { tokens: [token] });
      expect(updated).not.toBeNull();
      expect(updated?.tokens).toHaveLength(1);
      expect(updated?.tokens[0].id).toBe('token-1');
    });

    it('应更新迷雾单元格', () => {
      repo.create(roomId);
      const updated = repo.update(roomId, { fogCells: ['0,0', '1,1'] });
      expect(updated).not.toBeNull();
      expect(updated?.fogCells).toEqual(['0,0', '1,1']);
    });

    it('应同步更新 updatedAt 时间戳', () => {
      const created = repo.create(roomId);
      // 确保时间戳有差异
      const updated = repo.update(roomId, { gridSize: 32 });
      expect(updated).not.toBeNull();
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
    });

    it('空 patch 应返回当前地图状态', () => {
      const created = repo.create(roomId);
      const updated = repo.update(roomId, {});
      expect(updated).not.toBeNull();
      expect(updated?.id).toBe(created.id);
    });

    it('更新不存在的房间应返回 null', () => {
      const updated = repo.update('not-exist', { gridSize: 32 });
      expect(updated).toBeNull();
    });
  });

  describe('upsert', () => {
    it('不存在时应创建默认地图', () => {
      const mapState = repo.upsert(roomId);
      expect(mapState.roomId).toBe(roomId);
      expect(mapState.width).toBe(20);
      expect(mapState.tokens).toEqual([]);
    });

    it('已存在时应返回现有地图（不重复创建）', () => {
      const first = repo.upsert(roomId);
      // 修改一下
      repo.update(roomId, { gridSize: 32 });
      const second = repo.upsert(roomId);
      expect(second.id).toBe(first.id);
      expect(second.gridSize).toBe(32);
    });
  });

  describe('delete', () => {
    it('应删除地图状态并返回 true', () => {
      repo.create(roomId);
      const result = repo.delete(roomId);
      expect(result).toBe(true);
      expect(repo.findByRoom(roomId)).toBeNull();
    });

    it('删除不存在的地图应返回 false', () => {
      const result = repo.delete(roomId);
      expect(result).toBe(false);
    });
  });

  describe('Token 与迷雾的持久化', () => {
    it('应正确持久化与读取 Token 列表', () => {
      repo.create(roomId);
      const tokens: MapToken[] = [
        buildToken({ id: 't1', name: '英雄', x: 5, y: 3 }),
        buildToken({ id: 't2', name: 'NPC', type: 'npc', isVisible: false }),
      ];
      repo.update(roomId, { tokens });

      const found = repo.findByRoom(roomId);
      expect(found?.tokens).toHaveLength(2);
      expect(found?.tokens[0].id).toBe('t1');
      expect(found?.tokens[0].x).toBe(5);
      expect(found?.tokens[1].isVisible).toBe(false);
    });

    it('应正确持久化与读取迷雾单元格', () => {
      repo.create(roomId);
      const fogCells = ['0,0', '1,2', '3,4'];
      repo.update(roomId, { fogCells });

      const found = repo.findByRoom(roomId);
      expect(found?.fogCells).toEqual(fogCells);
    });
  });
});
