import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createInMemoryDb,
  setDbInstance,
  closeDb,
} from '../../src/db/index.js';
import { AssetRepository } from '../../src/db/repositories/AssetRepository.js';
import { roomRepository } from '../../src/db/repositories/RoomRepository.js';
import type { Asset, AssetType } from '../../src/types/models.js';

describe('AssetRepository', () => {
  let repo: AssetRepository;
  let roomId: string;
  let playerId: string;

  beforeEach(() => {
    const db = createInMemoryDb();
    setDbInstance(db);
    repo = new AssetRepository();

    // 创建测试房间与玩家
    const room = roomRepository.create('dnd5e', 'dm-1', 'DM');
    roomId = room.id;
    playerId = 'player-1';
  });

  afterEach(() => {
    closeDb();
  });

  /** 构造测试素材输入 */
  function buildAssetInput(overrides: Partial<Omit<Asset, 'id' | 'createdAt'>> = {}): Omit<Asset, 'id' | 'createdAt'> {
    return {
      roomId,
      type: 'portrait' as AssetType,
      filename: 'test.png',
      originalName: '测试图片.png',
      url: `/uploads/${roomId}/portrait/test.png`,
      size: 1024,
      uploadedBy: playerId,
      ...overrides,
    };
  }

  describe('create', () => {
    it('应创建素材并生成 ID 与时间戳', () => {
      const asset = repo.create(buildAssetInput());
      expect(asset.id).toBeTruthy();
      expect(asset.id.startsWith('asset_')).toBe(true);
      expect(asset.roomId).toBe(roomId);
      expect(asset.type).toBe('portrait');
      expect(asset.filename).toBe('test.png');
      expect(asset.originalName).toBe('测试图片.png');
      expect(asset.url).toContain('test.png');
      expect(asset.size).toBe(1024);
      expect(asset.uploadedBy).toBe(playerId);
      expect(asset.createdAt).toBeGreaterThan(0);
    });

    it('应正确存储不同类型的素材', () => {
      const types: AssetType[] = ['portrait', 'map', 'token', 'other'];
      for (const type of types) {
        const asset = repo.create(buildAssetInput({ type, filename: `${type}.png` }));
        expect(asset.type).toBe(type);
        expect(asset.filename).toBe(`${type}.png`);
      }
    });
  });

  describe('findById', () => {
    it('应按 ID 查询到素材', () => {
      const created = repo.create(buildAssetInput());
      const found = repo.findById(created.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.filename).toBe('test.png');
    });

    it('查询不存在的 ID 应返回 null', () => {
      expect(repo.findById('not-exist')).toBeNull();
    });
  });

  describe('findByRoom', () => {
    it('应返回房间内所有素材', () => {
      repo.create(buildAssetInput({ filename: 'a.png' }));
      repo.create(buildAssetInput({ filename: 'b.png' }));
      const assets = repo.findByRoom(roomId);
      expect(assets).toHaveLength(2);
      // 应包含两个文件（时间戳相同时顺序不保证）
      const filenames = assets.map((a) => a.filename).sort();
      expect(filenames).toEqual(['a.png', 'b.png']);
    });

    it('房间无素材时应返回空数组', () => {
      expect(repo.findByRoom(roomId)).toEqual([]);
    });

    it('应只返回指定房间的素材', () => {
      const otherRoom = roomRepository.create('dnd5e', 'dm-2', 'DM2');
      repo.create(buildAssetInput({ filename: 'room1.png' }));
      repo.create(buildAssetInput({ roomId: otherRoom.id, filename: 'room2.png' }));

      expect(repo.findByRoom(roomId)).toHaveLength(1);
      expect(repo.findByRoom(otherRoom.id)).toHaveLength(1);
    });
  });

  describe('findByRoomAndType', () => {
    it('应返回指定房间与类型的素材', () => {
      repo.create(buildAssetInput({ type: 'portrait', filename: 'p.png' }));
      repo.create(buildAssetInput({ type: 'map', filename: 'm.png' }));
      repo.create(buildAssetInput({ type: 'portrait', filename: 'p2.png' }));

      const portraits = repo.findByRoomAndType(roomId, 'portrait');
      expect(portraits).toHaveLength(2);
      expect(portraits.every((a) => a.type === 'portrait')).toBe(true);

      const maps = repo.findByRoomAndType(roomId, 'map');
      expect(maps).toHaveLength(1);
      expect(maps[0].filename).toBe('m.png');
    });

    it('无匹配类型素材时应返回空数组', () => {
      repo.create(buildAssetInput({ type: 'portrait' }));
      expect(repo.findByRoomAndType(roomId, 'token')).toEqual([]);
    });
  });

  describe('delete', () => {
    it('应删除素材并返回 true', () => {
      const created = repo.create(buildAssetInput());
      const result = repo.delete(created.id);
      expect(result).toBe(true);
      expect(repo.findById(created.id)).toBeNull();
    });

    it('删除不存在的素材应返回 false', () => {
      const result = repo.delete('not-exist');
      expect(result).toBe(false);
    });
  });

  describe('deleteByRoom', () => {
    it('应删除房间内所有素材', () => {
      repo.create(buildAssetInput({ filename: 'a.png' }));
      repo.create(buildAssetInput({ filename: 'b.png' }));
      repo.create(buildAssetInput({ filename: 'c.png' }));

      const result = repo.deleteByRoom(roomId);
      expect(result).toBe(true);
      expect(repo.findByRoom(roomId)).toEqual([]);
    });

    it('房间无素材时应返回 false', () => {
      const result = repo.deleteByRoom(roomId);
      expect(result).toBe(false);
    });
  });
});
