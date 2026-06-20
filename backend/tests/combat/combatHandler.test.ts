import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createInMemoryDb,
  setDbInstance,
  closeDb,
} from '../../src/db/index.js';
import { roomRepository } from '../../src/db/repositories/RoomRepository.js';
import { characterRepository } from '../../src/db/repositories/CharacterRepository.js';
import { registerCombatHandler } from '../../src/socket/combatHandler.js';
import type { AppServer, AppSocket } from '../../src/socket/index.js';
import type {
  SocketAck,
  CombatStartPayload,
  CombatStateEvent,
  LogEvent,
} from '../../src/types/socket.js';
import type { SocketAuthData } from '../../src/middleware/auth.js';
import type { CombatState } from '../../src/types/models.js';

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

describe('combatHandler', () => {
  let io: MockIo;
  let dmSocket: MockSocket;
  let playerSocket: MockSocket;
  let roomId: string;
  let dmId: string;
  let playerId: string;
  let characterId: string;
  let npcId: string;

  beforeEach(() => {
    const db = createInMemoryDb();
    setDbInstance(db);

    // 创建房间
    dmId = roomRepository.generatePlayerId();
    const room = roomRepository.create('dnd5e', dmId, 'DM');
    roomId = room.id;

    // 添加玩家
    playerId = roomRepository.generatePlayerId();
    roomRepository.addPlayer(roomId, {
      id: playerId,
      name: '玩家1',
      role: 'player',
      joinedAt: Date.now(),
      isConnected: true,
    });

    // 创建角色
    const char = characterRepository.create({
      roomId,
      playerId,
      name: '战士',
      ruleSystem: 'dnd5e',
      data: {
        name: '战士',
        level: 1,
        dex: 14,
        dexMod: 2,
        hp: 20,
        maxHp: 20,
        ac: 16,
      },
      portraitUrl: null,
      isNpc: false,
    });
    characterId = char.id;

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
    npcId = npc.id;

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

    // 注册战斗处理器（DM 与玩家各注册一份）
    registerCombatHandler(
      io as unknown as AppServer,
      dmSocket as unknown as AppSocket,
    );
    registerCombatHandler(
      io as unknown as AppServer,
      playerSocket as unknown as AppSocket,
    );
  });

  afterEach(() => {
    closeDb();
  });

  /** 获取指定房间的广播调用 */
  function getBroadcasts(): { event: string; data: unknown }[] {
    return io.broadcastCalls.get(roomId) ?? [];
  }

  describe('combat:start - DM only', () => {
    it('DM 开始战斗应广播 combat:state 与 log:add', () => {
      const payload: CombatStartPayload = {
        participantIds: [characterId, npcId],
        rollInitiative: true,
      };
      let ackResult: SocketAck<CombatState> | undefined;
      const ack = (res: SocketAck<CombatState>): void => {
        ackResult = res;
      };

      dmSocket.trigger('combat:start', payload, ack);

      expect(ackResult?.ok).toBe(true);
      expect(ackResult?.data).toBeDefined();
      expect(ackResult?.data?.isActive).toBe(true);

      // 应广播 combat:state 与 log:add
      const broadcasts = getBroadcasts();
      const stateEvents = broadcasts.filter((b) => b.event === 'combat:state');
      const logEvents = broadcasts.filter((b) => b.event === 'log:add');
      expect(stateEvents.length).toBeGreaterThanOrEqual(1);
      expect(logEvents.length).toBeGreaterThanOrEqual(1);

      const stateEvent = stateEvents[0].data as CombatStateEvent;
      expect(stateEvent.combat).not.toBeNull();
      expect(stateEvent.combat?.participants).toHaveLength(2);
    });

    it('非 DM 玩家开始战斗应返回权限错误', () => {
      const payload: CombatStartPayload = {
        participantIds: [characterId],
        rollInitiative: true,
      };
      let ackResult: SocketAck | undefined;
      const ack = (res: SocketAck): void => {
        ackResult = res;
      };

      playerSocket.trigger('combat:start', payload, ack);

      expect(ackResult?.ok).toBe(false);
      expect(ackResult?.error).toContain('权限');
    });
  });

  describe('combat:end - DM only', () => {
    it('DM 结束战斗应广播 combat:state（combat 为 null）与 log:add', () => {
      // 先开始战斗
      dmSocket.trigger('combat:start', { participantIds: [characterId], rollInitiative: false }, () => {});
      io.broadcastCalls.clear();

      let ackResult: SocketAck | undefined;
      const ack = (res: SocketAck): void => {
        ackResult = res;
      };
      dmSocket.trigger('combat:end', ack);

      expect(ackResult?.ok).toBe(true);

      const broadcasts = getBroadcasts();
      const stateEvents = broadcasts.filter((b) => b.event === 'combat:state');
      expect(stateEvents.length).toBeGreaterThanOrEqual(1);
      const stateEvent = stateEvents[0].data as CombatStateEvent;
      expect(stateEvent.combat).toBeNull();
    });

    it('非 DM 玩家结束战斗应返回权限错误', () => {
      let ackResult: SocketAck | undefined;
      const ack = (res: SocketAck): void => {
        ackResult = res;
      };
      playerSocket.trigger('combat:end', ack);
      expect(ackResult?.ok).toBe(false);
    });
  });

  describe('combat:nextTurn - DM only', () => {
    it('DM 推进回合应广播 combat:state、combat:turn 与 log:add', () => {
      // 先开始战斗
      dmSocket.trigger('combat:start', { participantIds: [characterId, npcId], rollInitiative: false }, () => {});
      io.broadcastCalls.clear();

      let ackResult: SocketAck<CombatState> | undefined;
      const ack = (res: SocketAck<CombatState>): void => {
        ackResult = res;
      };
      dmSocket.trigger('combat:nextTurn', ack);

      expect(ackResult?.ok).toBe(true);

      const broadcasts = getBroadcasts();
      const stateEvents = broadcasts.filter((b) => b.event === 'combat:state');
      const turnEvents = broadcasts.filter((b) => b.event === 'combat:turn');
      const logEvents = broadcasts.filter((b) => b.event === 'log:add');
      expect(stateEvents.length).toBeGreaterThanOrEqual(1);
      expect(turnEvents.length).toBeGreaterThanOrEqual(1);
      expect(logEvents.length).toBeGreaterThanOrEqual(1);

      const turnPayload = turnEvents[0].data as {
        round: number;
        currentTurn: number;
        participant: unknown;
      };
      expect(turnPayload.participant).toBeDefined();
    });

    it('非 DM 玩家推进回合应返回权限错误', () => {
      let ackResult: SocketAck | undefined;
      const ack = (res: SocketAck): void => {
        ackResult = res;
      };
      playerSocket.trigger('combat:nextTurn', ack);
      expect(ackResult?.ok).toBe(false);
    });
  });

  describe('combat:prevTurn - DM only', () => {
    it('DM 回退回合应广播 combat:state', () => {
      dmSocket.trigger('combat:start', { participantIds: [characterId, npcId], rollInitiative: false }, () => {});
      io.broadcastCalls.clear();

      let ackResult: SocketAck<CombatState> | undefined;
      const ack = (res: SocketAck<CombatState>): void => {
        ackResult = res;
      };
      dmSocket.trigger('combat:prevTurn', ack);

      expect(ackResult?.ok).toBe(true);
      const broadcasts = getBroadcasts();
      expect(broadcasts.some((b) => b.event === 'combat:state')).toBe(true);
    });

    it('非 DM 玩家回退回合应返回权限错误', () => {
      let ackResult: SocketAck | undefined;
      const ack = (res: SocketAck): void => {
        ackResult = res;
      };
      playerSocket.trigger('combat:prevTurn', ack);
      expect(ackResult?.ok).toBe(false);
    });
  });

  describe('combat:addParticipant - DM only', () => {
    it('DM 添加参与者应广播 combat:state', () => {
      dmSocket.trigger('combat:start', { participantIds: [characterId], rollInitiative: false }, () => {});
      io.broadcastCalls.clear();

      let ackResult: SocketAck<CombatState> | undefined;
      const ack = (res: SocketAck<CombatState>): void => {
        ackResult = res;
      };
      dmSocket.trigger(
        'combat:addParticipant',
        { name: '新怪物', type: 'npc', hp: 15, maxHp: 15, initiative: 20 },
        ack,
      );

      expect(ackResult?.ok).toBe(true);
      expect(ackResult?.data?.participants).toHaveLength(2);

      const broadcasts = getBroadcasts();
      expect(broadcasts.some((b) => b.event === 'combat:state')).toBe(true);
    });

    it('非 DM 玩家添加参与者应返回权限错误', () => {
      let ackResult: SocketAck | undefined;
      const ack = (res: SocketAck): void => {
        ackResult = res;
      };
      playerSocket.trigger(
        'combat:addParticipant',
        { name: '怪物', type: 'npc', hp: 10, maxHp: 10 },
        ack,
      );
      expect(ackResult?.ok).toBe(false);
    });
  });

  describe('combat:removeParticipant - DM only', () => {
    it('DM 移除参与者应广播 combat:state', () => {
      let combatState: CombatState | undefined;
      dmSocket.trigger(
        'combat:start',
        { participantIds: [characterId, npcId], rollInitiative: false },
        (res: SocketAck<CombatState>) => {
          combatState = res.data;
        },
      );
      io.broadcastCalls.clear();

      const participantId = combatState?.participants[0].id;
      let ackResult: SocketAck<CombatState> | undefined;
      const ack = (res: SocketAck<CombatState>): void => {
        ackResult = res;
      };
      dmSocket.trigger('combat:removeParticipant', { participantId }, ack);

      expect(ackResult?.ok).toBe(true);
      expect(ackResult?.data?.participants).toHaveLength(1);
    });

    it('非 DM 玩家移除参与者应返回权限错误', () => {
      let ackResult: SocketAck | undefined;
      const ack = (res: SocketAck): void => {
        ackResult = res;
      };
      playerSocket.trigger('combat:removeParticipant', { participantId: 'p-1' }, ack);
      expect(ackResult?.ok).toBe(false);
    });
  });

  describe('combat:updateParticipant - DM only', () => {
    it('DM 更新 HP 应广播 combat:state 与 log:add', () => {
      let combatState: CombatState | undefined;
      dmSocket.trigger(
        'combat:start',
        { participantIds: [characterId], rollInitiative: false },
        (res: SocketAck<CombatState>) => {
          combatState = res.data;
        },
      );
      io.broadcastCalls.clear();

      const participantId = combatState?.participants[0].id;
      let ackResult: SocketAck<CombatState> | undefined;
      const ack = (res: SocketAck<CombatState>): void => {
        ackResult = res;
      };
      dmSocket.trigger(
        'combat:updateParticipant',
        { participantId, patch: { hp: 5 } },
        ack,
      );

      expect(ackResult?.ok).toBe(true);
      const participant = ackResult?.data?.participants.find((p) => p.id === participantId);
      expect(participant?.hp).toBe(5);

      // HP 变化应广播 log:add
      const broadcasts = getBroadcasts();
      const logEvents = broadcasts.filter((b) => b.event === 'log:add');
      expect(logEvents.length).toBeGreaterThanOrEqual(1);
      const logEvent = logEvents[0].data as LogEvent;
      expect(logEvent.type).toBe('combat');
      expect(logEvent.message).toContain('5');
    });

    it('非 DM 玩家更新参与者应返回权限错误', () => {
      let ackResult: SocketAck | undefined;
      const ack = (res: SocketAck): void => {
        ackResult = res;
      };
      playerSocket.trigger(
        'combat:updateParticipant',
        { participantId: 'p-1', patch: { hp: 5 } },
        ack,
      );
      expect(ackResult?.ok).toBe(false);
    });
  });

  describe('combat:rollInitiative - DM only', () => {
    it('DM 重掷先攻应广播 combat:state', () => {
      let combatState: CombatState | undefined;
      dmSocket.trigger(
        'combat:start',
        { participantIds: [characterId, npcId], rollInitiative: false },
        (res: SocketAck<CombatState>) => {
          combatState = res.data;
        },
      );
      io.broadcastCalls.clear();

      const participantId = combatState?.participants[0].id;
      let ackResult: SocketAck<CombatState> | undefined;
      const ack = (res: SocketAck<CombatState>): void => {
        ackResult = res;
      };
      dmSocket.trigger('combat:rollInitiative', { participantId }, ack);

      expect(ackResult?.ok).toBe(true);
      const broadcasts = getBroadcasts();
      expect(broadcasts.some((b) => b.event === 'combat:state')).toBe(true);
    });

    it('非 DM 玩家重掷先攻应返回权限错误', () => {
      let ackResult: SocketAck | undefined;
      const ack = (res: SocketAck): void => {
        ackResult = res;
      };
      playerSocket.trigger('combat:rollInitiative', { participantId: 'p-1' }, ack);
      expect(ackResult?.ok).toBe(false);
    });
  });

  describe('未鉴权 Socket', () => {
    it('未鉴权时不应注册事件处理器', () => {
      const unauthSocket = new MockSocket('unauth', {} as SocketAuthData);
      const unauthIo = new MockIo();

      registerCombatHandler(
        unauthIo as unknown as AppServer,
        unauthSocket as unknown as AppSocket,
      );

      let ackCalled = false;
      unauthSocket.trigger('combat:start', { participantIds: [], rollInitiative: false }, () => {
        ackCalled = true;
      });
      expect(ackCalled).toBe(false);
    });
  });
});
