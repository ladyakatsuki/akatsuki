import { characterRepository } from '../db/repositories/CharacterRepository.js';
import { roomRepository } from '../db/repositories/RoomRepository.js';
import { ruleSystemRegistry } from '../rules/index.js';
import type { Coc7RollResolver } from '../rules/coc7/Coc7RollResolver.js';
import type { Dnd5eRollResolver } from '../rules/dnd5e/Dnd5eRollResolver.js';
import type { DiceRollResult, SuccessLevel } from '../types/rules.js';
import type { DiceRollRequest, DiceRollResultEvent } from '../types/socket.js';
import { AppError } from '../middleware/errorHandler.js';
import { generateId } from '../utils/id.js';
import { logger } from '../utils/logger.js';

/**
 * 骰子业务逻辑服务
 *
 * 封装掷骰相关业务规则，根据房间规则系统选择对应的掷骰方式：
 * - DND 5E：优势/劣势、技能检定
 * - COC 7版：奖金骰/惩罚骰、成功判定、SAN 检定
 *
 * 掷骰使用规则系统提供的 resolver，不自行实现随机。
 */
export class DiceService {
  /**
   * 通用掷骰
   *
   * 根据规则系统和请求参数选择掷骰方式：
   * - DND + advantage/disadvantage → rollWithAdvantage
   * - COC + bonusDice/penaltyDice → rollWithBonusPenalty
   * - 普通掷骰 → roll
   * COC 有 target 时计算 successLevel
   *
   * @param roomId 房间 ID
   * @param playerId 掷骰玩家 ID
   * @param playerName 掷骰玩家名
   * @param request 掷骰请求
   * @returns 掷骰结果事件
   */
  roll(
    roomId: string,
    playerId: string,
    playerName: string,
    request: DiceRollRequest,
  ): DiceRollResultEvent {
    const room = roomRepository.findById(roomId);
    if (!room) {
      throw new AppError(404, '房间不存在');
    }

    const ruleSystem = ruleSystemRegistry.get(room.ruleSystem);
    const resolver = ruleSystem.rollResolver;

    const {
      expression,
      advantage,
      disadvantage,
      bonusDice,
      penaltyDice,
      target,
    } = request;

    let result: DiceRollResult;

    if (room.ruleSystem === 'dnd5e' && (advantage || disadvantage)) {
      // DND 优势/劣势掷骰
      const dndResolver = resolver as Dnd5eRollResolver;
      result = dndResolver.rollWithAdvantage(expression, advantage === true);
    } else if (
      room.ruleSystem === 'coc7' &&
      ((bonusDice ?? 0) > 0 || (penaltyDice ?? 0) > 0)
    ) {
      // COC 奖金骰/惩罚骰掷骰
      const cocResolver = resolver as Coc7RollResolver;
      result = cocResolver.rollWithBonusPenalty(
        expression,
        bonusDice ?? 0,
        penaltyDice ?? 0,
      );
    } else {
      // 普通掷骰
      result = resolver.roll(expression);
    }

    // COC 成功等级判定（有 target 时）
    let successLevel: SuccessLevel | undefined;
    if (room.ruleSystem === 'coc7' && target !== undefined) {
      const cocResolver = resolver as Coc7RollResolver;
      successLevel = cocResolver.evaluateSuccess(result.total, target);
    }

    const event: DiceRollResultEvent = {
      id: generateId('dice_'),
      playerId,
      playerName,
      expression: result.expression,
      label: request.label ?? result.label,
      rolls: result.rolls,
      kept: result.kept,
      modifier: result.modifier,
      total: result.total,
      successLevel,
      target,
      characterId: request.characterId,
      isHidden: request.isHidden === true,
      timestamp: Date.now(),
    };

    logger.info('[DiceService.roll] 掷骰完成', {
      roomId,
      playerId,
      expression,
      total: result.total,
      isHidden: event.isHidden,
    });

    return event;
  }

