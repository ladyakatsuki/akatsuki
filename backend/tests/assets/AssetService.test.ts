import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  createInMemoryDb,
  setDbInstance,
  closeDb,
} from '../../src/db/index.js';
import { AssetService } from '../../src/services/AssetService.js';
import { assetRepository } from '../../src/db/repositories/AssetRepository.js';
import { roomRepository } from '../../src/db/repositories/RoomRepository.js';
import { getEnv, resetEnv } from '../../src/config/env.js';
import { AppError } from '../../src/middleware/errorHandler.js';
import type { AssetType } from '../../src/types/models.js';

describe('AssetService', () => {
  let service: AssetService;
  let roomId: string;
  let dmId: string;
  let playerId: string;
  let tempUploadDir: string;

  beforeEach(() => {
    const db = createInMemoryDb();
    setDbInstance(db);
    service = new AssetService();

    // 使用临时目录作为上传目录
    tempUploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-test-uploads-'));
    resetEnv();
    process.env.UPLOAD_DIR = tempUploadDir;
    process.env.DB_PATH = ':memory:';

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
  });

  afterEach(() => {
    closeDb();
    // 清理临时目录
    if (tempUploadDir && fs.existsSync(tempUploadDir)) {
      fs.rmSync(tempUploadDir, { recursive: true, force: true });
    }
    resetEnv();
    delete process.env.UPLOAD_DIR;
    delete process.env.DB_PATH;
  });

  /** 构造测试文件信息（模拟已上传到磁盘的文件） */
  function buildUploadedFile(filename: string = 'test.png'): {
    filename: string;
    path: string;
    size: number;
    mimetype: string;
    originalName: string;
  } {
    const filePath = path.join(tempUploadDir, roomId, 'portrait', filename);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, Buffer.from('fake-png-data'));
    return {
      filename,
      path: filePath,
      size: 1024,
      mimetype: 'image/png',
      originalName: filename,
    };
  }

  describe('upload', () => {
    it('DM 应能上传素材', () => {
      const file = buildUploadedFile();
      const asset = service.upload(roomId, dmId, file, 'portrait');
      expect(asset.id).toBeTruthy();
      expect(asset.roomId).toBe(roomId);
      expect(asset.type).toBe('portrait');
      expect(asset.filename).toBe('test.png');
      expect(asset.originalName).toBe('test.png');
      expect(asset.url).toContain('test.png');
      expect(asset.url).toContain('/uploads/');
      expect(asset.size).toBe(1024);
      expect(asset.uploadedBy).toBe(dmId);
    });

    it('玩家上传应抛 403', () => {
      const file = buildUploadedFile();
      try {
        service.upload(roomId, playerId, file, 'portrait');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });

    it('房间不存在应抛 404', () => {
      const file = buildUploadedFile();
      try {
        service.upload('not-exist', dmId, file, 'portrait');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(404);
      }
    });

    it('无效的素材类型应抛 400', () => {
      const file = buildUploadedFile();
      try {
        service.upload(roomId, dmId, file, 'invalid' as AssetType);
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });

    it('应支持所有合法类型', () => {
      const types: AssetType[] = ['portrait', 'map', 'token', 'other'];
      for (const type of types) {
        const file = buildUploadedFile(`${type}.png`);
        const asset = service.upload(roomId, dmId, file, type);
        expect(asset.type).toBe(type);
      }
    });
  });

  describe('getByRoom', () => {
    it('应返回房间内所有素材', () => {
      const file1 = buildUploadedFile('a.png');
      const file2 = buildUploadedFile('b.png');
      service.upload(roomId, dmId, file1, 'portrait');
      service.upload(roomId, dmId, file2, 'map');

      const assets = service.getByRoom(roomId);
      expect(assets).toHaveLength(2);
    });

    it('房间无素材时应返回空数组', () => {
      expect(service.getByRoom(roomId)).toEqual([]);
    });
  });

  describe('getByRoomAndType', () => {
    it('应返回指定类型的素材', () => {
      service.upload(roomId, dmId, buildUploadedFile('p1.png'), 'portrait');
      service.upload(roomId, dmId, buildUploadedFile('m1.png'), 'map');
      service.upload(roomId, dmId, buildUploadedFile('p2.png'), 'portrait');

      const portraits = service.getByRoomAndType(roomId, 'portrait');
      expect(portraits).toHaveLength(2);
      expect(portraits.every((a) => a.type === 'portrait')).toBe(true);

      const maps = service.getByRoomAndType(roomId, 'map');
      expect(maps).toHaveLength(1);
    });

    it('无效类型应抛 400', () => {
      try {
        service.getByRoomAndType(roomId, 'invalid' as AssetType);
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });
  });

  describe('delete', () => {
    it('DM 应能删除素材', () => {
      const file = buildUploadedFile();
      const asset = service.upload(roomId, dmId, file, 'portrait');

      const result = service.delete(roomId, dmId, asset.id);
      expect(result).toBe(true);
      expect(assetRepository.findById(asset.id)).toBeNull();
    });

    it('删除时应同时删除磁盘文件', () => {
      const file = buildUploadedFile();
      const asset = service.upload(roomId, dmId, file, 'portrait');
      expect(fs.existsSync(file.path)).toBe(true);

      service.delete(roomId, dmId, asset.id);
      expect(fs.existsSync(file.path)).toBe(false);
    });

    it('玩家删除应抛 403', () => {
      const file = buildUploadedFile();
      const asset = service.upload(roomId, dmId, file, 'portrait');
      try {
        service.delete(roomId, playerId, asset.id);
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });

    it('素材不存在应抛 404', () => {
      try {
        service.delete(roomId, dmId, 'not-exist');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(404);
      }
    });

    it('房间不存在应抛 404', () => {
      try {
        service.delete('not-exist', dmId, 'any-id');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(404);
      }
    });

    it('素材不属于该房间应抛 403', () => {
      // 创建另一个房间
      const otherRoom = roomRepository.create('dnd5e', 'dm-2', 'DM2');
      const file = buildUploadedFile();
      const asset = service.upload(otherRoom.id, 'dm-2', file, 'portrait');

      try {
        service.delete(roomId, dmId, asset.id);
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });
  });

  describe('完整流程', () => {
    it('上传 -> 查询 -> 删除 完整流程', () => {
      // 1. 上传
      const file1 = buildUploadedFile('portrait1.png');
      const file2 = buildUploadedFile('map1.png');
      const a1 = service.upload(roomId, dmId, file1, 'portrait');
      const a2 = service.upload(roomId, dmId, file2, 'map');

      // 2. 查询所有
      const all = service.getByRoom(roomId);
      expect(all).toHaveLength(2);

      // 3. 按类型查询
      const portraits = service.getByRoomAndType(roomId, 'portrait');
      expect(portraits).toHaveLength(1);
      expect(portraits[0].id).toBe(a1.id);

      // 4. 删除
      service.delete(roomId, dmId, a1.id);
      expect(service.getByRoom(roomId)).toHaveLength(1);

      // 5. 删除最后一个
      service.delete(roomId, dmId, a2.id);
      expect(service.getByRoom(roomId)).toHaveLength(0);
    });
  });
});
