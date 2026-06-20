import type { AppServer, AppSocket } from './index.js';
import { getSocketAuth } from '../middleware/auth.js';
import { requireDm } from '../middleware/permission.js';
import { combatService } from '../services/CombatService.js';
import { generateId } from '../utils/id.js';
import { logger } from '../utils/logger.js';
import type { CombatState } from '../types/models.js';
import type {
  CombatStateEvent,
  LogEvent,
} from '../types/socket.js';

/**
 * 注册战斗事件处理器
 *
 * 事件（均为 DM only）：
 * - combat:start            开始战斗，广播 combat:state 与 log:add
 * - combat:end              结束战斗，广播 combat:state（combat: null）与 log:add
 * - combat:addParticipant   添加参与者，广播 combat:state
 * - combat:removeParticipant 移除参与者，广播 combat:state
 * - combat:updateParticipant 更新参与者，广播 combat:state（HP 变化时广播 log:add）
 * - combat:nextTurn         推进回合，广播 combat:state、combat:turn、log:add
 * - combat:prevTurn         回退回合，广播 combat:state
 * - combat:rollInitiative   重掷先攻，广播 combat:state
 */
export function registerCombatHandler(io: AppServer, socket: AppSocket): void {
  const auth = getSocketAuth(socket);
  if (!auth) {
    logger.warn('[combatHandler] Socket 未鉴权', { socketId: socket.id });
    return;
  }
  const { roomId, playerId, playerName } = auth;

  /**
   * 广播战斗状态给全房间
   */
  function broadcastCombatState(combat: CombatState | null): void {
    const event: CombatStateEvent = { combat };
    io.to(roomId).emit('combat:state', event);
  }

  /**
   * 广播日志给全房间
   */
  function broadcastLog(message: string, data?: unknown): void {
    const logEvent: LogEvent = {
      id: generateId('log_'),
      type: 'combat',
      message,
      data,
      playerId,
      playerName,
      timestamp: Date.now(),
    };
    io.to(roomId).emit('log:add', logEvent);
  }

  /**
   * 校验 DM 权限，失败则通过 ack 返回错误
   * @returns 是否通过校验
   */
  function checkDm(ack: (res: { ok: boolean; error?: string }) => void): boolean {
    const check = requireDm(socket);
    if (!check.ok) {
      ack({ ok: false, error: check.error });
      return false;
    }
    return true;
  }

  // ============ combat:start ============
  socket.on('combat:start', (payload, ack) => {
    if (!checkDm(ack)) return;
    try {
      const { participantIds, rollInitiative } = payload;
      if (!Array.isArray(participantIds)) {
        ack({ ok: false, error: '缺少参数: participantIds' });
        return;
      }
      const combat = combatService.startCombat(
        roomId,
        playerId,
        participantIds,
        rollInitiative,
      );

      broadcastCombatState(combat);
      broadcastLog(
        `战斗开始（${combat.participants.length} 名参与者，轮次 ${combat.round}）`,
        { combatId: combat.id },
      );

      logger.info('[combat:start] 战斗已开始', {
        socketId: socket.id,
        roomId,
        participantCount: combat.participants.length,
      });
      ack({ ok: true, data: combat });
    } catch (err) {
      logger.error('[combat:start] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '开始战斗失败',
      });
    }
  });

  // ============ combat:end ============
  socket.on('combat:end', (ack) => {
    if (!checkDm(ack)) return;
    try {
      combatService.endCombat(roomId, playerId);

      broadcastCombatState(null);
      broadcastLog('战斗结束');

      logger.info('[combat:end] 战斗已结束', { socketId: socket.id, roomId });
      ack({ ok: true });
    } catch (err) {
      logger.error('[combat:end] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '结束战斗失败',
      });
    }
  });

  // ============ combat:addParticipant ============
  socket.on('combat:addParticipant', (payload, ack) => {
    if (!checkDm(ack)) return;
    try {
      if (!payload || !payload.name) {
        ack({ ok: false, error: '缺少参数: name' });
        return;
      }
      const combat = combatService.addParticipant(roomId, playerId, payload);

      broadcastCombatState(combat);
      broadcastLog(`参与者 ${payload.name} 加入战斗`);

      logger.info('[combat:addParticipant] 参与者已添加', {
        socketId: socket.id,
        roomId,
        name: payload.name,
      });
      ack({ ok: true, data: combat });
    } catch (err) {
      logger.error('[combat:addParticipant] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '添加参与者失败',
      });
    }
  });

  // ============ combat:removeParticipant ============
  socket.on('combat:removeParticipant', (payload, ack) => {
    if (!checkDm(ack)) return;
    try {
      const { participantId } = payload;
      if (!participantId) {
        ack({ ok: false, error: '缺少参数: participantId' });
        return;
      }
      const combat = combatService.removeParticipant(roomId, playerId, participantId);

      broadcastCombatState(combat);

      logger.info('[combat:removeParticipant] 参与者已移除', {
        socketId: socket.id,
        roomId,
        participantId,
      });
      ack({ ok: true, data: combat });
    } catch (err) {
      logger.error('[combat:removeParticipant] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '移除参与者失败',
      });
    }
  });

  // ============ combat:updateParticipant ============
  socket.on('combat:updateParticipant', (payload, ack) => {
    if (!checkDm(ack)) return;
    try {
      const { participantId, patch } = payload;
      if (!participantId) {
        ack({ ok: false, error: '缺少参数: participantId' });
        return;
      }

      // 记录 HP 变化用于日志
      const prevCombat = combatService.getCombatState(roomId);
      const prevParticipant = prevCombat?.participants.find(
        (p) => p.id === participantId,
      );
      const prevHp = prevParticipant?.hp;

      const combat = combatService.updateParticipant(
        roomId,
        playerId,
        participantId,
        patch,
      );

      broadcastCombatState(combat);

      // HP 变化时广播日志
      const participant = combat.participants.find((p) => p.id === participantId);
      if (participant && patch.hp !== undefined && prevHp !== undefined && patch.hp !== prevHp) {
        broadcastLog(`${participant.name} HP 变为 ${patch.hp}`, {
          participantId,
          prevHp,
          newHp: patch.hp,
        });
      }

      logger.info('[combat:updateParticipant] 参与者已更新', {
        socketId: socket.id,
        roomId,
        participantId,
      });
      ack({ ok: true, data: combat });
    } catch (err) {
      logger.error('[combat:updateParticipant] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '更新参与者失败',
      });
    }
  });

  // ============ combat:nextTurn ============
  socket.on('combat:nextTurn', (ack) => {
    if (!checkDm(ack)) return;
    try {
      const combat = combatService.nextTurn(roomId, playerId);
      const participant = combat.participants[combat.currentTurn];

      broadcastCombatState(combat);

      if (participant) {
        io.to(roomId).emit('combat:turn', {
          round: combat.round,
          currentTurn: combat.currentTurn,
          participant,
        });
        broadcastLog(
          `轮次 ${combat.round} - ${participant.name} 的回合`,
          { round: combat.round, currentTurn: combat.currentTurn },
        );
      }

      logger.info('[combat:nextTurn] 回合已推进', {
        socketId: socket.id,
        roomId,
        round: combat.round,
        currentTurn: combat.currentTurn,
      });
      ack({ ok: true, data: combat });
    } catch (err) {
      logger.error('[combat:nextTurn] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '推进回合失败',
      });
    }
  });

  // ============ combat:prevTurn ============
  socket.on('combat:prevTurn', (ack) => {
    if (!checkDm(ack)) return;
    try {
      const combat = combatService.prevTurn(roomId, playerId);

      broadcastCombatState(combat);

      logger.info('[combat:prevTurn] 回合已回退', {
        socketId: socket.id,
        roomId,
        round: combat.round,
        currentTurn: combat.currentTurn,
      });
      ack({ ok: true, data: combat });
    } catch (err) {
      logger.error('[combat:prevTurn] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '回退回合失败',
      });
    }
  });

  // ============ combat:rollInitiative ============
  socket.on('combat:rollInitiative', (payload, ack) => {
    if (!checkDm(ack)) return;
    try {
      const { participantId } = payload;
      if (!participantId) {
        ack({ ok: false, error: '缺少参数: participantId' });
        return;
      }
      const combat = combatService.rollInitiativeFor(roomId, playerId, participantId);

      broadcastCombatState(combat);

      const participant = combat.participants.find((p) => p.id === participantId);
      if (participant) {
        broadcastLog(`${participant.name} 重新掷先攻: ${participant.initiative}`);
      }

      logger.info('[combat:rollInitiative] 先攻已重掷', {
        socketId: socket.id,
        roomId,
        participantId,
      });
      ack({ ok: true, data: combat });
    } catch (err) {
      logger.error('[combat:rollInitiative] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '重掷先攻失败',
      });
    }
  });
}
