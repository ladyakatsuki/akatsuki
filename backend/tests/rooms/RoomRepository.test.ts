import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createInMemoryDb,
  setDbInstance,
  closeDb,
} from '../../src/db/index.js';
import {
  RoomRepository,
  MAX_PLAYERS,
} from '../../src/db/repositories/RoomRepository.js';
import type { RoomPlayer } from '../../src/types/models.js';

describe('RoomRepository', () => {
  let repo: RoomRepository;

  beforeEach(() => {
    const db = createInMemoryDb();
    setDbInstance(db);
    repo = new RoomRepository();
  });

  afterEach(() => {
    closeDb();
  });

  describe('create', () => {
    it('应创建房间并生成 6 位房间码', () => {
      const room = repo.create('dnd5e', 'dm-1', 'DM 玩家');
      expect(room.id).toBeTruthy();
      expect(room.code).toHaveLength(6);
      expect(room.ruleSystem).toBe('dnd5e');
      expect(room.dmId).toBe('dm-1');
      expect(room.players).toHaveLength(1);
      expect(room.players[0].id).toBe('dm-1');
      expect(room.players[0].name).toBe('DM 玩家');
      expect(room.players[0].role).toBe('dm');
      expect(room.storyId).toBeNull();
      expect(room.createdAt).toBeGreaterThan(0);
    });

    it('房间码应只包含允许的字符（排除 O/0/I/1/L）', () => {
      const room = repo.create('coc7', 'dm-2', 'DM');
      const allowedChars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
      for (const c of room.code) {
        expect(allowedChars).toContain(c);
      }
    });

    it('应生成唯一的房间码', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const room = repo.create('dnd5e', `dm-${i}`, `DM${i}`);
        expect(codes.has(room.code)).toBe(false);
        codes.add(room.code);
      }
    });
  });

  describe('findByCode / findById', () => {
    it('应按房间码查询到房间', () => {
      const created = repo.create('dnd5e', 'dm-1', 'DM');
      const found = repo.findByCode(created.code);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    it('应按 ID 查询到房间', () => {
      const created = repo.create('dnd5e', 'dm-1', 'DM');
      const found = repo.findById(created.id);
      expect(found).not.toBeNull();
      expect(found?.code).toBe(created.code);
    });

    it('查询不存在的房间码应返回 null', () => {
      expect(repo.findByCode('NOTEXS')).toBeNull();
    });

    it('查询不存在的 ID 应返回 null', () => {
      expect(repo.findById('not-exist')).toBeNull();
    });
  });

  describe('addPlayer', () => {
    it('应添加玩家到房间', () => {
      const room = repo.create('dnd5e', 'dm-1', 'DM');
      const player: RoomPlayer = {
        id: 'p-1',
        name: '玩家1',
        role: 'player',
        joinedAt: Date.now(),
      };
      const updated = repo.addPlayer(room.id, player);
      expect(updated.players).toHaveLength(2);
      expect(updated.players[1].id).toBe('p-1');
    });

    it('满 6 人时应拒绝添加', () => {
      const room = repo.create('dnd5e', 'dm-1', 'DM');
      // 已有 1 DM，再添加 5 玩家达到上限
      for (let i = 1; i <= 5; i++) {
        repo.addPlayer(room.id, {
          id: `p-${i}`,
          name: `玩家${i}`,
          role: 'player',
          joinedAt: Date.now(),
        });
      }
      // 第 7 人应被拒绝
      expect(() =>
        repo.addPlayer(room.id, {
          id: 'p-6',
          name: '玩家6',
          role: 'player',
          joinedAt: Date.now(),
        }),
      ).toThrow(/房间已满/);
    });

    it('重复添加同一玩家应抛错', () => {
      const room = repo.create('dnd5e', 'dm-1', 'DM');
      const player: RoomPlayer = {
        id: 'p-1',
        name: '玩家1',
        role: 'player',
        joinedAt: Date.now(),
      };
      repo.addPlayer(room.id, player);
      expect(() => repo.addPlayer(room.id, player)).toThrow(/已在房间内/);
    });

    it('房间不存在时应抛错', () => {
      expect(() =>
        repo.addPlayer('not-exist', {
          id: 'p-1',
          name: '玩家1',
          role: 'player',
          joinedAt: Date.now(),
        }),
      ).toThrow(/房间不存在/);
    });
  });

  describe('removePlayer', () => {
    it('应移除房间内玩家', () => {
      const room = repo.create('dnd5e', 'dm-1', 'DM');
      repo.addPlayer(room.id, {
        id: 'p-1',
        name: '玩家1',
        role: 'player',
        joinedAt: Date.now(),
      });
      const updated = repo.removePlayer(room.id, 'p-1');
      expect(updated?.players).toHaveLength(1);
      expect(updated?.players.find((p) => p.id === 'p-1')).toBeUndefined();
    });

    it('移除不存在的玩家应返回原房间', () => {
      const room = repo.create('dnd5e', 'dm-1', 'DM');
      const updated = repo.removePlayer(room.id, 'not-exist');
      expect(updated?.players).toHaveLength(1);
    });

    it('房间不存在时返回 null', () => {
      expect(repo.removePlayer('not-exist', 'p-1')).toBeNull();
    });
  });

  describe('updatePlayerConnection', () => {
    it('应更新玩家在线状态为 true', () => {
      const room = repo.create('dnd5e', 'dm-1', 'DM');
      const updated = repo.updatePlayerConnection(room.id, 'dm-1', true);
      expect(updated?.players[0].isConnected).toBe(true);
    });

    it('应更新玩家在线状态为 false', () => {
      const room = repo.create('dnd5e', 'dm-1', 'DM');
      repo.updatePlayerConnection(room.id, 'dm-1', true);
      const updated = repo.updatePlayerConnection(room.id, 'dm-1', false);
      expect(updated?.players[0].isConnected).toBe(false);
    });

    it('更新不存在的玩家应返回原房间（无变化）', () => {
      const room = repo.create('dnd5e', 'dm-1', 'DM');
      const updated = repo.updatePlayerConnection(room.id, 'not-exist', true);
      expect(updated?.players).toHaveLength(1);
    });
  });

  describe('listPlayers', () => {
    it('应返回房间内所有玩家', () => {
      const room = repo.create('dnd5e', 'dm-1', 'DM');
      repo.addPlayer(room.id, {
        id: 'p-1',
        name: '玩家1',
        role: 'player',
        joinedAt: Date.now(),
      });
      const players = repo.listPlayers(room.id);
      expect(players).toHaveLength(2);
    });

    it('房间不存在时返回空数组', () => {
      expect(repo.listPlayers('not-exist')).toEqual([]);
    });
  });

  describe('isPlayerInRoom', () => {
    it('DM 应在房间内', () => {
      const room = repo.create('dnd5e', 'dm-1', 'DM');
      expect(repo.isPlayerInRoom(room.id, 'dm-1')).toBe(true);
    });

    it('已加入的玩家应在房间内', () => {
      const room = repo.create('dnd5e', 'dm-1', 'DM');
      repo.addPlayer(room.id, {
        id: 'p-1',
        name: '玩家1',
        role: 'player',
        joinedAt: Date.now(),
      });
      expect(repo.isPlayerInRoom(room.id, 'p-1')).toBe(true);
    });

    it('未加入的玩家不应在房间内', () => {
      const room = repo.create('dnd5e', 'dm-1', 'DM');
      expect(repo.isPlayerInRoom(room.id, 'not-exist')).toBe(false);
    });

    it('房间不存在时返回 false', () => {
      expect(repo.isPlayerInRoom('not-exist', 'p-1')).toBe(false);
    });
  });

  describe('常量', () => {
    it('MAX_PLAYERS 应为 6', () => {
      expect(MAX_PLAYERS).toBe(6);
    });
  });

  describe('generatePlayerId', () => {
    it('应生成 UUID v4 格式的 ID', () => {
      const id = repo.generatePlayerId();
      // UUID v4 格式：xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });

    it('应生成唯一的 ID', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(repo.generatePlayerId());
      }
      expect(ids.size).toBe(100);
    });
  });
});
