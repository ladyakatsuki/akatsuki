import { getDb } from '../index.js';
import { generateId } from '../../utils/id.js';
import type { Asset, AssetType } from '../../types/models.js';

/** assets 表的原始行结构 */
interface AssetRow {
  id: string;
  room_id: string;
  type: string;
  filename: string;
  original_name: string;
  url: string;
  size: number;
  uploaded_by: string;
  created_at: number;
}

/** 创建素材时的输入参数（不含 id / createdAt） */
export type CreateAssetInput = Omit<Asset, 'id' | 'createdAt'>;

/**
 * 素材数据访问层
 */
export class AssetRepository {
  /** 将数据库行解析为 Asset 实体 */
  private parseRow(row: AssetRow): Asset {
    return {
      id: row.id,
      roomId: row.room_id,
      type: row.type as AssetType,
      filename: row.filename,
      originalName: row.original_name,
      url: row.url,
      size: row.size,
      uploadedBy: row.uploaded_by,
      createdAt: row.created_at,
    };
  }

  /**
   * 创建素材记录
   * @param asset 素材数据（不含 id / createdAt）
   * @returns 新创建的素材
   */
  create(asset: CreateAssetInput): Asset {
    const entity: Asset = {
      ...asset,
      id: generateId('asset_'),
      createdAt: Date.now(),
    };
    getDb()
      .prepare(
        `INSERT INTO assets (id, room_id, type, filename, original_name, url, size, uploaded_by, created_at)
         VALUES (@id, @room_id, @type, @filename, @original_name, @url, @size, @uploaded_by, @created_at)`,
      )
      .run({
        id: entity.id,
        room_id: entity.roomId,
        type: entity.type,
        filename: entity.filename,
        original_name: entity.originalName,
        url: entity.url,
        size: entity.size,
        uploaded_by: entity.uploadedBy,
        created_at: entity.createdAt,
      });
    return entity;
  }

  /** 按主键查询 */
  findById(id: string): Asset | null {
    const row = getDb().prepare('SELECT * FROM assets WHERE id = ?').get(id) as
      | AssetRow
      | undefined;
    return row ? this.parseRow(row) : null;
  }

  /** 按房间查询所有素材（按创建时间倒序） */
  findByRoom(roomId: string): Asset[] {
    const rows = getDb()
      .prepare('SELECT * FROM assets WHERE room_id = ? ORDER BY created_at DESC')
      .all(roomId) as AssetRow[];
    return rows.map((r) => this.parseRow(r));
  }

  /** 按房间 + 类型查询素材 */
  findByRoomAndType(roomId: string, type: AssetType): Asset[] {
    const rows = getDb()
      .prepare(
        'SELECT * FROM assets WHERE room_id = ? AND type = ? ORDER BY created_at DESC',
      )
      .all(roomId, type) as AssetRow[];
    return rows.map((r) => this.parseRow(r));
  }

  /**
   * 删除素材
   * @returns 删除成功返回 true，不存在返回 false
   */
  delete(id: string): boolean {
    const result = getDb().prepare('DELETE FROM assets WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * 删除房间内所有素材
   * @returns 删除的记录数
   */
  deleteByRoom(roomId: string): boolean {
    const result = getDb().prepare('DELETE FROM assets WHERE room_id = ?').run(roomId);
    return result.changes > 0;
  }
}

/** 素材仓库单例 */
export const assetRepository = new AssetRepository();
