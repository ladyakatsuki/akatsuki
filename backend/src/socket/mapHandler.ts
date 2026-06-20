import type { AppServer, AppSocket } from './index.js';
import { getSocketAuth } from '../middleware/auth.js';
import { requireDm } from '../middleware/permission.js';
import { mapService } from '../services/MapService.js';
import { logger } from '../utils/logger.js';
import type { MapState, MapToken } from '../types/models.js';
import type {
  MapConfigPayload,
  MapFogTogglePayload,
  MapStateEvent,
  MapTokenAddPayload,
  MapTokenMovePayload,
  MapTokenUpdatePayload,
  PlayerMapStateEvent,
} from '../types/socket.js';

/**
 * 注册地图事件处理器
 *
 * 事件：
 * - map:getState       获取地图状态（DM 完整，玩家过滤版），通过 ack 返回
 * - map:token:move     移动 Token，广播 map:token:moved
 * - map:token:add      添加 Token（DM only），广播 map:state
 * - map:token:remove   移除 Token（DM only），广播 map:token:removed
 * - map:token:update   更新 Token（DM only），广播 map:token:updated
 * - map:fog:toggle     切换迷雾（DM only），广播 map:fog:updated
 * - map:fog:clear      清空迷雾（DM only），广播 map:fog:updated
 * - map:config:set     设置配置（DM only），广播 map:state
 * - map:background:set 设置背景（DM only），广播 map:state
 *
 * DM 收到完整地图状态，玩家收到过滤不可见 Token 的版本。
 */
