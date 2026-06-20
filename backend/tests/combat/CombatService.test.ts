import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createInMemoryDb,
  setDbInstance,
  closeDb,
} from '../../src/db/index.js';
import { CombatService } from '../../src/services/CombatService.js';
import { roomRepository } from '../../src/db/repositories/RoomRepository.js';
import { characterRepository } from '../../src/db/repositories/CharacterRepository.js';
import { combatRepository } from '../../src/db/repositories/CombatRepository.js';
import { ruleSystemRegistry } from '../../src/rules/index.js';
import '../../src/rules/index.js';
import { AppError } from '../../src/middleware/errorHandler.js';
import type { Character } from '../../src/types/models.js';

describe('CombatService', () => {
  let service: CombatService;
  let roomId: string;
  let dmId: string;
  let playerId: string;
  let playerChar: Character;
  let npcChar: Character;

  beforeEach(() => {
    const db = createInMemoryDb();
    setDbInstance(db);
    service = new CombatService();

    // 创建测试房间（DM + 1 玩家）
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

    // 创建玩家角色（高敏捷）
    const system = ruleSystemRegistry.get('dnd5e');
    const playerData = system.createDefaultCharacter();
    playerData.name = '战士';
    playerData.dex = 16;
    playerData.dexMod = 3;
    playerData.hp = 20;
    playerData.maxHp = 20;
    playerData.ac = 16;
    playerChar = characterRepository.create({
      roomId,
      playerId,
      name: '战士',
      ruleSystem: 'dnd5e',
      data: playerData,
      portraitUrl: null,
      isNpc: false,
    });

    // 创建 NPC（低敏捷）
    const npcData = system.createDefaultCharacter();
    npcData.name = '哥布林';
    npcData.dex = 8;
    npcData.dexMod = -1;
    npcData.hp = 10;
    npcData.maxHp = 10;
    npcData.ac = 12;
    npcChar = characterRepository.create({
      roomId,
      playerId: dmId,
      name: '哥布林',
      ruleSystem: 'dnd5e',
      data: npcData,
      portraitUrl: null,
      isNpc: true,
    });
  });

  afterEach(() => {
    closeDb();
  });

  describe('startCombat - 自动掷先攻', () => {
    it('应创建战斗状态并自动掷先攻，参与者按先攻降序排序', () => {
      const combat = service.startCombat(roomId, dmId, [playerChar.id, npcChar.id], true);

      expect(combat.roomId).toBe(roomId);
      expect(combat.isActive).toBe(true);
      expect(combat.round).toBe(1);
      expect(combat.currentTurn).toBe(0);
      expect(combat.participants).toHaveLength(2);

      // 所有参与者应有先攻值（d20+dexMod，范围 1-20+mod）
      for (const p of combat.participants) {
        expect(p.initiative).toBeGreaterThan(0);
      }

      // 参与者应按先攻降序排序
      for (let i = 1; i < combat.participants.length; i++) {
        expect(combat.participants[i - 1].initiative).toBeGreaterThanOrEqual(
          combat.participants[i].initiative,
        );
      }
    });

    it('应正确从角色数据读取 HP/MaxHP/AC', () => {
      const combat = service.startCombat(roomId, dmId, [playerChar.id], true);
      const participant = combat.participants[0];
      expect(participant.characterId).toBe(playerChar.id);
      expect(participant.name).toBe('战士');
      expect(participant.type).toBe('player');
      expect(participant.hp).toBe(20);
      expect(participant.maxHp).toBe(20);
      expect(participant.ac).toBe(16);
      expect(participant.statusEffects).toEqual([]);
    });

    it('NPC 角色类型应为 npc', () => {
      const combat = service.startCombat(roomId, dmId, [npcChar.id], true);
      const participant = combat.participants[0];
      expect(participant.type).toBe('npc');
    });
  });

  describe('startCombat - 手动先攻', () => {
    it('rollInitiative 为 false 时所有参与者先攻为 0', () => {
      const combat = service.startCombat(roomId, dmId, [playerChar.id, npcChar.id], false);
      expect(combat.participants).toHaveLength(2);
      for (const p of combat.participants) {
        expect(p.initiative).toBe(0);
      }
    });
  });

  describe('startCombat - 权限校验', () => {
    it('非 DM 玩家开始战斗应抛 403', () => {
      try {
        service.startCombat(roomId, playerId, [playerChar.id], true);
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });

    it('房间不存在应抛 404', () => {
      try {
        service.startCombat('not-exist', dmId, [playerChar.id], true);
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(404);
      }
    });

    it('角色不存在应抛 404', () => {
      try {
        service.startCombat(roomId, dmId, ['not-exist'], true);
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(404);
      }
    });
  });

  describe('endCombat', () => {
    it('应删除战斗状态', () => {
      service.startCombat(roomId, dmId, [playerChar.id], true);
      service.endCombat(roomId, dmId);
      expect(combatRepository.findByRoom(roomId)).toBeNull();
    });

    it('非 DM 玩家结束战斗应抛 403', () => {
      service.startCombat(roomId, dmId, [playerChar.id], true);
      try {
        service.endCombat(roomId, playerId);
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });
  });

  describe('addParticipant', () => {
    it('应添加参与者并重新排序', () => {
      const combat = service.startCombat(roomId, dmId, [playerChar.id], false);
      const updated = service.addParticipant(roomId, dmId, {
        name: '新怪物',
        type: 'npc',
        hp: 15,
        maxHp: 15,
        ac: 14,
        initiative: 20,
      });
      expect(updated.participants).toHaveLength(2);
      // 先攻 20 的参与者应排在首位
      expect(updated.participants[0].initiative).toBe(20);
      expect(updated.participants[0].name).toBe('新怪物');
    });

    it('非 DM 玩家添加参与者应抛 403', () => {
      service.startCombat(roomId, dmId, [playerChar.id], false);
      try {
        service.addParticipant(roomId, playerId, {
          name: '怪物',
          type: 'npc',
          hp: 10,
          maxHp: 10,
        });
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });

    it('战斗未开始时添加参与者应抛 400', () => {
      try {
        service.addParticipant(roomId, dmId, {
          name: '怪物',
          type: 'npc',
          hp: 10,
          maxHp: 10,
        });
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });
  });

  describe('removeParticipant', () => {
    it('应移除参与者', () => {
      const combat = service.startCombat(roomId, dmId, [playerChar.id, npcChar.id], false);
      const participantId = combat.participants[0].id;
      const updated = service.removeParticipant(roomId, dmId, participantId);
      expect(updated.participants).toHaveLength(1);
      expect(updated.participants.find((p) => p.id === participantId)).toBeUndefined();
    });

    it('非 DM 玩家移除参与者应抛 403', () => {
      const combat = service.startCombat(roomId, dmId, [playerChar.id], false);
      try {
        service.removeParticipant(roomId, playerId, combat.participants[0].id);
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });
  });

  describe('updateParticipant', () => {
    it('应更新参与者 HP', () => {
      const combat = service.startCombat(roomId, dmId, [playerChar.id], false);
      const participantId = combat.participants[0].id;
      const updated = service.updateParticipant(roomId, dmId, participantId, { hp: 5 });
      const participant = updated.participants.find((p) => p.id === participantId);
      expect(participant?.hp).toBe(5);
    });

    it('应更新参与者状态效果', () => {
      const combat = service.startCombat(roomId, dmId, [playerChar.id], false);
      const participantId = combat.participants[0].id;
      const updated = service.updateParticipant(roomId, dmId, participantId, {
        statusEffects: ['poisoned'],
      });
      const participant = updated.participants.find((p) => p.id === participantId);
      expect(participant?.statusEffects).toEqual(['poisoned']);
    });

    it('非 DM 玩家更新参与者应抛 403', () => {
      const combat = service.startCombat(roomId, dmId, [playerChar.id], false);
      try {
        service.updateParticipant(roomId, playerId, combat.participants[0].id, { hp: 5 });
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });
  });

  describe('nextTurn', () => {
    it('应推进到下一回合', () => {
      const combat = service.startCombat(roomId, dmId, [playerChar.id, npcChar.id], false);
      expect(combat.currentTurn).toBe(0);
      const updated = service.nextTurn(roomId, dmId);
      expect(updated.currentTurn).toBe(1);
    });

    it('到末尾应轮次 +1 回到首位', () => {
      const combat = service.startCombat(roomId, dmId, [playerChar.id, npcChar.id], false);
      // 推进到末尾
      service.nextTurn(roomId, dmId); // turn 1
      const updated = service.nextTurn(roomId, dmId); // wrap to 0, round 2
      expect(updated.currentTurn).toBe(0);
      expect(updated.round).toBe(2);
    });

    it('非 DM 玩家推进回合应抛 403', () => {
      service.startCombat(roomId, dmId, [playerChar.id], false);
      try {
        service.nextTurn(roomId, playerId);
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });
  });

  describe('prevTurn', () => {
    it('应回退回合', () => {
      const combat = service.startCombat(roomId, dmId, [playerChar.id, npcChar.id], false);
      service.nextTurn(roomId, dmId); // turn 1
      const updated = service.prevTurn(roomId, dmId); // back to turn 0
      expect(updated.currentTurn).toBe(0);
      expect(updated.round).toBe(1);
    });

    it('首位回退应回到上一轮末尾', () => {
      const combat = service.startCombat(roomId, dmId, [playerChar.id, npcChar.id], false);
      service.nextTurn(roomId, dmId); // turn 1
      service.nextTurn(roomId, dmId); // turn 0, round 2
      const updated = service.prevTurn(roomId, dmId); // back to turn 1, round 1
      expect(updated.currentTurn).toBe(1);
      expect(updated.round).toBe(1);
    });

    it('第一轮首位回退应保持在原位', () => {
      service.startCombat(roomId, dmId, [playerChar.id, npcChar.id], false);
      const updated = service.prevTurn(roomId, dmId);
      expect(updated.currentTurn).toBe(0);
      expect(updated.round).toBe(1);
    });
  });

  describe('rollInitiativeFor', () => {
    it('应为指定参与者重新掷先攻并重新排序', () => {
      const combat = service.startCombat(roomId, dmId, [playerChar.id, npcChar.id], false);
      const participantId = combat.participants[0].id;
      const updated = service.rollInitiativeFor(roomId, dmId, participantId);
      const participant = updated.participants.find((p) => p.id === participantId);
      // 重新掷骰后先攻值应 > 0
      expect(participant?.initiative).toBeGreaterThan(0);
      // 仍按降序排序
      for (let i = 1; i < updated.participants.length; i++) {
        expect(updated.participants[i - 1].initiative).toBeGreaterThanOrEqual(
          updated.participants[i].initiative,
        );
      }
    });

    it('非 DM 玩家掷先攻应抛 403', () => {
      const combat = service.startCombat(roomId, dmId, [playerChar.id], false);
      try {
        service.rollInitiativeFor(roomId, playerId, combat.participants[0].id);
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });
  });

  describe('getCombatState', () => {
    it('应返回战斗状态', () => {
      service.startCombat(roomId, dmId, [playerChar.id], true);
      const combat = service.getCombatState(roomId);
      expect(combat).not.toBeNull();
      expect(combat?.isActive).toBe(true);
    });

    it('无战斗时应返回 null', () => {
      expect(service.getCombatState(roomId)).toBeNull();
    });
  });

  describe('COC 7版先攻', () => {
    beforeEach(() => {
      closeDb();
      const db = createInMemoryDb();
      setDbInstance(db);

      const room = roomRepository.create('coc7', 'coc-dm', 'COC DM');
      roomId = room.id;
      dmId = 'coc-dm';
      playerId = 'coc-player';
      roomRepository.addPlayer(roomId, {
        id: playerId,
        name: '调查员',
        role: 'player',
        joinedAt: Date.now(),
      });

      const system = ruleSystemRegistry.get('coc7');
      const data = system.createDefaultCharacter();
      data.name = '调查员';
      playerChar = characterRepository.create({
        roomId,
        playerId,
        name: '调查员',
        ruleSystem: 'coc7',
        data,
        portraitUrl: null,
        isNpc: false,
      });
    });

    it('COC 应使用 d100 掷先攻（1-100 范围）', () => {
      const combat = service.startCombat(roomId, dmId, [playerChar.id], true);
      const participant = combat.participants[0];
      expect(participant.initiative).toBeGreaterThanOrEqual(1);
      expect(participant.initiative).toBeLessThanOrEqual(100);
    });
  });
});
