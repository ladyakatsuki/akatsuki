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
import { charactersRouter } from '../../src/routes/characters.js';
import { roomsRouter } from '../../src/routes/rooms.js';
import { errorHandler, notFoundHandler } from '../../src/middleware/errorHandler.js';
import { getEnv, resetEnv } from '../../src/config/env.js';
import { roomRepository } from '../../src/db/repositories/RoomRepository.js';
import { ruleSystemRegistry } from '../../src/rules/index.js';
import '../../src/rules/index.js';

/**
 * 构建测试用 Express 应用
 * 挂载房间与角色路由，使用临时上传目录
 */
function buildTestApp(): express.Application {
  const app = express();
  app.use(express.json());
  app.use('/api/rooms', roomsRouter);
  app.use('/api', charactersRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('角色路由 /api/characters', () => {
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
    tempUploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'char-test-uploads-'));
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

  describe('POST /api/rooms/:code/characters - 创建角色', () => {
    it('应成功创建角色并返回 201', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
        .send({ name: '英雄' })
        .expect(201);

      expect(res.body.ok).toBe(true);
      expect(res.body.data.name).toBe('英雄');
      expect(res.body.data.playerId).toBe(playerId);
      expect(res.body.data.roomId).toBe(roomId);
      expect(res.body.data.ruleSystem).toBe('dnd5e');
      expect(res.body.data.isNpc).toBe(false);
      expect(res.body.data.data).toBeTruthy();
      expect(res.body.data.data.name).toBe('英雄');
    });

    it('DM 创建 NPC 应成功', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${dmId}`)
        .send({ name: '怪物', isNpc: true })
        .expect(201);

      expect(res.body.ok).toBe(true);
      expect(res.body.data.isNpc).toBe(true);
      expect(res.body.data.playerId).toBe(dmId);
    });

    it('缺少 playerId 应返回 400', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/characters`)
        .send({ name: '英雄' })
        .expect(400);
      expect(res.body.ok).toBe(false);
    });

    it('缺少 name 应返回 400', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
        .send({})
        .expect(400);
      expect(res.body.ok).toBe(false);
    });

    it('房间不存在应返回 404', async () => {
      const res = await request(app)
        .post('/api/rooms/NOTEXS/characters?playerId=p1')
        .send({ name: '英雄' })
        .expect(404);
      expect(res.body.ok).toBe(false);
    });

    it('玩家最多 1 个角色，重复创建应返回 409', async () => {
      await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
        .send({ name: '英雄1' })
        .expect(201);

      const res = await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
        .send({ name: '英雄2' })
        .expect(409);
      expect(res.body.ok).toBe(false);
    });
  });

  describe('GET /api/rooms/:code/characters - 获取房间所有角色', () => {
    it('应返回房间内所有角色', async () => {
      // 创建 2 个角色
      await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
        .send({ name: '玩家角色' });
      await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${dmId}`)
        .send({ name: 'NPC', isNpc: true });

      const res = await request(app)
        .get(`/api/rooms/${roomCode}/characters`)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    it('房间无角色时应返回空数组', async () => {
      const res = await request(app)
        .get(`/api/rooms/${roomCode}/characters`)
        .expect(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('房间不存在应返回 404', async () => {
      const res = await request(app)
        .get('/api/rooms/NOTEXS/characters')
        .expect(404);
      expect(res.body.ok).toBe(false);
    });
  });

  describe('GET /api/rooms/:code/characters/mine - 获取自己的角色', () => {
    it('应返回当前玩家的角色', async () => {
      await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
        .send({ name: '我的角色' });
      await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${dmId}`)
        .send({ name: 'NPC', isNpc: true });

      const res = await request(app)
        .get(`/api/rooms/${roomCode}/characters/mine?playerId=${playerId}`)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('我的角色');
    });

    it('缺少 playerId 应返回 400', async () => {
      const res = await request(app)
        .get(`/api/rooms/${roomCode}/characters/mine`)
        .expect(400);
      expect(res.body.ok).toBe(false);
    });
  });

  describe('GET /api/characters/:id - 获取单个角色', () => {
    it('应返回指定角色', async () => {
      const createRes = await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
        .send({ name: '英雄' });
      const characterId = createRes.body.data.id;

      const res = await request(app)
        .get(`/api/characters/${characterId}`)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data.id).toBe(characterId);
      expect(res.body.data.name).toBe('英雄');
    });

    it('角色不存在应返回 404', async () => {
      const res = await request(app)
        .get('/api/characters/not-exist')
        .expect(404);
      expect(res.body.ok).toBe(false);
    });
  });

  describe('PATCH /api/characters/:id - 更新角色基本信息', () => {
    it('应允许玩家更新自己的角色名称', async () => {
      const createRes = await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
        .send({ name: '旧名称' });
      const characterId = createRes.body.data.id;

      const res = await request(app)
        .patch(`/api/characters/${characterId}?playerId=${playerId}`)
        .send({ name: '新名称' })
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data.name).toBe('新名称');
      expect(res.body.data.data.name).toBe('新名称');
    });

    it('玩家不能改他人的角色，应返回 403', async () => {
      const createRes = await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
        .send({ name: '玩家角色' });
      const characterId = createRes.body.data.id;

      const res = await request(app)
        .patch(`/api/characters/${characterId}?playerId=other-player`)
        .send({ name: '篡改' })
        .expect(403);
      expect(res.body.ok).toBe(false);
    });

    it('DM 可改所有角色', async () => {
      const createRes = await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
        .send({ name: '玩家角色' });
      const characterId = createRes.body.data.id;

      const res = await request(app)
        .patch(`/api/characters/${characterId}?playerId=${dmId}`)
        .send({ name: 'DM 修改' })
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data.name).toBe('DM 修改');
    });

    it('缺少 playerId 应返回 400', async () => {
      const createRes = await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
        .send({ name: '英雄' });
      const characterId = createRes.body.data.id;

      const res = await request(app)
        .patch(`/api/characters/${characterId}`)
        .send({ name: '新名称' })
        .expect(400);
      expect(res.body.ok).toBe(false);
    });
  });

  describe('PUT /api/characters/:id/data - 更新角色卡数据', () => {
    it('应允许玩家更新自己的角色卡数据', async () => {
      const createRes = await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
        .send({ name: '英雄' });
      const characterId = createRes.body.data.id;

      // 使用规则系统默认数据（包含所有必需字段）
      const system = ruleSystemRegistry.get('dnd5e');
      const newData = system.createDefaultCharacter();
      newData.name = '英雄';
      newData.str = 18;

      const res = await request(app)
        .put(`/api/characters/${characterId}/data?playerId=${playerId}`)
        .send(newData)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data.data.str).toBe(18);
    });

    it('玩家不能改他人的角色卡数据，应返回 403', async () => {
      const createRes = await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
        .send({ name: '英雄' });
      const characterId = createRes.body.data.id;

      const system = ruleSystemRegistry.get('dnd5e');
      const newData = system.createDefaultCharacter();

      const res = await request(app)
        .put(`/api/characters/${characterId}/data?playerId=other-player`)
        .send(newData)
        .expect(403);
      expect(res.body.ok).toBe(false);
    });

    it('缺少必需字段应返回 400', async () => {
      const createRes = await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
        .send({ name: '英雄' });
      const characterId = createRes.body.data.id;

      const res = await request(app)
        .put(`/api/characters/${characterId}/data?playerId=${playerId}`)
        .send({ name: '英雄' })
        .expect(400);
      expect(res.body.ok).toBe(false);
    });
  });

  describe('POST /api/characters/:id/portrait - 上传立绘', () => {
    it('应允许玩家上传自己角色的立绘', async () => {
      const createRes = await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
        .send({ name: '英雄' });
      const characterId = createRes.body.data.id;

      // 创建临时图片文件
      const tempFile = path.join(os.tmpdir(), 'test-portrait.png');
      fs.writeFileSync(tempFile, Buffer.from('fake-png-data'));

      const res = await request(app)
        .post(`/api/characters/${characterId}/portrait?playerId=${playerId}`)
        .attach('portrait', tempFile)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data.portraitUrl).toBeTruthy();
      expect(res.body.data.portraitUrl).toContain('.png');

      // 清理
      fs.unlinkSync(tempFile);
    });

    it('玩家不能上传他人角色的立绘，应返回 403', async () => {
      const createRes = await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
        .send({ name: '英雄' });
      const characterId = createRes.body.data.id;

      const tempFile = path.join(os.tmpdir(), 'test-portrait.png');
      fs.writeFileSync(tempFile, Buffer.from('fake-png-data'));

      const res = await request(app)
        .post(`/api/characters/${characterId}/portrait?playerId=other-player`)
        .attach('portrait', tempFile)
        .expect(403);

      expect(res.body.ok).toBe(false);
      fs.unlinkSync(tempFile);
    });

    it('缺少文件应返回 400', async () => {
      const createRes = await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
        .send({ name: '英雄' });
      const characterId = createRes.body.data.id;

      const res = await request(app)
        .post(`/api/characters/${characterId}/portrait?playerId=${playerId}`)
        .expect(400);

      expect(res.body.ok).toBe(false);
    });

    it('角色不存在应返回 404', async () => {
      const tempFile = path.join(os.tmpdir(), 'test-portrait.png');
      fs.writeFileSync(tempFile, Buffer.from('fake-png-data'));

      const res = await request(app)
        .post(`/api/characters/not-exist/portrait?playerId=${playerId}`)
        .attach('portrait', tempFile)
        .expect(404);

      expect(res.body.ok).toBe(false);
      fs.unlinkSync(tempFile);
    });
  });

  describe('DELETE /api/characters/:id - 删除角色', () => {
    it('应允许玩家删除自己的角色', async () => {
      const createRes = await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
        .send({ name: '英雄' });
      const characterId = createRes.body.data.id;

      const res = await request(app)
        .delete(`/api/characters/${characterId}?playerId=${playerId}`)
        .expect(200);

      expect(res.body.ok).toBe(true);

      // 确认已删除
      const getRes = await request(app)
        .get(`/api/characters/${characterId}`)
        .expect(404);
      expect(getRes.body.ok).toBe(false);
    });

    it('玩家不能删他人的角色，应返回 403', async () => {
      const createRes = await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
        .send({ name: '英雄' });
      const characterId = createRes.body.data.id;

      const res = await request(app)
        .delete(`/api/characters/${characterId}?playerId=other-player`)
        .expect(403);

      expect(res.body.ok).toBe(false);
    });

    it('DM 可删所有角色', async () => {
      const createRes = await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
        .send({ name: '英雄' });
      const characterId = createRes.body.data.id;

      const res = await request(app)
        .delete(`/api/characters/${characterId}?playerId=${dmId}`)
        .expect(200);

      expect(res.body.ok).toBe(true);
    });

    it('角色不存在应返回 404', async () => {
      const res = await request(app)
        .delete('/api/characters/not-exist?playerId=p1')
        .expect(404);
      expect(res.body.ok).toBe(false);
    });
  });

  describe('完整流程', () => {
    it('创建 -> 获取 -> 更新 -> 删除 完整流程', async () => {
      // 1. 创建角色
      const createRes = await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
        .send({ name: '初始英雄' })
        .expect(201);
      const characterId = createRes.body.data.id;

      // 2. 获取房间角色列表
      const listRes = await request(app)
        .get(`/api/rooms/${roomCode}/characters`)
        .expect(200);
      expect(listRes.body.data).toHaveLength(1);

      // 3. 获取单个角色
      const getRes = await request(app)
        .get(`/api/characters/${characterId}`)
        .expect(200);
      expect(getRes.body.data.name).toBe('初始英雄');

      // 4. 更新名称
      const updateRes = await request(app)
        .patch(`/api/characters/${characterId}?playerId=${playerId}`)
        .send({ name: '更新英雄' })
        .expect(200);
      expect(updateRes.body.data.name).toBe('更新英雄');

      // 5. 获取自己的角色
      const mineRes = await request(app)
        .get(`/api/rooms/${roomCode}/characters/mine?playerId=${playerId}`)
        .expect(200);
      expect(mineRes.body.data).toHaveLength(1);
      expect(mineRes.body.data[0].name).toBe('更新英雄');

      // 6. 删除角色
      await request(app)
        .delete(`/api/characters/${characterId}?playerId=${playerId}`)
        .expect(200);

      // 7. 确认已删除
      const listRes2 = await request(app)
        .get(`/api/rooms/${roomCode}/characters`)
        .expect(200);
      expect(listRes2.body.data).toHaveLength(0);
    });
  });
});
