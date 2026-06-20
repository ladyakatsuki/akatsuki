import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../index.js';
import type { Room, RoomPlayer, RuleSystem } from '../../types/models.js';
import { generateId, generateRoomCode } from '../../utils/id.js';

/** rooms 表的原始行结构 */
interface RoomRow {
  id: string;
  code: string;
  rule_system: string;
  dm_id: string;
  players: string;
  story_id: string | null;
  created_at: number;
}

/** 房间最大人数（1 DM + 5 玩家） */
export const MAX_PLAYERS = 6;

/**
 * 房间数据访问层
 */
export class RoomRepository {
  private parseRow(row: RoomRow): Room {
    return {
      id: row.id,
      code: row.code,
      ruleSystem: row.rule_system as RuleSystem,
      dmId: row.dm_id,
      players: JSON.parse(row.players) as RoomPlayer[],
      storyId: row.story_id,
      createdAt: row.created_at,
    };
  }

  /**
   * 创建房间
   * @param ruleSystem 规则系统
   * @param dmId DM 玩家 ID
   * @param dmName DM 显示名
   * @returns 新建的房间
   */
  create(
    ruleSystem: RuleSystem,
    dmId: string,
    dmName: string,
  ): Room {
    const now = Date.now();
    const room: Room = {
      id: generateId('room_'),
      code: this.generateUniqueCode(),
      ruleSystem,
      dmId,
      players: [
        {
          id: dmId,
          name: dmName,
          role: 'dm',
          joinedAt: now,
          isConnected: false,
        },
      ],
      storyId: null,
      createdAt: now,
    };

    getDb()
      .prepare(
        `INSERT INTO rooms (id, code, rule_system, dm_id, players, story_id, created_at)
         VALUES (@id, @code, @rule_system, @dm_id, @players, @story_id, @created_at)`,
      )
      .run({
        id: room.id,
        code: room.code,
        rule_system: room.ruleSystem,
        dm_id: room.dmId,
        players: JSON.stringify(room.players),
        story_id: room.storyId,
        created_at: room.createdAt,
      });
    return room;
  }

  /**
   * 生成唯一的 6 位房间码（排除易混淆字符 O/0/I/1/L）
   * 冲突时重试，最多 10 次
   */
  private generateUniqueCode(): string {
    for (let i = 0; i < 10; i++) {
      const code = generateRoomCode();
      const exists = getDb()
        .prepare('SELECT 1 FROM rooms WHERE code = ?')
        .get(code);
      if (!exists) {
        return code;
      }
    }
    // 极小概率冲突，最后一次直接返回
    return generateRoomCode();
  }

  /** 按主键查询 */
  findById(id: string): Room | null {
    const row = getDb().prepare('SELECT * FROM rooms WHERE id = ?').get(id) as
      | RoomRow
      | undefined;
    return row ? this.parseRow(row) : null;
  }

  /** 按房间码查询 */
  findByCode(code: string): Room | null {
    const row = getDb().prepare('SELECT * FROM rooms WHERE code = ?').get(code) as
      | RoomRow
      | undefined;
    return row ? this.parseRow(row) : null;
  }

  /**
   * 添加玩家到房间
   * @param roomId 房间 ID
   * @param player 玩家信息
   * @throws 房间不存在 / 房间已满 / 玩家已在房间
   */
  addPlayer(roomId: string, player: RoomPlayer): Room {
    const room = this.findById(roomId);
    if (!room) {
      throw new Error('房间不存在');
    }
    if (room.players.length >= MAX_PLAYERS) {
      throw new Error('房间已满（最多 6 人）');
    }
    if (room.players.some((p) => p.id === player.id)) {
      throw new Error('玩家已在房间内');
    }
    room.players.push(player);
    this.updatePlayers(room.id, room.players);
    return room;
  }

  /**
   * 移除房间内玩家
   * @param roomId 房间 ID
   * @param playerId 玩家 ID
   * @returns 更新后的房间（玩家不存在则返回原房间）
   */
  removePlayer(roomId: string, playerId: string): Room | null {
    const room = this.findById(roomId);
    if (!room) {
      return null;
    }
    room.players = room.players.filter((p) => p.id !== playerId);
    this.updatePlayers(room.id, room.players);
    return room;
  }

  /**
   * 更新玩家在线状态
   * @param roomId 房间 ID
   * @param playerId 玩家 ID
   * @param isConnected 是否在线
   * @returns 更新后的房间
   */
  updatePlayerConnection(
    roomId: string,
    playerId: string,
    isConnected: boolean,
  ): Room | null {
    const room = this.findById(roomId);
    if (!room) {
      return null;
    }
    const player = room.players.find((p) => p.id === playerId);
    if (player) {
      player.isConnected = isConnected;
      this.updatePlayers(room.id, room.players);
    }
    return room;
  }

  /**
   * 获取房间内玩家列表
   */
  listPlayers(roomId: string): RoomPlayer[] {
    const room = this.findById(roomId);
    return room ? room.players : [];
  }

  /**
   * 检查玩家是否在房间内
   */
  isPlayerInRoom(roomId: string, playerId: string): boolean {
    const room = this.findById(roomId);
    if (!room) {
      return false;
    }
    // DM 直接算在房间内
    if (room.dmId === playerId) {
      return true;
    }
    return room.players.some((p) => p.id === playerId);
  }

  /** 更新房间玩家列表 */
  updatePlayers(id: string, players: RoomPlayer[]): void {
    getDb()
      .prepare('UPDATE rooms SET players = ? WHERE id = ?')
      .run(JSON.stringify(players), id);
  }

  /** 更新房间关联的故事书 */
  updateStoryId(id: string, storyId: string | null): void {
    getDb().prepare('UPDATE rooms SET story_id = ? WHERE id = ?').run(storyId, id);
  }

  /** 删除房间 */
  delete(id: string): void {
    getDb().prepare('DELETE FROM rooms WHERE id = ?').run(id);
  }

  /** 生成新的玩家 ID（UUID v4） */
  generatePlayerId(): string {
    return uuidv4();
  }
}

export const roomRepository = new RoomRepository();
