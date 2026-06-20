import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  createInMemoryDb,
  setDbInstance,
  closeDb,
} from '../../src/db/index.js';
import { assetsRouter } from '../../src/routes/assets.js';
import { roomsRouter } from '../../src/routes/rooms.js';
import { errorHandler, notFoundHandler } from '../../src/middleware/errorHandler.js';
import { resetEnv } from '../../src/config/env.js';
import { roomRepository } from '../../src/db/repositories/RoomRepository.js';

/**
 * 构建测试用 Express 应用
 * 挂载房间与素材路由，使用临时上传目录
 */
function buildTestApp(): express.Application {
  const app = express();
  app.use(express.json());
  app.use('/api/rooms', roomsRouter);
  app.use('/api', assetsRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('素材路由 /api/rooms/:code/assets', () => {
  let app: express.Application;
  let roomCode: string;
  let roomId: string;
  let dmId: string;
  let playerId: string;
  let tempUploadDir: string;

  beforeEach(() => {
    const db = createInMemoryDb();
    setDbInstance(db);

    // 使用临时目录作为上传目录
    tempUploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-route-uploads-'));
    resetEnv();
    process.env.UPLOAD_DIR = tempUploadDir;
    process.env.DB_PATH = ':memory:';

    app = buildTestApp();

    // 创建测试房间
    const room = roomRepository.create('dnd5e', 'dm-1', 'DM');
    roomCode = room.code;
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

  /** 创建临时图片文件 */
  function createTempImage(name: string = 'test.png'): string {
    const tempFile = path.join(os.tmpdir(), name);
    fs.writeFileSync(tempFile, Buffer.from('fake-png-data'));
    return tempFile;
  }

  describe('POST /api/rooms/:code/assets - 上传素材', () => {
    it('DM 应能上传素材并返回 201', async () => {
      const tempFile = createTempImage();
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/assets?playerId=${dmId}&type=portrait`)
        .attach('file', tempFile)
        .expect(201);

      expect(res.body.ok).toBe(true);
      expect(res.body.data.id).toBeTruthy();
      expect(res.body.data.roomId).toBe(roomId);
      expect(res.body.data.type).toBe('portrait');
      expect(res.body.data.filename).toBeTruthy();
      expect(res.body.data.originalName).toBe('test.png');
      expect(res.body.data.url).toContain('/uploads/');
      expect(res.body.data.size).toBeGreaterThan(0);
      expect(res.body.data.uploadedBy).toBe(dmId);

      fs.unlinkSync(tempFile);
    });

    it('玩家上传应返回 403', async () => {
      const tempFile = createTempImage();
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/assets?playerId=${playerId}&type=portrait`)
        .attach('file', tempFile)
        .expect(403);

      expect(res.body.ok).toBe(false);
      fs.unlinkSync(tempFile);
    });

    it('缺少 playerId 应返回 400', async () => {
      const tempFile = createTempImage();
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/assets?type=portrait`)
        .attach('file', tempFile)
        .expect(400);

      expect(res.body.ok).toBe(false);
      fs.unlinkSync(tempFile);
    });

    it('缺少 type 应返回 400', async () => {
      const tempFile = createTempImage();
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/assets?playerId=${dmId}`)
        .attach('file', tempFile)
        .expect(400);

      expect(res.body.ok).toBe(false);
      fs.unlinkSync(tempFile);
    });

    it('无效的 type 应返回 400', async () => {
      const tempFile = createTempImage();
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/assets?playerId=${dmId}&type=invalid`)
        .attach('file', tempFile)
        .expect(400);

      expect(res.body.ok).toBe(false);
      fs.unlinkSync(tempFile);
    });

    it('缺少文件应返回 400', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/assets?playerId=${dmId}&type=portrait`)
        .expect(400);

      expect(res.body.ok).toBe(false);
    });

    it('房间不存在应返回 404', async () => {
      const tempFile = createTempImage();
      const res = await request(app)
        .post('/api/rooms/NOTEXS/assets?playerId=p1&type=portrait')
        .attach('file', tempFile)
        .expect(404);

      expect(res.body.ok).toBe(false);
      fs.unlinkSync(tempFile);
    });

    it('应支持不同类型上传', async () => {
      const types = ['portrait', 'map', 'token', 'other'];
      for (const type of types) {
        const tempFile = createTempImage(`${type}.png`);
        const res = await request(app)
          .post(`/api/rooms/${roomCode}/assets?playerId=${dmId}&type=${type}`)
          .attach('file', tempFile)
          .expect(201);

        expect(res.body.data.type).toBe(type);
        fs.unlinkSync(tempFile);
      }
    });
  });

  describe('GET /api/rooms/:code/assets - 获取房间所有素材', () => {
    it('应返回房间内所有素材', async () => {
      // 上传 2 个素材
      const tempFile1 = createTempImage('a.png');
      const tempFile2 = createTempImage('b.png');
      await request(app)
        .post(`/api/rooms/${roomCode}/assets?playerId=${dmId}&type=portrait`)
        .attach('file', tempFile1);
      await request(app)
        .post(`/api/rooms/${roomCode}/assets?playerId=${dmId}&type=map`)
        .attach('file', tempFile2);

      const res = await request(app)
        .get(`/api/rooms/${roomCode}/assets`)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data).toHaveLength(2);
      fs.unlinkSync(tempFile1);
      fs.unlinkSync(tempFile2);
    });

    it('应支持按 type 过滤', async () => {
      const tempFile1 = createTempImage('a.png');
      const tempFile2 = createTempImage('b.png');
      await request(app)
        .post(`/api/rooms/${roomCode}/assets?playerId=${dmId}&type=portrait`)
        .attach('file', tempFile1);
      await request(app)
        .post(`/api/rooms/${roomCode}/assets?playerId=${dmId}&type=map`)
        .attach('file', tempFile2);

      const res = await request(app)
        .get(`/api/rooms/${roomCode}/assets?type=portrait`)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].type).toBe('portrait');
      fs.unlinkSync(tempFile1);
      fs.unlinkSync(tempFile2);
    });

    it('房间无素材时应返回空数组', async () => {
      const res = await request(app)
        .get(`/api/rooms/${roomCode}/assets`)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('房间不存在应返回 404', async () => {
      const res = await request(app)
        .get('/api/rooms/NOTEXS/assets')
        .expect(404);

      expect(res.body.ok).toBe(false);
    });
  });

  describe('GET /api/rooms/:code/assets/:type - 按类型获取', () => {
    it('应返回指定类型的素材', async () => {
      const tempFile1 = createTempImage('a.png');
      const tempFile2 = createTempImage('b.png');
      const tempFile3 = createTempImage('c.png');
      await request(app)
        .post(`/api/rooms/${roomCode}/assets?playerId=${dmId}&type=portrait`)
        .attach('file', tempFile1);
      await request(app)
        .post(`/api/rooms/${roomCode}/assets?playerId=${dmId}&type=portrait`)
        .attach('file', tempFile2);
      await request(app)
        .post(`/api/rooms/${roomCode}/assets?playerId=${dmId}&type=map`)
        .attach('file', tempFile3);

      const res = await request(app)
        .get(`/api/rooms/${roomCode}/assets/portrait`)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.every((a: { type: string }) => a.type === 'portrait')).toBe(true);

      fs.unlinkSync(tempFile1);
      fs.unlinkSync(tempFile2);
      fs.unlinkSync(tempFile3);
    });

    it('无效类型应返回 400', async () => {
      const res = await request(app)
        .get(`/api/rooms/${roomCode}/assets/invalid`)
        .expect(400);

      expect(res.body.ok).toBe(false);
    });
  });

  describe('DELETE /api/rooms/:code/assets/:id - 删除素材', () => {
    it('DM 应能删除素材', async () => {
      const tempFile = createTempImage();
      const uploadRes = await request(app)
        .post(`/api/rooms/${roomCode}/assets?playerId=${dmId}&type=portrait`)
        .attach('file', tempFile);
      const assetId = uploadRes.body.data.id;

      const res = await request(app)
        .delete(`/api/rooms/${roomCode}/assets/${assetId}?playerId=${dmId}`)
        .expect(200);

      expect(res.body.ok).toBe(true);

      // 确认已删除
      const listRes = await request(app)
        .get(`/api/rooms/${roomCode}/assets`)
        .expect(200);
      expect(listRes.body.data).toHaveLength(0);

      fs.unlinkSync(tempFile);
    });

    it('玩家删除应返回 403', async () => {
      const tempFile = createTempImage();
      const uploadRes = await request(app)
        .post(`/api/rooms/${roomCode}/assets?playerId=${dmId}&type=portrait`)
        .attach('file', tempFile);
      const assetId = uploadRes.body.data.id;

      const res = await request(app)
        .delete(`/api/rooms/${roomCode}/assets/${assetId}?playerId=${playerId}`)
        .expect(403);

      expect(res.body.ok).toBe(false);
      fs.unlinkSync(tempFile);
    });

    it('缺少 playerId 应返回 400', async () => {
      const res = await request(app)
        .delete(`/api/rooms/${roomCode}/assets/any-id`)
        .expect(400);

      expect(res.body.ok).toBe(false);
    });

    it('素材不存在应返回 404', async () => {
      const res = await request(app)
        .delete(`/api/rooms/${roomCode}/assets/not-exist?playerId=${dmId}`)
        .expect(404);

      expect(res.body.ok).toBe(false);
    });
  });

  describe('完整流程', () => {
    it('上传 -> 查询 -> 按类型查询 -> 删除 完整流程', async () => {
      // 1. 上传 3 个素材
      const tempFile1 = createTempImage('p1.png');
      const tempFile2 = createTempImage('m1.png');
      const tempFile3 = createTempImage('p2.png');

      const up1 = await request(app)
        .post(`/api/rooms/${roomCode}/assets?playerId=${dmId}&type=portrait`)
        .attach('file', tempFile1)
        .expect(201);
      await request(app)
        .post(`/api/rooms/${roomCode}/assets?playerId=${dmId}&type=map`)
        .attach('file', tempFile2)
        .expect(201);
      await request(app)
        .post(`/api/rooms/${roomCode}/assets?playerId=${dmId}&type=portrait`)
        .attach('file', tempFile3)
        .expect(201);

      // 2. 查询所有
      const allRes = await request(app)
        .get(`/api/rooms/${roomCode}/assets`)
        .expect(200);
      expect(allRes.body.data).toHaveLength(3);

      // 3. 按类型查询
      const portraitRes = await request(app)
        .get(`/api/rooms/${roomCode}/assets/portrait`)
        .expect(200);
      expect(portraitRes.body.data).toHaveLength(2);

      // 4. 删除一个
      await request(app)
        .delete(`/api/rooms/${roomCode}/assets/${up1.body.data.id}?playerId=${dmId}`)
        .expect(200);

      // 5. 再次查询
      const afterDeleteRes = await request(app)
        .get(`/api/rooms/${roomCode}/assets`)
        .expect(200);
      expect(afterDeleteRes.body.data).toHaveLength(2);

      fs.unlinkSync(tempFile1);
      fs.unlinkSync(tempFile2);
      fs.unlinkSync(tempFile3);
    });
  });
});
