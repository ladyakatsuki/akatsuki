import { combatRepository } from '../db/repositories/CombatRepository.js';
import { characterRepository } from '../db/repositories/CharacterRepository.js';
import { roomRepository } from '../db/repositories/RoomRepository.js';
import { ruleSystemRegistry } from '../rules/index.js';
import type { RuleSystem } from '../types/rules.js';
import type { Character, CombatParticipant, CombatState } from '../types/models.js';
import type { CombatAddParticipantPayload } from '../types/socket.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateId } from '../utils/id.js';
import { logger } from '../utils/logger.js';

/**
 * 战斗业务逻辑服务
 *
 * 封装战斗开始/结束、参与者管理、回合推进、先攻掷骰等业务规则。
 * 所有战斗操作仅 DM 可执行，需权限校验。
 * 战斗状态变化由调用方（Socket 处理器）负责广播给全房间。
 */
export class CombatService {
  /**
   * 开始战斗
   *
   * 流程：
   * 1. DM 权限校验
   * 2. 获取角色信息并创建参与者
   * 3. 若 rollInitiative，用规则系统掷先攻（DND: d20+dexMod, COC: d100）
   * 4. 按先攻降序排序
   * 5. 保存战斗状态
   *
   * @param roomId 房间 ID
   * @param playerId 操作者 ID（须为 DM）
   * @param participantIds 角色 ID 列表
   * @param rollInitiative 是否自动掷先攻
   * @returns 战斗状态
   */
  startCombat(
    roomId: string,
    playerId: string,
    participantIds: string[],
    rollInitiative: boolean,
  ): CombatState {
    this.assertDm(roomId, playerId);

    const room = roomRepository.findById(roomId);
    if (!room) {
      throw new AppError(404, '房间不存在');
    }

    const system = ruleSystemRegistry.get(room.ruleSystem);

    // 获取角色并创建参与者
    const participants: CombatParticipant[] = [];
    for (const characterId of participantIds) {
      const character = characterRepository.findById(characterId);
      if (!character) {
        throw new AppError(404, `角色不存在: ${characterId}`);
      }
      if (character.roomId !== roomId) {
        throw new AppError(400, `角色不属于该房间: ${characterId}`);
      }
      participants.push(this.createParticipantFromCharacter(character, rollInitiative, system));
    }

    // 按先攻降序排序
    this.sortParticipants(participants);

    // 创建并保存战斗状态
    combatRepository.create(roomId);
    const updated = combatRepository.update(roomId, {
      participants,
      isActive: true,
      round: 1,
      currentTurn: 0,
    });
    if (!updated) {
      throw new AppError(500, '创建战斗状态失败');
    }

    logger.info('[CombatService.startCombat] 战斗已开始', {
      roomId,
      playerId,
      participantCount: participants.length,
      rollInitiative,
    });
    return updated;
  }

  /**
   * 结束战斗
   *
   * @param roomId 房间 ID
   * @param playerId 操作者 ID（须为 DM）
   */
  endCombat(roomId: string, playerId: string): void {
    this.assertDm(roomId, playerId);
    combatRepository.delete(roomId);
    logger.info('[CombatService.endCombat] 战斗已结束', { roomId, playerId });
  }

  /**
   * 添加参与者
   *
   * @param roomId 房间 ID
   * @param playerId 操作者 ID（须为 DM）
   * @param payload 参与者信息
   * @returns 更新后的战斗状态
   */
  addParticipant(
    roomId: string,
    playerId: string,
    payload: CombatAddParticipantPayload,
  ): CombatState {
    this.assertDm(roomId, playerId);
    const combat = this.getCombatStateOrThrow(roomId);

    // 若提供 characterId，从角色获取信息
    let name = payload.name;
    const initiative = payload.initiative ?? 0;
    if (payload.characterId) {
      const character = characterRepository.findById(payload.characterId);
      if (character) {
        name = character.name;
      }
    }

    const participant: CombatParticipant = {
      id: generateId('part_'),
      characterId: payload.characterId,
      name,
      type: payload.type,
      initiative,
      hp: payload.hp,
      maxHp: payload.maxHp,
      ac: payload.ac,
      statusEffects: [],
    };

    combat.participants.push(participant);
    this.sortParticipants(combat.participants);

    const updated = combatRepository.update(roomId, {
      participants: combat.participants,
    });
    if (!updated) {
      throw new AppError(500, '更新战斗状态失败');
    }
    logger.info('[CombatService.addParticipant] 参与者已添加', {
      roomId,
      participantId: participant.id,
      name: participant.name,
    });
    return updated;
  }

