import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import {
  createInMemoryDb,
  setDbInstance,
  closeDb,
} from '../../src/db/index.js';
import { storiesRouter } from '../../src/routes/stories.js';
import { roomsRouter } from '../../src/routes/rooms.js';
import { errorHandler, notFoundHandler } from '../../src/middleware/errorHandler.js';
import { roomRepository } from '../../src/db/repositories/RoomRepository.js';

/**
 * 构建测试用 Express 应用
 * 挂载房间路由与故事路由（共用 /api/rooms 前缀）
 */
function buildTestApp(): express.Application {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/api/rooms', roomsRouter);
  app.use('/api/rooms', storiesRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('故事路由 /api/rooms/:code/story', () => {
  let app: express.Application;
  let roomCode: string;
  let dmId: string;
  let playerId: string;

  beforeEach(() => {
    const db = createInMemoryDb();
    setDbInstance(db);
    app = buildTestApp();

    // 创建测试房间
    const room = roomRepository.create('dnd5e', 'dm-1', 'DM');
    roomCode = room.code;
    dmId = 'dm-1';
    playerId = 'player-1';
    roomRepository.addPlayer(room.id, {
      id: playerId,
      name: '玩家1',
      role: 'player',
      joinedAt: Date.now(),
    });
  });

  afterEach(() => {
    closeDb();
  });

  /** 构造 Markdown 文件内容 */
  function buildMdContent(): string {
    return ['## 第一章 开始', '', '冒险开始了。', '', '## 第二章 高潮', '', '英雄登场。'].join('\n');
  }

  /** 构造 JSON 文件内容 */
  function buildJsonContent(): string {
    return JSON.stringify({
      chapters: [{ id: 'ch1', title: '第一章', content: '章节内容' }],
      scenes: [
        { chapterId: 'ch1', title: '场景一', description: '描述一' },
        { chapterId: 'ch1', title: '场景二', description: '描述二' },
      ],
      npcs: [{ name: 'NPC 1', description: '描述' }],
      encounters: [{ name: '遇敌 1', enemies: ['哥布林'] }],
    });
  }

  describe('POST /:code/story/upload - 上传故事书', () => {
    it('DM 应能上传 Markdown 故事并返回 201', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/story/upload?format=md&playerId=${dmId}`)
        .attach('file', Buffer.from(buildMdContent(), 'utf-8'), 'story.md')
        .expect(201);

      expect(res.body.ok).toBe(true);
      expect(res.body.data.format).toBe('md');
      expect(res.body.data.title).toBe('story');
      expect(res.body.data.chapters).toHaveLength(2);
      expect(res.body.data.currentChapter).toBe(0);
    });

    it('DM 应能上传 JSON 故事并返回 201', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/story/upload?format=json&playerId=${dmId}`)
        .attach('file', Buffer.from(buildJsonContent(), 'utf-8'), 'story.json')
        .expect(201);

      expect(res.body.ok).toBe(true);
      expect(res.body.data.format).toBe('json');
      expect(res.body.data.chapters).toHaveLength(1);
      expect(res.body.data.scenes).toHaveLength(2);
      expect(res.body.data.currentScene).toBeTruthy();
    });

    it('玩家不能上传故事，应返回 403', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/story/upload?format=md&playerId=${playerId}`)
        .attach('file', Buffer.from(buildMdContent(), 'utf-8'), 'story.md')
        .expect(403);

      expect(res.body.ok).toBe(false);
    });

    it('缺少 playerId 应返回 400', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/story/upload?format=md`)
        .attach('file', Buffer.from(buildMdContent(), 'utf-8'), 'story.md')
        .expect(400);

      expect(res.body.ok).toBe(false);
    });

    it('缺少 format 应返回 400', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/story/upload?playerId=${dmId}`)
        .attach('file', Buffer.from(buildMdContent(), 'utf-8'), 'story.md')
        .expect(400);

      expect(res.body.ok).toBe(false);
    });

    it('缺少文件应返回 400', async () => {
      const res = await request(app)
        .post(`/api/rooms/${roomCode}/story/upload?format=md&playerId=${dmId}`)
        .expect(400);

      expect(res.body.ok).toBe(false);
    });

    it('房间不存在应返回 404', async () => {
      const res = await request(app)
        .post('/api/rooms/NOTEXS/story/upload?format=md&playerId=dm-1')
        .attach('file', Buffer.from(buildMdContent(), 'utf-8'), 'story.md')
        .expect(404);

      expect(res.body.ok).toBe(false);
    });
  });

  describe('GET /:code/story - 获取故事', () => {
    it('应返回已上传的故事', async () => {
      // 先上传
      await request(app)
        .post(`/api/rooms/${roomCode}/story/upload?format=md&playerId=${dmId}`)
        .attach('file', Buffer.from(buildMdContent(), 'utf-8'), 'story.md')
        .expect(201);

      const res = await request(app)
        .get(`/api/rooms/${roomCode}/story`)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data).not.toBeNull();
      expect(res.body.data.format).toBe('md');
      expect(res.body.data.chapters).toHaveLength(2);
    });

    it('无故事时应返回 null', async () => {
      const res = await request(app)
        .get(`/api/rooms/${roomCode}/story`)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data).toBeNull();
    });

    it('房间不存在应返回 404', async () => {
      const res = await request(app)
        .get('/api/rooms/NOTEXS/story')
        .expect(404);

      expect(res.body.ok).toBe(false);
    });
  });

  describe('DELETE /:code/story - 删除故事', () => {
    it('DM 应能删除故事', async () => {
      // 先上传
      await request(app)
        .post(`/api/rooms/${roomCode}/story/upload?format=md&playerId=${dmId}`)
        .attach('file', Buffer.from(buildMdContent(), 'utf-8'), 'story.md')
        .expect(201);

      const res = await request(app)
        .delete(`/api/rooms/${roomCode}/story?playerId=${dmId}`)
        .expect(200);

      expect(res.body.ok).toBe(true);

      // 验证已删除
      const getRes = await request(app)
        .get(`/api/rooms/${roomCode}/story`)
        .expect(200);
      expect(getRes.body.data).toBeNull();
    });

    it('玩家不能删除故事，应返回 403', async () => {
      // 先上传
      await request(app)
        .post(`/api/rooms/${roomCode}/story/upload?format=md&playerId=${dmId}`)
        .attach('file', Buffer.from(buildMdContent(), 'utf-8'), 'story.md')
        .expect(201);

      const res = await request(app)
        .delete(`/api/rooms/${roomCode}/story?playerId=${playerId}`)
        .expect(403);

      expect(res.body.ok).toBe(false);
    });

    it('缺少 playerId 应返回 400', async () => {
      const res = await request(app)
        .delete(`/api/rooms/${roomCode}/story`)
        .expect(400);

      expect(res.body.ok).toBe(false);
    });

    it('故事不存在应返回 404', async () => {
      const res = await request(app)
        .delete(`/api/rooms/${roomCode}/story?playerId=${dmId}`)
        .expect(404);

      expect(res.body.ok).toBe(false);
    });
  });

  describe('完整流程', () => {
    it('上传 -> 获取 -> 删除 完整流程', async () => {
      // 1. 上传
      const uploadRes = await request(app)
        .post(`/api/rooms/${roomCode}/story/upload?format=md&playerId=${dmId}`)
        .attach('file', Buffer.from(buildMdContent(), 'utf-8'), 'story.md')
        .expect(201);
      expect(uploadRes.body.data.chapters).toHaveLength(2);

      // 2. 获取
      const getRes = await request(app)
        .get(`/api/rooms/${roomCode}/story`)
        .expect(200);
      expect(getRes.body.data.id).toBe(uploadRes.body.data.id);

      // 3. 删除
      await request(app)
        .delete(`/api/rooms/${roomCode}/story?playerId=${dmId}`)
        .expect(200);

      // 4. 再次获取应为 null
      const getRes2 = await request(app)
        .get(`/api/rooms/${roomCode}/story`)
        .expect(200);
      expect(getRes2.body.data).toBeNull();
    });
  });
});
