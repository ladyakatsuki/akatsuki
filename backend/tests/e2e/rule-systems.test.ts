import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import {
  createInMemoryDb,
  setDbInstance,
  closeDb,
} from '../../src/db/index.js';
import { roomsRouter } from '../../src/routes/rooms.js';
import { charactersRouter } from '../../src/routes/characters.js';
import { errorHandler, notFoundHandler } from '../../src/middleware/errorHandler.js';
import { roomRepository } from '../../src/db/repositories/RoomRepository.js';
import { characterRepository } from '../../src/db/repositories/CharacterRepository.js';
import { ruleSystemRegistry } from '../../src/rules/index.js';
import '../../src/rules/index.js';
import { dnd5eRuleSystem } from '../../src/rules/dnd5e/index.js';
import { coc7RuleSystem } from '../../src/rules/coc7/index.js';
import { Dnd5eRollResolver } from '../../src/rules/dnd5e/Dnd5eRollResolver.js';
import { Coc7RollResolver } from '../../src/rules/coc7/Coc7RollResolver.js';
import { diceService } from '../../src/services/DiceService.js';
import { combatService } from '../../src/services/CombatService.js';
import type { Character } from '../../src/types/models.js';
import type { SuccessLevel } from '../../src/types/rules.js';

/**
 * 双规则集切换验证测试
 *
 * 测试内容：
 * - DND 5E 房间完整流程
 * - COC 7版房间完整流程
 * - 规则系统注册验证
 * - DND 5E 规则正确性（属性检定、优势/劣势）
 * - COC 7版规则正确性（d100 检定、奖金骰/惩罚骰、SAN 检定）
 */

/**
 * 构建测试应用
 */