  /**
   * 移除参与者
   *
   * @param roomId 房间 ID
   * @param playerId 操作者 ID（须为 DM）
   * @param participantId 参与者 ID
   * @returns 更新后的战斗状态
   */
  removeParticipant(roomId: string, playerId: string, participantId: string): CombatState {
    this.assertDm(roomId, playerId);
    const combat = this.getCombatStateOrThrow(roomId);

    const index = combat.participants.findIndex((p) => p.id === participantId);
    if (index === -1) {
      throw new AppError(404, '参与者不存在');
    }

    combat.participants.splice(index, 1);
    // 若当前回合索引超出范围则修正
    if (combat.currentTurn >= combat.participants.length) {
      combat.currentTurn = Math.max(0, combat.participants.length - 1);
    }

    const updated = combatRepository.update(roomId, {
      participants: combat.participants,
      currentTurn: combat.currentTurn,
    });
    if (!updated) {
      throw new AppError(500, '更新战斗状态失败');
    }
    logger.info('[CombatService.removeParticipant] 参与者已移除', {
      roomId,
      participantId,
    });
    return updated;
  }

  /**
   * 更新参与者状态（HP、状态效果等）
   *
   * @param roomId 房间 ID
   * @param playerId 操作者 ID（须为 DM）
   * @param participantId 参与者 ID
   * @param patch 需要更新的字段
   * @returns 更新后的战斗状态
   */
  updateParticipant(
    roomId: string,
    playerId: string,
    participantId: string,
    patch: Partial<CombatParticipant>,
  ): CombatState {
    this.assertDm(roomId, playerId);
    const combat = this.getCombatStateOrThrow(roomId);

    const participant = combat.participants.find((p) => p.id === participantId);
    if (!participant) {
      throw new AppError(404, '参与者不存在');
    }

    // 应用更新（不允许修改 id 与 characterId）
    if (patch.hp !== undefined) participant.hp = patch.hp;
    if (patch.maxHp !== undefined) participant.maxHp = patch.maxHp;
    if (patch.ac !== undefined) participant.ac = patch.ac;
    if (patch.initiative !== undefined) participant.initiative = patch.initiative;
    if (patch.statusEffects !== undefined) participant.statusEffects = patch.statusEffects;
    if (patch.notes !== undefined) participant.notes = patch.notes;
    if (patch.name !== undefined) participant.name = patch.name;

    const updated = combatRepository.update(roomId, {
      participants: combat.participants,
    });
    if (!updated) {
      throw new AppError(500, '更新战斗状态失败');
    }
    return updated;
  }

  /**
   * 推进到下一回合
   *
   * 若到末尾则轮次 +1 回到首位。
   *
   * @param roomId 房间 ID
   * @param playerId 操作者 ID（须为 DM）
   * @returns 更新后的战斗状态
   */
  nextTurn(roomId: string, playerId: string): CombatState {
    this.assertDm(roomId, playerId);
    const combat = this.getCombatStateOrThrow(roomId);

    if (combat.participants.length === 0) {
      return combat;
    }

    let nextTurn = combat.currentTurn + 1;
    let round = combat.round;
    if (nextTurn >= combat.participants.length) {
      nextTurn = 0;
      round += 1;
    }

    const updated = combatRepository.update(roomId, {
      currentTurn: nextTurn,
      round,
    });
    if (!updated) {
      throw new AppError(500, '更新战斗状态失败');
    }
    return updated;
  }

  /**
   * 回退回合
   *
   * 若在首位则回到上一轮末尾（第一轮首位保持原位）。
   *
   * @param roomId 房间 ID
   * @param playerId 操作者 ID（须为 DM）
   * @returns 更新后的战斗状态
   */
  prevTurn(roomId: string, playerId: string): CombatState {
    this.assertDm(roomId, playerId);
    const combat = this.getCombatStateOrThrow(roomId);

    if (combat.participants.length === 0) {
      return combat;
    }

    let prevTurn = combat.currentTurn - 1;
    let round = combat.round;
    if (prevTurn < 0) {
      if (round > 1) {
        round -= 1;
        prevTurn = combat.participants.length - 1;
      } else {
        // 第一轮首位保持原位
        prevTurn = 0;
        round = 1;
      }
    }

    const updated = combatRepository.update(roomId, {
      currentTurn: prevTurn,
      round,
    });
    if (!updated) {
      throw new AppError(500, '更新战斗状态失败');
    }
    return updated;
  }

  /**
   * 获取战斗状态
   *
   * @param roomId 房间 ID
   * @returns 战斗状态，不存在返回 null
   */
  getCombatState(roomId: string): CombatState | null {
    return combatRepository.findByRoom(roomId);
  }

