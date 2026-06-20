import type { AppServer, AppSocket } from './index.js';
import { getSocketAuth } from '../middleware/auth.js';
import { characterRepository } from '../db/repositories/CharacterRepository.js';
import { roomRepository } from '../db/repositories/RoomRepository.js';
import { diceService } from '../services/DiceService.js';
import { generateId } from '../utils/id.js';
import { logger } from '../utils/logger.js';
import type { DiceRollResultEvent, LogEvent } from '../types/socket.js';
import type { SuccessLevel } from '../types/rules.js';

/**
 * 成功等级中文映射
 */
const SUCCESS_LEVEL_TEXT: Record<NonNullable<SuccessLevel>, string> = {
  critical: '大成功',
  extreme: '极难成功',
  hard: '困难成功',
  regular: '普通成功',
  fumble: '大失败',
};

/**
 * 注册骰子事件处理器
 *
 * 事件：
 * - dice:roll      通用掷骰，广播 dice:result 与 log:add
 * - dice:rollSkill 技能检定掷骰，广播 dice:result 与 log:add
 * - dice:rollSan   SAN 检定掷骰，广播 dice:result、log:add、character:dataUpdated
 *
 * 暗骰（isHidden）结果仅发给 DM 和掷骰者。
 */
export function registerDiceHandler(io: AppServer, socket: AppSocket): void {
  const auth = getSocketAuth(socket);
  if (!auth) {
    logger.warn('[diceHandler] Socket 未鉴权', { socketId: socket.id });
    return;
  }
  const { roomId, playerId, playerName } = auth;

  /**
   * 广播掷骰结果与日志
   *
   * 暗骰仅发给 DM 和掷骰者；公开掷骰广播给全房间。
   */
  function broadcastResult(result: DiceRollResultEvent): void {
    const logEvent: LogEvent = {
      id: generateId('log_'),
      type: 'dice',
      message: formatDiceMessage(result),
      data: result,
      playerId: result.playerId,
      playerName: result.playerName,
      timestamp: result.timestamp,
      isHidden: result.isHidden,
    };

    if (result.isHidden) {
      // 暗骰：仅发给 DM 和掷骰者
      socket.emit('dice:result', result);
      socket.emit('log:add', logEvent);

      // 找到 DM 的 socket 并发送（DM 不是掷骰者时）
      const room = roomRepository.findById(roomId);
      if (room && room.dmId !== playerId) {
        const sockets = io.sockets.sockets;
        for (const [, s] of sockets) {
          const sAuth = getSocketAuth(s);
          if (sAuth && sAuth.playerId === room.dmId && sAuth.roomId === roomId) {
            s.emit('dice:result', result);
            s.emit('log:add', logEvent);
            break;
          }
        }
      }
      logger.debug('[diceHandler] 暗骰已发送给 DM 和掷骰者', {
        roomId,
        playerId,
        resultId: result.id,
      });
    } else {
      // 公开掷骰：广播给全房间
      io.to(roomId).emit('dice:result', result);
      io.to(roomId).emit('log:add', logEvent);
    }
  }

  // ============ dice:roll ============
  socket.on('dice:roll', (payload, ack) => {
    try {
      if (!payload || !payload.expression) {
        ack({ ok: false, error: '缺少参数: expression' });
        return;
      }
      const result = diceService.roll(roomId, playerId, playerName, payload);
      broadcastResult(result);
      logger.info('[dice:roll] 掷骰完成', {
        socketId: socket.id,
        roomId,
        playerId,
        expression: payload.expression,
        total: result.total,
      });
      ack({ ok: true, data: result });
    } catch (err) {
      logger.error('[dice:roll] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '掷骰失败',
      });
    }
  });

  // ============ dice:rollSkill ============
  socket.on('dice:rollSkill', (payload, ack) => {
    try {
      const { characterId, skillKey } = payload;
      if (!characterId) {
        ack({ ok: false, error: '缺少参数: characterId' });
        return;
      }
      if (!skillKey) {
        ack({ ok: false, error: '缺少参数: skillKey' });
        return;
      }
      const result = diceService.rollSkill(
        roomId,
        playerId,
        playerName,
        characterId,
        skillKey,
      );
      broadcastResult(result);
      logger.info('[dice:rollSkill] 技能检定完成', {
        socketId: socket.id,
        roomId,
        playerId,
        characterId,
        skillKey,
        total: result.total,
      });
      ack({ ok: true, data: result });
    } catch (err) {
      logger.error('[dice:rollSkill] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '技能检定失败',
      });
    }
  });

  // ============ dice:rollSan ============
  socket.on('dice:rollSan', (payload, ack) => {
    try {
      const { characterId, sanLossExpression } = payload;
      if (!characterId) {
        ack({ ok: false, error: '缺少参数: characterId' });
        return;
      }
      if (!sanLossExpression) {
        ack({ ok: false, error: '缺少参数: sanLossExpression' });
        return;
      }
      const result = diceService.rollSan(
        roomId,
        playerId,
        playerName,
        characterId,
        sanLossExpression,
      );
      broadcastResult(result);

      // SAN 变化时触发角色数据更新事件
      if (result.sanLossApplied !== undefined && result.characterId) {
        const updatedCharacter = characterRepository.findById(result.characterId);
        if (updatedCharacter) {
          io.to(roomId).emit('character:dataUpdated', {
            characterId: updatedCharacter.id,
            data: updatedCharacter.data,
          });
        }
      }

      logger.info('[dice:rollSan] SAN 检定完成', {
        socketId: socket.id,
        roomId,
        playerId,
        characterId,
        total: result.total,
        sanLossApplied: result.sanLossApplied,
      });
      ack({ ok: true, data: result });
    } catch (err) {
      logger.error('[dice:rollSan] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : 'SAN 检定失败',
      });
    }
  });
}

/**
 * 格式化掷骰结果为可读消息
 *
 * 示例输出：
 * - "玩家1 掷骰(攻击检定): 1d20+5 = [12] +5 = 17"
 * - "玩家1 掷骰(SAN 检定): 1d100 = [45] = 45 (普通成功) SAN -5"
 */
function formatDiceMessage(result: DiceRollResultEvent): string {
  const parts: string[] = [];
  parts.push(result.playerName);
  parts.push('掷骰');
  if (result.label) {
    parts.push(`(${result.label})`);
  }
  parts.push(':');
  parts.push(result.expression);
  parts.push('=');
  parts.push(`[${result.rolls.join(', ')}]`);
  if (result.modifier !== 0) {
    parts.push(`${result.modifier > 0 ? '+' : ''}${result.modifier}`);
  }
  parts.push('=');
  parts.push(String(result.total));

  // 成功等级
  if (result.successLevel) {
    parts.push(`(${SUCCESS_LEVEL_TEXT[result.successLevel]})`);
  }

  // SAN 损失
  if (result.sanLossApplied !== undefined) {
    parts.push(`SAN -${result.sanLossApplied}`);
  }

  return parts.join(' ');
}
