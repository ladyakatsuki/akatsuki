import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createInMemoryDb,
  setDbInstance,
  closeDb,
} from '../../src/db/index.js';
import { CombatRepository } from '../../src/db/repositories/CombatRepository.js';
import { roomRepository } from '../../src/db/repositories/RoomRepository.js';
import type { CombatParticipant } from '../../src/types/models.js';

describe('CombatRepository', () => {
  let repo: CombatRepository;
  let roomId: string;

  beforeEach(() => {
    const db = createInMemoryDb();
    setDbInstance(db);
    repo = new CombatRepository();

    // 创建测试房间
    const room = roomRepository.create('dnd5e', 'dm-1', 'DM');
    roomId = room.id;
  });

  afterEach(() => {
    closeDb();
  });

  /** 构造测试参与者 */
  function buildParticipant(overrides: Partial<CombatParticipant> = {}): CombatParticipant {
    return {
      id: 'p-1',
      name: '战士',
      type: 'player',
      initiative: 10,
      hp: 20,
      maxHp: 20,
      statusEffects: [],
      ...overrides,
    };
  }

  describe('create', () => {
    it('应创建战斗状态并生成 ID 与时间戳', () => {
      const combat = repo.create(roomId);
      expect(combat.id).toBeTruthy();
      expect(combat.id.startsWith('combat_')).toBe(true);
      expect(combat.roomId).toBe(roomId);
      expect(combat.isActive).toBe(false);
      expect(combat.round).toBe(0);
      expect(combat.currentTurn).toBe(0);
      expect(combat.participants).toEqual([]);
      expect(combat.startedAt).toBeGreaterThan(0);
      expect(combat.updatedAt).toBe(combat.startedAt);
    });
  });

  describe('findByRoom', () => {
    it('应按房间查询到战斗状态', () => {
      const created = repo.create(roomId);
      const found = repo.findByRoom(roomId);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    it('房间无战斗状态时应返回 null', () => {
      expect(repo.findByRoom(roomId)).toBeNull();
    });
  });

  describe('update', () => {
    it('应更新参与者列表与回合信息', () => {
      const created = repo.create(roomId);
      const participants: CombatParticipant[] = [
        buildParticipant({ id: 'p-1', initiative: 15 }),
        buildParticipant({ id: 'p-2', name: '法师', initiative: 12 }),
      ];
      const updated = repo.update(roomId, {
        participants,
        currentTurn: 1,
        round: 2,
        isActive: true,
      });
      expect(updated).not.toBeNull();
      expect(updated?.participants).toHaveLength(2);
      expect(updated?.participants[0].id).toBe('p-1');
      expect(updated?.currentTurn).toBe(1);
      expect(updated?.round).toBe(2);
      expect(updated?.isActive).toBe(true);
      expect(updated?.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
    });

    it('空 patch 应返回当前战斗状态', () => {
      const created = repo.create(roomId);
      const updated = repo.update(roomId, {});
      expect(updated).not.toBeNull();
      expect(updated?.id).toBe(created.id);
    });

    it('更新不存在的房间应返回 null', () => {
      const updated = repo.update('not-exist', { round: 1 });
      expect(updated).toBeNull();
    });
  });

  describe('setActive', () => {
    it('应设置战斗为激活状态', () => {
      repo.create(roomId);
      const updated = repo.setActive(roomId, true);
      expect(updated).not.toBeNull();
      expect(updated?.isActive).toBe(true);
    });

    it('应设置战斗为非激活状态', () => {
      repo.create(roomId);
      repo.setActive(roomId, true);
      const updated = repo.setActive(roomId, false);
      expect(updated).not.toBeNull();
      expect(updated?.isActive).toBe(false);
    });

    it('战斗不存在时应返回 null', () => {
      const updated = repo.setActive('not-exist', true);
      expect(updated).toBeNull();
    });
  });

  describe('delete', () => {
    it('应删除战斗状态并返回 true', () => {
      repo.create(roomId);
      const result = repo.delete(roomId);
      expect(result).toBe(true);
      expect(repo.findByRoom(roomId)).toBeNull();
    });

    it('删除不存在的战斗状态应返回 false', () => {
      const result = repo.delete('not-exist');
      expect(result).toBe(false);
    });
  });

  describe('每个房间仅一条战斗状态', () => {
    it('同一房间重复创建应覆盖原记录', () => {
      const first = repo.create(roomId);
      const second = repo.create(roomId);
      expect(second.id).not.toBe(first.id);
      // 房间内仅一条记录
      const found = repo.findByRoom(roomId);
      expect(found?.id).toBe(second.id);
    });
  });
});