export function registerMapHandler(io: AppServer, socket: AppSocket): void {
  const auth = getSocketAuth(socket);
  if (!auth) {
    logger.warn('[mapHandler] Socket 未鉴权', { socketId: socket.id });
    return;
  }
  const { roomId, playerId, role } = auth;

  /**
   * 向全房间广播地图状态
   * - DM 收到完整版（含所有 Token）
   * - 玩家收到过滤版（仅可见 Token）
   */
  function broadcastMapState(): void {
    const fullState = mapService.getMapState(roomId);
    const playerView = mapService.getPlayerMapState(roomId);

    // 遍历房间内所有 socket，按角色发送对应版本
    const sockets = io.sockets.sockets;
    for (const [, s] of sockets) {
      const sAuth = getSocketAuth(s);
      if (!sAuth || sAuth.roomId !== roomId) {
        continue;
      }
      if (sAuth.role === 'dm') {
        const dmEvent: MapStateEvent = { mapState: fullState };
        s.emit('map:state', dmEvent);
      } else {
        s.emit('map:state', playerView);
      }
    }
  }

  // ============ map:getState ============
  socket.on('map:getState', (ack) => {
    try {
      if (role === 'dm') {
        const mapState: MapState = mapService.getMapState(roomId);
        ack({ ok: true, data: mapState });
      } else {
        const playerView: PlayerMapStateEvent = mapService.getPlayerMapState(roomId);
        ack({ ok: true, data: playerView });
      }
      logger.info('[map:getState] 已返回地图状态', {
        socketId: socket.id,
        roomId,
        playerId,
        role,
      });
    } catch (err) {
      logger.error('[map:getState] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '获取地图状态失败',
      });
    }
  });

  // ============ map:token:move ============
  socket.on('map:token:move', (payload: MapTokenMovePayload, ack) => {
    try {
      const { tokenId, x, y } = payload;
      if (!tokenId) {
        ack({ ok: false, error: '缺少参数: tokenId' });
        return;
      }
      if (typeof x !== 'number' || typeof y !== 'number') {
        ack({ ok: false, error: '缺少参数: x, y' });
        return;
      }

      mapService.moveToken(roomId, playerId, tokenId, x, y);

      // 广播 Token 移动给全房间
      io.to(roomId).emit('map:token:moved', { tokenId, x, y });
      logger.info('[map:token:move] Token 已移动', {
        socketId: socket.id,
        roomId,
        playerId,
        tokenId,
        x,
        y,
      });
      ack({ ok: true });
    } catch (err) {
      logger.error('[map:token:move] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '移动 Token 失败',
      });
    }
  });

  // ============ map:token:add (DM only) ============
  socket.on('map:token:add', (payload: MapTokenAddPayload, ack) => {
    try {
      const dmCheck = requireDm(socket);
      if (!dmCheck.ok) {
        ack({ ok: false, error: dmCheck.error });
        return;
      }

      if (!payload || !payload.token) {
        ack({ ok: false, error: '缺少参数: token' });
        return;
      }

      const mapState = mapService.addToken(roomId, playerId, payload);

      // 广播地图状态给全房间（区分 DM 与玩家视角）
      broadcastMapState();
      logger.info('[map:token:add] Token 已添加', {
        socketId: socket.id,
        roomId,
        playerId,
      });
      ack({ ok: true, data: mapState });
    } catch (err) {
      logger.error('[map:token:add] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '添加 Token 失败',
      });
    }
  });

  // ============ map:token:remove (DM only) ============
  socket.on('map:token:remove', (payload, ack) => {
    try {
      const dmCheck = requireDm(socket);
      if (!dmCheck.ok) {
        ack({ ok: false, error: dmCheck.error });
        return;
      }

      const { tokenId } = payload;
      if (!tokenId) {
        ack({ ok: false, error: '缺少参数: tokenId' });
        return;
      }

      mapService.removeToken(roomId, playerId, tokenId);

      // 广播 Token 移除给全房间
      io.to(roomId).emit('map:token:removed', { tokenId });
      logger.info('[map:token:remove] Token 已移除', {
        socketId: socket.id,
        roomId,
        playerId,
        tokenId,
      });
      ack({ ok: true });
    } catch (err) {
      logger.error('[map:token:remove] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '移除 Token 失败',
      });
    }
  });

  // ============ map:token:update (DM only) ============
  socket.on('map:token:update', (payload: MapTokenUpdatePayload, ack) => {
    try {
      const dmCheck = requireDm(socket);
      if (!dmCheck.ok) {
        ack({ ok: false, error: dmCheck.error });
        return;
      }

      const { tokenId, patch } = payload;
      if (!tokenId) {
        ack({ ok: false, error: '缺少参数: tokenId' });
        return;
      }
      if (!patch || typeof patch !== 'object') {
        ack({ ok: false, error: '缺少参数: patch' });
        return;
      }

      const token: MapToken = mapService.updateToken(roomId, playerId, tokenId, patch);

      // 广播 Token 更新给全房间
      io.to(roomId).emit('map:token:updated', { token });
      logger.info('[map:token:update] Token 已更新', {
        socketId: socket.id,
        roomId,
        playerId,
        tokenId,
      });
      ack({ ok: true, data: token });
    } catch (err) {
      logger.error('[map:token:update] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '更新 Token 失败',
      });
    }
  });

  // ============ map:fog:toggle (DM only) ============
  socket.on('map:fog:toggle', (payload: MapFogTogglePayload, ack) => {
    try {
      const dmCheck = requireDm(socket);
      if (!dmCheck.ok) {
        ack({ ok: false, error: dmCheck.error });
        return;
      }

      const { cells, mode } = payload;
      if (!Array.isArray(cells)) {
        ack({ ok: false, error: '缺少参数: cells' });
        return;
      }
      if (mode !== 'add' && mode !== 'remove') {
        ack({ ok: false, error: 'mode 必须为 add 或 remove' });
        return;
      }

      const fogCells = mapService.toggleFog(roomId, playerId, cells, mode);

      // 广播迷雾更新给全房间
      io.to(roomId).emit('map:fog:updated', { fogCells });
      logger.info('[map:fog:toggle] 迷雾已切换', {
        socketId: socket.id,
        roomId,
        playerId,
        mode,
        count: cells.length,
      });
      ack({ ok: true });
    } catch (err) {
      logger.error('[map:fog:toggle] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '切换迷雾失败',
      });
    }
  });

  // ============ map:fog:clear (DM only) ============
  socket.on('map:fog:clear', (ack) => {
    try {
      const dmCheck = requireDm(socket);
      if (!dmCheck.ok) {
        ack({ ok: false, error: dmCheck.error });
        return;
      }

      mapService.clearFog(roomId, playerId);

      // 广播迷雾更新（空数组）给全房间
      io.to(roomId).emit('map:fog:updated', { fogCells: [] });
      logger.info('[map:fog:clear] 迷雾已清空', {
        socketId: socket.id,
        roomId,
        playerId,
      });
      ack({ ok: true });
    } catch (err) {
      logger.error('[map:fog:clear] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '清空迷雾失败',
      });
    }
  });

  // ============ map:config:set (DM only) ============
  socket.on('map:config:set', (payload: MapConfigPayload, ack) => {
    try {
      const dmCheck = requireDm(socket);
      if (!dmCheck.ok) {
        ack({ ok: false, error: dmCheck.error });
        return;
      }

      if (!payload || typeof payload !== 'object') {
        ack({ ok: false, error: '缺少参数: config' });
        return;
      }

      const mapState = mapService.setConfig(roomId, playerId, payload);

      // 广播地图状态给全房间（区分 DM 与玩家视角）
      broadcastMapState();
      logger.info('[map:config:set] 地图配置已更新', {
        socketId: socket.id,
        roomId,
        playerId,
      });
      ack({ ok: true, data: mapState });
    } catch (err) {
      logger.error('[map:config:set] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '设置地图配置失败',
      });
    }
  });

  // ============ map:background:set (DM only) ============
  socket.on('map:background:set', (payload, ack) => {
    try {
      const dmCheck = requireDm(socket);
      if (!dmCheck.ok) {
        ack({ ok: false, error: dmCheck.error });
        return;
      }

      const { url } = payload;
      if (url !== null && typeof url !== 'string') {
        ack({ ok: false, error: '缺少参数: url' });
        return;
      }

      const mapState = mapService.setBackground(roomId, playerId, url);

      // 广播地图状态给全房间（区分 DM 与玩家视角）
      broadcastMapState();
      logger.info('[map:background:set] 背景图已设置', {
        socketId: socket.id,
        roomId,
        playerId,
        url,
      });
      ack({ ok: true, data: mapState });
    } catch (err) {
      logger.error('[map:background:set] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '设置背景图失败',
      });
    }
  });
}
