import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createInMemoryDb,
  setDbInstance,
  closeDb,
} from '../../src/db/index.js';
import { CharacterService } from '../../src/services/CharacterService.js';
import { roomRepository } from '../../src/db/repositories/RoomRepository.js';
import { characterRepository } from '../../src/db/repositories/CharacterRepository.js';
import { ruleSystemRegistry } from '../../src/rules/index.js';
import '../../src/rules/index.js';
import { AppError } from '../../src/middleware/errorHandler.js';
import type { Character } from '../../src/types/models.js';

describe('CharacterService', () => {
  let service: CharacterService;
  let roomId: string;
  let dmId: string;
  let playerId: string;

  beforeEach(() => {
    const db = createInMemoryDb();
    setDbInstance(db);
    service = new CharacterService();

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
  });

  afterEach(() => {
    closeDb();
  });

  describe('createCharacter', () => {
    it('应成功创建角色并使用规则系统默认数据', () => {
      const character = service.createCharacter({
        roomId,
        playerId,
        ruleSystem: 'dnd5e',
        name: '英雄',
      });
      expect(character.id).toBeTruthy();
      expect(character.name).toBe('英雄');
      expect(character.playerId).toBe(playerId);
      expect(character.roomId).toBe(roomId);
      expect(character.ruleSystem).toBe('dnd5e');
      expect(character.isNpc).toBe(false);
      expect(character.portraitUrl).toBeNull();
      // 默认数据应包含规则系统的字段
      expect(character.data).toBeTruthy();
      expect(character.data.name).toBe('英雄');
      expect(character.data.str).toBeDefined();
      expect(character.data.dex).toBeDefined();
    });

    it('COC 7版规则系统应生成对应默认数据', () => {
      // 创建 COC 房间
      const cocRoom = roomRepository.create('coc7', 'coc-dm', 'COC DM');
      roomRepository.addPlayer(cocRoom.id, {
        id: 'coc-player',
        name: 'COC 玩家',
        role: 'player',
        joinedAt: Date.now(),
      });
      const character = service.createCharacter({
        roomId: cocRoom.id,
        playerId: 'coc-player',
        ruleSystem: 'coc7',
        name: '调查员',
      });
      expect(character.ruleSystem).toBe('coc7');
      expect(character.data.san).toBeDefined();
      expect(character.data.luck).toBeDefined();
      expect(character.data.maxHp).toBeDefined();
    });

    it('角色名称为空时应抛 400', () => {
      try {
        service.createCharacter({
          roomId,
          playerId,
          ruleSystem: 'dnd5e',
          name: '',
        });
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });

    it('房间不存在时应抛 404', () => {
      try {
        service.createCharacter({
          roomId: 'not-exist',
          playerId,
          ruleSystem: 'dnd5e',
          name: '英雄',
        });
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(404);
      }
    });

    it('玩家不在房间内时应抛 403', () => {
      try {
        service.createCharacter({
          roomId,
          playerId: 'not-in-room',
          ruleSystem: 'dnd5e',
          name: '英雄',
        });
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });

    it('规则系统与房间不一致时应抛 400', () => {
      try {
        service.createCharacter({
          roomId,
          playerId,
          ruleSystem: 'coc7',
          name: '英雄',
        });
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });

    it('玩家最多 1 个角色，重复创建应抛 409', () => {
      service.createCharacter({
        roomId,
        playerId,
        ruleSystem: 'dnd5e',
        name: '英雄1',
      });
      try {
        service.createCharacter({
          roomId,
          playerId,
          ruleSystem: 'dnd5e',
          name: '英雄2',
        });
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(409);
      }
    });

    it('DM 创建 NPC 不限数量', () => {
      const npc1 = service.createCharacter({
        roomId,
        playerId: dmId,
        ruleSystem: 'dnd5e',
        name: 'NPC1',
        isNpc: true,
      });
      const npc2 = service.createCharacter({
        roomId,
        playerId: dmId,
        ruleSystem: 'dnd5e',
        name: 'NPC2',
        isNpc: true,
      });
      expect(npc1.isNpc).toBe(true);
      expect(npc2.isNpc).toBe(true);
      const dmChars = characterRepository.findByPlayer(roomId, dmId);
      expect(dmChars).toHaveLength(2);
    });
  });

  describe('getCharacter', () => {
    it('应返回指定角色', () => {
      const created = service.createCharacter({
        roomId,
        playerId,
        ruleSystem: 'dnd5e',
        name: '英雄',
      });
      const found = service.getCharacter(created.id);
      expect(found.id).toBe(created.id);
      expect(found.name).toBe('英雄');
    });

    it('角色不存在时应抛 404', () => {
      try {
        service.getCharacter('not-exist');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(404);
      }
    });
  });

  describe('getRoomCharacters', () => {
    it('应返回房间内所有角色', () => {
      service.createCharacter({
        roomId,
        playerId,
        ruleSystem: 'dnd5e',
        name: '玩家角色',
      });
      service.createCharacter({
        roomId,
        playerId: dmId,
        ruleSystem: 'dnd5e',
        name: 'NPC',
        isNpc: true,
      });
      const characters = service.getRoomCharacters(roomId);
      expect(characters).toHaveLength(2);
    });
  });

  describe('getPlayerCharacters', () => {
    it('应返回玩家在房间内的角色', () => {
      service.createCharacter({
        roomId,
        playerId,
        ruleSystem: 'dnd5e',
        name: '英雄',
      });
      const characters = service.getPlayerCharacters(roomId, playerId);
      expect(characters).toHaveLength(1);
      expect(characters[0].name).toBe('英雄');
    });
  });

  describe('updateCharacter', () => {
    it('玩家应能更新自己的角色名称', () => {
      const created = service.createCharacter({
        roomId,
        playerId,
        ruleSystem: 'dnd5e',
        name: '旧名称',
      });
      const updated = service.updateCharacter(created.id, playerId, { name: '新名称' });
      expect(updated.name).toBe('新名称');
      expect(updated.data.name).toBe('新名称');
    });

    it('玩家不能改他人的角色，应抛 403', () => {
      const created = service.createCharacter({
        roomId,
        playerId,
        ruleSystem: 'dnd5e',
        name: '玩家角色',
      });
      // 添加另一个玩家
      roomRepository.addPlayer(roomId, {
        id: 'player-2',
        name: '玩家2',
        role: 'player',
        joinedAt: Date.now(),
      });
      try {
        service.updateCharacter(created.id, 'player-2', { name: '篡改' });
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });

    it('DM 可改所有角色', () => {
      const created = service.createCharacter({
        roomId,
        playerId,
        ruleSystem: 'dnd5e',
        name: '玩家角色',
      });
      const updated = service.updateCharacter(created.id, dmId, { name: 'DM 修改' });
      expect(updated.name).toBe('DM 修改');
    });

    it('角色名称为空时应抛 400', () => {
      const created = service.createCharacter({
        roomId,
        playerId,
        ruleSystem: 'dnd5e',
        name: '英雄',
      });
      try {
        service.updateCharacter(created.id, playerId, { name: '' });
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });

    it('角色不存在时应抛 404', () => {
      try {
        service.updateCharacter('not-exist', playerId, { name: '新名称' });
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(404);
      }
    });
  });

  describe('updateCharacterData', () => {
    it('玩家应能更新自己的角色卡数据', () => {
      const created = service.createCharacter({
        roomId,
        playerId,
        ruleSystem: 'dnd5e',
        name: '英雄',
      });
      // 使用规则系统默认数据（已包含所有必需字段）
      const system = ruleSystemRegistry.get('dnd5e');
      const newData = system.createDefaultCharacter();
      newData.name = '英雄';
      newData.str = 18;

      const updated = service.updateCharacterData(created.id, playerId, newData);
      expect(updated.data.str).toBe(18);
    });

    it('玩家不能改他人的角色卡数据，应抛 403', () => {
      const created = service.createCharacter({
        roomId,
        playerId,
        ruleSystem: 'dnd5e',
        name: '英雄',
      });
      roomRepository.addPlayer(roomId, {
        id: 'player-2',
        name: '玩家2',
        role: 'player',
        joinedAt: Date.now(),
      });
      const system = ruleSystemRegistry.get('dnd5e');
      const newData = system.createDefaultCharacter();
      try {
        service.updateCharacterData(created.id, 'player-2', newData);
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });

    it('DM 可改所有角色卡数据', () => {
      const created = service.createCharacter({
        roomId,
        playerId,
        ruleSystem: 'dnd5e',
        name: '英雄',
      });
      const system = ruleSystemRegistry.get('dnd5e');
      const newData = system.createDefaultCharacter();
      newData.name = '英雄';
      newData.str = 20;

      const updated = service.updateCharacterData(created.id, dmId, newData);
      expect(updated.data.str).toBe(20);
    });

    it('缺少必需字段时应抛 400', () => {
      const created = service.createCharacter({
        roomId,
        playerId,
        ruleSystem: 'dnd5e',
        name: '英雄',
      });
      // 缺少字段的 data
      const incompleteData = { name: '英雄' };
      try {
        service.updateCharacterData(created.id, playerId, incompleteData);
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });
  });

  describe('deleteCharacter', () => {
    it('玩家应能删除自己的角色', () => {
      const created = service.createCharacter({
        roomId,
        playerId,
        ruleSystem: 'dnd5e',
        name: '英雄',
      });
      service.deleteCharacter(created.id, playerId);
      expect(characterRepository.findById(created.id)).toBeNull();
    });

    it('玩家不能删他人的角色，应抛 403', () => {
      const created = service.createCharacter({
        roomId,
        playerId,
        ruleSystem: 'dnd5e',
        name: '英雄',
      });
      roomRepository.addPlayer(roomId, {
        id: 'player-2',
        name: '玩家2',
        role: 'player',
        joinedAt: Date.now(),
      });
      try {
        service.deleteCharacter(created.id, 'player-2');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });

    it('DM 可删所有角色', () => {
      const created = service.createCharacter({
        roomId,
        playerId,
        ruleSystem: 'dnd5e',
        name: '英雄',
      });
      service.deleteCharacter(created.id, dmId);
      expect(characterRepository.findById(created.id)).toBeNull();
    });

    it('角色不存在时应抛 404', () => {
      try {
        service.deleteCharacter('not-exist', playerId);
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(404);
      }
    });
  });

  describe('uploadPortrait', () => {
    it('玩家应能上传自己角色的立绘', () => {
      const created = service.createCharacter({
        roomId,
        playerId,
        ruleSystem: 'dnd5e',
        name: '英雄',
      });
      const updated = service.uploadPortrait(created.id, playerId, {
        filename: 'test.png',
        path: '/tmp/uploads/room-1/portrait/test.png',
        size: 1024,
        mimetype: 'image/png',
      });
      expect(updated.portraitUrl).toContain('test.png');
    });

    it('玩家不能上传他人角色的立绘，应抛 403', () => {
      const created = service.createCharacter({
        roomId,
        playerId,
        ruleSystem: 'dnd5e',
        name: '英雄',
      });
      roomRepository.addPlayer(roomId, {
        id: 'player-2',
        name: '玩家2',
        role: 'player',
        joinedAt: Date.now(),
      });
      try {
        service.uploadPortrait(created.id, 'player-2', {
          filename: 'test.png',
          path: '/tmp/test.png',
          size: 1024,
          mimetype: 'image/png',
        });
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });

    it('DM 可上传所有角色的立绘', () => {
      const created = service.createCharacter({
        roomId,
        playerId,
        ruleSystem: 'dnd5e',
        name: '英雄',
      });
      const updated = service.uploadPortrait(created.id, dmId, {
        filename: 'dm-portrait.png',
        path: '/tmp/dm-portrait.png',
        size: 2048,
        mimetype: 'image/png',
      });
      expect(updated.portraitUrl).toContain('dm-portrait.png');
    });
  });

  describe('完整流程', () => {
    it('创建 -> 查询 -> 更新 -> 删除 完整流程', () => {
      // 1. 创建
      const created = service.createCharacter({
        roomId,
        playerId,
        ruleSystem: 'dnd5e',
        name: '初始名称',
      });

      // 2. 查询
      const found = service.getCharacter(created.id);
      expect(found.name).toBe('初始名称');

      // 3. 更新名称
      const updated = service.updateCharacter(created.id, playerId, { name: '更新名称' });
      expect(updated.name).toBe('更新名称');

      // 4. 更新数据
      const system = ruleSystemRegistry.get('dnd5e');
      const newData = system.createDefaultCharacter();
      newData.name = '更新名称';
      newData.str = 16;
      const dataUpdated = service.updateCharacterData(created.id, playerId, newData);
      expect(dataUpdated.data.str).toBe(16);

      // 5. 删除
      service.deleteCharacter(created.id, playerId);
      try {
        service.getCharacter(created.id);
        expect.fail('应抛出 404');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(404);
      }
    });
  });
});
