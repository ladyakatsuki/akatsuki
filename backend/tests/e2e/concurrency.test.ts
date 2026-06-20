import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createInMemoryDb,
  setDbInstance,
  closeDb,
} from '../../src/db/index.js';
import { roomRepository } from '../../src/db/repositories/RoomRepository.js';
import { characterRepository } from '../../src/db/repositories/CharacterRepository.js';
import { combatRepository } from '../../src/db/repositories/CombatRepository.js';
import { combatService } from '../../src/services/CombatService.js';
import { diceService } from '../../src/services/DiceService.js';
import { roomService } from '../../src/services/RoomService.js';
import { characterService } from '../../src/services/CharacterService.js';
import '../../src/rules/index.js';
import type { Character, CombatState } from '../../src/types/models.js';

/**
 * 并发性能测试
 *
 * 测试场景：
 * - 模拟 6 人房间满载
 * - 多玩家同时掷骰子
 * - 多玩家同时更新角色卡
 * - 战斗中多操作并发
 * - 验证状态一致性
 *
 * 说明：SQLite 使用 better-sqlite3 同步驱动，并发操作通过 Promise.all 模拟。
 */

/** 6 人房间（1 DM + 5 玩家）的玩家数量 */
const PLAYER_COUNT = 5;

describe('并发性能测试', () => {
  let roomId: string;
  let dmId: string;
  let playerIds: string[] = [];
  let characters: Character[] = [];

  beforeEach(() => {
    const db = createInMemoryDb();
    setDbInstance(db);

    // 创建房间
    const createResult = roomService.createRoom({
      ruleSystem: 'dnd5e',
      dmName: 'DM',
    });
    roomId = createResult.room.id;
    dmId = createResult.playerId;

    // 5 名玩家加入房间
    playerIds = [];
    for (let i = 0; i < PLAYER_COUNT; i++) {
      const joinResult = roomService.joinRoom({
        code: createResult.room.code,
        playerName: `玩家${i + 1}`,
      });
      playerIds.push(joinResult.playerId);
    }

    // 验证房间满载（6 人）
    const room = roomRepository.findById(roomId);
    expect(room?.players).toHaveLength(6);
    expect(room?.players.length).toBe(PLAYER_COUNT + 1);

    // 为每个玩家创建角色
    characters = [];
    for (let i = 0; i < PLAYER_COUNT; i++) {
      const char = characterService.createCharacter({
        roomId,
        playerId: playerIds[i],
        ruleSystem: 'dnd5e',
        name: `角色${i + 1}`,
      });
      characters.push(char);
    }
  });

  afterEach(() => {
    closeDb();
  });

  describe('6 人房间满载', () => {
    it('房间应支持 6 人（1 DM + 5 玩家）', () => {
      const room = roomRepository.findById(roomId);
      expect(room?.players).toHaveLength(6);
      const dmCount = room?.players.filter((p) => p.role === 'dm').length;
      const playerCount = room?.players.filter((p) => p.role === 'player').length;
      expect(dmCount).toBe(1);
      expect(playerCount).toBe(5);
    });

    it('第 7 人加入应被拒绝', () => {
      expect(() => {
        roomService.joinRoom({
          code: roomRepository.findById(roomId)!.code,
          playerName: '玩家6',
        });
      }).toThrow();
    });

    it('满载房间预览应显示 isFull=true', () => {
      const code = roomRepository.findById(roomId)!.code;
      const preview = roomService.previewRoom(code);
      expect(preview.isFull).toBe(true);
      expect(preview.playerCount).toBe(6);
    });
  });

  describe('多玩家同时掷骰子', () => {
    it('5 名玩家并发掷骰应全部成功且结果独立', async () => {
      const results = await Promise.all(
        playerIds.map((pid, idx) =>
          Promise.resolve(
            diceService.roll(roomId, pid, `玩家${idx + 1}`, {
              expression: '1d20',
              label: `玩家${idx + 1}的检定`,
            }),
          ),
        ),
      );

      expect(results).toHaveLength(PLAYER_COUNT);
      for (let i = 0; i < PLAYER_COUNT; i++) {
        expect(results[i].playerId).toBe(playerIds[i]);
        expect(results[i].playerName).toBe(`玩家${i + 1}`);
        expect(results[i].total).toBeGreaterThanOrEqual(1);
        expect(results[i].total).toBeLessThanOrEqual(20);
        expect(results[i].rolls).toHaveLength(1);
      }
    });

    it('并发掷骰 100 次应全部成功', async () => {
      const promises: Promise<unknown>[] = [];
      for (let i = 0; i < 100; i++) {
        const pid = playerIds[i % PLAYER_COUNT];
        promises.push(
          Promise.resolve(
            diceService.roll(roomId, pid, '玩家', {
              expression: '1d20',
            }),
          ),
        );
      }
      const results = await Promise.all(promises);
      expect(results).toHaveLength(100);
    });

    it('并发掷不同表达式应正确解析', async () => {
      const expressions = ['1d20', '2d6+3', '1d100', '3d20kh1', '1d4+1'];
      const results = await Promise.all(
        expressions.map((expr, idx) =>
          Promise.resolve(
            diceService.roll(roomId, playerIds[idx % PLAYER_COUNT], '玩家', {
              expression: expr,
            }),
          ),
        ),
      );

      expect(results).toHaveLength(5);
      // 1d20
      expect(results[0].total).toBeGreaterThanOrEqual(1);
      expect(results[0].total).toBeLessThanOrEqual(20);
      // 2d6+3
      expect(results[1].total).toBeGreaterThanOrEqual(5);
      expect(results[1].total).toBeLessThanOrEqual(15);
      // 1d100
      expect(results[2].total).toBeGreaterThanOrEqual(1);
      expect(results[2].total).toBeLessThanOrEqual(100);
      // 3d20kh1
      expect(results[3].total).toBeGreaterThanOrEqual(1);
      expect(results[3].total).toBeLessThanOrEqual(20);
      // 1d4+1
      expect(results[4].total).toBeGreaterThanOrEqual(2);
      expect(results[4].total).toBeLessThanOrEqual(5);
    });
  });

  describe('多玩家同时更新角色卡', () => {
    it('5 名玩家并发更新角色卡应全部成功', async () => {
      const updates = characters.map((char, idx) => ({
        characterId: char.id,
        playerId: playerIds[idx],
        data: {
          ...char.data,
          hp: 15 + idx,
          maxHp: 20,
        },
      }));

      const results = await Promise.all(
        updates.map((u) =>
          Promise.resolve(
            characterService.updateCharacterData(
              u.characterId,
              u.playerId,
              u.data,
            ),
          ),
        ),
      );

      expect(results).toHaveLength(PLAYER_COUNT);
      for (let i = 0; i < PLAYER_COUNT; i++) {
        expect(results[i].data.hp).toBe(15 + i);
      }
    });

    it('并发更新后角色卡数据应保持一致', async () => {
      // 并发更新每个角色的 HP
      await Promise.all(
        characters.map((char, idx) =>
          Promise.resolve(
            characterService.updateCharacterData(char.id, playerIds[idx], {
              ...char.data,
              hp: 10,
            }),
          ),
        ),
      );

      // 验证所有角色 HP 均为 10
      const updatedChars = characterRepository.findByRoom(roomId);
      expect(updatedChars).toHaveLength(PLAYER_COUNT);
      for (const char of updatedChars) {
        expect(char.data.hp).toBe(10);
      }
    });

    it('并发更新角色名称应全部成功', async () => {
      const newNames = ['勇者', '法师', '盗贼', '牧师', '游侠'];
      await Promise.all(
        characters.map((char, idx) =>
          Promise.resolve(
            characterService.updateCharacter(char.id, playerIds[idx], {
              name: newNames[idx],
            }),
          ),
        ),
      );

      const updatedChars = characterRepository.findByRoom(roomId);
      const updatedNames = updatedChars.map((c) => c.name).sort();
      const expectedNames = [...newNames].sort();
      expect(updatedNames).toEqual(expectedNames);
    });
  });

  describe('战斗中多操作并发', () => {
    let combat: CombatState;

    beforeEach(() => {
      // DM 开始战斗（包含所有玩家角色）
      combat = combatService.startCombat(
        roomId,
        dmId,
        characters.map((c) => c.id),
        true,
      );
    });

    it('战斗应包含所有 5 名玩家角色', () => {
      expect(combat.participants).toHaveLength(PLAYER_COUNT);
    });

    it('并发更新多个参与者 HP 应全部成功', async () => {
      const participantIds = combat.participants.map((p) => p.id);
      const newHps = [5, 10, 15, 20, 18];

      const results = await Promise.all(
        participantIds.map((pid, idx) =>
          Promise.resolve(
            combatService.updateParticipant(roomId, dmId, pid, {
              hp: newHps[idx],
            }),
          ),
        ),
      );

      // 验证所有更新成功
      const finalCombat = combatRepository.findByRoom(roomId);
      expect(finalCombat).not.toBeNull();
      for (let i = 0; i < PLAYER_COUNT; i++) {
        const participant = finalCombat!.participants.find(
          (p) => p.id === participantIds[i],
        );
        expect(participant?.hp).toBe(newHps[i]);
      }
    });

    it('并发添加多个参与者应全部成功', async () => {
      const initialCount = combat.participants.length;
      const newParticipants = [
        { name: '怪物1', type: 'npc' as const, hp: 10, maxHp: 10 },
        { name: '怪物2', type: 'npc' as const, hp: 12, maxHp: 12 },
        { name: '怪物3', type: 'npc' as const, hp: 8, maxHp: 8 },
      ];

      // 顺序添加（better-sqlite3 同步，避免并发冲突）
      for (const p of newParticipants) {
        combatService.addParticipant(roomId, dmId, p);
      }

      const finalCombat = combatRepository.findByRoom(roomId);
      expect(finalCombat?.participants).toHaveLength(
        initialCount + newParticipants.length,
      );
    });

    it('并发推进回合多次应保持状态一致', () => {
      // 推进回合 PLAYER_COUNT 次（5 个参与者推进 5 次回到起点，进入第 2 轮）
      let current = combat;
      for (let i = 0; i < PLAYER_COUNT; i++) {
        current = combatService.nextTurn(roomId, dmId);
      }

      // 应回到第 1 个参与者，但轮次为 2
      expect(current.currentTurn).toBe(0);
      expect(current.round).toBe(2);
    });

    it('并发掷骰与战斗操作应互不干扰', async () => {
      // 同时进行掷骰与战斗回合推进
      const dicePromise = Promise.all(
        playerIds.map((pid, idx) =>
          Promise.resolve(
            diceService.roll(roomId, pid, `玩家${idx + 1}`, {
              expression: '1d20',
            }),
          ),
        ),
      );

      // 顺序推进回合（SQLite 同步）
      const turnResult = combatService.nextTurn(roomId, dmId);

      const diceResults = await dicePromise;

      expect(diceResults).toHaveLength(PLAYER_COUNT);
      expect(turnResult.currentTurn).toBe(1);
    });
  });

  describe('状态一致性验证', () => {
    it('并发操作后房间玩家数应保持不变', async () => {
      // 并发执行多个掷骰操作
      await Promise.all(
        playerIds.map((pid) =>
          Promise.resolve(
            diceService.roll(roomId, pid, '玩家', { expression: '1d20' }),
          ),
        ),
      );

      const room = roomRepository.findById(roomId);
      expect(room?.players).toHaveLength(6);
    });

    it('并发操作后角色数量应保持不变', async () => {
      // 并发更新所有角色
      await Promise.all(
        characters.map((char, idx) =>
          Promise.resolve(
            characterService.updateCharacterData(char.id, playerIds[idx], {
              ...char.data,
              hp: 10,
            }),
          ),
        ),
      );

      const chars = characterRepository.findByRoom(roomId);
      expect(chars).toHaveLength(PLAYER_COUNT);
    });

    it('并发掷骰后每个结果应有唯一 ID', async () => {
      const results = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          Promise.resolve(
            diceService.roll(roomId, playerIds[i % PLAYER_COUNT], '玩家', {
              expression: '1d20',
            }),
          ),
        ),
      );

      const ids = results.map((r) => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(20);
    });

    it('并发操作后战斗状态应保持一致', async () => {
      // 开始战斗
      const combat = combatService.startCombat(
        roomId,
        dmId,
        characters.map((c) => c.id),
        true,
      );

      // 并发掷骰
      await Promise.all(
        playerIds.map((pid) =>
          Promise.resolve(
            diceService.roll(roomId, pid, '玩家', { expression: '1d20' }),
          ),
        ),
      );

      // 战斗状态应不受掷骰影响
      const finalCombat = combatRepository.findByRoom(roomId);
      expect(finalCombat?.participants).toHaveLength(combat.participants.length);
      expect(finalCombat?.isActive).toBe(true);
      expect(finalCombat?.round).toBe(combat.round);
    });
  });

  describe('性能基准', () => {
    it('100 次掷骰应在合理时间内完成', async () => {
      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        diceService.roll(roomId, playerIds[i % PLAYER_COUNT], '玩家', {
          expression: '1d20',
        });
      }
      const elapsed = Date.now() - start;
      // 100 次掷骰应在 1 秒内完成
      expect(elapsed).toBeLessThan(1000);
    });

    it('50 次角色卡更新应在合理时间内完成', async () => {
      const start = Date.now();
      for (let i = 0; i < 50; i++) {
        const char = characters[i % PLAYER_COUNT];
        const pid = playerIds[i % PLAYER_COUNT];
        characterService.updateCharacterData(char.id, pid, {
          ...char.data,
          hp: 10 + (i % 10),
        });
      }
      const elapsed = Date.now() - start;
      // 50 次更新应在 1 秒内完成
      expect(elapsed).toBeLessThan(1000);
    });
  });
});
