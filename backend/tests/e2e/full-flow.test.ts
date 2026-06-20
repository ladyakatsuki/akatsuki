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
import { roomsRouter } from '../../src/routes/rooms.js';
import { charactersRouter } from '../../src/routes/characters.js';
import { storiesRouter } from '../../src/routes/stories.js';
import { assetsRouter } from '../../src/routes/assets.js';
import { errorHandler, notFoundHandler } from '../../src/middleware/errorHandler.js';
import { resetEnv } from '../../src/config/env.js';
import { roomRepository } from '../../src/db/repositories/RoomRepository.js';
import { characterRepository } from '../../src/db/repositories/CharacterRepository.js';
import { combatRepository } from '../../src/db/repositories/CombatRepository.js';
import { combatService } from '../../src/services/CombatService.js';
import { diceService } from '../../src/services/DiceService.js';
import { storyService } from '../../src/services/StoryService.js';
import { assetService } from '../../src/services/AssetService.js';
import { roomService } from '../../src/services/RoomService.js';
import '../../src/rules/index.js';
import type { AppServer, AppSocket } from '../../src/socket/index.js';
import { registerCombatHandler } from '../../src/socket/combatHandler.js';
import { registerDiceHandler } from '../../src/socket/diceHandler.js';
import { registerStoryHandler } from '../../src/socket/storyHandler.js';
import type {
  SocketAck,
  CombatStartPayload,
  CombatStateEvent,
  LogEvent,
  DiceRollResultEvent,
  StoryStateEvent,
  StoryEventPayload,
} from '../../src/types/socket.js';
import type { SocketAuthData } from '../../src/middleware/auth.js';
import type { CombatState, Story, Asset, Character } from '../../src/types/models.js';

/**
 * 完整跑团流程 E2E 测试
 *
 * 测试场景：DND 5E 房间从创建到结束的完整流程
 * - 创建房间（DND 5E）
 * - 玩家加入房间
 * - 玩家创建角色
 * - DM 创建 NPC
 * - 玩家掷骰子（d20 攻击检定）
 * - DM 发起战斗
 * - 添加参与者
 * - 推进回合
 * - DM 上传故事书（Markdown）
 * - 推进故事章节
 * - DM 上传素材
 * - 结束战斗
 * - 玩家离开房间
 *
 * 说明：socket.io-client 未安装，使用 MockSocket/MockIo 模拟 Socket 通信，
 * 配合 supertest 测试 HTTP 接口，覆盖完整业务流程。
 */

/**
 * 构建完整测试应用（挂载所有路由）
 */
