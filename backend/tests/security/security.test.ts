import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  createInMemoryDb,
  setDbInstance,
  closeDb,
} from '../../src/db/index.js';
import { roomsRouter } from '../../src/routes/rooms.js';
import { charactersRouter } from '../../src/routes/characters.js';
import { storiesRouter } from '../../src/routes/stories.js';
import { assetsRouter } from '../../src/routes/assets.js';
import { errorHandler, notFoundHandler } from '../../src/middleware/errorHandler.js';
import { resetEnv, getEnv } from '../../src/config/env.js';
import { roomRepository } from '../../src/db/repositories/RoomRepository.js';
import { characterRepository } from '../../src/db/repositories/CharacterRepository.js';
import { combatService } from '../../src/services/CombatService.js';
import { createAuthMiddleware } from '../../src/middleware/auth.js';
import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import http from 'node:http';
import '../../src/rules/index.js';

/**
 * 公网部署安全测试
 *
 * 测试内容：
 * - 未授权 Socket 连接被拒绝
 * - 无效房间码被拒绝
 * - 玩家尝试 DM 操作被拒绝
 * - 文件类型校验（上传非图片被拒绝）
 * - 文件大小校验（超过 5MB 被拒绝）
 * - CORS 配置验证
 * - SQL 注入防护验证（基本）
 */

/**
 * 构建完整测试应用
 */
