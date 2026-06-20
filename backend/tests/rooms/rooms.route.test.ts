import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import {
  createInMemoryDb,
  setDbInstance,
  closeDb,
} from '../../src/db/index.js';
import { roomsRouter } from '../../src/routes/rooms.js';
import { errorHandler, notFoundHandler } from '../../src/middleware/errorHandler.js';

/**
 * 构建测试用 Express 应用
 * 仅挂载房间路由与错误处理，不依赖环境变量
 */
function buildTestApp(): express.Application {
  const app = express();
  app.use(express.json());
  app.use('/api/rooms', roomsRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('房间路由 /api/rooms', () => {
  let app: express.Application;

  beforeEach(() => {
    const db = createInMemoryDb();
    setDbInstance(db);
    app = buildTestApp();
  });

  afterEach(() => {
    closeDb();
  });

  describe('POST /api/rooms - 创建房间', () => {
    it('应成功创建房间并返回 201', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .send({ ruleSystem: 'dnd5e', dmName: '测试 DM' })
        .expect(201);

      expect(res.body.ok).toBe(true);
      expect(res.body.data.room).toBeTruthy();
      expect(res.body.data.room.code).toHaveLength(6);
      expect(res.body.data.room.ruleSystem).toBe('dnd5e');
      expect(res.body.data.room.players).toHaveLength(1);
      expect(res.body.data.room.players[0].name).toBe('测试 DM');
      expect(res.body.data.room.players[0].role).toBe('dm');
      expect(res.body.data.playerId).toBeTruthy();
      expect(res.body.data.playerId).toBe(res.body.data.room.dmId);
    });

    it('缺少 ruleSystem 应返回 400', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .send({ dmName: 'DM' })
        .expect(400);
      expect(res.body.ok).toBe(false);
    });

    it('缺少 dmName 应返回 400', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .send({ ruleSystem: 'dnd5e' })
        .expect(400);
      expect(res.body.ok).toBe(false);
    });

    it('无效的 ruleSystem 应返回 400', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .send({ ruleSystem: 'invalid', dmName: 'DM' })
        .expect(400);
      expect(res.body.ok).toBe(false);
    });
  });

  describe('POST /api/rooms/:code/join - 加入房间', () => {
    it('应成功加入房间并返回玩家 ID', async () => {
      // 先创建房间
      const createRes = await request(app)
        .post('/api/rooms')
        .send({ ruleSystem: 'dnd5e', dmName: 'DM' });
      const code = createRes.body.data.room.code;

      const res = await request(app)
        .post(`/api/rooms/${code}/join`)
        .send({ playerName: '玩家1' })
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data.room).toBeTruthy();
      expect(res.body.data.playerId).toBeTruthy();
      expect(res.body.data.room.players).toHaveLength(2);
      const newPlayer = res.body.data.room.players.find(
        (p: { id: string }) => p.id === res.body.data.playerId,
      );
      expect(newPlayer.name).toBe('玩家1');
      expect(newPlayer.role).toBe('player');
    });

    it('房间不存在应返回 404', async () => {
      const res = await request(app)
        .post('/api/rooms/NOTEXS/join')
        .send({ playerName: '玩家1' })
        .expect(404);
      expect(res.body.ok).toBe(false);
    });

    it('房间满员应返回 409', async () => {
      // 创建房间
      const createRes = await request(app)
        .post('/api/rooms')
        .send({ ruleSystem: 'dnd5e', dmName: 'DM' });
      const code = createRes.body.data.room.code;

      // 添加 5 个玩家达到上限
      for (let i = 1; i <= 5; i++) {
        await request(app)
          .post(`/api/rooms/${code}/join`)
          .send({ playerName: `玩家${i}` })
          .expect(200);
      }

      // 第 6 个玩家应被拒绝
      const res = await request(app)
        .post(`/api/rooms/${code}/join`)
        .send({ playerName: '玩家6' })
        .expect(409);
      expect(res.body.ok).toBe(false);
    });

    it('缺少 playerName 应返回 400', async () => {
      const createRes = await request(app)
        .post('/api/rooms')
        .send({ ruleSystem: 'dnd5e', dmName: 'DM' });
      const code = createRes.body.data.room.code;

      const res = await request(app)
        .post(`/api/rooms/${code}/join`)
        .send({})
        .expect(400);
      expect(res.body.ok).toBe(false);
    });
  });

  describe('GET /api/rooms/:code - 查询房间预览', () => {
    it('应返回房间预览信息', async () => {
      const createRes = await request(app)
        .post('/api/rooms')
        .send({ ruleSystem: 'coc7', dmName: 'DM' });
      const code = createRes.body.data.room.code;

      const res = await request(app).get(`/api/rooms/${code}`).expect(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.ruleSystem).toBe('coc7');
      expect(res.body.data.playerCount).toBe(1);
      expect(res.body.data.isFull).toBe(false);
    });

    it('房间不存在应返回 404', async () => {
      const res = await request(app).get('/api/rooms/NOTEXS').expect(404);
      expect(res.body.ok).toBe(false);
    });
  });

  describe('GET /api/rooms/:code/state - 获取房间状态', () => {
    it('应返回房间完整状态', async () => {
      const createRes = await request(app)
        .post('/api/rooms')
        .send({ ruleSystem: 'dnd5e', dmName: 'DM' });
      const code = createRes.body.data.room.code;
      const playerId = createRes.body.data.playerId;

      const res = await request(app)
        .get(`/api/rooms/${code}/state?playerId=${playerId}`)
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data.room).toBeTruthy();
      expect(res.body.data.room.id).toBe(createRes.body.data.room.id);
      expect(res.body.data.characters).toEqual([]);
      expect(res.body.data.onlinePlayers).toEqual([]);
    });

    it('缺少 playerId 应返回 400', async () => {
      const createRes = await request(app)
        .post('/api/rooms')
        .send({ ruleSystem: 'dnd5e', dmName: 'DM' });
      const code = createRes.body.data.room.code;

      const res = await request(app)
        .get(`/api/rooms/${code}/state`)
        .expect(400);
      expect(res.body.ok).toBe(false);
    });

    it('玩家不在房间内应返回 403', async () => {
      const createRes = await request(app)
        .post('/api/rooms')
        .send({ ruleSystem: 'dnd5e', dmName: 'DM' });
      const code = createRes.body.data.room.code;

      const res = await request(app)
        .get(`/api/rooms/${code}/state?playerId=not-in-room`)
        .expect(403);
      expect(res.body.ok).toBe(false);
    });

    it('房间不存在应返回 404', async () => {
      const res = await request(app)
        .get('/api/rooms/NOTEXS/state?playerId=p-1')
        .expect(404);
      expect(res.body.ok).toBe(false);
    });
  });

  describe('POST /api/rooms/:code/leave - 离开房间', () => {
    it('普通玩家离开应成功', async () => {
      const createRes = await request(app)
        .post('/api/rooms')
        .send({ ruleSystem: 'dnd5e', dmName: 'DM' });
      const code = createRes.body.data.room.code;

      const joinRes = await request(app)
        .post(`/api/rooms/${code}/join`)
        .send({ playerName: '玩家1' });
      const playerId = joinRes.body.data.playerId;

      const res = await request(app)
        .post(`/api/rooms/${code}/leave`)
        .send({ playerId })
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data.room).toBeTruthy();
      expect(res.body.data.room.players).toHaveLength(1);
    });

    it('DM 离开应关闭房间（返回 null）', async () => {
      const createRes = await request(app)
        .post('/api/rooms')
        .send({ ruleSystem: 'dnd5e', dmName: 'DM' });
      const code = createRes.body.data.room.code;
      const playerId = createRes.body.data.playerId;

      const res = await request(app)
        .post(`/api/rooms/${code}/leave`)
        .send({ playerId })
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.data.room).toBeNull();
    });

    it('缺少 playerId 应返回 400', async () => {
      const createRes = await request(app)
        .post('/api/rooms')
        .send({ ruleSystem: 'dnd5e', dmName: 'DM' });
      const code = createRes.body.data.room.code;

      const res = await request(app)
        .post(`/api/rooms/${code}/leave`)
        .send({})
        .expect(400);
      expect(res.body.ok).toBe(false);
    });
  });

  describe('完整流程', () => {
    it('创建 -> 加入 -> 查询 -> 离开 完整流程', async () => {
      // 1. 创建房间
      const createRes = await request(app)
        .post('/api/rooms')
        .send({ ruleSystem: 'dnd5e', dmName: 'DM' })
        .expect(201);
      const code = createRes.body.data.room.code;
      const dmId = createRes.body.data.playerId;

      // 2. 玩家加入
      const joinRes = await request(app)
        .post(`/api/rooms/${code}/join`)
        .send({ playerName: '玩家1' })
        .expect(200);
      const playerId = joinRes.body.data.playerId;

      // 3. 查询房间预览
      const previewRes = await request(app)
        .get(`/api/rooms/${code}`)
        .expect(200);
      expect(previewRes.body.data.playerCount).toBe(2);

      // 4. 获取房间状态
      const stateRes = await request(app)
        .get(`/api/rooms/${code}/state?playerId=${playerId}`)
        .expect(200);
      expect(stateRes.body.data.room.players).toHaveLength(2);

      // 5. 玩家离开
      await request(app)
        .post(`/api/rooms/${code}/leave`)
        .send({ playerId })
        .expect(200);

      // 6. DM 离开关闭房间
      const dmLeaveRes = await request(app)
        .post(`/api/rooms/${code}/leave`)
        .send({ playerId: dmId })
        .expect(200);
      expect(dmLeaveRes.body.data.room).toBeNull();

      // 7. 房间已不存在
      await request(app).get(`/api/rooms/${code}`).expect(404);
    });
  });
});
