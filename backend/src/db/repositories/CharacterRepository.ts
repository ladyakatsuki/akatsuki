import { getDb } from '../index.js';
import { generateId } from '../../utils/id.js';
import type { Character, RuleSystem } from '../../types/models.js';

/** characters 表的原始行结构 */
interface CharacterRow {
  id: string;
  room_id: string;
  player_id: string;
  name: string;
  rule_system: string;
  data: string;
  portrait_url: string | null;
  is_npc: number;
  created_at: number;
  updated_at: number;
}

/** 创建角色时的输入参数（不含 id / createdAt / updatedAt） */
export type CreateCharacterInput = Omit<Character, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * 角色数据访问层
 */
export class CharacterRepository {
  /** 将数据库行解析为 Character 实体 */
  private parseRow(row: CharacterRow): Character {
    return {
      id: row.id,
      roomId: row.room_id,
      playerId: row.player_id,
      name: row.name,
      ruleSystem: row.rule_system as RuleSystem,
      data: JSON.parse(row.data) as Record<string, unknown>,
      portraitUrl: row.portrait_url,
      isNpc: row.is_npc === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * 创建角色
   * @param character 角色数据（不含 id / createdAt / updatedAt）
   * @returns 新创建的角色
   */
  create(character: CreateCharacterInput): Character {
    const now = Date.now();
    const entity: Character = {
      ...character,
      id: generateId('char_'),
      createdAt: now,
      updatedAt: now,
    };
    getDb()
      .prepare(
        `INSERT INTO characters (id, room_id, player_id, name, rule_system, data, portrait_url, is_npc, created_at, updated_at)
         VALUES (@id, @room_id, @player_id, @name, @rule_system, @data, @portrait_url, @is_npc, @created_at, @updated_at)`,
      )
      .run({
        id: entity.id,
        room_id: entity.roomId,
        player_id: entity.playerId,
        name: entity.name,
        rule_system: entity.ruleSystem,
        data: JSON.stringify(entity.data),
        portrait_url: entity.portraitUrl,
        is_npc: entity.isNpc ? 1 : 0,
        created_at: entity.createdAt,
        updated_at: entity.updatedAt,
      });
    return entity;
  }

  /** 按主键查询 */
  findById(id: string): Character | null {
    const row = getDb().prepare('SELECT * FROM characters WHERE id = ?').get(id) as
      | CharacterRow
      | undefined;
    return row ? this.parseRow(row) : null;
  }

  /** 按房间查询所有角色（按创建时间排序） */
  findByRoom(roomId: string): Character[] {
    const rows = getDb()
      .prepare('SELECT * FROM characters WHERE room_id = ? ORDER BY created_at ASC')
      .all(roomId) as CharacterRow[];
    return rows.map((r) => this.parseRow(r));
  }

  /** 按房间 + 玩家查询角色 */
  findByPlayer(roomId: string, playerId: string): Character[] {
    const rows = getDb()
      .prepare(
        'SELECT * FROM characters WHERE room_id = ? AND player_id = ? ORDER BY created_at ASC',
      )
      .all(roomId, playerId) as CharacterRow[];
    return rows.map((r) => this.parseRow(r));
  }

  /**
   * 更新角色基本信息
   * @param id 角色 ID
   * @param patch 需要更新的字段
   * @returns 更新后的角色，不存在则返回 null
   */
  update(id: string, patch: Partial<Pick<Character, 'name'>>): Character | null {
    const sets: string[] = [];
    const params: Record<string, unknown> = { id };
    if (patch.name !== undefined) {
      sets.push('name = @name');
      params.name = patch.name;
    }
    if (sets.length === 0) {
      return this.findById(id);
    }
    sets.push('updated_at = @updated_at');
    params.updated_at = Date.now();
    getDb()
      .prepare(`UPDATE characters SET ${sets.join(', ')} WHERE id = @id`)
      .run(params);
    return this.findById(id);
  }

  /**
   * 更新角色卡数据
   * @param id 角色 ID
   * @param data 新的角色卡数据
   * @returns 更新后的角色，不存在则返回 null
   */
  updateData(id: string, data: Record<string, unknown>): Character | null {
    getDb()
      .prepare('UPDATE characters SET data = @data, updated_at = @updated_at WHERE id = @id')
      .run({
        id,
        data: JSON.stringify(data),
        updated_at: Date.now(),
      });
    return this.findById(id);
  }

  /**
   * 设置立绘 URL
   * @param id 角色 ID
   * @param portraitUrl 立绘 URL
   * @returns 更新后的角色，不存在则返回 null
   */
  setPortrait(id: string, portraitUrl: string): Character | null {
    getDb()
      .prepare(
        'UPDATE characters SET portrait_url = @portrait_url, updated_at = @updated_at WHERE id = @id',
      )
      .run({
        id,
        portrait_url: portraitUrl,
        updated_at: Date.now(),
      });
    return this.findById(id);
  }

  /**
   * 删除角色
   * @returns 删除成功返回 true，不存在返回 false
   */
  delete(id: string): boolean {
    const result = getDb().prepare('DELETE FROM characters WHERE id = ?').run(id);
    return result.changes > 0;
  }
}

/** 角色仓库单例 */
export const characterRepository = new CharacterRepository();
