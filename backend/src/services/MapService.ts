import { mapRepository } from '../db/repositories/MapRepository.js';
import { roomRepository } from '../db/repositories/RoomRepository.js';
import { characterRepository } from '../db/repositories/CharacterRepository.js';
import { generateId } from '../utils/id.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import type { GridType, MapState, MapToken, MapTokenType } from '../types/models.js';
import type {
  MapConfigPayload,
  MapTokenAddPayload,
  PlayerMapStateEvent,
} from '../types/socket.js';

/**
 * 地图业务逻辑服务
 *
 * 封装地图状态、Token、迷雾、配置等业务规则：
 * - 玩家只能移动自己的 Token（通过 characterId 关联 playerId 判断）
 * - DM 可操作所有 Token 与地图配置
 * - 玩家视角过滤不可见 Token
 */
export class MapService {
  /**
   * 获取地图状态（不存在则创建默认）
   * @param roomId 房间 ID
   * @returns 地图状态
   */
  getMapState(roomId: string): MapState {
    this.assertRoomExists(roomId);
    return mapRepository.upsert(roomId);
  }

  /**
   * 获取玩家视角地图（过滤不可见 Token）
   * @param roomId 房间 ID
   * @returns 玩家视角地图状态
   */
  getPlayerMapState(roomId: string): PlayerMapStateEvent {
    const mapState = this.getMapState(roomId);
    const visibleTokens = mapState.tokens.filter((t) => t.isVisible);
    return {
      mapState: {
        ...mapState,
        tokens: visibleTokens,
      },
    };
  }

  /**
   * 移动 Token
   * - 玩家只能移动自己的 Token（通过 characterId 关联 playerId 判断）
   * - DM 可移动所有 Token
   * @param roomId 房间 ID
   * @param playerId 操作者 ID
   * @param tokenId Token ID
   * @param x 新 X 坐标
   * @param y 新 Y 坐标
   * @returns 更新后的地图状态
   */
  moveToken(
    roomId: string,
    playerId: string,
    tokenId: string,
    x: number,
    y: number,
  ): MapState {
    this.assertRoomExists(roomId);
    const mapState = mapRepository.upsert(roomId);
    const token = mapState.tokens.find((t) => t.id === tokenId);
    if (!token) {
      throw new AppError(404, 'Token 不存在');
    }

    const isDm = this.isDm(roomId, playerId);
    if (!isDm) {
      // 玩家只能移动自己的 Token
      this.assertOwnsToken(roomId, playerId, token);
    }

    token.x = x;
    token.y = y;

    const updated = mapRepository.update(roomId, { tokens: mapState.tokens });
    if (!updated) {
      throw new AppError(404, '地图状态不存在');
    }
    logger.info('Token 已移动', { roomId, playerId, tokenId, x, y });
    return updated;
  }

  /**
   * 添加 Token（DM only）
   * @param roomId 房间 ID
   * @param playerId 操作者 ID（用于权限校验）
   * @param payload Token 数据（不含 id）
   * @returns 更新后的地图状态
   */
  addToken(roomId: string, playerId: string, payload: MapTokenAddPayload): MapState {
    this.assertDm(roomId, playerId);
    const mapState = mapRepository.upsert(roomId);

    const newToken: MapToken = {
      ...payload.token,
      id: generateId('token_'),
    };
    this.validateToken(newToken);

    mapState.tokens.push(newToken);
    const updated = mapRepository.update(roomId, { tokens: mapState.tokens });
    if (!updated) {
      throw new AppError(404, '地图状态不存在');
    }
    logger.info('Token 已添加', { roomId, playerId, tokenId: newToken.id });
    return updated;
  }

  /**
   * 移除 Token（DM only）
   * @param roomId 房间 ID
   * @param playerId 操作者 ID（用于权限校验）
   * @param tokenId Token ID
   * @returns 更新后的地图状态
   */
  removeToken(roomId: string, playerId: string, tokenId: string): MapState {
    this.assertDm(roomId, playerId);
    const mapState = mapRepository.upsert(roomId);

    const token = mapState.tokens.find((t) => t.id === tokenId);
    if (!token) {
      throw new AppError(404, 'Token 不存在');
    }

    const newTokens = mapState.tokens.filter((t) => t.id !== tokenId);
    const updated = mapRepository.update(roomId, { tokens: newTokens });
    if (!updated) {
      throw new AppError(404, '地图状态不存在');
    }
    logger.info('Token 已移除', { roomId, playerId, tokenId });
    return updated;
  }

  /**
   * 更新 Token（DM only）
   * @param roomId 房间 ID
   * @param playerId 操作者 ID（用于权限校验）
   * @param tokenId Token ID
   * @param patch 需要更新的字段
   * @returns 更新后的 Token
   */
  updateToken(
    roomId: string,
    playerId: string,
    tokenId: string,
    patch: Partial<MapToken>,
  ): MapToken {
    this.assertDm(roomId, playerId);
    const mapState = mapRepository.upsert(roomId);

    const tokenIndex = mapState.tokens.findIndex((t) => t.id === tokenId);
    if (tokenIndex === -1) {
      throw new AppError(404, 'Token 不存在');
    }

    // 不允许通过 patch 修改 id
    const { id: _id, ...restPatch } = patch;
    void _id;
    const updatedToken: MapToken = { ...mapState.tokens[tokenIndex], ...restPatch };
    this.validateToken(updatedToken);

    mapState.tokens[tokenIndex] = updatedToken;
    mapRepository.update(roomId, { tokens: mapState.tokens });
    logger.info('Token 已更新', { roomId, playerId, tokenId });
    return updatedToken;
  }

