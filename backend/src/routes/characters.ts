import { Router } from 'express';
import type { Request } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { characterService } from '../services/CharacterService.js';
import { roomRepository } from '../db/repositories/RoomRepository.js';
import { getEnv } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import type { Character, RuleSystem } from '../types/models.js';

export const charactersRouter = Router();

// ============ 工具函数 ============

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

// ============ 立绘上传 Multer 配置 ============

const ALLOWED_PORTRAIT_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_PORTRAIT_SIZE = 5 * 1024 * 1024; // 5MB

const portraitFileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (ALLOWED_PORTRAIT_MIME.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(400, `不支持的文件类型: ${file.mimetype}，仅支持 jpg/png/webp/gif`));
  }
};

// 使用内存存储，避免在 destination 回调中因角色不存在导致连接重置
// 文件保存到磁盘的逻辑在路由处理器中完成（所有校验通过后）
const portraitUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: portraitFileFilter,
  limits: { fileSize: MAX_PORTRAIT_SIZE },
});

// ============ 路由 ============

/**
 * POST /api/rooms/:code/characters
 * 创建角色
 * Body: { name: string, isNpc?: boolean }
 * 需 playerId（query 或 header）
 * 返回: Character
 */
charactersRouter.post('/rooms/:code/characters', (req, res, next) => {
  try {
    const playerId = getPlayerId(req);
    const roomId = getRoomIdByCode(req.params.code);
    const { name, isNpc } = req.body as { name?: string; isNpc?: boolean };

    if (!name || typeof name !== 'string') {
      throw new AppError(400, '缺少必要参数: name');
    }

    // 获取房间规则系统
    const room = roomRepository.findById(roomId);
    if (!room) {
      throw new AppError(404, '房间不存在');
    }

    const character = characterService.createCharacter({
      roomId,
      playerId,
      ruleSystem: room.ruleSystem as RuleSystem,
      name,
      isNpc: isNpc ?? false,
    });
    res.status(201).json({ ok: true, data: character });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/rooms/:code/characters
 * 获取房间所有角色
 * 返回: Character[]
 */
charactersRouter.get('/rooms/:code/characters', (req, res, next) => {
  try {
    const roomId = getRoomIdByCode(req.params.code);
    const characters = characterService.getRoomCharacters(roomId);
    res.json({ ok: true, data: characters });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/rooms/:code/characters/mine
 * 获取自己的角色
 * 需 playerId
 * 返回: Character[]
 */
charactersRouter.get('/rooms/:code/characters/mine', (req, res, next) => {
  try {
    const playerId = getPlayerId(req);
    const roomId = getRoomIdByCode(req.params.code);
    const characters = characterService.getPlayerCharacters(roomId, playerId);
    res.json({ ok: true, data: characters });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/characters/:id
 * 获取单个角色
 * 返回: Character
 */
charactersRouter.get('/characters/:id', (req, res, next) => {
  try {
    const character = characterService.getCharacter(req.params.id);
    res.json({ ok: true, data: character });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/characters/:id
 * 更新角色基本信息
 * Body: Partial<Pick<Character, 'name'>>
 * 需 playerId
 */
charactersRouter.patch('/characters/:id', (req, res, next) => {
  try {
    const playerId = getPlayerId(req);
    const patch = req.body as Partial<Pick<Character, 'name'>>;
    const character = characterService.updateCharacter(req.params.id, playerId, patch);
    res.json({ ok: true, data: character });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/characters/:id/data
 * 更新角色卡数据
 * Body: Record<string, unknown>
 * 需 playerId
 */
charactersRouter.put('/characters/:id/data', (req, res, next) => {
  try {
    const playerId = getPlayerId(req);
    const data = req.body as Record<string, unknown>;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new AppError(400, '请求体必须为 JSON 对象');
    }
    const character = characterService.updateCharacterData(req.params.id, playerId, data);
    res.json({ ok: true, data: character });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/characters/:id/portrait
 * 上传立绘
 * multipart/form-data, field: portrait
 * 需 playerId
 */
charactersRouter.post(
  '/characters/:id/portrait',
  portraitUpload.single('portrait'),
  (req, res, next) => {
    try {
      const playerId = getPlayerId(req);
      if (!req.file) {
        throw new AppError(400, '缺少上传文件，field 名为 portrait');
      }

      // 获取角色（含存在性校验）
      const character = characterService.getCharacter(req.params.id);

      // 校验权限（uploadPortrait 内部也会校验，但需先获取 roomId 才能保存文件）
      const room = roomRepository.findById(character.roomId);
      if (!room) {
        throw new AppError(404, '房间不存在');
      }
      const isDm = room.dmId === playerId;
      if (!isDm && character.playerId !== playerId) {
        throw new AppError(403, '无权操作他人的角色');
      }

      // 保存文件到磁盘
      const dir = path.join(getEnv().uploadDir, character.roomId, 'portrait');
      fs.mkdirSync(dir, { recursive: true });
      const timestamp = Date.now();
      const safeName = req.file.originalname.replace(/[^\w.-]/g, '_');
      const filename = `${timestamp}-${safeName}`;
      const filePath = path.join(dir, filename);
      fs.writeFileSync(filePath, req.file.buffer);

      const updated = characterService.uploadPortrait(req.params.id, playerId, {
        filename,
        path: filePath,
        size: req.file.size,
        mimetype: req.file.mimetype,
      });
      res.json({ ok: true, data: updated });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/characters/:id
 * 删除角色
 * 需 playerId
 */
charactersRouter.delete('/characters/:id', (req, res, next) => {
  try {
    const playerId = getPlayerId(req);
    characterService.deleteCharacter(req.params.id, playerId);
    res.json({ ok: true, data: null });
  } catch (err) {
    next(err);
  }
});