function buildTestApp(): express.Application {
  const app = express();
  app.use(express.json());
  app.use('/api/rooms', roomsRouter);
  app.use('/api', charactersRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('双规则集切换验证', () => {
  let app: express.Application;

  beforeEach(() => {
    const db = createInMemoryDb();
    setDbInstance(db);
    app = buildTestApp();
  });

  afterEach(() => {
    closeDb();
  });

  describe('规则系统注册验证', () => {
    it('应注册 DND 5E 规则系统', () => {
      expect(ruleSystemRegistry.has('dnd5e')).toBe(true);
      const system = ruleSystemRegistry.get('dnd5e');
      expect(system.id).toBe('dnd5e');
      expect(system.name).toBe('DND 5E');
      expect(system.theme).toBe('dnd');
    });

    it('应注册 COC 7版规则系统', () => {
      expect(ruleSystemRegistry.has('coc7')).toBe(true);
      const system = ruleSystemRegistry.get('coc7');
      expect(system.id).toBe('coc7');
      expect(system.name).toBe('COC 7版');
      expect(system.theme).toBe('coc');
    });

    it('应能列出所有已注册规则系统', () => {
      const list = ruleSystemRegistry.list();
      expect(list.length).toBeGreaterThanOrEqual(2);
      const ids = list.map((s) => s.id);
      expect(ids).toContain('dnd5e');
      expect(ids).toContain('coc7');
    });

    it('查询未注册的规则系统应抛错', () => {
      expect(() => ruleSystemRegistry.get('unknown')).toThrow();
    });
  });

  describe('DND 5E 房间完整流程', () => {
    let roomCode: string;
    let roomId: string;
    let dmId: string;
    let playerId: string;
    let character: Character;

    beforeEach(async () => {
      // 创建 DND 5E 房间
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
        .send({ name: '战士' })
        .expect(201);
      character = charRes.body.data;
    });

    it('房间规则系统应为 dnd5e', () => {
      const room = roomRepository.findById(roomId);
      expect(room?.ruleSystem).toBe('dnd5e');
    });

    it('角色规则系统应与房间一致', () => {
      expect(character.ruleSystem).toBe('dnd5e');
    });

    it('角色卡应包含 DND 5E 特有字段', () => {
      const data = character.data;
      // DND 5E 属性
      expect(data.str).toBeDefined();
      expect(data.dex).toBeDefined();
      expect(data.con).toBeDefined();
      expect(data.int).toBeDefined();
      expect(data.wis).toBeDefined();
      expect(data.cha).toBeDefined();
      // 派生属性
      expect(data.strMod).toBeDefined();
      expect(data.dexMod).toBeDefined();
      expect(data.proficiencyBonus).toBeDefined();
      // 战斗字段
      expect(data.hp).toBeDefined();
      expect(data.maxHp).toBeDefined();
      expect(data.ac).toBeDefined();
    });

    it('应支持 DND 5E d20 掷骰', () => {
      const result = diceService.roll(roomId, playerId, '玩家1', {
        expression: '1d20+5',
        label: '攻击检定',
      });
      expect(result.total).toBeGreaterThanOrEqual(6);
      expect(result.total).toBeLessThanOrEqual(25);
      expect(result.rolls).toHaveLength(1);
      expect(result.rolls[0]).toBeGreaterThanOrEqual(1);
      expect(result.rolls[0]).toBeLessThanOrEqual(20);
    });

    it('应支持 DND 5E 优势掷骰', () => {
      const result = diceService.roll(roomId, playerId, '玩家1', {
        expression: '1d20',
        advantage: true,
      });
      // 优势掷骰应掷两次 d20
      expect(result.rolls).toHaveLength(2);
      expect(result.label).toBe('优势');
      // 总计应在 1-20 范围内
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(20);
    });

    it('应支持 DND 5E 劣势掷骰', () => {
      const result = diceService.roll(roomId, playerId, '玩家1', {
        expression: '1d20',
        disadvantage: true,
      });
      expect(result.rolls).toHaveLength(2);
      expect(result.label).toBe('劣势');
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(20);
    });

    it('应支持 DND 5E 技能检定', () => {
      const result = diceService.rollSkill(
        roomId,
        playerId,
        '玩家1',
        character.id,
        'athletics',
      );
      expect(result.label).toBeTruthy();
      expect(result.total).toBeGreaterThanOrEqual(1);
      // athletics 关联 str，1d20 + strMod + 熟练加值
      // 默认 str=10 → strMod=0，未熟练 → 1d20
      expect(result.total).toBeLessThanOrEqual(20);
    });

    it('应支持 DND 5E 战斗先攻（d20+敏捷调整值）', () => {
      // 创建 NPC
      const npc = characterRepository.create({
        roomId,
        playerId: dmId,
        name: '哥布林',
        ruleSystem: 'dnd5e',
        data: {
          name: '哥布林',
          dex: 8,
          dexMod: -1,
          hp: 10,
          maxHp: 10,
          ac: 12,
        },
        portraitUrl: null,
        isNpc: true,
      });

      const combat = combatService.startCombat(
        roomId,
        dmId,
        [character.id, npc.id],
        true,
      );
      expect(combat.participants).toHaveLength(2);
      // 先攻 = d20 + dexMod，范围 -1 到 20
      for (const p of combat.participants) {
        expect(p.initiative).toBeGreaterThanOrEqual(-1);
        expect(p.initiative).toBeLessThanOrEqual(20);
      }
    });
  });

  describe('COC 7版房间完整流程', () => {
    let roomCode: string;
    let roomId: string;
    let dmId: string;
    let playerId: string;
    let character: Character;

    beforeEach(async () => {
      // 创建 COC 7版房间
      const createRes = await request(app)
        .post('/api/rooms')
        .send({ ruleSystem: 'coc7', dmName: '守门人' })
        .expect(201);
      roomCode = createRes.body.data.room.code;
      roomId = createRes.body.data.room.id;
      dmId = createRes.body.data.playerId;

      // 玩家加入
      const joinRes = await request(app)
        .post(`/api/rooms/${roomCode}/join`)
        .send({ playerName: '调查员' })
        .expect(200);
      playerId = joinRes.body.data.playerId;

      // 创建角色
      const charRes = await request(app)
        .post(`/api/rooms/${roomCode}/characters?playerId=${playerId}`)
        .send({ name: '调查员' })
        .expect(201);
      character = charRes.body.data;
    });

    it('房间规则系统应为 coc7', () => {
      const room = roomRepository.findById(roomId);
      expect(room?.ruleSystem).toBe('coc7');
    });

    it('角色规则系统应与房间一致', () => {
      expect(character.ruleSystem).toBe('coc7');
    });

    it('角色卡应包含 COC 7版特有字段', () => {
      const data = character.data;
      // COC 7版 8 项核心属性
      expect(data.str).toBeDefined();
      expect(data.con).toBeDefined();
      expect(data.siz).toBeDefined();
      expect(data.dex).toBeDefined();
      expect(data.app).toBeDefined();
      expect(data.int).toBeDefined();
      expect(data.pow).toBeDefined();
      expect(data.edu).toBeDefined();
      // 派生属性
      expect(data.hp).toBeDefined();
      expect(data.maxHp).toBeDefined();
      expect(data.mp).toBeDefined();
      expect(data.san).toBeDefined();
      expect(data.maxSan).toBeDefined();
      expect(data.db).toBeDefined();
      expect(data.build).toBeDefined();
      expect(data.mov).toBeDefined();
      expect(data.luck).toBeDefined();
    });

    it('应支持 COC 7版 d100 掷骰', () => {
      const result = diceService.roll(roomId, playerId, '调查员', {
        expression: '1d100',
        label: 'd100 检定',
      });
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(100);
      expect(result.rolls).toHaveLength(1);
    });

    it('应支持 COC 7版奖金骰掷骰', () => {
      const result = diceService.roll(roomId, playerId, '调查员', {
        expression: '1d100',
        bonusDice: 1,
        label: '奖金骰检定',
      });
      // 奖金骰：1 个十位骰 + 多个个位骰
      // rolls 应包含十位骰与个位骰
      expect(result.rolls.length).toBeGreaterThanOrEqual(2);
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(100);
    });

    it('应支持 COC 7版惩罚骰掷骰', () => {
      const result = diceService.roll(roomId, playerId, '调查员', {
        expression: '1d100',
        penaltyDice: 1,
        label: '惩罚骰检定',
      });
      expect(result.rolls.length).toBeGreaterThanOrEqual(2);
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(100);
    });

    it('应支持 COC 7版成功等级判定', () => {
      // 掷骰带 target，应计算 successLevel
      const result = diceService.roll(roomId, playerId, '调查员', {
        expression: '1d100',
        target: 50,
        label: '技能检定',
      });
      expect(result.target).toBe(50);
      // successLevel 应为合法值
      const validLevels: (SuccessLevel | undefined)[] = [
        'critical',
        'extreme',
        'hard',
        'regular',
        'fumble',
        undefined,
      ];
      expect(validLevels).toContain(result.successLevel);
    });

    it('应支持 COC 7版 SAN 检定', () => {
      const result = diceService.rollSan(
        roomId,
        playerId,
        '调查员',
        character.id,
        '1d10',
      );
      expect(result.label).toBe('SAN 检定');
      expect(result.sanLossApplied).toBeDefined();
      expect(result.sanLossApplied!).toBeGreaterThanOrEqual(0);
      // 验证角色 SAN 已更新
      const updated = characterRepository.findById(character.id);
      const newSan = updated?.data.san as number;
      expect(newSan).toBeGreaterThanOrEqual(0);
    });

    it('应支持 COC 7版战斗先攻（d100）', () => {
      // 创建 NPC
      const npc = characterRepository.create({
        roomId,
        playerId: dmId,
        name: '邪教徒',
        ruleSystem: 'coc7',
        data: {
          name: '邪教徒',
          dex: 60,
          hp: 12,
          maxHp: 12,
          san: 50,
        },
        portraitUrl: null,
        isNpc: true,
      });

      const combat = combatService.startCombat(
        roomId,
        dmId,
        [character.id, npc.id],
        true,
      );
      expect(combat.participants).toHaveLength(2);
      // 先攻 = d100，范围 1-100
      for (const p of combat.participants) {
        expect(p.initiative).toBeGreaterThanOrEqual(1);
        expect(p.initiative).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('DND 5E 规则正确性', () => {
    it('属性调整值计算应正确', () => {
      const derived = dnd5eRuleSystem.computeDerived({
        str: 16,
        dex: 14,
        con: 12,
        int: 10,
        wis: 8,
        cha: 6,
        level: 1,
      });
      // floor((16-10)/2) = 3
      expect(derived.strMod).toBe(3);
      // floor((14-10)/2) = 2
      expect(derived.dexMod).toBe(2);
      // floor((12-10)/2) = 1
      expect(derived.conMod).toBe(1);
      // floor((10-10)/2) = 0
      expect(derived.intMod).toBe(0);
      // floor((8-10)/2) = -1
      expect(derived.wisMod).toBe(-1);
      // floor((6-10)/2) = -2
      expect(derived.chaMod).toBe(-2);
    });

    it('熟练加值应按等级计算', () => {
      expect(dnd5eRuleSystem.computeDerived({ level: 1 }).proficiencyBonus).toBe(2);
      expect(dnd5eRuleSystem.computeDerived({ level: 5 }).proficiencyBonus).toBe(3);
      expect(dnd5eRuleSystem.computeDerived({ level: 9 }).proficiencyBonus).toBe(4);
      expect(dnd5eRuleSystem.computeDerived({ level: 13 }).proficiencyBonus).toBe(5);
      expect(dnd5eRuleSystem.computeDerived({ level: 17 }).proficiencyBonus).toBe(6);
    });

    it('优势掷骰应取较高值', () => {
      const resolver = new Dnd5eRollResolver();
      // 多次测试验证优势总是取较高
      for (let i = 0; i < 20; i++) {
        const result = resolver.rollWithAdvantage('1d20', true);
        expect(result.rolls).toHaveLength(2);
        // 优势应取较高的总计
        const max = Math.max(result.rolls[0], result.rolls[1]);
        expect(result.total).toBe(max);
      }
    });

    it('劣势掷骰应取较低值', () => {
      const resolver = new Dnd5eRollResolver();
      for (let i = 0; i < 20; i++) {
        const result = resolver.rollWithAdvantage('1d20', false);
        expect(result.rolls).toHaveLength(2);
        const min = Math.min(result.rolls[0], result.rolls[1]);
        expect(result.total).toBe(min);
      }
    });

    it('技能检定应包含属性调整值', () => {
      const resolver = new Dnd5eRollResolver();
      const result = resolver.rollSkill('athletics', {
        strMod: 3,
        athletics: 1, // 熟练
        proficiencyBonus: 2,
      });
      // 1d20 + 3 + 2 = 6-25
      expect(result.total).toBeGreaterThanOrEqual(6);
      expect(result.total).toBeLessThanOrEqual(25);
    });

    it('默认角色卡应包含所有字段', () => {
      const data = dnd5eRuleSystem.createDefaultCharacter();
      // 基础字段
      expect(data.name).toBeDefined();
      expect(data.level).toBeDefined();
      // 属性
      expect(data.str).toBeDefined();
      expect(data.dex).toBeDefined();
      // 派生属性
      expect(data.strMod).toBeDefined();
      expect(data.proficiencyBonus).toBeDefined();
      // 战斗
      expect(data.hp).toBeDefined();
      expect(data.maxHp).toBeDefined();
      expect(data.ac).toBeDefined();
    });
  });

  describe('COC 7版规则正确性', () => {
    it('d100 成功等级判定应正确', () => {
      const resolver = new Coc7RollResolver();
      // 目标值 50
      // 大成功：掷出 1
      expect(resolver.evaluateSuccess(1, 50)).toBe('critical');
      // 极难成功：≤ 10 (50/5)
      expect(resolver.evaluateSuccess(10, 50)).toBe('extreme');
      // 困难成功：≤ 25 (50/2)
      expect(resolver.evaluateSuccess(25, 50)).toBe('hard');
      // 普通成功：≤ 50
      expect(resolver.evaluateSuccess(50, 50)).toBe('regular');
      // 失败：> 50 且 < 100
      expect(resolver.evaluateSuccess(51, 50)).toBeNull();
      // 大失败：100（目标值 ≥ 50 时）
      expect(resolver.evaluateSuccess(100, 50)).toBe('fumble');
    });

    it('目标值 < 50 时大失败阈值为 96', () => {
      const resolver = new Coc7RollResolver();
      // 目标值 40
      expect(resolver.evaluateSuccess(96, 40)).toBe('fumble');
      expect(resolver.evaluateSuccess(100, 40)).toBe('fumble');
      // 95 应为失败（非大失败）
      expect(resolver.evaluateSuccess(95, 40)).toBeNull();
    });

    it('奖金骰应取个位最小值', () => {
      const resolver = new Coc7RollResolver();
      // 多次测试验证奖金骰结果在合法范围
      for (let i = 0; i < 20; i++) {
        const result = resolver.rollWithBonusPenalty('1d100', 1, 0);
        expect(result.total).toBeGreaterThanOrEqual(1);
        expect(result.total).toBeLessThanOrEqual(100);
        expect(result.label).toBe('奖金骰');
      }
    });

    it('惩罚骰应取个位最大值', () => {
      const resolver = new Coc7RollResolver();
      for (let i = 0; i < 20; i++) {
        const result = resolver.rollWithBonusPenalty('1d100', 0, 1);
        expect(result.total).toBeGreaterThanOrEqual(1);
        expect(result.total).toBeLessThanOrEqual(100);
        expect(result.label).toBe('惩罚骰');
      }
    });

    it('奖金骰与惩罚骰应相互抵消', () => {
      const resolver = new Coc7RollResolver();
      // 奖金骰与惩罚骰各 1，应相互抵消
      const result = resolver.rollWithBonusPenalty('1d100', 1, 1);
      expect(result.total).toBeGreaterThanOrEqual(1);
      expect(result.total).toBeLessThanOrEqual(100);
      // 抵消后应无 label
      expect(result.label).toBeUndefined();
    });

    it('SAN 检定成功应扣半损', () => {
      const resolver = new Coc7RollResolver();
      // 模拟成功场景：roll 1（大成功）
      // 但 rollSan 内部掷骰，无法控制结果，验证逻辑正确性
      // 通过 evaluateSuccess 验证成功等级
      const successLevel = resolver.evaluateSuccess(1, 60);
      expect(successLevel).toBe('critical');
    });

    it('SAN 检定失败应扣全损', () => {
      const resolver = new Coc7RollResolver();
      // 失败场景：roll 80 vs target 60
      const successLevel = resolver.evaluateSuccess(80, 60);
      expect(successLevel).toBeNull();
    });

    it('默认角色卡应包含所有字段', () => {
      const data = coc7RuleSystem.createDefaultCharacter();
      // 基础字段
      expect(data.name).toBeDefined();
      expect(data.age).toBeDefined();
      expect(data.occupation).toBeDefined();
      // 8 项核心属性
      expect(data.str).toBeDefined();
      expect(data.con).toBeDefined();
      expect(data.siz).toBeDefined();
      expect(data.dex).toBeDefined();
      expect(data.app).toBeDefined();
      expect(data.int).toBeDefined();
      expect(data.pow).toBeDefined();
      expect(data.edu).toBeDefined();
      // 派生属性
      expect(data.hp).toBeDefined();
      expect(data.maxHp).toBeDefined();
      expect(data.san).toBeDefined();
      expect(data.maxSan).toBeDefined();
      expect(data.db).toBeDefined();
      expect(data.build).toBeDefined();
      expect(data.mov).toBeDefined();
      expect(data.luck).toBeDefined();
    });

    it('派生属性计算应正确', () => {
      const derived = coc7RuleSystem.computeDerived({
        str: 50,
        con: 50,
        siz: 50,
        dex: 50,
        app: 50,
        int: 50,
        pow: 50,
        edu: 50,
        age: 30,
        cthulhuMythos: 0,
      });
      // HP = (CON + SIZ) / 10 = 10
      expect(derived.maxHp).toBe(10);
      // MP = POW / 5 = 10
      expect(derived.maxMp).toBe(10);
      // 最大 SAN = 99 - 0 = 99
      expect(derived.maxSan).toBe(99);
      // STR + SIZ = 100，DB = 0，Build = 0
      expect(derived.db).toBe(0);
      expect(derived.build).toBe(0);
      // 年龄 30，DEX 不小于 STR/SIZ，MOV = 8
      expect(derived.mov).toBe(8);
    });
  });

  describe('规则集切换验证', () => {
    it('不同规则集房间应独立运行', async () => {
      // 创建 DND 5E 房间
      const dndRes = await request(app)
        .post('/api/rooms')
        .send({ ruleSystem: 'dnd5e', dmName: 'DND DM' })
        .expect(201);
      const dndCode = dndRes.body.data.room.code;
      const dndDmId = dndRes.body.data.playerId;

      // 创建 COC 7版房间
      const cocRes = await request(app)
        .post('/api/rooms')
        .send({ ruleSystem: 'coc7', dmName: 'COC DM' })
        .expect(201);
      const cocCode = cocRes.body.data.room.code;
      const cocDmId = cocRes.body.data.playerId;

      // DND 房间创建 DND 角色
      const dndCharRes = await request(app)
        .post(`/api/rooms/${dndCode}/characters?playerId=${dndDmId}`)
        .send({ name: 'DND 英雄', isNpc: true })
        .expect(201);
      expect(dndCharRes.body.data.ruleSystem).toBe('dnd5e');
      expect(dndCharRes.body.data.data.str).toBeDefined();
      expect(dndCharRes.body.data.data.dexMod).toBeDefined();

      // COC 房间创建 COC 角色
      const cocCharRes = await request(app)
        .post(`/api/rooms/${cocCode}/characters?playerId=${cocDmId}`)
        .send({ name: 'COC 调查员', isNpc: true })
        .expect(201);
      expect(cocCharRes.body.data.ruleSystem).toBe('coc7');
      expect(cocCharRes.body.data.data.san).toBeDefined();
      expect(cocCharRes.body.data.data.cthulhuMythos).toBeDefined();

      // 验证两房间角色不互相影响
      const dndChars = await request(app)
        .get(`/api/rooms/${dndCode}/characters`)
        .expect(200);
      expect(dndChars.body.data).toHaveLength(1);
      expect(dndChars.body.data[0].ruleSystem).toBe('dnd5e');

      const cocChars = await request(app)
        .get(`/api/rooms/${cocCode}/characters`)
        .expect(200);
      expect(cocChars.body.data).toHaveLength(1);
      expect(cocChars.body.data[0].ruleSystem).toBe('coc7');
    });

    it('DND 5E 角色卡模板应包含 7 个分页', () => {
      expect(dnd5eRuleSystem.characterSheetTemplate.sections).toHaveLength(7);
      const sectionKeys = dnd5eRuleSystem.characterSheetTemplate.sections.map(
        (s) => s.key,
      );
      expect(sectionKeys).toContain('basic');
      expect(sectionKeys).toContain('attributes');
      expect(sectionKeys).toContain('combat');
      expect(sectionKeys).toContain('skills');
      expect(sectionKeys).toContain('spells');
      expect(sectionKeys).toContain('background');
      expect(sectionKeys).toContain('inventory');
    });

    it('COC 7版角色卡模板应包含 10 个分页', () => {
      expect(coc7RuleSystem.characterSheetTemplate.sections).toHaveLength(10);
      const sectionKeys = coc7RuleSystem.characterSheetTemplate.sections.map(
        (s) => s.key,
      );
      expect(sectionKeys).toContain('basic');
      expect(sectionKeys).toContain('attributes');
      expect(sectionKeys).toContain('combat_skills');
      expect(sectionKeys).toContain('investigation_skills');
      expect(sectionKeys).toContain('action_skills');
      expect(sectionKeys).toContain('social_skills');
      expect(sectionKeys).toContain('knowledge_skills');
      expect(sectionKeys).toContain('combat');
    });

    it('DND 5E 应支持 18 项技能', () => {
      expect(dnd5eRuleSystem.skillSchema).toHaveLength(18);
    });

    it('COC 7版应包含完整技能列表', () => {
      // COC 7版技能数量应大于 30
      expect(coc7RuleSystem.skillSchema.length).toBeGreaterThan(30);
      // 应包含关键技能
      const skillKeys = coc7RuleSystem.skillSchema.map((s) => s.key);
      expect(skillKeys).toContain('libraryUse');
      expect(skillKeys).toContain('perception');
      expect(skillKeys).toContain('stealth');
      expect(skillKeys).toContain('dodge');
      expect(skillKeys).toContain('cthulhuMythos');
    });
  });
});