  /**
   * 切换迷雾（DM only）
   * @param roomId 房间 ID
   * @param playerId 操作者 ID（用于权限校验）
   * @param cells 要切换的单元格列表（"x,y" 格式）
   * @param mode 添加或移除
   * @returns 更新后的迷雾单元格列表
   */
  toggleFog(
    roomId: string,
    playerId: string,
    cells: string[],
    mode: 'add' | 'remove',
  ): string[] {
    this.assertDm(roomId, playerId);
    const mapState = mapRepository.upsert(roomId);

    let fogCells: string[];
    if (mode === 'add') {
      const fogSet = new Set(mapState.fogCells);
      for (const cell of cells) {
        fogSet.add(cell);
      }
      fogCells = [...fogSet];
    } else {
      const removeSet = new Set(cells);
      fogCells = mapState.fogCells.filter((c) => !removeSet.has(c));
    }

    mapRepository.update(roomId, { fogCells });
    logger.info('迷雾已切换', { roomId, mode, count: cells.length });
    return fogCells;
  }

  /**
   * 清空所有迷雾（DM only）
   * @param roomId 房间 ID
   * @param playerId 操作者 ID（用于权限校验）
   * @returns 空数组
   */
  clearFog(roomId: string, playerId: string): string[] {
    this.assertDm(roomId, playerId);
    mapRepository.upsert(roomId);
    mapRepository.update(roomId, { fogCells: [] });
    logger.info('迷雾已清空', { roomId });
    return [];
  }

  /**
   * 设置地图配置（DM only）
   * @param roomId 房间 ID
   * @param playerId 操作者 ID（用于权限校验）
   * @param config 配置项
   * @returns 更新后的地图状态
   */
  setConfig(roomId: string, playerId: string, config: MapConfigPayload): MapState {
    this.assertDm(roomId, playerId);
    mapRepository.upsert(roomId);

    const patch: Partial<MapState> = {};
    if (config.gridType !== undefined) {
      this.validateGridType(config.gridType);
      patch.gridType = config.gridType;
    }
    if (config.gridSize !== undefined) {
      this.validatePositive(config.gridSize, 'gridSize');
      patch.gridSize = config.gridSize;
    }
    if (config.width !== undefined) {
      this.validatePositive(config.width, 'width');
      patch.width = config.width;
    }
    if (config.height !== undefined) {
      this.validatePositive(config.height, 'height');
      patch.height = config.height;
    }
    if (config.backgroundUrl !== undefined) {
      patch.backgroundUrl = config.backgroundUrl;
    }

    const updated = mapRepository.update(roomId, patch);
    if (!updated) {
      throw new AppError(404, '地图状态不存在');
    }
    logger.info('地图配置已更新', { roomId, config });
    return updated;
  }

  /**
   * 设置背景图（DM only）
   * @param roomId 房间 ID
   * @param playerId 操作者 ID（用于权限校验）
   * @param url 背景图 URL（null 表示清除）
   * @returns 更新后的地图状态
   */
  setBackground(roomId: string, playerId: string, url: string | null): MapState {
    this.assertDm(roomId, playerId);
    mapRepository.upsert(roomId);
    const updated = mapRepository.update(roomId, { backgroundUrl: url });
    if (!updated) {
      throw new AppError(404, '地图状态不存在');
    }
    logger.info('背景图已设置', { roomId, url });
    return updated;
  }

  // ============ 私有校验方法 ============

  /** 校验房间存在 */
  private assertRoomExists(roomId: string): void {
    const room = roomRepository.findById(roomId);
    if (!room) {
      throw new AppError(404, '房间不存在');
    }
  }

  /** 校验操作者为 DM */
  private assertDm(roomId: string, playerId: string): void {
    this.assertRoomExists(roomId);
    if (!this.isDm(roomId, playerId)) {
      throw new AppError(403, '需要 DM 权限');
    }
  }

  /** 判断玩家是否为 DM */
  private isDm(roomId: string, playerId: string): boolean {
    const room = roomRepository.findById(roomId);
    if (!room) {
      return false;
    }
    return room.dmId === playerId;
  }

  /**
   * 校验玩家拥有该 Token
   * - Token 的 characterId 必须关联到该玩家的某个角色
   */
  private assertOwnsToken(
    roomId: string,
    playerId: string,
    token: MapToken,
  ): void {
    if (!token.characterId) {
      throw new AppError(403, '无权移动该 Token');
    }
    const playerCharacters = characterRepository.findByPlayer(roomId, playerId);
    const owns = playerCharacters.some((c) => c.id === token.characterId);
    if (!owns) {
      throw new AppError(403, '无权移动他人的 Token');
    }
  }

  /** 校验网格类型 */
  private validateGridType(gridType: string): asserts gridType is GridType {
    if (gridType !== 'square' && gridType !== 'hex') {
      throw new AppError(400, `无效的网格类型: ${gridType}`);
    }
  }

  /** 校验为正数 */
  private validatePositive(value: number, field: string): void {
    if (typeof value !== 'number' || value <= 0 || !Number.isFinite(value)) {
      throw new AppError(400, `${field} 必须为正数`);
    }
  }

  /** 校验 Token 基本字段 */
  private validateToken(token: MapToken): void {
    if (!token.name || typeof token.name !== 'string') {
      throw new AppError(400, 'Token 名称不能为空');
    }
    const validTypes: MapTokenType[] = ['player', 'npc', 'object'];
    if (!validTypes.includes(token.type)) {
      throw new AppError(400, `无效的 Token 类型: ${token.type}`);
    }
    if (typeof token.x !== 'number' || typeof token.y !== 'number') {
      throw new AppError(400, 'Token 坐标必须为数字');
    }
    if (typeof token.size !== 'number' || token.size <= 0) {
      throw new AppError(400, 'Token 大小必须为正数');
    }
  }
}

/** 地图服务单例 */
export const mapService = new MapService();
