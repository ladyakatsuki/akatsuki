import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createInMemoryDb,
  setDbInstance,
  closeDb,
} from '../../src/db/index.js';
import { CharacterRepository } from '../../src/db/repositories/CharacterRepository.js';
import { roomRepository } from '../../src/db/repositories/RoomRepository.js';
import { ruleSystemRegistry } from '../../src/rules/index.js';
import '../../src/rules/index.js';
import type { Character } from '../../src/types/models.js';

describe('CharacterRepository', () => {
  let repo: CharacterRepository;
  let roomId: string;
  let playerId: string;
  let dmId: string;

  beforeEach(() => {
    const db = createInMemoryDb();
    setDbInstance(db);
    repo = new CharacterRepository();

    // 创建测试房间与玩家
    const room = roomRepository.create('dnd5e', 'dm-1', 'DM');
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
  });

  /** 构造测试角色输入 */
  function buildCharacterInput(overrides: Partial<Character> = {}): Omit<Character, 'id' | 'createdAt' | 'updatedAt'> {
    const system = ruleSystemRegistry.get('dnd5e');
    const data = system.createDefaultCharacter();
    data.name = '测试角色';
    return {
      roomId,
      playerId,
      name: '测试角色',
      ruleSystem: 'dnd5e',
      data,
      portraitUrl: null,
      isNpc: false,
      ...overrides,
    };
  }

  describe('create', () => {
    it('应创建角色并生成 ID 与时间戳', () => {
      const character = repo.create(buildCharacterInput());
      expect(character.id).toBeTruthy();
      expect(character.id.startsWith('char_')).toBe(true);
      expect(character.roomId).toBe(roomId);
      expect(character.playerId).toBe(playerId);
      expect(character.name).toBe('测试角色');
      expect(character.ruleSystem).toBe('dnd5e');
      expect(character.data).toBeTruthy();
      expect(character.data.name).toBe('测试角色');
      expect(character.portraitUrl).toBeNull();
      expect(character.isNpc).toBe(false);
      expect(character.createdAt).toBeGreaterThan(0);
      expect(character.updatedAt).toBe(character.createdAt);
    });

    it('应正确存储 isNpc 为 true', () => {
      const character = repo.create(buildCharacterInput({ isNpc: true, playerId: dmId }));
      expect(character.isNpc).toBe(true);
    });

    it('应正确存储角色卡数据', () => {
      const input = buildCharacterInput();
      input.data = { name: '测试', str: 15, dex: 14 };
      const character = repo.create(input);
      expect(character.data).toEqual({ name: '测试', str: 15, dex: 14 });
    });
  });

  describe('findById', () => {
    it('应按 ID 查询到角色', () => {
      const created = repo.create(buildCharacterInput());
      const found = repo.findById(created.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe('测试角色');
    });

    it('查询不存在的 ID 应返回 null', () => {
      expect(repo.findById('not-exist')).toBeNull();
    });
  });

  describe('findByRoom', () => {
    it('应返回房间内所有角色（按创建时间排序）', () => {
      repo.create(buildCharacterInput({ name: '角色1' }));
      repo.create(buildCharacterInput({ name: '角色2', playerId: dmId, isNpc: true }));
      const characters = repo.findByRoom(roomId);
      expect(characters).toHaveLength(2);
      expect(characters[0].name).toBe('角色1');
      expect(characters[1].name).toBe('角色2');
    });

    it('房间无角色时应返回空数组', () => {
      expect(repo.findByRoom(roomId)).toEqual([]);
    });
  });

  describe('findByPlayer', () => {
    it('应返回指定玩家在房间内的角色', () => {
      repo.create(buildCharacterInput({ name: '玩家角色', playerId }));
      repo.create(buildCharacterInput({ name: 'DM 角色', playerId: dmId, isNpc: true }));
      const playerChars = repo.findByPlayer(roomId, playerId);
      expect(playerChars).toHaveLength(1);
      expect(playerChars[0].name).toBe('玩家角色');
      const dmChars = repo.findByPlayer(roomId, dmId);
      expect(dmChars).toHaveLength(1);
      expect(dmChars[0].name).toBe('DM 角色');
    });

    it('玩家无角色时应返回空数组', () => {
      expect(repo.findByPlayer(roomId, 'no-chars-player')).toEqual([]);
    });
  });

  describe('update', () => {
    it('应更新角色名称', () => {
      const created = repo.create(buildCharacterInput());
      const updated = repo.update(created.id, { name: '新名称' });
      expect(updated).not.toBeNull();
      expect(updated?.name).toBe('新名称');
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
    });

    it('更新不存在的角色应返回 null', () => {
      const updated = repo.update('not-exist', { name: '新名称' });
      expect(updated).toBeNull();
    });

    it('空 patch 应返回当前角色', () => {
      const created = repo.create(buildCharacterInput());
      const updated = repo.update(created.id, {});
      expect(updated).not.toBeNull();
      expect(updated?.name).toBe(created.name);
    });
  });

  describe('updateData', () => {
    it('应更新角色卡数据', () => {
      const created = repo.create(buildCharacterInput());
      const newData = { name: '测试', str: 18, dex: 16 };
      const updated = repo.updateData(created.id, newData);
      expect(updated).not.toBeNull();
      expect(updated?.data).toEqual(newData);
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
    });

    it('更新不存在的角色应返回 null', () => {
      const updated = repo.updateData('not-exist', { foo: 'bar' });
      expect(updated).toBeNull();
    });
  });

  describe('setPortrait', () => {
    it('应设置立绘 URL', () => {
      const created = repo.create(buildCharacterInput());
      const updated = repo.setPortrait(created.id, '/uploads/test.png');
      expect(updated).not.toBeNull();
      expect(updated?.portraitUrl).toBe('/uploads/test.png');
    });

    it('设置不存在的角色应返回 null', () => {
      const updated = repo.setPortrait('not-exist', '/uploads/test.png');
      expect(updated).toBeNull();
    });
  });

  describe('delete', () => {
    it('应删除角色并返回 true', () => {
      const created = repo.create(buildCharacterInput());
      const result = repo.delete(created.id);
      expect(result).toBe(true);
      expect(repo.findById(created.id)).toBeNull();
    });

    it('删除不存在的角色应返回 false', () => {
      const result = repo.delete('not-exist');
      expect(result).toBe(false);
    });
  });
});
