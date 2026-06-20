import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createInMemoryDb,
  setDbInstance,
  closeDb,
} from '../../src/db/index.js';
import { roomRepository } from '../../src/db/repositories/RoomRepository.js';
import { characterRepository } from '../../src/db/repositories/CharacterRepository.js';
import { DiceService } from '../../src/services/DiceService.js';
import { AppError } from '../../src/middleware/errorHandler.js';
import type { Character } from '../../src/types/models.js';

describe('DiceService', () => {
  let service: DiceService;
  let dndRoomId: string;
  let cocRoomId: string;
  let dndDmId: string;
  let cocDmId: string;
  let dndCharacter: Character;
  let cocCharacter: Character;

  beforeEach(() => {
    const db = createInMemoryDb();
    setDbInstance(db);
    service = new DiceService();

    // 创建 DND 房间
    dndDmId = roomRepository.generatePlayerId();
    const dndRoom = roomRepository.create('dnd5e', dndDmId, 'DND DM');
    dndRoomId = dndRoom.id;

    // 创建 DND 角色
    dndCharacter = characterRepository.create({
      roomId: dndRoomId,
      playerId: dndDmId,
      name: 'DND 角色',
      ruleSystem: 'dnd5e',
      data: {
        name: '战士',
        level: 1,
        str: 16,
        strMod: 3,
        dex: 14,
        dexMod: 2,
        con: 14,
        conMod: 2,
        int: 10,
        intMod: 0,
        wis: 12,
        wisMod: 1,
        cha: 10,
        chaMod: 0,
        proficiencyBonus: 2,
        athletics: 1,
        acrobatics: 0,
        perception: 1,
      },
      portraitUrl: null,
      isNpc: false,
    });

    // 创建 COC 房间
    cocDmId = roomRepository.generatePlayerId();
    const cocRoom = roomRepository.create('coc7', cocDmId, 'COC DM');
    cocRoomId = cocRoom.id;

    // 创建 COC 角色
    cocCharacter = characterRepository.create({
      roomId: cocRoomId,
      playerId: cocDmId,
      name: 'COC 角色',
      ruleSystem: 'coc7',
      data: {
        name: '调查员',
        san: 60,
        luck: 50,
        libraryUse: 50,
        brawl: 60,
        perception: 50,
        cthulhuMythos: 0,
      },
      portraitUrl: null,
      isNpc: false,
    });
  });

  afterEach(() => {
    closeDb();
  });

  describe('roll - 通用掷骰', () => {
    it('应正确执行 d20 掷骰', () => {
      const result = service.roll(dndRoomId, dndDmId, 'DM', {
        expression: '1d20',
      });
      expect(result.id).toBeTruthy();
      expect(result.playerId).toBe(dndDmId);
      expect(result.playerName).toBe('DM');
      expect(result.expression).toBe('1d20');
      expect(result.rolls).toHaveLength(1);
      expect(result.rolls[0]).toBeGreaterThanOrEqual(1);
      expect(result.rolls[0]).toBeLessThanOrEqual(20);
      expect(result.total).toBe(result.rolls[0]);
      expect(result.modifier).toBe(0);
      expect(result.isHidden).toBe(false);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('应正确执行 2d6+3 掷骰', () => {
      const result = service.roll(dndRoomId, dndDmId, 'DM', {
        expression: '2d6+3',
      });
      expect(result.rolls).toHaveLength(2);
      result.rolls.forEach((r) => {
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(6);
      });
      expect(result.modifier).toBe(3);
      expect(result.total).toBe(result.rolls[0] + result.rolls[1] + 3);
    });

    it('应正确处理暗骰标记', () => {
      const result = service.roll(dndRoomId, dndDmId, 'DM', {
        expression: '1d20',
        isHidden: true,
      });
      expect(result.isHidden).toBe(true);
    });

    it('应正确处理 label 标签', () => {
      const result = service.roll(dndRoomId, dndDmId, 'DM', {
        expression: '1d20',
        label: '攻击检定',
      });
      expect(result.label).toBe('攻击检定');
    });

    it('房间不存在时应抛 404', () => {
      expect(() =>
        service.roll('not-exist', dndDmId, 'DM', { expression: '1d20' }),
      ).toThrow(AppError);
      try {
        service.roll('not-exist', dndDmId, 'DM', { expression: '1d20' });
      } catch (err) {
        expect((err as AppError).statusCode).toBe(404);
      }
    });

    it('结果应包含所有必要字段', () => {
      const result = service.roll(dndRoomId, dndDmId, 'DM', {
        expression: '1d20+5',
        label: '测试',
      });
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('playerId');
      expect(result).toHaveProperty('playerName');
      expect(result).toHaveProperty('expression');
      expect(result).toHaveProperty('rolls');
      expect(result).toHaveProperty('kept');
      expect(result).toHaveProperty('modifier');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('isHidden');
      expect(result).toHaveProperty('timestamp');
    });
  });

  describe('roll - DND 优势/劣势', () => {
    it('优势应掷两次 d20 并取较高值', () => {
      const result = service.roll(dndRoomId, dndDmId, 'DM', {
        expression: '1d20',
        advantage: true,
      });
      expect(result.rolls).toHaveLength(2);
      expect(result.label).toBe('优势');
      // 保留较高者
      const max = Math.max(...result.rolls);
      expect(result.total).toBe(max);
    });

    it('劣势应掷两次 d20 并取较低值', () => {
      const result = service.roll(dndRoomId, dndDmId, 'DM', {
        expression: '1d20',
        disadvantage: true,
      });
      expect(result.rolls).toHaveLength(2);
      expect(result.label).toBe('劣势');
      // 保留较低者
      const min = Math.min(...result.rolls);
      expect(result.total).toBe(min);
    });

    it('带加值的优势掷骰应正确计算', () => {
      const result = service.roll(dndRoomId, dndDmId, 'DM', {
        expression: '1d20+5',
        advantage: true,
      });
      expect(result.rolls).toHaveLength(2);
      expect(result.modifier).toBe(5);
      const max = Math.max(...result.rolls);
      expect(result.total).toBe(max + 5);
    });
  });

  describe('roll - COC 奖金骰/惩罚骰', () => {
    it('奖金骰应掷 1 个十位骰 + 多个个位骰', () => {
      const result = service.roll(cocRoomId, cocDmId, 'DM', {
        expression: '1d100',
        bonusDice: 2,
      });
      // 1 十位 + 2 个位
      expect(result.rolls).toHaveLength(3);
      expect(result.label).toBe('奖金骰');
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(100);
    });

    it('惩罚骰应掷 1 个十位骰 + 多个个位骰', () => {
      const result = service.roll(cocRoomId, cocDmId, 'DM', {
        expression: '1d100',
        penaltyDice: 2,
      });
      expect(result.rolls).toHaveLength(3);
      expect(result.label).toBe('惩罚骰');
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(100);
    });

    it('奖金骰与惩罚骰同时存在时应相互抵消', () => {
      const result = service.roll(cocRoomId, cocDmId, 'DM', {
        expression: '1d100',
        bonusDice: 2,
        penaltyDice: 2,
      });
      // 净 0，无标签
      expect(result.label).toBeUndefined();
      // 仅 1 个个位骰
      expect(result.rolls).toHaveLength(2);
    });
  });

  describe('roll - COC 成功等级判定', () => {
    it('有 target 时应计算 successLevel', () => {
      const result = service.roll(cocRoomId, cocDmId, 'DM', {
        expression: '1d100',
        target: 50,
      });
      expect(result.target).toBe(50);
      expect(result.successLevel).toBeDefined();
      // 验证成功等级与掷骰结果一致
      // target=50：≥50 时仅 100 为大失败，96-99 为普通失败
      if (result.total <= 50) {
        expect(result.successLevel).not.toBeNull();
      } else if (result.total < 100) {
        expect(result.successLevel).toBeNull();
      } else {
        expect(result.successLevel).toBe('fumble');
      }
    });

    it('无 target 时不应计算 successLevel', () => {
      const result = service.roll(cocRoomId, cocDmId, 'DM', {
        expression: '1d100',
      });
      expect(result.successLevel).toBeUndefined();
    });
  });

  describe('rollSkill - 技能检定', () => {
    it('DND 技能检定应使用 dnd5eResolver.rollSkill', () => {
      const result = service.rollSkill(
        dndRoomId,
        dndDmId,
        'DM',
        dndCharacter.id,
        'athletics',
      );
      expect(result.rolls).toHaveLength(1);
      expect(result.rolls[0]).toBeGreaterThanOrEqual(1);
      expect(result.rolls[0]).toBeLessThanOrEqual(20);
      // athletics 关联 str，strMod=3，熟练(1)，熟练加值=2
      // 加值 = 3 + 1*2 = 5
      expect(result.modifier).toBe(5);
      expect(result.total).toBe(result.rolls[0] + 5);
      expect(result.characterId).toBe(dndCharacter.id);
      expect(result.label).toBeTruthy();
    });

    it('COC 技能检定应使用 coc7Resolver.rollSkill 并设置 target', () => {
      const result = service.rollSkill(
        cocRoomId,
        cocDmId,
        'DM',
        cocCharacter.id,
        'libraryUse',
      );
      expect(result.rolls).toHaveLength(1);
      expect(result.rolls[0]).toBeGreaterThanOrEqual(1);
      expect(result.rolls[0]).toBeLessThanOrEqual(100);
      // target 应为技能值 50
      expect(result.target).toBe(50);
      expect(result.successLevel).toBeDefined();
      expect(result.characterId).toBe(cocCharacter.id);
    });

    it('角色不存在时应抛 404', () => {
      expect(() =>
        service.rollSkill(dndRoomId, dndDmId, 'DM', 'not-exist', 'athletics'),
      ).toThrow(AppError);
      try {
        service.rollSkill(dndRoomId, dndDmId, 'DM', 'not-exist', 'athletics');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(404);
      }
    });

    it('角色不属于该房间时应抛错', () => {
      expect(() =>
        service.rollSkill(
          cocRoomId,
          cocDmId,
          'DM',
          dndCharacter.id,
          'libraryUse',
        ),
      ).toThrow(AppError);
    });
  });

  describe('rollSan - SAN 检定', () => {
    it('应掷 d100 vs 当前 SAN 并返回成功等级', () => {
      const result = service.rollSan(
        cocRoomId,
        cocDmId,
        'DM',
        cocCharacter.id,
        '1d10',
      );
      expect(result.rolls).toHaveLength(1);
      expect(result.rolls[0]).toBeGreaterThanOrEqual(1);
      expect(result.rolls[0]).toBeLessThanOrEqual(100);
      expect(result.label).toBe('SAN 检定');
      expect(result.target).toBe(60); // 初始 SAN
      expect(result.successLevel).toBeDefined();
      expect(result.sanLossApplied).toBeDefined();
      expect(typeof result.sanLossApplied).toBe('number');
    });

    it('成功时应扣半损（向下取整）', () => {
      // 多次尝试直到出现成功
      for (let i = 0; i < 100; i++) {
        // 重置 SAN
        characterRepository.updateData(cocCharacter.id, {
          ...cocCharacter.data,
          san: 60,
        });
        const result = service.rollSan(
          cocRoomId,
          cocDmId,
          'DM',
          cocCharacter.id,
          '10',
        );
        if (
          result.successLevel === 'critical' ||
          result.successLevel === 'extreme' ||
          result.successLevel === 'hard' ||
          result.successLevel === 'regular'
        ) {
          // 成功扣半损：floor(10/2) = 5
          expect(result.sanLossApplied).toBe(5);
          return;
        }
      }
      throw new Error('100 次掷骰均失败，无法验证成功扣半损');
    });

    it('失败时应扣全损', () => {
      for (let i = 0; i < 100; i++) {
        characterRepository.updateData(cocCharacter.id, {
          ...cocCharacter.data,
          san: 60,
        });
        const result = service.rollSan(
          cocRoomId,
          cocDmId,
          'DM',
          cocCharacter.id,
          '10',
        );
        if (result.successLevel === null || result.successLevel === 'fumble') {
          expect(result.sanLossApplied).toBe(10);
          return;
        }
      }
      throw new Error('100 次掷骰均成功，无法验证失败扣全损');
    });

    it('应更新角色 SAN 值', () => {
      const beforeSan = characterRepository.findById(cocCharacter.id)?.data
        .san;
      expect(beforeSan).toBe(60);

      service.rollSan(cocRoomId, cocDmId, 'DM', cocCharacter.id, '5');

      const afterSan = characterRepository.findById(cocCharacter.id)?.data.san;
      expect(afterSan).toBeDefined();
      expect(afterSan).not.toBe(60);
      // SAN 应减少（成功扣 2，失败扣 5）
      expect(afterSan as number).toBeLessThan(60);
      expect(afterSan as number).toBeGreaterThanOrEqual(55);
    });

    it('支持固定数字的 sanLossExpression', () => {
      const result = service.rollSan(
        cocRoomId,
        cocDmId,
        'DM',
        cocCharacter.id,
        '5',
      );
      expect(result.sanLossApplied).toBeDefined();
      // 成功扣 2，失败扣 5
      expect([2, 5]).toContain(result.sanLossApplied);
    });

    it('非 COC 规则系统应抛错', () => {
      expect(() =>
        service.rollSan(dndRoomId, dndDmId, 'DM', dndCharacter.id, '1d10'),
      ).toThrow(AppError);
      try {
        service.rollSan(dndRoomId, dndDmId, 'DM', dndCharacter.id, '1d10');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });

    it('角色不存在时应抛 404', () => {
      expect(() =>
        service.rollSan(cocRoomId, cocDmId, 'DM', 'not-exist', '1d10'),
      ).toThrow(AppError);
    });
  });
});
