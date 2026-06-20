import path from 'node:path';
import fs from 'node:fs';
import { characterRepository } from '../db/repositories/CharacterRepository.js';
import { roomRepository } from '../db/repositories/RoomRepository.js';
import { ruleSystemRegistry } from '../rules/index.js';
import type { Character, RuleSystem } from '../types/models.js';
import { AppError } from '../middleware/errorHandler.js';
import { getEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';

/** 上传文件类型（Multer file 对象的最小子集） */
export interface UploadedFile {
  filename: string;
  path: string;
  size: number;
  mimetype: string;
}

/**
 * 角色业务逻辑服务
 *
 * 封装角色创建、查询、更新、删除、立绘上传等业务规则。
 * - 玩家最多 1 个角色（DM 创建 NPC 不限）
 * - 玩家只能修改/删除自己的角色，DM 可操作所有角色
 * - 规则系统与房间一致
 */
export class CharacterService {
  /**
   * 创建角色
   * - 校验玩家在房间内
   * - 校验规则系统与房间一致
   * - 玩家最多 1 个角色（DM 创建 NPC 不限）
   * - 使用规则系统的 createDefaultCharacter() 生成默认数据
   * - 设置 name
   */
  createCharacter(params: {
    roomId: string;
    playerId: string;
    ruleSystem: RuleSystem;
    name: string;
    isNpc?: boolean;
  }): Character {
    const { roomId, playerId, ruleSystem, name, isNpc = false } = params;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new AppError(400, '角色名称不能为空');
    }

    // 校验房间存在
    const room = roomRepository.findById(roomId);
    if (!room) {
      throw new AppError(404, '房间不存在');
    }

    // 校验玩家在房间内
    if (!roomRepository.isPlayerInRoom(roomId, playerId)) {
      throw new AppError(403, '玩家不在房间内');
    }

    // 校验规则系统与房间一致
    if (room.ruleSystem !== ruleSystem) {
      throw new AppError(400, `规则系统与房间不一致，房间规则系统为 ${room.ruleSystem}`);
    }

    // DM 创建 NPC 不限数量；普通玩家最多 1 个角色
    const isDm = room.dmId === playerId;
    if (!isNpc || !isDm) {
      const existing = characterRepository.findByPlayer(roomId, playerId);
      // 玩家已有非 NPC 角色时不能再创建角色
      const playerCharacters = existing.filter((c) => !c.isNpc);
      if (playerCharacters.length >= 1 && !isNpc) {
        throw new AppError(409, '每个玩家最多创建 1 个角色');
      }
    }

    // 获取规则系统并生成默认数据
    const system = ruleSystemRegistry.get(ruleSystem);
    const data = system.createDefaultCharacter();
    // 设置 name 字段到 data 中
    data.name = name;

    const character = characterRepository.create({
      roomId,
      playerId,
      name,
      ruleSystem,
      data,
      portraitUrl: null,
      isNpc: isNpc && isDm,
    });

    logger.info('角色已创建', {
      characterId: character.id,
      roomId,
      playerId,
      name,
      isNpc: character.isNpc,
    });
    return character;
  }

  /** 获取单个角色 */
  getCharacter(id: string): Character {
    const character = characterRepository.findById(id);
    if (!character) {
      throw new AppError(404, '角色不存在');
    }
    return character;
  }

  /** 获取房间内所有角色 */
  getRoomCharacters(roomId: string): Character[] {
    return characterRepository.findByRoom(roomId);
  }

  /** 获取玩家在房间内的角色 */
  getPlayerCharacters(roomId: string, playerId: string): Character[] {
    return characterRepository.findByPlayer(roomId, playerId);
  }

  /**
   * 更新角色基本信息
   * - 玩家只能改自己的角色
   * - DM 可改所有角色
   */
  updateCharacter(
    id: string,
    playerId: string,
    patch: Partial<Pick<Character, 'name'>>,
  ): Character {
    const character = this.getCharacter(id);
    this.assertCanModify(character, playerId);

    if (patch.name !== undefined) {
      if (typeof patch.name !== 'string' || patch.name.trim().length === 0) {
        throw new AppError(400, '角色名称不能为空');
      }
      // 同步更新 data.name
      const newData = { ...character.data, name: patch.name };
      characterRepository.updateData(id, newData);
    }

    const updated = characterRepository.update(id, patch);
    if (!updated) {
      throw new AppError(404, '角色不存在');
    }
    logger.info('角色已更新', { characterId: id, playerId, patch });
    return updated;
  }

  /**
   * 更新角色卡数据
   * - 校验权限
   * - 基本字段存在性检查
   */
  updateCharacterData(
    id: string,
    playerId: string,
    data: Record<string, unknown>,
  ): Character {
    const character = this.getCharacter(id);
    this.assertCanModify(character, playerId);

    // 基本字段存在性检查（不强制完整 schema）
    const system = ruleSystemRegistry.get(character.ruleSystem);
    const template = system.characterSheetTemplate;
    for (const field of template.fields) {
      if (field.computed) continue;
      if (!(field.key in data)) {
        throw new AppError(400, `角色卡数据缺少字段: ${field.key} (${field.label})`);
      }
    }

    const updated = characterRepository.updateData(id, data);
    if (!updated) {
      throw new AppError(404, '角色不存在');
    }
    logger.info('角色卡数据已更新', { characterId: id, playerId });
    return updated;
  }

  /**
   * 删除角色
   * - 玩家只能删自己的角色
   * - DM 可删所有角色
   */
  deleteCharacter(id: string, playerId: string): void {
    const character = this.getCharacter(id);
    this.assertCanModify(character, playerId);

    const success = characterRepository.delete(id);
    if (!success) {
      throw new AppError(404, '角色不存在');
    }
    logger.info('角色已删除', { characterId: id, playerId });
  }

  /**
   * 上传立绘
   * - 校验权限
   * - 文件已由 Multer 存储到 uploads/{roomId}/portrait/
   * - 更新 portraitUrl
   */
  uploadPortrait(id: string, playerId: string, file: UploadedFile): Character {
    const character = this.getCharacter(id);
    this.assertCanModify(character, playerId);

    // 构造可访问的 URL（相对于静态文件服务根路径）
    const env = getEnv();
    const relativePath = path.relative(env.uploadDir, file.path).replace(/\\/g, '/');
    const portraitUrl = `/uploads/${relativePath}`;

    const updated = characterRepository.setPortrait(id, portraitUrl);
    if (!updated) {
      throw new AppError(404, '角色不存在');
    }
    logger.info('角色立绘已上传', { characterId: id, playerId, portraitUrl });
    return updated;
  }

  /**
   * 校验玩家是否有权修改/删除角色
   * - DM 可操作所有角色
   * - 玩家只能操作自己的角色
   */
  private assertCanModify(character: Character, playerId: string): void {
    const room = roomRepository.findById(character.roomId);
    if (!room) {
      throw new AppError(404, '房间不存在');
    }
    const isDm = room.dmId === playerId;
    if (!isDm && character.playerId !== playerId) {
      throw new AppError(403, '无权操作他人的角色');
    }
  }
}

/** 角色服务单例 */
export const characterService = new CharacterService();

/**
 * 确保立绘上传目录存在
 * @param roomId 房间 ID
 * @returns 立绘上传目录绝对路径
 */
export function ensurePortraitDir(roomId: string): string {
  const dir = path.join(getEnv().uploadDir, roomId, 'portrait');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