  /**
   * 为指定参与者重新掷先攻
   *
   * @param roomId 房间 ID
   * @param playerId 操作者 ID（须为 DM）
   * @param participantId 参与者 ID
   * @returns 更新后的战斗状态
   */
  rollInitiativeFor(roomId: string, playerId: string, participantId: string): CombatState {
    this.assertDm(roomId, playerId);
    const combat = this.getCombatStateOrThrow(roomId);

    const participant = combat.participants.find((p) => p.id === participantId);
    if (!participant) {
      throw new AppError(404, '参与者不存在');
    }

    const room = roomRepository.findById(roomId);
    if (!room) {
      throw new AppError(404, '房间不存在');
    }
    const system = ruleSystemRegistry.get(room.ruleSystem);

    // 若关联角色，使用角色数据掷先攻；否则使用纯公式
    let characterData: Record<string, unknown> = {};
    if (participant.characterId) {
      const character = characterRepository.findById(participant.characterId);
      if (character) {
        characterData = character.data;
      }
    }
    participant.initiative = this.rollInitiative(system, characterData);

    this.sortParticipants(combat.participants);

    const updated = combatRepository.update(roomId, {
      participants: combat.participants,
    });
    if (!updated) {
      throw new AppError(500, '更新战斗状态失败');
    }
    logger.info('[CombatService.rollInitiativeFor] 先攻已重掷', {
      roomId,
      participantId,
      initiative: participant.initiative,
    });
    return updated;
  }

  // ============ 私有辅助方法 ============

  /**
   * 校验操作者为 DM
   */
  private assertDm(roomId: string, playerId: string): void {
    const room = roomRepository.findById(roomId);
    if (!room) {
      throw new AppError(404, '房间不存在');
    }
    if (room.dmId !== playerId) {
      throw new AppError(403, '需要 DM 权限');
    }
  }

  /**
   * 获取战斗状态，不存在则抛错
   */
  private getCombatStateOrThrow(roomId: string): CombatState {
    const combat = combatRepository.findByRoom(roomId);
    if (!combat) {
      throw new AppError(400, '战斗未开始');
    }
    return combat;
  }

  /**
   * 从角色创建战斗参与者
   */
  private createParticipantFromCharacter(
    character: Character,
    rollInitiative: boolean,
    system: RuleSystem,
  ): CombatParticipant {
    const initiative = rollInitiative
      ? this.rollInitiative(system, character.data)
      : 0;

    const hp = this.readNumber(character.data, 'hp');
    const maxHp = this.readNumber(character.data, 'maxHp') || hp;
    const ac = this.readNumber(character.data, 'ac');

    return {
      id: generateId('part_'),
      characterId: character.id,
      name: character.name,
      type: character.isNpc ? 'npc' : 'player',
      initiative,
      hp,
      maxHp,
      ac: ac !== 0 ? ac : undefined,
      statusEffects: [],
    };
  }

  /**
   * 掷先攻
   *
   * 根据规则系统的先攻公式掷骰：
   * - DND: 1d20+dexMod（替换 dexMod 为角色敏捷调整值）
   * - COC: 1d100
   */
  private rollInitiative(
    system: RuleSystem,
    characterData: Record<string, unknown>,
  ): number {
    const { initiativeFormula, initiativeAttribute } = system.combatRules;
    const resolver = system.rollResolver;

    let formula = initiativeFormula;
    if (initiativeAttribute) {
      const modKey = `${initiativeAttribute}Mod`;
      const modValue = this.readNumber(characterData, modKey);
      // 替换 [+-]?modKey 为带符号的数值
      const regex = new RegExp(`([+-]?)${modKey}`, 'g');
      formula = formula.replace(regex, (_match: string, sign: string) => {
        if (sign === '-') {
          const negated = -modValue;
          return negated >= 0 ? `+${negated}` : `${negated}`;
        }
        return modValue >= 0 ? `+${modValue}` : `${modValue}`;
      });
    }

    const result = resolver.roll(formula);
    return result.total;
  }

  /**
   * 按先攻降序排序参与者
   */
  private sortParticipants(participants: CombatParticipant[]): void {
    participants.sort((a, b) => b.initiative - a.initiative);
  }

  /**
   * 从角色数据中安全读取数值
   */
  private readNumber(data: Record<string, unknown>, key: string): number {
    const value = data[key];
    if (typeof value === 'number') {
      return value;
    }
    return 0;
  }
}

/** 战斗服务单例 */
export const combatService = new CombatService();
