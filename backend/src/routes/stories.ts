import { Router } from 'express';
import multer from 'multer';
import { storyService } from '../services/StoryService.js';
import { roomService } from '../services/RoomService.js';
import { AppError } from '../middleware/errorHandler.js';
import type { StoryFormat } from '../types/models.js';

export const storiesRouter = Router();

/**
 * 故事书路由
 *
 * 路由：
 * - POST   /:code/story/upload   上传故事书（multipart/form-data, field: file）
 * - GET    /:code/story          获取故事
 * - DELETE /:code/story          删除故事
 *
 * 查询参数：
 * - format=md|json  （上传时指定格式）
 * - playerId        （操作者 ID，用于权限校验）
 */

// Multer 配置：使用内存存储，限制 5MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

/**
 * POST /:code/story/upload
 * 上传故事书
 * - multipart/form-data, field: file
 * - query: format=md|json, playerId
 * - 返回: Story
 */
storiesRouter.post(
  '/:code/story/upload',
  upload.single('file'),
  (req, res, next) => {
    try {
      const { code } = req.params;
      const format = req.query.format as string | undefined;
      const playerId = req.query.playerId as string | undefined;

      if (!playerId) {
        throw new AppError(400, '缺少必要查询参数: playerId');
      }
      if (format !== 'md' && format !== 'json') {
        throw new AppError(400, 'format 必须为 md 或 json');
      }
      if (!req.file) {
        throw new AppError(400, '缺少上传文件: file');
      }

      // 按房间码查询房间
      const room = roomService.getRoomByCode(code);

      const story = storyService.uploadStory(
        room.id,
        playerId,
        {
          buffer: req.file.buffer,
          originalname: req.file.originalname,
        },
        format as StoryFormat,
      );

      res.status(201).json({ ok: true, data: story });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /:code/story
 * 获取故事
 * - 返回: Story | null
 */
storiesRouter.get('/:code/story', (req, res, next) => {
  try {
    const { code } = req.params;
    const room = roomService.getRoomByCode(code);
    const story = storyService.getStory(room.id);
    res.json({ ok: true, data: story });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /:code/story
 * 删除故事
 * - query: playerId
 */
storiesRouter.delete('/:code/story', (req, res, next) => {
  try {
    const { code } = req.params;
    const playerId = req.query.playerId as string | undefined;

    if (!playerId) {
      throw new AppError(400, '缺少必要查询参数: playerId');
    }

    const room = roomService.getRoomByCode(code);
    storyService.deleteStory(room.id, playerId);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
