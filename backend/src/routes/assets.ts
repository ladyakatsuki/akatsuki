import { Router } from 'express';
import type { Request } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { assetService } from '../services/AssetService.js';
import { roomRepository } from '../db/repositories/RoomRepository.js';
import { getEnv } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import type { AssetType } from '../types/models.js';

export const assetsRouter = Router();

// ============ 工具函数 ============

/** 合法的素材类型 */
const VALID_ASSET_TYPES: AssetType[] = ['portrait', 'map', 'token', 'other'];

/**
 * 从 query 或 header 中获取 playerId
 * 优先 query.playerId，其次 x-player-id header
 */
function getPlayerId(req: Request): string {
  const playerId = (req.query.playerId as string | undefined) ?? req.headers['x-player-id'];
  if (!playerId || typeof playerId !== 'string') {
    throw new AppError(400, '缺少必要参数: playerId（可通过 query 或 x-player-id header 提供）');
  }
  return playerId;
}

/** 校验房间码并返回房间 ID */
function getRoomIdByCode(code: string): string {
  const room = roomRepository.findByCode(code);
  if (!room) {
    throw new AppError(404, '房间不存在');
  }
  return room.id;
}

/** 解析并校验素材类型 */
function parseAssetType(type: string | undefined): AssetType {
  if (!type) {
    throw new AppError(400, '缺少必要参数: type（portrait/map/token/other）');
  }
  if (!VALID_ASSET_TYPES.includes(type as AssetType)) {
    throw new AppError(400, `无效的素材类型: ${type}，仅支持 portrait/map/token/other`);
  }
  return type as AssetType;
}

// ============ Multer 上传配置 ============

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (ALLOWED_MIME.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(400, `不支持的文件类型: ${file.mimetype}，仅支持 jpg/png/webp/gif`));
  }
};

// 使用内存存储，文件保存到磁盘的逻辑在路由处理器中完成（所有校验通过后）
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_SIZE },
});

// ============ 路由 ============

/**
 * POST /api/rooms/:code/assets
 * 上传素材（仅 DM）
 * multipart/form-data, field: file
 * query: type=portrait|map|token|other, playerId
 * 返回: Asset
 */
assetsRouter.post(
  '/rooms/:code/assets',
  upload.single('file'),
  (req, res, next) => {
    try {
      const playerId = getPlayerId(req);
      const roomId = getRoomIdByCode(req.params.code);
      const type = parseAssetType(req.query.type as string | undefined);

      if (!req.file) {
        throw new AppError(400, '缺少上传文件，field 名为 file');
      }

      // 保存文件到磁盘：uploads/{roomId}/{type}/
      const dir = path.join(getEnv().uploadDir, roomId, type);
      fs.mkdirSync(dir, { recursive: true });
      const timestamp = Date.now();
      const safeName = req.file.originalname.replace(/[^\w.-]/g, '_');
      const filename = `${timestamp}-${safeName}`;
      const filePath = path.join(dir, filename);
      fs.writeFileSync(filePath, req.file.buffer);

      const asset = assetService.upload(roomId, playerId, {
        filename,
        path: filePath,
        size: req.file.size,
        mimetype: req.file.mimetype,
        originalName: req.file.originalname,
      }, type);

      res.status(201).json({ ok: true, data: asset });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/rooms/:code/assets
 * 获取房间所有素材（可选 type 过滤）
 * query: type?（可选过滤）
 * 返回: Asset[]
 */
assetsRouter.get('/rooms/:code/assets', (req, res, next) => {
  try {
    const roomId = getRoomIdByCode(req.params.code);
    const type = req.query.type as string | undefined;

    if (type) {
      const validType = parseAssetType(type);
      const assets = assetService.getByRoomAndType(roomId, validType);
      res.json({ ok: true, data: assets });
    } else {
      const assets = assetService.getByRoom(roomId);
      res.json({ ok: true, data: assets });
    }
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/rooms/:code/assets/:type
 * 按类型获取素材
 * 返回: Asset[]
 */
assetsRouter.get('/rooms/:code/assets/:type', (req, res, next) => {
  try {
    const roomId = getRoomIdByCode(req.params.code);
    const type = parseAssetType(req.params.type);
    const assets = assetService.getByRoomAndType(roomId, type);
    res.json({ ok: true, data: assets });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/rooms/:code/assets/:id
 * 删除素材（仅 DM）
 * query: playerId
 */
assetsRouter.delete('/rooms/:code/assets/:id', (req, res, next) => {
  try {
    const playerId = getPlayerId(req);
    const roomId = getRoomIdByCode(req.params.code);
    assetService.delete(roomId, playerId, req.params.id);
    res.json({ ok: true, data: null });
  } catch (err) {
    next(err);
  }
});