function buildFullApp(): express.Application {
  const app = express();
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

/**
 * Mock Socket 实现（捕获事件注册与 emit 调用）
 */
class MockSocket {
  id: string;
  data: Partial<SocketAuthData> & Record<string, unknown>;
  private handlers: Map<string, (...args: unknown[]) => void> = new Map();
  emitCalls: { event: string; data: unknown }[] = [];

  constructor(id: string, auth: SocketAuthData) {
    this.id = id;
    this.data = auth;
  }

  on(event: string, handler: (...args: unknown[]) => void): this {
    this.handlers.set(event, handler);
    return this;
  }

  emit(event: string, data: unknown): this {
    this.emitCalls.push({ event, data });
    return this;
  }

  trigger(event: string, ...args: unknown[]): void {
    const handler = this.handlers.get(event);
    if (handler) {
      handler(...args);
    }
  }

  to(_room: string): { emit: (event: string, data: unknown) => void } {
    return {
      emit: () => {
        // no-op
      },
    };
  }

  join(_room: string): this {
    return this;
  }

  leave(_room: string): this {
    return this;
  }

  disconnect(_close?: boolean): this {
    return this;
  }
}

/**
 * Mock IO 实现（捕获广播调用与 sockets 集合）
 */
class MockIo {
  broadcastCalls: Map<string, { event: string; data: unknown }[]> = new Map();
  sockets: { sockets: Map<string, MockSocket> } = { sockets: new Map() };

  to(room: string): { emit: (event: string, data: unknown) => void } {
    const calls = this.broadcastCalls.get(room) ?? [];
    this.broadcastCalls.set(room, calls);
    return {
      emit: (event: string, data: unknown) => {
        calls.push({ event, data });
      },
    };
  }

  addSocket(socket: MockSocket): void {
    this.sockets.sockets.set(socket.id, socket);
  }
}

describe('完整跑团流程 E2E - DND 5E', () => {
  let app: express.Application;
  let tempUploadDir: string;
  let io: MockIo;
  let dmSocket: MockSocket;
  let playerSocket: MockSocket;

  let roomCode: string;
  let roomId: string;
  let dmId: string;
  let playerId: string;
  let playerCharacterId: string;
  let npcCharacterId: string;
  let combatState: CombatState;
  let story: Story;
  let asset: Asset;

  beforeEach(() => {
    const db = createInMemoryDb();
    setDbInstance(db);

    // 临时上传目录
    tempUploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-full-flow-'));
    resetEnv();
    process.env.UPLOAD_DIR = tempUploadDir;
    process.env.DB_PATH = ':memory:';

    app = buildFullApp();
    io = new MockIo();
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

  /** 获取指定房间的广播调用 */
  function getBroadcasts(): { event: string; data: unknown }[] {
    return io.broadcastCalls.get(roomId) ?? [];
  }

  it('完整跑团流程：创建→加入→建角色→掷骰→战斗→故事→素材→结束', async () => {
    // ============ 1. 创建房间（DND 5E） ============
    const createRes = await request(app)
      .post('/api/rooms')
      .send({ ruleSystem: 'dnd5e', dmName: 'DM 阿尔法' })
      .expect(201);

    expect(createRes.body.ok).toBe(true);
    expect(createRes.body.data.room).toBeTruthy();
    expect(createRes.body.data.room.code).toHaveLength(6);
    expect(createRes.body.data.room.ruleSystem).toBe('dnd5e');
    expect(createRes.body.data.room.players).toHaveLength(1);
    expect(createRes.body.data.room.players[0].role).toBe('dm');

    roomCode = createRes.body.data.room.code;
    roomId = createRes.body.data.room.id;
    dmId = createRes.body.data.playerId;

    // ============ 2. 玩家加入房间 ============
    const joinRes = await request(app)
      .post(`/api/rooms/${roomCode}/join`)
      .send({ playerName: '玩家贝塔' })
      .expect(200);

    expect(joinRes.body.ok).toBe(true);
    expect(joinRes.body.data.room.players).toHaveLength(2);
    playerId = joinRes.body.data.playerId;
    const newPlayer = joinRes.body.data.room.players.find(
      (p: { id: string }) => p.id === playerId,
    );
    expect(newPlayer.name).toBe('玩家贝塔');
    expect(newPlayer.role).toBe('player');

    // ============ 3. 玩家创建角色 ============
    const createCharRes = await request(app)
      .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
      .send({ name: '战士卡尔', isNpc: false })
      .expect(201);

    expect(createCharRes.body.ok).toBe(true);
    expect(createCharRes.body.data.name).toBe('战士卡尔');
    expect(createCharRes.body.data.ruleSystem).toBe('dnd5e');
    expect(createCharRes.body.data.isNpc).toBe(false);
    playerCharacterId = createCharRes.body.data.id;

    // ============ 4. DM 创建 NPC ============
    const createNpcRes = await request(app)
      .post(`/api/rooms/${roomCode}/characters?playerId=${dmId}`)
      .send({ name: '哥布林首领', isNpc: true })
      .expect(201);

    expect(createNpcRes.body.ok).toBe(true);
    expect(createNpcRes.body.data.name).toBe('哥布林首领');
    expect(createNpcRes.body.data.isNpc).toBe(true);
    npcCharacterId = createNpcRes.body.data.id;

    // 验证房间内角色列表
    const listCharRes = await request(app)
      .get(`/api/rooms/${roomCode}/characters`)
      .expect(200);
    expect(listCharRes.body.data).toHaveLength(2);

    // ============ 5. 玩家掷骰子（d20 攻击检定） ============
    // 初始化 Mock Socket
    dmSocket = new MockSocket('socket-dm', {
      roomId,
      playerId: dmId,
      role: 'dm',
      playerName: 'DM 阿尔法',
    });
    playerSocket = new MockSocket('socket-player', {
      roomId,
      playerId,
      role: 'player',
      playerName: '玩家贝塔',
    });
    io.addSocket(dmSocket);
    io.addSocket(playerSocket);

    // 注册骰子处理器
    registerDiceHandler(io as unknown as AppServer, playerSocket as unknown as AppSocket);

    let diceAck: SocketAck<DiceRollResultEvent> | undefined;
    playerSocket.trigger(
      'dice:roll',
      {
        expression: '1d20+5',
        label: '攻击检定',
        characterId: playerCharacterId,
      },
      (res: SocketAck<DiceRollResultEvent>): void => {
        diceAck = res;
      },
    );

    expect(diceAck?.ok).toBe(true);
    expect(diceAck?.data).toBeDefined();
    expect(diceAck?.data?.expression).toBe('1d20+5');
    expect(diceAck?.data?.label).toBe('攻击检定');
    expect(diceAck?.data?.playerId).toBe(playerId);
    expect(diceAck?.data?.playerName).toBe('玩家贝塔');
    expect(diceAck?.data?.characterId).toBe(playerCharacterId);
    // d20+5 总计范围：6-25
    expect(diceAck?.data?.total).toBeGreaterThanOrEqual(6);
    expect(diceAck?.data?.total).toBeLessThanOrEqual(25);
    expect(diceAck?.data?.rolls).toHaveLength(1);

    // 应广播 dice:result 与 log:add
    const diceBroadcasts = getBroadcasts();
    expect(diceBroadcasts.some((b) => b.event === 'dice:result')).toBe(true);
    expect(diceBroadcasts.some((b) => b.event === 'log:add')).toBe(true);

    // ============ 6. DM 发起战斗 ============
    // 注册战斗处理器
    registerCombatHandler(io as unknown as AppServer, dmSocket as unknown as AppSocket);

    // 清空之前的广播
    io.broadcastCalls.clear();

    const combatPayload: CombatStartPayload = {
      participantIds: [playerCharacterId, npcCharacterId],
      rollInitiative: true,
    };
    let combatAck: SocketAck<CombatState> | undefined;
    dmSocket.trigger(
      'combat:start',
      combatPayload,
      (res: SocketAck<CombatState>): void => {
        combatAck = res;
      },
    );

    expect(combatAck?.ok).toBe(true);
    expect(combatAck?.data).toBeDefined();
    expect(combatAck?.data?.isActive).toBe(true);
    expect(combatAck?.data?.round).toBe(1);
    expect(combatAck?.data?.currentTurn).toBe(0);
    expect(combatAck?.data?.participants).toHaveLength(2);
    combatState = combatAck!.data!;

    // 参与者应按先攻降序排序
    for (let i = 1; i < combatState.participants.length; i++) {
      expect(combatState.participants[i - 1].initiative).toBeGreaterThanOrEqual(
        combatState.participants[i].initiative,
      );
    }

    // 应广播 combat:state 与 log:add
    const startBroadcasts = getBroadcasts();
    expect(startBroadcasts.some((b) => b.event === 'combat:state')).toBe(true);
    expect(startBroadcasts.some((b) => b.event === 'log:add')).toBe(true);

    // ============ 7. 添加参与者 ============
    io.broadcastCalls.clear();
    let addPartAck: SocketAck<CombatState> | undefined;
    dmSocket.trigger(
      'combat:addParticipant',
      {
        name: '援军哥布林',
        type: 'npc',
        hp: 8,
        maxHp: 8,
        ac: 12,
        initiative: 12,
      },
      (res: SocketAck<CombatState>): void => {
        addPartAck = res;
      },
    );

    expect(addPartAck?.ok).toBe(true);
    expect(addPartAck?.data?.participants).toHaveLength(3);
    expect(
      addPartAck?.data?.participants.some((p) => p.name === '援军哥布林'),
    ).toBe(true);

    // ============ 8. 推进回合 ============
    io.broadcastCalls.clear();
    let nextTurnAck: SocketAck<CombatState> | undefined;
    dmSocket.trigger(
      'combat:nextTurn',
      (res: SocketAck<CombatState>): void => {
        nextTurnAck = res;
      },
    );

    expect(nextTurnAck?.ok).toBe(true);
    expect(nextTurnAck?.data?.currentTurn).toBe(1);

    // 应广播 combat:state、combat:turn 与 log:add
    const turnBroadcasts = getBroadcasts();
    expect(turnBroadcasts.some((b) => b.event === 'combat:state')).toBe(true);
    expect(turnBroadcasts.some((b) => b.event === 'combat:turn')).toBe(true);
    expect(turnBroadcasts.some((b) => b.event === 'log:add')).toBe(true);

    // ============ 9. DM 上传故事书（Markdown） ============
    const mdContent = [
      '# 暗影之城',
      '',
      '## 第一章 启程',
      '',
      '冒险者们抵达了暗影之城。',
      '',
      '## 第二章 迷雾',
      '',
      '城中弥漫着诡异的迷雾。',
      '',
      '## 第三章 真相',
      '',
      '真相终于浮出水面。',
    ].join('\n');

    const uploadStoryRes = await request(app)
      .post(`/api/rooms/${roomCode}/story/upload?format=md&playerId=${dmId}`)
      .attach('file', Buffer.from(mdContent, 'utf-8'), 'dark-city.md')
      .expect(201);

    expect(uploadStoryRes.body.ok).toBe(true);
    expect(uploadStoryRes.body.data.format).toBe('md');
    expect(uploadStoryRes.body.data.title).toBe('dark-city');
    expect(uploadStoryRes.body.data.chapters).toHaveLength(3);
    expect(uploadStoryRes.body.data.currentChapter).toBe(0);
    story = uploadStoryRes.body.data;

    // ============ 10. 推进故事章节 ============
    // 注册故事处理器
    registerStoryHandler(io as unknown as AppServer, dmSocket as unknown as AppSocket);
    io.broadcastCalls.clear();

    let advanceAck: SocketAck<Story | null> | undefined;
    dmSocket.trigger(
      'story:advance',
      {},
      (res: SocketAck<Story | null>): void => {
        advanceAck = res;
      },
    );

    expect(advanceAck?.ok).toBe(true);
    expect(advanceAck?.data?.currentChapter).toBe(1);

    // 应广播 story:state 与 log:add
    const storyBroadcasts = getBroadcasts();
    expect(storyBroadcasts.some((b) => b.event === 'story:state')).toBe(true);
    expect(storyBroadcasts.some((b) => b.event === 'log:add')).toBe(true);

    // 通过 HTTP 接口验证故事已推进
    const getStoryRes = await request(app)
      .get(`/api/rooms/${roomCode}/story`)
      .expect(200);
    expect(getStoryRes.body.data.currentChapter).toBe(1);

    // ============ 11. DM 上传素材 ============
    // 创建临时图片文件
    const tempImage = path.join(os.tmpdir(), 'e2e-asset.png');
    fs.writeFileSync(tempImage, Buffer.from('fake-png-data'));

    const uploadAssetRes = await request(app)
      .post(`/api/rooms/${roomCode}/assets?playerId=${dmId}&type=portrait`)
      .attach('file', tempImage)
      .expect(201);

    expect(uploadAssetRes.body.ok).toBe(true);
    expect(uploadAssetRes.body.data.type).toBe('portrait');
    expect(uploadAssetRes.body.data.url).toContain('/uploads/');
    expect(uploadAssetRes.body.data.uploadedBy).toBe(dmId);
    asset = uploadAssetRes.body.data;

    // 验证素材列表
    const listAssetRes = await request(app)
      .get(`/api/rooms/${roomCode}/assets`)
      .expect(200);
    expect(listAssetRes.body.data).toHaveLength(1);
    expect(listAssetRes.body.data[0].id).toBe(asset.id);

    fs.unlinkSync(tempImage);

    // ============ 12. 结束战斗 ============
    io.broadcastCalls.clear();
    let endCombatAck: SocketAck | undefined;
    dmSocket.trigger(
      'combat:end',
      (res: SocketAck): void => {
        endCombatAck = res;
      },
    );

    expect(endCombatAck?.ok).toBe(true);

    // 应广播 combat:state（combat 为 null）与 log:add
    const endBroadcasts = getBroadcasts();
    const stateEvents = endBroadcasts.filter((b) => b.event === 'combat:state');
    expect(stateEvents.length).toBeGreaterThanOrEqual(1);
    const stateEvent = stateEvents[0].data as CombatStateEvent;
    expect(stateEvent.combat).toBeNull();

    // 验证战斗状态已删除
    expect(combatRepository.findByRoom(roomId)).toBeNull();

    // ============ 13. 玩家离开房间 ============
    const leaveRes = await request(app)
      .post(`/api/rooms/${roomCode}/leave`)
      .send({ playerId })
      .expect(200);

    expect(leaveRes.body.ok).toBe(true);
    expect(leaveRes.body.data.room).toBeTruthy();
    expect(leaveRes.body.data.room.players).toHaveLength(1);
    expect(
      leaveRes.body.data.room.players.some((p: { id: string }) => p.id === playerId),
    ).toBe(false);

    // DM 离开应关闭房间
    const dmLeaveRes = await request(app)
      .post(`/api/rooms/${roomCode}/leave`)
      .send({ playerId: dmId })
      .expect(200);

    expect(dmLeaveRes.body.ok).toBe(true);
    expect(dmLeaveRes.body.data.room).toBeNull();

    // 房间已不存在
    await request(app).get(`/api/rooms/${roomCode}`).expect(404);
  });

  it('完整流程中应正确维护数据一致性', async () => {
    // 创建房间
    const createRes = await request(app)
      .post('/api/rooms')
      .send({ ruleSystem: 'dnd5e', dmName: 'DM' })
      .expect(201);
    roomCode = createRes.body.data.room.code;
    roomId = createRes.body.data.room.id;
    dmId = createRes.body.data.playerId;

    // 加入房间
    const joinRes = await request(app)
      .post(`/api/rooms/${roomCode}/join`)
      .send({ playerName: '玩家1' })
      .expect(200);
    playerId = joinRes.body.data.playerId;

    // 创建角色
    const charRes = await request(app)
      .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
      .send({ name: '英雄' })
      .expect(201);
    playerCharacterId = charRes.body.data.id;

    // 通过 Service 层验证数据一致性
    const room = roomRepository.findById(roomId);
    expect(room).not.toBeNull();
    expect(room?.players).toHaveLength(2);

    const characters = characterRepository.findByRoom(roomId);
    expect(characters).toHaveLength(1);
    expect(characters[0].id).toBe(playerCharacterId);
    expect(characters[0].playerId).toBe(playerId);

    // 房间状态查询应包含角色
    const state = roomService.getRoomState(roomId);
    expect(state.characters).toHaveLength(1);
    expect(state.room.players).toHaveLength(2);
  });

  it('应支持 DM 触发故事事件（NPC 出现、遇敌）', async () => {
    // 创建房间
    const createRes = await request(app)
      .post('/api/rooms')
      .send({ ruleSystem: 'dnd5e', dmName: 'DM' })
      .expect(201);
    roomCode = createRes.body.data.room.code;
    roomId = createRes.body.data.room.id;
    dmId = createRes.body.data.playerId;

    // 上传故事
    const mdContent = '## 第一章 开始\n\n冒险开始了。';
    await request(app)
      .post(`/api/rooms/${roomCode}/story/upload?format=md&playerId=${dmId}`)
      .attach('file', Buffer.from(mdContent, 'utf-8'), 'story.md')
      .expect(201);

    // 注册故事处理器
    dmSocket = new MockSocket('socket-dm', {
      roomId,
      playerId: dmId,
      role: 'dm',
      playerName: 'DM',
    });
    io.addSocket(dmSocket);
    registerStoryHandler(io as unknown as AppServer, dmSocket as unknown as AppSocket);

    // 触发 NPC 事件
    let eventAck: SocketAck<StoryEventPayload> | undefined;
    const npcEvent: StoryEventPayload = {
      type: 'npc',
      data: { name: '神秘老人', description: '一位披着斗篷的老者' },
    };
    dmSocket.trigger(
      'story:event',
      npcEvent,
      (res: SocketAck<StoryEventPayload>): void => {
        eventAck = res;
      },
    );

    expect(eventAck?.ok).toBe(true);
    expect(eventAck?.data?.type).toBe('npc');

    // 应广播 story:event 与 log:add
    const broadcasts = getBroadcasts();
    expect(broadcasts.some((b) => b.event === 'story:event')).toBe(true);
    expect(broadcasts.some((b) => b.event === 'log:add')).toBe(true);

    const logEvents = broadcasts.filter((b) => b.event === 'log:add');
    const logData = logEvents[0].data as LogEvent;
    expect(logData.type).toBe('story');
    expect(logData.message).toContain('NPC');
  });

  it('应支持战斗中更新参与者 HP', async () => {
    // 创建房间
    const createRes = await request(app)
      .post('/api/rooms')
      .send({ ruleSystem: 'dnd5e', dmName: 'DM' })
      .expect(201);
    roomCode = createRes.body.data.room.code;
    roomId = createRes.body.data.room.id;
    dmId = createRes.body.data.playerId;

    // 玩家加入
    const joinRes = await request(app)
      .post(`/api/rooms/${roomCode}/join`)
      .send({ playerName: '玩家1' })
      .expect(200);
    playerId = joinRes.body.data.playerId;

    // 创建角色
    const charRes = await request(app)
      .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
      .send({ name: '英雄' })
      .expect(201);
    playerCharacterId = charRes.body.data.id;

    // 创建 NPC
    const npcRes = await request(app)
      .post(`/api/rooms/${roomCode}/characters?playerId=${dmId}`)
      .send({ name: '哥布林', isNpc: true })
      .expect(201);
    npcCharacterId = npcRes.body.data.id;

    // 注册战斗处理器
    dmSocket = new MockSocket('socket-dm', {
      roomId,
      playerId: dmId,
      role: 'dm',
      playerName: 'DM',
    });
    io.addSocket(dmSocket);
    registerCombatHandler(io as unknown as AppServer, dmSocket as unknown as AppSocket);

    // 开始战斗
    let startAck: SocketAck<CombatState> | undefined;
    dmSocket.trigger(
      'combat:start',
      { participantIds: [playerCharacterId, npcCharacterId], rollInitiative: false },
      (res: SocketAck<CombatState>): void => {
        startAck = res;
      },
    );
    expect(startAck?.ok).toBe(true);
    const combat = startAck!.data!;
    const participantId = combat.participants[0].id;
    const originalHp = combat.participants[0].hp;

    // 更新 HP
    io.broadcastCalls.clear();
    let updateAck: SocketAck<CombatState> | undefined;
    dmSocket.trigger(
      'combat:updateParticipant',
      { participantId, patch: { hp: Math.max(0, originalHp - 5) } },
      (res: SocketAck<CombatState>): void => {
        updateAck = res;
      },
    );

    expect(updateAck?.ok).toBe(true);
    const updated = updateAck!.data!.participants.find((p) => p.id === participantId);
    expect(updated?.hp).toBe(Math.max(0, originalHp - 5));

    // HP 变化应广播 log:add
    const broadcasts = getBroadcasts();
    const logEvents = broadcasts.filter((b) => b.event === 'log:add');
    expect(logEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('应支持 Service 层完整跑团流程', () => {
    // 通过 Service 层模拟完整流程（不经过 HTTP）

    // 1. 创建房间
    const createResult = roomService.createRoom({
      ruleSystem: 'dnd5e',
      dmName: 'DM',
    });
    roomId = createResult.room.id;
    roomCode = createResult.room.code;
    dmId = createResult.playerId;

    // 2. 玩家加入
    const joinResult = roomService.joinRoom({
      code: roomCode,
      playerName: '玩家1',
    });
    playerId = joinResult.playerId;

    // 3. 创建角色
    const character = characterRepository.create({
      roomId,
      playerId,
      name: '英雄',
      ruleSystem: 'dnd5e',
      data: {
        name: '英雄',
        level: 1,
        str: 16,
        strMod: 3,
        dex: 14,
        dexMod: 2,
        hp: 20,
        maxHp: 20,
        ac: 16,
      },
      portraitUrl: null,
      isNpc: false,
    });
    playerCharacterId = character.id;

    // 4. 创建 NPC
    const npc = characterRepository.create({
      roomId,
      playerId: dmId,
      name: '哥布林',
      ruleSystem: 'dnd5e',
      data: {
        name: '哥布林',
        level: 1,
        dex: 8,
        dexMod: -1,
        hp: 10,
        maxHp: 10,
        ac: 12,
      },
      portraitUrl: null,
      isNpc: true,
    });
    npcCharacterId = npc.id;

    // 5. 掷骰子
    const diceResult = diceService.roll(roomId, playerId, '玩家1', {
      expression: '1d20+5',
      label: '攻击检定',
    });
    expect(diceResult.total).toBeGreaterThanOrEqual(6);
    expect(diceResult.total).toBeLessThanOrEqual(25);

    // 6. 开始战斗
    combatState = combatService.startCombat(
      roomId,
      dmId,
      [playerCharacterId, npcCharacterId],
      true,
    );
    expect(combatState.isActive).toBe(true);
    expect(combatState.participants).toHaveLength(2);

    // 7. 推进回合
    const nextTurn = combatService.nextTurn(roomId, dmId);
    expect(nextTurn.currentTurn).toBe(1);

    // 8. 上传故事
    story = storyService.uploadStory(
      roomId,
      dmId,
      {
        buffer: Buffer.from('## 第一章 开始\n\n内容', 'utf-8'),
        originalname: 'story.md',
      },
      'md',
    );
    expect(story.chapters).toHaveLength(1);

    // 9. 推进故事章节（先上传多章节故事）
    storyService.deleteStory(roomId, dmId);
    story = storyService.uploadStory(
      roomId,
      dmId,
      {
        buffer: Buffer.from(
          '## 第一章 开始\n\n内容1\n\n## 第二章 高潮\n\n内容2',
          'utf-8',
        ),
        originalname: 'story2.md',
      },
      'md',
    );
    const advanced = storyService.advanceChapter(roomId, dmId);
    expect(advanced.currentChapter).toBe(1);

    // 10. 结束战斗
    combatService.endCombat(roomId, dmId);
    expect(combatRepository.findByRoom(roomId)).toBeNull();

    // 11. 玩家离开
    const updatedRoom = roomService.leaveRoom({ roomId, playerId });
    expect(updatedRoom?.players).toHaveLength(1);

    // 12. DM 离开（房间关闭）
    const dmLeaveResult = roomService.leaveRoom({ roomId, playerId: dmId });
    expect(dmLeaveResult).toBeNull();
    expect(roomRepository.findById(roomId)).toBeNull();
  });
});
