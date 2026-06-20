import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createInMemoryDb,
  setDbInstance,
  closeDb,
} from '../../src/db/index.js';
import { roomRepository } from '../../src/db/repositories/RoomRepository.js';
import { characterRepository } from '../../src/db/repositories/CharacterRepository.js';
import { mapRepository } from '../../src/db/repositories/MapRepository.js';
import { registerMapHandler } from '../../src/socket/mapHandler.js';
import type { AppServer, AppSocket } from '../../src/socket/index.js';
import type { SocketAck, MapStateEvent, PlayerMapStateEvent } from '../../src/types/socket.js';
import type { SocketAuthData } from '../../src/middleware/auth.js';
import type { MapState, MapToken } from '../../src/types/models.js';

/**
 * Mock Socket 实现
 *
 * 捕获事件注册与 emit 调用，用于测试事件处理器。
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

  /** 触发事件（测试用） */
  trigger(event: string, ...args: unknown[]): void {
    const handler = this.handlers.get(event);
    if (handler) {
      handler(...args);
    }
  }

  to(_room: string): { emit: (event: string, data: unknown) => void } {
    // MockSocket 的 to() 不实际广播，仅返回空实现
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
 * Mock IO 实现
 *
 * 捕获 to().emit() 广播调用与 sockets.sockets 集合。
 */
class MockIo {
  /** 按房间分组的广播调用 */
  broadcastCalls: Map<string, { event: string; data: unknown }[]> = new Map();
  /** 所有连接的 socket */
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

  /** 添加 socket 到 io（用于按角色广播测试） */
  addSocket(socket: MockSocket): void {
    this.sockets.sockets.set(socket.id, socket);
  }
}

describe('mapHandler', () => {
  let io: MockIo;
  let dmSocket: MockSocket;
  let playerSocket: MockSocket;
  let roomId: string;
  let dmId: string;
  let playerId: string;
  let playerCharacterId: string;

  beforeEach(() => {
    const db = createInMemoryDb();
    setDbInstance(db);

    // 创建房间
    dmId = 'dm-1';
    const room = roomRepository.create('dnd5e', dmId, 'DM');
    roomId = room.id;

    // 添加玩家
    playerId = 'player-1';
    roomRepository.addPlayer(roomId, {
      id: playerId,
      name: '玩家1',
      role: 'player',
      joinedAt: Date.now(),
      isConnected: true,
    });

    // 为玩家创建角色
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

    // 创建 Mock socket
    io = new MockIo();
    dmSocket = new MockSocket('socket-dm', {
      roomId,
      playerId: dmId,
      role: 'dm',
      playerName: 'DM',
    });
    playerSocket = new MockSocket('socket-player', {
      roomId,
      playerId,
      role: 'player',
      playerName: '玩家1',
    });
    io.addSocket(dmSocket);
    io.addSocket(playerSocket);

    // 注册地图处理器（DM 与玩家各注册一份）
    registerMapHandler(
      io as unknown as AppServer,
      dmSocket as unknown as AppSocket,
    );
    registerMapHandler(
      io as unknown as AppServer,
      playerSocket as unknown as AppSocket,
    );
  });

  afterEach(() => {
    closeDb();
  });

  /** 构造测试 Token 输入（不含 id） */
  function buildTokenInput(
    overrides: Partial<Omit<MapToken, 'id'>> = {},
  ): Omit<MapToken, 'id'> {
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

  /** 通过 DM socket 添加一个 Token 并返回 */
  function addTokenViaDm(
    input: Omit<MapToken, 'id'>,
  ): MapToken {
    let ackResult: SocketAck<MapState> | undefined;
    dmSocket.trigger(
      'map:token:add',
      { token: input },
      (res: SocketAck<MapState>) => {
        ackResult = res;
      },
    );
    const mapState = ackResult?.data as MapState;
    return mapState.tokens[mapState.tokens.length - 1];
  }

  describe('map:getState', () => {
    it('DM 应获取完整地图状态', () => {
      let ackResult: SocketAck<MapState | PlayerMapStateEvent> | undefined;
      dmSocket.trigger('map:getState', (res: SocketAck<MapState | PlayerMapStateEvent>) => {
        ackResult = res;
      });

      expect(ackResult?.ok).toBe(true);
      const mapState = ackResult?.data as MapState;
      expect(mapState.roomId).toBe(roomId);
      expect(mapState.width).toBe(20);
      expect(mapState.tokens).toEqual([]);
    });

    it('玩家应获取过滤版地图状态', () => {
      // 先由 DM 添加一个不可见 Token
      addTokenViaDm(buildTokenInput({ name: '隐藏Token', isVisible: false }));

      let ackResult: SocketAck<MapState | PlayerMapStateEvent> | undefined;
      playerSocket.trigger(
        'map:getState',
        (res: SocketAck<MapState | PlayerMapStateEvent>) => {
          ackResult = res;
        },
      );

      expect(ackResult?.ok).toBe(true);
      const playerView = ackResult?.data as PlayerMapStateEvent;
      expect(playerView.mapState.tokens).toHaveLength(0);
    });
  });

  describe('map:token:move', () => {
    it('玩家应能移动自己的 Token 并广播', () => {
      const token = addTokenViaDm(
        buildTokenInput({ characterId: playerCharacterId }),
      );

      let ackResult: SocketAck | undefined;
      playerSocket.trigger(
        'map:token:move',
        { tokenId: token.id, x: 5, y: 3 },
        (res: SocketAck) => {
          ackResult = res;
        },
      );

      expect(ackResult?.ok).toBe(true);

      // 应广播 map:token:moved 给全房间
      const broadcasts = io.broadcastCalls.get(roomId) ?? [];
      const movedEvent = broadcasts.find((b) => b.event === 'map:token:moved');
      expect(movedEvent).toBeDefined();
      expect(movedEvent?.data).toEqual({ tokenId: token.id, x: 5, y: 3 });

      // 数据库中应已更新
      const mapState = mapRepository.findByRoom(roomId);
      const movedToken = mapState?.tokens.find((t) => t.id === token.id);
      expect(movedToken?.x).toBe(5);
      expect(movedToken?.y).toBe(3);
    });

    it('玩家不能移动他人的 Token', () => {
      // DM 创建一个属于 DM 的 Token
      const dmCharacter = characterRepository.create({
        roomId,
        playerId: dmId,
        name: 'NPC',
        ruleSystem: 'dnd5e',
        data: { name: 'NPC' },
        portraitUrl: null,
        isNpc: true,
      });
      const token = addTokenViaDm(
        buildTokenInput({ characterId: dmCharacter.id }),
      );

      let ackResult: SocketAck | undefined;
      playerSocket.trigger(
        'map:token:move',
        { tokenId: token.id, x: 5, y: 3 },
        (res: SocketAck) => {
          ackResult = res;
        },
      );

      expect(ackResult?.ok).toBe(false);
      expect(ackResult?.error).toContain('无权');
    });

    it('DM 应能移动所有 Token', () => {
      const token = addTokenViaDm(
        buildTokenInput({ characterId: playerCharacterId }),
      );

      let ackResult: SocketAck | undefined;
      dmSocket.trigger(
        'map:token:move',
        { tokenId: token.id, x: 10, y: 10 },
        (res: SocketAck) => {
          ackResult = res;
        },
      );

      expect(ackResult?.ok).toBe(true);
    });

    it('缺少 tokenId 应返回错误', () => {
      let ackResult: SocketAck | undefined;
      playerSocket.trigger(
        'map:token:move',
        { tokenId: '', x: 0, y: 0 },
        (res: SocketAck) => {
          ackResult = res;
        },
      );

      expect(ackResult?.ok).toBe(false);
      expect(ackResult?.error).toContain('tokenId');
    });
  });

  describe('map:token:add (DM only)', () => {
    it('DM 应能添加 Token', () => {
      let ackResult: SocketAck<MapState> | undefined;
      dmSocket.trigger(
        'map:token:add',
        { token: buildTokenInput({ name: '新Token' }) },
        (res: SocketAck<MapState>) => {
          ackResult = res;
        },
      );

      expect(ackResult?.ok).toBe(true);
      expect(ackResult?.data?.tokens).toHaveLength(1);
      expect(ackResult?.data?.tokens[0].name).toBe('新Token');
    });

    it('玩家不能添加 Token', () => {
      let ackResult: SocketAck | undefined;
      playerSocket.trigger(
        'map:token:add',
        { token: buildTokenInput({ name: '新Token' }) },
        (res: SocketAck) => {
          ackResult = res;
        },
      );

      expect(ackResult?.ok).toBe(false);
      expect(ackResult?.error).toContain('dm');
    });

    it('DM 添加 Token 后应广播 map:state 给全房间（区分视角）', () => {
      dmSocket.trigger('map:token:add', {
        token: buildTokenInput({ name: '可见Token', isVisible: true }),
      }, () => {
        // no-op
      });

      // DM socket 应收到完整版 map:state
      const dmStateEvents = dmSocket.emitCalls.filter(
        (e) => e.event === 'map:state',
      );
      expect(dmStateEvents).toHaveLength(1);
      const dmEvent = dmStateEvents[0].data as MapStateEvent;
      expect(dmEvent.mapState.tokens).toHaveLength(1);

      // 玩家 socket 也应收到 map:state（过滤版）
      const playerStateEvents = playerSocket.emitCalls.filter(
        (e) => e.event === 'map:state',
      );
      expect(playerStateEvents).toHaveLength(1);
    });
  });

  describe('map:token:remove (DM only)', () => {
    it('DM 应能移除 Token 并广播', () => {
      const token = addTokenViaDm(buildTokenInput({ name: 'Token1' }));

      let ackResult: SocketAck | undefined;
      dmSocket.trigger(
        'map:token:remove',
        { tokenId: token.id },
        (res: SocketAck) => {
          ackResult = res;
        },
      );

      expect(ackResult?.ok).toBe(true);

      // 应广播 map:token:removed
      const broadcasts = io.broadcastCalls.get(roomId) ?? [];
      const removedEvent = broadcasts.find((b) => b.event === 'map:token:removed');
      expect(removedEvent).toBeDefined();
      expect(removedEvent?.data).toEqual({ tokenId: token.id });
    });

    it('玩家不能移除 Token', () => {
      const token = addTokenViaDm(buildTokenInput({ name: 'Token1' }));

      let ackResult: SocketAck | undefined;
      playerSocket.trigger(
        'map:token:remove',
        { tokenId: token.id },
        (res: SocketAck) => {
          ackResult = res;
        },
      );

      expect(ackResult?.ok).toBe(false);
      expect(ackResult?.error).toContain('dm');
    });
  });

  describe('map:token:update (DM only)', () => {
    it('DM 应能更新 Token 并广播', () => {
      const token = addTokenViaDm(buildTokenInput({ name: '原名' }));

      let ackResult: SocketAck<MapToken> | undefined;
      dmSocket.trigger(
        'map:token:update',
        { tokenId: token.id, patch: { name: '新名' } },
        (res: SocketAck<MapToken>) => {
          ackResult = res;
        },
      );

      expect(ackResult?.ok).toBe(true);
      expect(ackResult?.data?.name).toBe('新名');

      // 应广播 map:token:updated
      const broadcasts = io.broadcastCalls.get(roomId) ?? [];
      const updatedEvent = broadcasts.find((b) => b.event === 'map:token:updated');
      expect(updatedEvent).toBeDefined();
      expect((updatedEvent?.data as { token: MapToken }).token.name).toBe('新名');
    });

    it('玩家不能更新 Token', () => {
      const token = addTokenViaDm(buildTokenInput({ name: 'Token1' }));

      let ackResult: SocketAck | undefined;
      playerSocket.trigger(
        'map:token:update',
        { tokenId: token.id, patch: { name: '篡改' } },
        (res: SocketAck) => {
          ackResult = res;
        },
      );

      expect(ackResult?.ok).toBe(false);
      expect(ackResult?.error).toContain('dm');
    });
  });

  describe('map:fog:toggle (DM only)', () => {
    it('DM 应能添加迷雾并广播', () => {
      let ackResult: SocketAck | undefined;
      dmSocket.trigger(
        'map:fog:toggle',
        { cells: ['0,0', '1,1'], mode: 'add' },
        (res: SocketAck) => {
          ackResult = res;
        },
      );

      expect(ackResult?.ok).toBe(true);

      // 应广播 map:fog:updated
      const broadcasts = io.broadcastCalls.get(roomId) ?? [];
      const fogEvent = broadcasts.find((b) => b.event === 'map:fog:updated');
      expect(fogEvent).toBeDefined();
      expect((fogEvent?.data as { fogCells: string[] }).fogCells).toEqual([
        '0,0',
        '1,1',
      ]);
    });

    it('玩家不能切换迷雾', () => {
      let ackResult: SocketAck | undefined;
      playerSocket.trigger(
        'map:fog:toggle',
        { cells: ['0,0'], mode: 'add' },
        (res: SocketAck) => {
          ackResult = res;
        },
      );

      expect(ackResult?.ok).toBe(false);
      expect(ackResult?.error).toContain('dm');
    });

    it('无效 mode 应返回错误', () => {
      let ackResult: SocketAck | undefined;
      dmSocket.trigger(
        'map:fog:toggle',
        { cells: ['0,0'], mode: 'invalid' as 'add' },
        (res: SocketAck) => {
          ackResult = res;
        },
      );

      expect(ackResult?.ok).toBe(false);
      expect(ackResult?.error).toContain('mode');
    });
  });

  describe('map:fog:clear (DM only)', () => {
    it('DM 应能清空迷雾并广播', () => {
      // 先添加迷雾
      dmSocket.trigger('map:fog:toggle', {
        cells: ['0,0', '1,1'],
        mode: 'add',
      }, () => {
        // no-op
      });

      // 清空之前的广播记录
      io.broadcastCalls.clear();

      let ackResult: SocketAck | undefined;
      dmSocket.trigger('map:fog:clear', (res: SocketAck) => {
        ackResult = res;
      });

      expect(ackResult?.ok).toBe(true);

      // 应广播 map:fog:updated（空数组）
      const broadcasts = io.broadcastCalls.get(roomId) ?? [];
      const fogEvent = broadcasts.find((b) => b.event === 'map:fog:updated');
      expect(fogEvent).toBeDefined();
      expect((fogEvent?.data as { fogCells: string[] }).fogCells).toEqual([]);
    });

    it('玩家不能清空迷雾', () => {
      let ackResult: SocketAck | undefined;
      playerSocket.trigger('map:fog:clear', (res: SocketAck) => {
        ackResult = res;
      });

      expect(ackResult?.ok).toBe(false);
      expect(ackResult?.error).toContain('dm');
    });
  });

  describe('map:config:set (DM only)', () => {
    it('DM 应能设置配置并广播 map:state', () => {
      let ackResult: SocketAck<MapState> | undefined;
      dmSocket.trigger(
        'map:config:set',
        { gridType: 'hex', width: 30 },
        (res: SocketAck<MapState>) => {
          ackResult = res;
        },
      );

      expect(ackResult?.ok).toBe(true);
      expect(ackResult?.data?.gridType).toBe('hex');
      expect(ackResult?.data?.width).toBe(30);

      // 应广播 map:state
      const dmStateEvents = dmSocket.emitCalls.filter(
        (e) => e.event === 'map:state',
      );
      expect(dmStateEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('玩家不能设置配置', () => {
      let ackResult: SocketAck | undefined;
      playerSocket.trigger(
        'map:config:set',
        { gridType: 'hex' },
        (res: SocketAck) => {
          ackResult = res;
        },
      );

      expect(ackResult?.ok).toBe(false);
      expect(ackResult?.error).toContain('dm');
    });
  });

  describe('map:background:set (DM only)', () => {
    it('DM 应能设置背景图并广播 map:state', () => {
      let ackResult: SocketAck<MapState> | undefined;
      dmSocket.trigger(
        'map:background:set',
        { url: '/uploads/bg.png' },
        (res: SocketAck<MapState>) => {
          ackResult = res;
        },
      );

      expect(ackResult?.ok).toBe(true);
      expect(ackResult?.data?.backgroundUrl).toBe('/uploads/bg.png');
    });

    it('DM 应能清除背景图（传 null）', () => {
      // 先设置
      dmSocket.trigger('map:background:set', { url: '/uploads/bg.png' }, () => {
        // no-op
      });

      let ackResult: SocketAck<MapState> | undefined;
      dmSocket.trigger(
        'map:background:set',
        { url: null },
        (res: SocketAck<MapState>) => {
          ackResult = res;
        },
      );

      expect(ackResult?.ok).toBe(true);
      expect(ackResult?.data?.backgroundUrl).toBeNull();
    });

    it('玩家不能设置背景图', () => {
      let ackResult: SocketAck | undefined;
      playerSocket.trigger(
        'map:background:set',
        { url: '/uploads/bg.png' },
        (res: SocketAck) => {
          ackResult = res;
        },
      );

      expect(ackResult?.ok).toBe(false);
      expect(ackResult?.error).toContain('dm');
    });
  });

  describe('未鉴权 Socket', () => {
    it('未鉴权时不应注册事件处理器', () => {
      const unauthSocket = new MockSocket(
        'unauth',
        {} as SocketAuthData,
      );
      const unauthIo = new MockIo();

      // 不应抛错
      registerMapHandler(
        unauthIo as unknown as AppServer,
        unauthSocket as unknown as AppSocket,
      );

      // 触发事件应无效果
      let ackCalled = false;
      unauthSocket.trigger('map:getState', () => {
        ackCalled = true;
      });
      expect(ackCalled).toBe(false);
    });
  });
});
