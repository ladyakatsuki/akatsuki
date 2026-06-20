import { Router } from 'express';
import { roomService } from '../services/RoomService.js';
import type { RuleSystem } from '../types/models.js';
import { AppError } from '../middleware/errorHandler.js';

export const roomsRouter = Router();

/**
 * POST /api/rooms
 * 创建房间
 * Body: { ruleSystem: 'dnd5e' | 'coc7', dmName: string }
 * 返回: { room: Room, playerId: string }（playerId 为 DM 的 ID，前端存 localStorage）
 */
roomsRouter.post('/', (req, res, next) => {
  try {
    const { ruleSystem, dmName } = req.body as {
      ruleSystem?: string;
      dmName?: string;
    };
    if (!ruleSystem || !dmName) {
      throw new AppError(400, '缺少必要参数: ruleSystem, dmName');
    }
    if (ruleSystem !== 'dnd5e' && ruleSystem !== 'coc7') {
      throw new AppError(400, 'ruleSystem 必须为 dnd5e 或 coc7');
    }
    const result = roomService.createRoom({
      ruleSystem: ruleSystem as RuleSystem,
      dmName,
    });
    res.status(201).json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/rooms/:code/join
 * 加入房间
 * Body: { playerName: string }
 * 返回: { room: Room, playerId: string }
 */
roomsRouter.post('/:code/join', (req, res, next) => {
  try {
    const { playerName } = req.body as { playerName?: string };
    if (!playerName) {
      throw new AppError(400, '缺少必要参数: playerName');
    }
    const result = roomService.joinRoom({
      code: req.params.code,
      playerName,
    });
    res.status(200).json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/rooms/:code
 * 查询房间（供加入前预览，只返回基本信息）
 * 返回: { ruleSystem: string, playerCount: number, isFull: boolean }
 */
roomsRouter.get('/:code', (req, res, next) => {
  try {
    const preview = roomService.previewRoom(req.params.code);
    res.json({ ok: true, data: preview });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/rooms/:code/state
 * 获取房间完整状态（需 playerId 查询参数）
 * 返回: RoomStateEvent
 */
roomsRouter.get('/:code/state', (req, res, next) => {
  try {
    const playerId = req.query.playerId as string | undefined;
    if (!playerId) {
      throw new AppError(400, '缺少必要查询参数: playerId');
    }
    const room = roomService.getRoomByCode(req.params.code);
    // 校验玩家在房间内
    const state = roomService.getRoomState(room.id);
    // 简单校验玩家在房间内（通过返回的房间数据）
    const isInRoom =
      state.room.players.some((p) => p.id === playerId) ||
      state.room.dmId === playerId;
    if (!isInRoom) {
      throw new AppError(403, '玩家不在房间内，无权查看房间状态');
    }
    res.json({ ok: true, data: state });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/rooms/:code/leave
 * 离开房间
 * Body: { playerId: string }
 */
roomsRouter.post('/:code/leave', (req, res, next) => {
  try {
    const { playerId } = req.body as { playerId?: string };
    if (!playerId) {
      throw new AppError(400, '缺少必要参数: playerId');
    }
    const room = roomService.getRoomByCode(req.params.code);
    const updatedRoom = roomService.leaveRoom({
      roomId: room.id,
      playerId,
    });
    // DM 离开后房间已删除，返回 null
    res.json({ ok: true, data: { room: updatedRoom } });
  } catch (err) {
    next(err);
  }
});