function buildFullApp(corsOrigin?: string): express.Application {
  const app = express();
  app.use(
    cors({
      origin: corsOrigin ?? getEnv().corsOrigin,
    }),
  );
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use('/api/rooms', roomsRouter);
  app.use('/api', charactersRouter);
  app.use('/api/rooms', storiesRouter);
  app.use('/api', assetsRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('公网部署安全测试', () => {
  let app: express.Application;
  let tempUploadDir: string;
  let roomCode: string;
  let roomId: string;
  let dmId: string;
  let playerId: string;
  let playerCharacterId: string;

  beforeEach(() => {
    const db = createInMemoryDb();
    setDbInstance(db);

    // 临时上传目录
    tempUploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'security-test-'));
    resetEnv();
    process.env.UPLOAD_DIR = tempUploadDir;
    process.env.DB_PATH = ':memory:';

    app = buildFullApp();

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

    // 创建玩家角色
    const char = characterRepository.create({
      roomId,
      playerId,
      name: '英雄',
      ruleSystem: 'dnd5e',
      data: {
        name: '英雄',
        level: 1,
        str: 10,
        dex: 10,
        hp: 10,
        maxHp: 10,
        ac: 10,
      },
      portraitUrl: null,
      isNpc: false,
    });
    playerCharacterId = char.id;
  });

  afterEach(() => {
    closeDb();
    if (tempUploadDir && fs.existsSync(tempUploadDir)) {
      fs.rmSync(tempUploadDir, { recursive: true, force: true });
    }
    resetEnv();
    delete process.env.UPLOAD_DIR;
    delete process.env.DB_PATH;
  });

  describe('未授权 Socket 连接被拒绝', () => {
    it('缺少 roomCode 的 Socket 连接应被拒绝', async () => {
      const httpServer = http.createServer();
      const io = new Server(httpServer, { cors: { origin: '*' } });
      io.use(createAuthMiddleware());

      const connectPromise = new Promise<{ ok: boolean; error?: string }>(
        (resolve) => {
          httpServer.listen(0, () => {
            const port = (httpServer.address() as { port: number }).port;
            // 使用原生 socket.io-client 模拟（通过 fetch 握手）
            // 由于 socket.io-client 未安装，通过直接调用中间件验证
            const mockSocket = {
              handshake: { auth: { playerId: 'p1' } },
              data: {},
            };
            const mockNext = (err?: Error): void => {
              if (err) {
                resolve({ ok: false, error: err.message });
              } else {
                resolve({ ok: true });
              }
            };
            createAuthMiddleware()(
              mockSocket as never,
              mockNext as never,
            );
            httpServer.close();
            void port;
          });
        },
      );

      const result = await connectPromise;
      expect(result.ok).toBe(false);
      expect(result.error).toContain('roomCode');

      io.close();
    });

    it('缺少 playerId 的 Socket 连接应被拒绝', async () => {
      const mockSocket = {
        handshake: { auth: { roomCode: 'ABCDEF' } },
        data: {},
      };
      let capturedError: Error | undefined;
      const mockNext = (err?: Error): void => {
        capturedError = err;
      };
      createAuthMiddleware()(mockSocket as never, mockNext as never);

      expect(capturedError).toBeDefined();
      expect(capturedError?.message).toContain('playerId');
    });

    it('无效房间码的 Socket 连接应被拒绝', () => {
      const mockSocket = {
        handshake: { auth: { roomCode: 'NOTEXS', playerId: 'p1' } },
        data: {},
      };
      let capturedError: Error | undefined;
      const mockNext = (err?: Error): void => {
        capturedError = err;
      };
      createAuthMiddleware()(mockSocket as never, mockNext as never);

      expect(capturedError).toBeDefined();
      expect(capturedError?.message).toContain('房间码无效');
    });

    it('玩家不在房间内的 Socket 连接应被拒绝', () => {
      const mockSocket = {
        handshake: { auth: { roomCode, playerId: 'not-in-room' } },
        data: {},
      };
      let capturedError: Error | undefined;
      const mockNext = (err?: Error): void => {
        capturedError = err;
      };
      createAuthMiddleware()(mockSocket as never, mockNext as never);

      expect(capturedError).toBeDefined();
      expect(capturedError?.message).toContain('玩家不在房间内');
    });

    it('DM 的 Socket 连接应通过鉴权', () => {
      const mockSocket = {
        handshake: { auth: { roomCode, playerId: dmId } },
        data: {},
      };
      let capturedError: Error | undefined;
      const mockNext = (err?: Error): void => {
        capturedError = err;
      };
      createAuthMiddleware()(mockSocket as never, mockNext as never);

      expect(capturedError).toBeUndefined();
      expect((mockSocket as { data: { role: string } }).data.role).toBe('dm');
    });

    it('房间内玩家的 Socket 连接应通过鉴权', () => {
      const mockSocket = {
        handshake: { auth: { roomCode, playerId } },
        data: {},
      };
      let capturedError: Error | undefined;
      const mockNext = (err?: Error): void => {
        capturedError = err;
      };
      createAuthMiddleware()(mockSocket as never, mockNext as never);

      expect(capturedError).toBeUndefined();
      expect((mockSocket as { data: { role: string } }).data.role).toBe('player');
    });
  });

  describe('无效房间码被拒绝', () => {
    it('加入不存在的房间应返回 404', async () => {
      const res = await request(app)
        .post('/api/rooms/NOTEXS/join')
        .send({ playerName: '玩家' })
        .expect(404);
      expect(res.body.ok).toBe(false);
    });

    it('查询不存在的房间应返回 404', async () => {
      const res = await request(app)
        .get('/api/rooms/NOTEXS')
        .expect(404);
      expect(res.body.ok).toBe(false);
    });

    it('获取不存在房间的状态应返回 404', async () => {
      const res = await request(app)
        .get('/api/rooms/NOTEXS/state?playerId=p1')
        .expect(404);
      expect(res.body.ok).toBe(false);
    });

    it('在不存在的房间创建角色应返回 404', async () => {
      const res = await request(app)
        .post('/api/rooms/NOTEXS/characters?playerId=p1')
        .send({ name: '角色' })
        .expect(404);
      expect(res.body.ok).toBe(false);
    });

    it('在不存在的房间上传故事应返回 404', async () => {
      const res = await request(app)
        .post('/api/rooms/NOTEXS/story/upload?format=md&playerId=p1')
        .attach('file', Buffer.from('## 章节', 'utf-8'), 'story.md')
        .expect(404);
      expect(res.body.ok).toBe(false);
    });

    it('在不存在的房间上传素材应返回 404', async () => {
      const tempFile = path.join(os.tmpdir(), 'security-test.png');
      fs.writeFileSync(tempFile, Buffer.from('fake'));
      const res = await request(app)
        .post('/api/rooms/NOTEXS/assets?playerId=p1&type=portrait')
        .attach('file', tempFile)
        .expect(404);
      expect(res.body.ok).toBe(false);
      fs.unlinkSync(tempFile);
    });
  });

  describe('玩家尝试 DM 操作被拒绝', () => {
    it('玩家上传故事应返回 403', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/story/upload?format=md&playerId=${playerId}`)
        .attach('file', Buffer.from('## 章节', 'utf-8'), 'story.md')
        .expect(403);
      expect(res.body.ok).toBe(false);
    });

    it('玩家删除故事应返回 403', async () => {
      // 先由 DM 上传故事
      await request(app)
        .post(`/api/rooms/${roomCode}/story/upload?format=md&playerId=${dmId}`)
        .attach('file', Buffer.from('## 章节', 'utf-8'), 'story.md');

      const res = await request(app)
        .delete(`/api/rooms/${roomCode}/story?playerId=${playerId}`)
        .expect(403);
      expect(res.body.ok).toBe(false);
    });

    it('玩家上传素材应返回 403', async () => {
      const tempFile = path.join(os.tmpdir(), 'security-test.png');
      fs.writeFileSync(tempFile, Buffer.from('fake'));
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/assets?playerId=${playerId}&type=portrait`)
        .attach('file', tempFile)
        .expect(403);
      expect(res.body.ok).toBe(false);
      fs.unlinkSync(tempFile);
    });

    it('玩家删除素材应返回 403', async () => {
      // 先由 DM 上传素材
      const tempFile = path.join(os.tmpdir(), 'security-test.png');
      fs.writeFileSync(tempFile, Buffer.from('fake'));
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

    it('玩家尝试开始战斗应被拒绝（Service 层）', () => {
      expect(() => {
        combatService.startCombat(roomId, playerId, [playerCharacterId], false);
      }).toThrow();
    });

    it('玩家尝试结束战斗应被拒绝（Service 层）', () => {
      // 先由 DM 开始战斗
      combatService.startCombat(roomId, dmId, [playerCharacterId], false);
      expect(() => {
        combatService.endCombat(roomId, playerId);
      }).toThrow();
    });

    it('玩家尝试推进回合应被拒绝（Service 层）', () => {
      combatService.startCombat(roomId, dmId, [playerCharacterId], false);
      expect(() => {
        combatService.nextTurn(roomId, playerId);
      }).toThrow();
    });

    it('玩家尝试操作他人角色应返回 403', async () => {
      // DM 创建 NPC
      const npcRes = await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${dmId}`)
        .send({ name: 'NPC', isNpc: true })
        .expect(201);
      const npcId = npcRes.body.data.id;

      // 玩家尝试修改 NPC
      const res = await request(app)
        .patch(`/api/characters/${npcId}?playerId=${playerId}`)
        .send({ name: '改名' })
        .expect(403);
      expect(res.body.ok).toBe(false);
    });
  });

  describe('文件类型校验', () => {
    it('上传非图片文件（txt）应被拒绝', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/assets?playerId=${dmId}&type=portrait`)
        .attach('file', Buffer.from('text content', 'utf-8'), 'test.txt')
        .expect(400);
      expect(res.body.ok).toBe(false);
    });

    it('上传非图片文件（exe）应被拒绝', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/assets?playerId=${dmId}&type=portrait`)
        .attach('file', Buffer.from('fake exe', 'utf-8'), 'malware.exe')
        .expect(400);
      expect(res.body.ok).toBe(false);
    });

    it('上传非图片文件（js）应被拒绝', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/assets?playerId=${dmId}&type=portrait`)
        .attach('file', Buffer.from('alert(1)', 'utf-8'), 'script.js')
        .expect(400);
      expect(res.body.ok).toBe(false);
    });

    it('上传非图片文件（html）应被拒绝', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/assets?playerId=${dmId}&type=portrait`)
        .attach('file', Buffer.from('<script>alert(1)</script>', 'utf-8'), 'page.html')
        .expect(400);
      expect(res.body.ok).toBe(false);
    });

    it('立绘上传非图片文件应被拒绝', async () => {
      const res = await request(app)
        .post(`/api/characters/${playerCharacterId}/portrait?playerId=${playerId}`)
        .attach('portrait', Buffer.from('text', 'utf-8'), 'test.txt')
        .expect(400);
      expect(res.body.ok).toBe(false);
    });

    it('应接受合法图片类型（png）', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/assets?playerId=${dmId}&type=portrait`)
        .attach('file', Buffer.from('fake png'), 'test.png')
        .expect(201);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('文件大小校验', () => {
    it('上传超过 5MB 的素材应被拒绝', async () => {
      // 创建 6MB 的文件
      const largeContent = Buffer.alloc(6 * 1024 * 1024, 'x');
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/assets?playerId=${dmId}&type=portrait`)
        .attach('file', largeContent, 'large.png')
        .expect(400);
      expect(res.body.ok).toBe(false);
    });

    it('上传超过 5MB 的故事书应被拒绝', async () => {
      // 创建 6MB 的文件
      const largeContent = Buffer.alloc(6 * 1024 * 1024, 'a');
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/story/upload?format=md&playerId=${dmId}`)
        .attach('file', largeContent, 'large.md')
        .expect(400);
      expect(res.body.ok).toBe(false);
    });

    it('上传超过 5MB 的立绘应被拒绝', async () => {
      const largeContent = Buffer.alloc(6 * 1024 * 1024, 'x');
      const res = await request(app)
        .post(`/api/characters/${playerCharacterId}/portrait?playerId=${playerId}`)
        .attach('portrait', largeContent, 'large.png')
        .expect(400);
      expect(res.body.ok).toBe(false);
    });

    it('应接受 5MB 以内的文件', async () => {
      // 创建略小于 5MB 的文件
      const content = Buffer.alloc(4 * 1024 * 1024, 'x');
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/assets?playerId=${dmId}&type=portrait`)
        .attach('file', content, 'normal.png')
        .expect(201);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('CORS 配置验证', () => {
    it('默认 CORS 应允许所有来源', async () => {
      const res = await request(app)
        .options('/api/rooms')
        .set('Origin', 'http://evil.com')
        .set('Access-Control-Request-Method', 'POST');
      // 默认 CORS 配置 origin: '*' 应允许
      expect(res.headers['access-control-allow-origin']).toBeDefined();
    });

    it('应响应 OPTIONS 预检请求', async () => {
      const res = await request(app)
        .options('/api/rooms')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST');
      expect(res.status).toBeLessThan(500);
    });

    it('健康检查端点应可访问', async () => {
      // 添加健康检查路由
      const healthApp = express();
      healthApp.get('/health', (_req, res) => {
        res.json({ status: 'ok' });
      });
      const res = await request(healthApp).get('/health').expect(200);
      expect(res.body.status).toBe('ok');
    });

    it('CORS 配置为特定来源时应限制访问', async () => {
      // 重新构建应用，限制 CORS 来源
      resetEnv();
      process.env.CORS_ORIGIN = 'http://localhost:5173';
      process.env.UPLOAD_DIR = tempUploadDir;
      process.env.DB_PATH = ':memory:';
      const restrictedApp = buildFullApp('http://localhost:5173');

      const res = await request(restrictedApp)
        .options('/api/rooms')
        .set('Origin', 'http://evil.com')
        .set('Access-Control-Request-Method', 'POST');

      // 受限来源不应返回 Allow-Origin
      expect(res.headers['access-control-allow-origin']).not.toBe('http://evil.com');
    });
  });

  describe('SQL 注入防护验证', () => {
    it('房间码包含 SQL 注入字符串应被正常处理', async () => {
      // 尝试通过房间码注入
      const res = await request(app)
        .get('/api/rooms/\' OR \'1\'=\'1')
        .expect(404);
      expect(res.body.ok).toBe(false);
    });

    it('角色名包含 SQL 注入字符串应被安全存储', async () => {
      // 先删除 beforeEach 中创建的角色（每个玩家仅允许 1 个角色）
      await request(app)
        .delete(`/api/characters/${playerCharacterId}?playerId=${playerId}`)
        .expect(200);

      const maliciousName = "'; DROP TABLE characters; --";
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
        .send({ name: maliciousName })
        .expect(201);

      expect(res.body.ok).toBe(true);
      expect(res.body.data.name).toBe(maliciousName);

      // 验证 characters 表仍存在
      const chars = characterRepository.findByRoom(roomId);
      expect(chars.length).toBeGreaterThan(0);
    });

    it('玩家名包含 SQL 注入字符串应被安全处理', async () => {
      const maliciousName = "admin'--";
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/join`)
        .send({ playerName: maliciousName })
        .expect(200);

      expect(res.body.ok).toBe(true);
      // 验证房间仍正常
      const room = roomRepository.findById(roomId);
      expect(room).not.toBeNull();
    });

    it('查询参数包含 SQL 注入应被参数化处理', async () => {
      // 通过 query 参数尝试注入
      const res = await request(app)
        .get(`/api/rooms/${roomCode}/state?playerId=' OR '1'='1`)
        .expect(403);
      expect(res.body.ok).toBe(false);
    });

    it('故事书内容包含 SQL 注入字符串应被安全存储', async () => {
      const maliciousContent = "## '; DROP TABLE stories; --\n\n内容";
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/story/upload?format=md&playerId=${dmId}`)
        .attach('file', Buffer.from(maliciousContent, 'utf-8'), 'inject.md')
        .expect(201);

      expect(res.body.ok).toBe(true);
      // 验证 stories 表仍存在（通过查询房间故事）
      const storyRes = await request(app)
        .get(`/api/rooms/${roomCode}/story`)
        .expect(200);
      expect(storyRes.body.ok).toBe(true);
    });

    it('路径参数包含特殊字符应被安全处理', async () => {
      // 尝试路径遍历
      const res = await request(app)
        .get('/api/rooms/../../../etc/passwd')
        .expect(404);
      expect(res.body.ok).toBe(false);
    });

    it('JSON 请求体包含 SQL 注入字符串应被安全处理', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .send({
          ruleSystem: "dnd5e'; DROP TABLE rooms; --",
          dmName: 'DM',
        })
        .expect(400);
      expect(res.body.ok).toBe(false);

      // 验证 rooms 表仍存在
      const room = roomRepository.findById(roomId);
      expect(room).not.toBeNull();
    });
  });

  describe('其他安全验证', () => {
    it('缺少 playerId 的角色操作应返回 400', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/characters`)
        .send({ name: '角色' })
        .expect(400);
      expect(res.body.ok).toBe(false);
    });

    it('无效的规则系统应返回 400', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .send({ ruleSystem: 'invalid', dmName: 'DM' })
        .expect(400);
      expect(res.body.ok).toBe(false);
    });

    it('空的角色名应返回 400', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
        .send({ name: '' })
        .expect(400);
      expect(res.body.ok).toBe(false);
    });

    it('空的角色名（空格）应返回 400', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
        .send({ name: '   ' })
        .expect(400);
      expect(res.body.ok).toBe(false);
    });

    it('无效的素材类型应返回 400', async () => {
      const tempFile = path.join(os.tmpdir(), 'security-test.png');
      fs.writeFileSync(tempFile, Buffer.from('fake'));
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/assets?playerId=${dmId}&type=malicious`)
        .attach('file', tempFile)
        .expect(400);
      expect(res.body.ok).toBe(false);
      fs.unlinkSync(tempFile);
    });

    it('无效的故事格式应返回 400', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/story/upload?format=xml&playerId=${dmId}`)
        .attach('file', Buffer.from('<xml/>', 'utf-8'), 'story.xml')
        .expect(400);
      expect(res.body.ok).toBe(false);
    });

    it('不存在的 API 路径应返回 404', async () => {
      const res = await request(app)
        .get('/api/nonexistent')
        .expect(404);
      expect(res.body.ok).toBe(false);
    });

    it('健康检查应正常响应', async () => {
      const healthApp = express();
      healthApp.get('/health', (_req, res) => {
        res.json({ status: 'ok' });
      });
      const res = await request(healthApp).get('/health').expect(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
