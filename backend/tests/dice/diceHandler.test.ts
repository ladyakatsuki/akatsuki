import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createInMemoryDb,
  setDbInstance,
  closeDb,
} from '../../src/db/index.js';
import { roomRepository } from '../../src/db/repositories/RoomRepository.js';
import { characterRepository } from '../../src/db/repositories/CharacterRepository.js';
import { registerDiceHandler } from '../../src/socket/diceHandler.js';
import type { AppServer, AppSocket } from '../../src/socket/index.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  DiceRollResultEvent,
  LogEvent,
  SocketAck,
  DiceRollRequest,
} from '../../src/types/socket.js';
import type { SocketAuthData } from '../../src/middleware/auth.js';
import type { Character } from '../../src/types/models.js';

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

  /** 添加 socket 到 io（用于暗骰测试） */
  addSocket(socket: MockSocket): void {
    this.sockets.sockets.set(socket.id, socket);
  }
}

describe('diceHandler', () => {
  let io: MockIo;
  let socket: MockSocket;
  let dmSocket: MockSocket;
  let roomId: string;
  let dmId: string;
  let playerId: string;
  let character: Character;

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
    character = characterRepository.create({
      roomId,
      playerId,
      name: '角色1',
      ruleSystem: 'dnd5e',
      data: {
        name: '战士',
        level: 1,
        str: 16,
        strMod: 3,
        dex: 14,
        dexMod: 2,
        proficiencyBonus: 2,
        athletics: 1,
      },
      portraitUrl: null,
      isNpc: false,
    });

    // 创建 Mock socket
    io = new MockIo();
    socket = new MockSocket('socket-player', {
      roomId,
      playerId,
      role: 'player',
      playerName: '玩家1',
    });
    dmSocket = new MockSocket('socket-dm', {
      roomId,
      playerId: dmId,
      role: 'dm',
      playerName: 'DM',
    });
    io.addSocket(socket);
    io.addSocket(dmSocket);

    // 注册骰子处理器
    registerDiceHandler(
      io as unknown as AppServer,
      socket as unknown as AppSocket,
    );
  });

  afterEach(() => {
    closeDb();
  });

  describe('dice:roll - 公开掷骰', () => {
    it('应广播 dice:result 和 log:add 给全房间', () => {
      const request: DiceRollRequest = { expression: '1d20' };
      let ackResult: SocketAck<DiceRollResultEvent> | undefined;
      const ack = (res: SocketAck<DiceRollResultEvent>): void => {
        ackResult = res;
      };

      socket.trigger('dice:roll', request, ack);

      // ack 应返回成功
      expect(ackResult).toBeDefined();
      expect(ackResult?.ok).toBe(true);
      expect(ackResult?.data).toBeDefined();
      expect(ackResult?.data?.expression).toBe('1d20');
      expect(ackResult?.data?.playerId).toBe(playerId);
      expect(ackResult?.data?.playerName).toBe('玩家1');

      // 应广播给全房间
      const broadcasts = io.broadcastCalls.get(roomId) ?? [];
      expect(broadcasts).toHaveLength(2);
      expect(broadcasts[0].event).toBe('dice:result');
      expect(broadcasts[1].event).toBe('log:add');

      // 验证 dice:result 广播内容
      const diceResult = broadcasts[0].data as DiceRollResultEvent;
      expect(diceResult.expression).toBe('1d20');
      expect(diceResult.rolls).toHaveLength(1);
      expect(diceResult.isHidden).toBe(false);

      // 验证 log:add 广播内容
      const logEvent = broadcasts[1].data as LogEvent;
      expect(logEvent.type).toBe('dice');
      expect(logEvent.message).toContain('玩家1');
      expect(logEvent.message).toContain('1d20');
      expect(logEvent.playerId).toBe(playerId);
    });

    it('缺少 expression 时应返回错误', () => {
      let ackResult: SocketAck | undefined;
      const ack = (res: SocketAck): void => {
        ackResult = res;
      };

      socket.trigger('dice:roll', {} as DiceRollRequest, ack);

      expect(ackResult?.ok).toBe(false);
      expect(ackResult?.error).toContain('expression');
    });

    it('应正确处理带 label 的掷骰', () => {
      const request: DiceRollRequest = {
        expression: '1d20+5',
        label: '攻击检定',
      };
      let ackResult: SocketAck<DiceRollResultEvent> | undefined;
      const ack = (res: SocketAck<DiceRollResultEvent>): void => {
        ackResult = res;
      };

      socket.trigger('dice:roll', request, ack);

      expect(ackResult?.ok).toBe(true);
      expect(ackResult?.data?.label).toBe('攻击检定');

      const broadcasts = io.broadcastCalls.get(roomId) ?? [];
      const logEvent = broadcasts[1].data as LogEvent;
      expect(logEvent.message).toContain('攻击检定');
    });
  });

  describe('dice:roll - 暗骰', () => {
    it('暗骰应仅发给掷骰者和 DM，不广播给全房间', () => {
      const request: DiceRollRequest = {
        expression: '1d20',
        isHidden: true,
      };
      let ackResult: SocketAck<DiceRollResultEvent> | undefined;
      const ack = (res: SocketAck<DiceRollResultEvent>): void => {
        ackResult = res;
      };

      socket.trigger('dice:roll', request, ack);

      // ack 应返回成功
      expect(ackResult?.ok).toBe(true);
      expect(ackResult?.data?.isHidden).toBe(true);

      // 不应广播给全房间
      const broadcasts = io.broadcastCalls.get(roomId) ?? [];
      expect(broadcasts).toHaveLength(0);

      // 掷骰者应收到 dice:result 和 log:add
      const playerEmits = socket.emitCalls;
      expect(playerEmits).toHaveLength(2);
      expect(playerEmits[0].event).toBe('dice:result');
      expect(playerEmits[1].event).toBe('log:add');

      // DM 应收到 dice:result 和 log:add
      const dmEmits = dmSocket.emitCalls;
      expect(dmEmits).toHaveLength(2);
      expect(dmEmits[0].event).toBe('dice:result');
      expect(dmEmits[1].event).toBe('log:add');

      // DM 收到的结果应与掷骰者一致
      const playerResult = playerEmits[0].data as DiceRollResultEvent;
      const dmResult = dmEmits[0].data as DiceRollResultEvent;
      expect(dmResult.id).toBe(playerResult.id);
      expect(dmResult.isHidden).toBe(true);
    });

    it('DM 自己掷暗骰时不应重复发送', () => {
      // 为 DM 注册处理器
      const dmIo = new MockIo();
      const dmSocketLocal = new MockSocket('socket-dm-local', {
        roomId,
        playerId: dmId,
        role: 'dm',
        playerName: 'DM',
      });
      dmIo.addSocket(dmSocketLocal);
      registerDiceHandler(
        dmIo as unknown as AppServer,
        dmSocketLocal as unknown as AppSocket,
      );

      const request: DiceRollRequest = {
        expression: '1d20',
        isHidden: true,
      };
      let ackResult: SocketAck<DiceRollResultEvent> | undefined;
      const ack = (res: SocketAck<DiceRollResultEvent>): void => {
        ackResult = res;
      };

      dmSocketLocal.trigger('dice:roll', request, ack);

      expect(ackResult?.ok).toBe(true);

      // 不应广播给全房间
      const broadcasts = dmIo.broadcastCalls.get(roomId) ?? [];
      expect(broadcasts).toHaveLength(0);

      // DM 应收到 dice:result 和 log:add（仅一次，不重复）
      expect(dmSocketLocal.emitCalls).toHaveLength(2);
    });
  });

  describe('dice:rollSkill', () => {
    it('应执行技能检定并广播结果', () => {
      let ackResult: SocketAck<DiceRollResultEvent> | undefined;
      const ack = (res: SocketAck<DiceRollResultEvent>): void => {
        ackResult = res;
      };

      socket.trigger(
        'dice:rollSkill',
        { characterId: character.id, skillKey: 'athletics' },
        ack,
      );

      expect(ackResult?.ok).toBe(true);
      expect(ackResult?.data?.characterId).toBe(character.id);
      expect(ackResult?.data?.label).toBeTruthy();

      // 应广播给全房间
      const broadcasts = io.broadcastCalls.get(roomId) ?? [];
      expect(broadcasts).toHaveLength(2);
      expect(broadcasts[0].event).toBe('dice:result');
      expect(broadcasts[1].event).toBe('log:add');
    });

    it('缺少 characterId 时应返回错误', () => {
      let ackResult: SocketAck | undefined;
      const ack = (res: SocketAck): void => {
        ackResult = res;
      };

      socket.trigger(
        'dice:rollSkill',
        { skillKey: 'athletics' } as { characterId: string; skillKey: string },
        ack,
      );

      expect(ackResult?.ok).toBe(false);
      expect(ackResult?.error).toContain('characterId');
    });

    it('缺少 skillKey 时应返回错误', () => {
      let ackResult: SocketAck | undefined;
      const ack = (res: SocketAck): void => {
        ackResult = res;
      };

      socket.trigger(
        'dice:rollSkill',
        { characterId: character.id } as { characterId: string; skillKey: string },
        ack,
      );

      expect(ackResult?.ok).toBe(false);
      expect(ackResult?.error).toContain('skillKey');
    });
  });

  describe('dice:rollSan', () => {
    beforeEach(() => {
      // 重新创建 COC 房间用于 SAN 测试
      closeDb();
      const db = createInMemoryDb();
      setDbInstance(db);

      dmId = roomRepository.generatePlayerId();
      const room = roomRepository.create('coc7', dmId, 'DM');
      roomId = room.id;

      playerId = roomRepository.generatePlayerId();
      roomRepository.addPlayer(roomId, {
        id: playerId,
        name: '玩家1',
        role: 'player',
        joinedAt: Date.now(),
        isConnected: true,
      });

      character = characterRepository.create({
        roomId,
        playerId,
        name: 'COC 角色',
        ruleSystem: 'coc7',
        data: {
          name: '调查员',
          san: 60,
          luck: 50,
          libraryUse: 50,
        },
        portraitUrl: null,
        isNpc: false,
      });

      io = new MockIo();
      socket = new MockSocket('socket-player', {
        roomId,
        playerId,
        role: 'player',
        playerName: '玩家1',
      });
      dmSocket = new MockSocket('socket-dm', {
        roomId,
        playerId: dmId,
        role: 'dm',
        playerName: 'DM',
      });
      io.addSocket(socket);
      io.addSocket(dmSocket);

      registerDiceHandler(
        io as unknown as AppServer,
        socket as unknown as AppSocket,
      );
    });

    it('应执行 SAN 检定并广播结果与角色数据更新', () => {
      let ackResult: SocketAck<DiceRollResultEvent> | undefined;
      const ack = (res: SocketAck<DiceRollResultEvent>): void => {
        ackResult = res;
      };

      // 使用固定数字 10 确保 SAN 一定减少（成功扣 5，失败扣 10）
      socket.trigger(
        'dice:rollSan',
        { characterId: character.id, sanLossExpression: '10' },
        ack,
      );

      expect(ackResult?.ok).toBe(true);
      expect(ackResult?.data?.label).toBe('SAN 检定');
      expect(ackResult?.data?.sanLossApplied).toBeDefined();
      expect(ackResult?.data?.target).toBe(60);

      // 应广播 dice:result、log:add、character:dataUpdated
      const broadcasts = io.broadcastCalls.get(roomId) ?? [];
      expect(broadcasts.length).toBeGreaterThanOrEqual(2);
      expect(broadcasts[0].event).toBe('dice:result');
      expect(broadcasts[1].event).toBe('log:add');

      // 应有 character:dataUpdated 事件
      const dataUpdatedEvents = broadcasts.filter(
        (b) => b.event === 'character:dataUpdated',
      );
      expect(dataUpdatedEvents).toHaveLength(1);
      const updatePayload = dataUpdatedEvents[0].data as {
        characterId: string;
        data: Record<string, unknown>;
      };
      expect(updatePayload.characterId).toBe(character.id);
      expect(updatePayload.data.san).toBeDefined();
      // SAN 应减少（成功扣 5，失败扣 10）
      expect(updatePayload.data.san as number).toBeLessThan(60);
    });

    it('缺少 characterId 时应返回错误', () => {
      let ackResult: SocketAck | undefined;
      const ack = (res: SocketAck): void => {
        ackResult = res;
      };

      socket.trigger(
        'dice:rollSan',
        { sanLossExpression: '1d10' } as {
          characterId: string;
          sanLossExpression: string;
        },
        ack,
      );

      expect(ackResult?.ok).toBe(false);
      expect(ackResult?.error).toContain('characterId');
    });

    it('缺少 sanLossExpression 时应返回错误', () => {
      let ackResult: SocketAck | undefined;
      const ack = (res: SocketAck): void => {
        ackResult = res;
      };

      socket.trigger(
        'dice:rollSan',
        { characterId: character.id } as {
          characterId: string;
          sanLossExpression: string;
        },
        ack,
      );

      expect(ackResult?.ok).toBe(false);
      expect(ackResult?.error).toContain('sanLossExpression');
    });
  });

  describe('未鉴权 Socket', () => {
    it('未鉴权时不应注册事件处理器', () => {
      const unauthSocket = new MockSocket('unauth', {} as SocketAuthData);
      const unauthIo = new MockIo();

      // 不应抛错
      registerDiceHandler(
        unauthIo as unknown as AppServer,
        unauthSocket as unknown as AppSocket,
      );

      // 不应有事件注册（handlers 为空）
      // 触发事件应无效果
      let ackCalled = false;
      unauthSocket.trigger('dice:roll', { expression: '1d20' }, () => {
        ackCalled = true;
      });
      expect(ackCalled).toBe(false);
    });
  });
});

// 避免 vi 未使用警告
void vi;