  /**
   * 技能检定掷骰
   *
   * 根据规则系统调用对应的 rollSkill：
   * - DND: dnd5eResolver.rollSkill(skillKey, character.data)
   * - COC: coc7Resolver.rollSkill(skillKey, character.data)，target = 技能值
   *
   * @param roomId 房间 ID
   * @param playerId 掷骰玩家 ID
   * @param playerName 掷骰玩家名
   * @param characterId 角色 ID
   * @param skillKey 技能 key
   * @returns 掷骰结果事件
   */
  rollSkill(
    roomId: string,
    playerId: string,
    playerName: string,
    characterId: string,
    skillKey: string,
  ): DiceRollResultEvent {
    const room = roomRepository.findById(roomId);
    if (!room) {
      throw new AppError(404, '房间不存在');
    }

    const character = characterRepository.findById(characterId);
    if (!character) {
      throw new AppError(404, '角色不存在');
    }
    if (character.roomId !== roomId) {
      throw new AppError(400, '角色不属于该房间');
    }

    const ruleSystem = ruleSystemRegistry.get(room.ruleSystem);
    let result: DiceRollResult;
    let target: number | undefined;

    if (room.ruleSystem === 'dnd5e') {
      const dndResolver = ruleSystem.rollResolver as Dnd5eRollResolver;
      result = dndResolver.rollSkill(skillKey, character.data);
    } else if (room.ruleSystem === 'coc7') {
      const cocResolver = ruleSystem.rollResolver as Coc7RollResolver;
      result = cocResolver.rollSkill(skillKey, character.data);
      // COC 技能检定的目标值为技能值
      const skillValue = character.data[skillKey];
      if (typeof skillValue === 'number') {
        target = skillValue;
      }
    } else {
      throw new AppError(400, `不支持的规则系统: ${room.ruleSystem}`);
    }

    const event: DiceRollResultEvent = {
      id: generateId('dice_'),
      playerId,
      playerName,
      expression: result.expression,
      label: result.label,
      rolls: result.rolls,
      kept: result.kept,
      modifier: result.modifier,
      total: result.total,
      successLevel: result.successLevel,
      target,
      characterId,
      isHidden: false,
      timestamp: Date.now(),
    };

    logger.info('[DiceService.rollSkill] 技能检定完成', {
      roomId,
      playerId,
      characterId,
      skillKey,
      total: result.total,
    });

    return event;
  }

  /**
   * SAN 检定（COC 专用）
   *
   * 流程：
   * 1. 掷 d100 vs 当前 SAN
   * 2. 成功扣半损（向下取整），失败扣全损
   * 3. 更新角色 SAN 值
   * 4. 返回结果（含 SAN 变化）
   *
   * @param roomId 房间 ID
   * @param playerId 掷骰玩家 ID
   * @param playerName 掷骰玩家名
   * @param characterId 角色 ID
   * @param sanLossExpression SAN 损失表达式（如 '1d10' 或固定数字 '5'）
   * @returns 掷骰结果事件（含 sanLossApplied）
   */
  rollSan(
    roomId: string,
    playerId: string,
    playerName: string,
    characterId: string,
    sanLossExpression: string,
  ): DiceRollResultEvent {
    const room = roomRepository.findById(roomId);
    if (!room) {
      throw new AppError(404, '房间不存在');
    }

    if (room.ruleSystem !== 'coc7') {
      throw new AppError(400, 'SAN 检定仅支持 COC 7版规则系统');
    }

    const character = characterRepository.findById(characterId);
    if (!character) {
      throw new AppError(404, '角色不存在');
    }
    if (character.roomId !== roomId) {
      throw new AppError(400, '角色不属于该房间');
    }

    const ruleSystem = ruleSystemRegistry.get(room.ruleSystem);
    const cocResolver = ruleSystem.rollResolver as Coc7RollResolver;

    // 解析 SAN 损失表达式：可为固定数字或骰子表达式
    const sanLoss = this.resolveSanLoss(sanLossExpression, cocResolver);

    // 执行 SAN 检定
    const sanResult = cocResolver.rollSan(character.data, sanLoss);

    // 更新角色 SAN 值
    const currentSan =
      typeof character.data.san === 'number' ? character.data.san : 0;
    const newSan = Math.max(0, currentSan - sanResult.sanLossApplied);
    const updatedData = { ...character.data, san: newSan };
    characterRepository.updateData(characterId, updatedData);

    const event: DiceRollResultEvent = {
      id: generateId('dice_'),
      playerId,
      playerName,
      expression: sanResult.expression,
      label: sanResult.label,
      rolls: sanResult.rolls,
      kept: sanResult.kept,
      modifier: sanResult.modifier,
      total: sanResult.total,
      successLevel: sanResult.successLevel,
      target: currentSan,
      characterId,
      isHidden: false,
      timestamp: Date.now(),
      sanLossApplied: sanResult.sanLossApplied,
    };

    logger.info('[DiceService.rollSan] SAN 检定完成', {
      roomId,
      playerId,
      characterId,
      total: sanResult.total,
      sanLossApplied: sanResult.sanLossApplied,
      sanBefore: currentSan,
      sanAfter: newSan,
    });

    return event;
  }

  /**
   * 解析 SAN 损失表达式
   *
   * 支持纯数字（如 '5'）与骰子表达式（如 '1d10'）。
   * 骰子表达式通过 resolver 掷骰得到损失值。
   */
  private resolveSanLoss(
    expression: string,
    resolver: Coc7RollResolver,
  ): number {
    const trimmed = expression.trim();
    // 纯数字
    const num = Number(trimmed);
    if (!Number.isNaN(num) && trimmed !== '') {
      return num;
    }
    // 骰子表达式
    const rollResult = resolver.roll(trimmed);
    return rollResult.total;
  }
}

/** 骰子服务单例 */
export const diceService = new DiceService();
