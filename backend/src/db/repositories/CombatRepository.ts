import { getDb } from '../index.js';
import { generateId } from '../../utils/id.js';
import type { CombatParticipant, CombatState } from '../../types/models.js';

/** combat_states 表的原始行结构 */
interface CombatStateRow {
  id: string;
  room_id: string;
  current_turn: number;
  round: number;
  participants: string;
  is_active: number;
  started_at: number;
  updated_at: number;
}

/** 更新战斗状态时的可修改字段 */
export type CombatStatePatch = Partial<
  Pick<CombatState, 'participants' | 'currentTurn' | 'round' | 'isActive'>
>;

/**
 * 战斗状态数据访问层
 *
 * 每个房间至多一条战斗状态记录。
 */
export class CombatRepository {
  /** 将数据库行解析为 CombatState 实体 */
  private parseRow(row: CombatStateRow): CombatState {
    return {
      id: row.id,
      roomId: row.room_id,
      isActive: row.is_active === 1,
      round: row.round,
      currentTurn: row.current_turn,
      participants: JSON.parse(row.participants) as CombatParticipant[],
      startedAt: row.started_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * 创建战斗状态（每个房间至多一条，重复创建会覆盖）
   * @param roomId 房间 ID
   * @returns 新创建的战斗状态（默认未激活、0 轮、0 回合、空参与者）
   */
  create(roomId: string): CombatState {
    const now = Date.now();
    const combat: CombatState = {
      id: generateId('combat_'),
      roomId,
      isActive: false,
      round: 0,
      currentTurn: 0,
      participants: [],
      startedAt: now,
      updatedAt: now,
    };

    // 房间 ID 唯一，重复创建时先删除旧记录
    getDb().prepare('DELETE FROM combat_states WHERE room_id = ?').run(roomId);

    getDb()
      .prepare(
        `INSERT INTO combat_states (id, room_id, current_turn, round, participants, is_active, started_at, updated_at)
         VALUES (@id, @room_id, @current_turn, @round, @participants, @is_active, @started_at, @updated_at)`,
      )
      .run({
        id: combat.id,
        room_id: combat.roomId,
        current_turn: combat.currentTurn,
        round: combat.round,
        participants: JSON.stringify(combat.participants),
        is_active: combat.isActive ? 1 : 0,
        started_at: combat.startedAt,
        updated_at: combat.updatedAt,
      });
    return combat;
  }

  /** 按房间查询战斗状态 */
  findByRoom(roomId: string): CombatState | null {
    const row = getDb()
      .prepare('SELECT * FROM combat_states WHERE room_id = ?')
      .get(roomId) as CombatStateRow | undefined;
    return row ? this.parseRow(row) : null;
  }

  /**
   * 更新战斗状态字段
   * @param roomId 房间 ID
   * @param patch 需要更新的字段
   * @returns 更新后的战斗状态，不存在则返回 null
   */
  update(roomId: string, patch: CombatStatePatch): CombatState | null {
    const sets: string[] = [];
    const params: Record<string, unknown> = { room_id: roomId };
    if (patch.participants !== undefined) {
      sets.push('participants = @participants');
      params.participants = JSON.stringify(patch.participants);
    }
    if (patch.currentTurn !== undefined) {
      sets.push('current_turn = @current_turn');
      params.current_turn = patch.currentTurn;
    }
    if (patch.round !== undefined) {
      sets.push('round = @round');
      params.round = patch.round;
    }
    if (patch.isActive !== undefined) {
      sets.push('is_active = @is_active');
      params.is_active = patch.isActive ? 1 : 0;
    }
    if (sets.length === 0) {
      return this.findByRoom(roomId);
    }
    sets.push('updated_at = @updated_at');
    params.updated_at = Date.now();
    getDb()
      .prepare(`UPDATE combat_states SET ${sets.join(', ')} WHERE room_id = @room_id`)
      .run(params);
    return this.findByRoom(roomId);
  }

  /**
   * 设置战斗激活状态
   * @param roomId 房间 ID
   * @param isActive 是否激活
   * @returns 更新后的战斗状态，不存在则返回 null
   */
  setActive(roomId: string, isActive: boolean): CombatState | null {
    return this.update(roomId, { isActive });
  }

  /**
   * 删除战斗状态
   * @returns 删除成功返回 true，不存在返回 false
   */
  delete(roomId: string): boolean {
    const result = getDb()
      .prepare('DELETE FROM combat_states WHERE room_id = ?')
      .run(roomId);
    return result.changes > 0;
  }
}

/** 战斗状态仓库单例 */
export const combatRepository = new CombatRepository();
