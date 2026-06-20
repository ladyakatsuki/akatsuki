import { getDb } from '../index.js';
import { generateId } from '../../utils/id.js';
import type { GridType, MapState, MapToken } from '../../types/models.js';

/** map_states 表的原始行结构 */
interface MapStateRow {
  id: string;
  room_id: string;
  grid_type: string;
  grid_size: number;
  width: number;
  height: number;
  background_url: string | null;
  tokens: string;
  fog_cells: string;
  updated_at: number;
}

/** 默认地图宽度（格子数） */
export const DEFAULT_MAP_WIDTH = 20;
/** 默认地图高度（格子数） */
export const DEFAULT_MAP_HEIGHT = 20;
/** 默认格子大小（像素） */
export const DEFAULT_GRID_SIZE = 50;
/** 默认网格类型 */
export const DEFAULT_GRID_TYPE: GridType = 'square';

/** 更新地图状态时可修改的字段 */
export type MapStateUpdatePatch = Partial<
  Pick<
    MapState,
    'gridType' | 'gridSize' | 'width' | 'height' | 'backgroundUrl' | 'tokens' | 'fogCells'
  >
>;

/**
 * 地图状态数据访问层
 *
 * 每个房间对应一条 map_states 记录。
 */
export class MapRepository {
  /** 将数据库行解析为 MapState 实体 */
  private parseRow(row: MapStateRow): MapState {
    return {
      id: row.id,
      roomId: row.room_id,
      gridType: row.grid_type as GridType,
      gridSize: row.grid_size,
      width: row.width,
      height: row.height,
      backgroundUrl: row.background_url,
      tokens: JSON.parse(row.tokens) as MapToken[],
      fogCells: JSON.parse(row.fog_cells) as string[],
      updatedAt: row.updated_at,
    };
  }

  /**
   * 创建默认地图状态
   * - 默认 20x20 方格，50px 格子
   * @param roomId 房间 ID
   * @returns 新建的地图状态
   */
  create(roomId: string): MapState {
    const now = Date.now();
    const mapState: MapState = {
      id: generateId('map_'),
      roomId,
      gridType: DEFAULT_GRID_TYPE,
      gridSize: DEFAULT_GRID_SIZE,
      width: DEFAULT_MAP_WIDTH,
      height: DEFAULT_MAP_HEIGHT,
      backgroundUrl: null,
      tokens: [],
      fogCells: [],
      updatedAt: now,
    };

    getDb()
      .prepare(
        `INSERT INTO map_states (id, room_id, grid_type, grid_size, width, height, background_url, tokens, fog_cells, updated_at)
         VALUES (@id, @room_id, @grid_type, @grid_size, @width, @height, @background_url, @tokens, @fog_cells, @updated_at)`,
      )
      .run({
        id: mapState.id,
        room_id: mapState.roomId,
        grid_type: mapState.gridType,
        grid_size: mapState.gridSize,
        width: mapState.width,
        height: mapState.height,
        background_url: mapState.backgroundUrl,
        tokens: JSON.stringify(mapState.tokens),
        fog_cells: JSON.stringify(mapState.fogCells),
        updated_at: mapState.updatedAt,
      });

    return mapState;
  }

  /** 按房间 ID 查询地图状态 */
  findByRoom(roomId: string): MapState | null {
    const row = getDb()
      .prepare('SELECT * FROM map_states WHERE room_id = ?')
      .get(roomId) as MapStateRow | undefined;
    return row ? this.parseRow(row) : null;
  }

  /**
   * 更新地图状态
   * @param roomId 房间 ID
   * @param patch 需要更新的字段
   * @returns 更新后的地图状态，不存在则返回 null
   */
  update(roomId: string, patch: MapStateUpdatePatch): MapState | null {
    const sets: string[] = [];
    const params: Record<string, unknown> = { room_id: roomId };

    if (patch.gridType !== undefined) {
      sets.push('grid_type = @grid_type');
      params.grid_type = patch.gridType;
    }
    if (patch.gridSize !== undefined) {
      sets.push('grid_size = @grid_size');
      params.grid_size = patch.gridSize;
    }
    if (patch.width !== undefined) {
      sets.push('width = @width');
      params.width = patch.width;
    }
    if (patch.height !== undefined) {
      sets.push('height = @height');
      params.height = patch.height;
    }
    if (patch.backgroundUrl !== undefined) {
      sets.push('background_url = @background_url');
      params.background_url = patch.backgroundUrl;
    }
    if (patch.tokens !== undefined) {
      sets.push('tokens = @tokens');
      params.tokens = JSON.stringify(patch.tokens);
    }
    if (patch.fogCells !== undefined) {
      sets.push('fog_cells = @fog_cells');
      params.fog_cells = JSON.stringify(patch.fogCells);
    }

    if (sets.length === 0) {
      return this.findByRoom(roomId);
    }

    sets.push('updated_at = @updated_at');
    params.updated_at = Date.now();

    getDb()
      .prepare(`UPDATE map_states SET ${sets.join(', ')} WHERE room_id = @room_id`)
      .run(params);

    return this.findByRoom(roomId);
  }

  /**
   * 获取或创建地图状态（不存在则创建默认）
   * @param roomId 房间 ID
   * @returns 地图状态
   */
  upsert(roomId: string): MapState {
    const existing = this.findByRoom(roomId);
    if (existing) {
      return existing;
    }
    return this.create(roomId);
  }

  /**
   * 删除地图状态
   * @param roomId 房间 ID
   * @returns 删除成功返回 true，不存在返回 false
   */
  delete(roomId: string): boolean {
    const result = getDb()
      .prepare('DELETE FROM map_states WHERE room_id = ?')
      .run(roomId);
    return result.changes > 0;
  }
}

/** 地图仓库单例 */
export const mapRepository = new MapRepository();
