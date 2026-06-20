import type { ErrorRequestHandler, RequestHandler } from 'express';
import { logger } from '../utils/logger.js';

/**
 * 自定义业务错误
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * 统一错误处理中间件
 * - 捕获同步与异步错误
 * - 返回统一 JSON 错误结构
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    logger.warn('业务错误', { statusCode: err.statusCode, message: err.message });
    res.status(err.statusCode).json({
      ok: false,
      error: err.message,
      details: err.details,
    });
    return;
  }

  // 处理 Multer 上传错误（文件大小超限、文件类型不支持等）
  if (err.name === 'MulterError') {
    const multerErr = err as { code: string; message: string; field?: string };
    let message = '文件上传失败';
    if (multerErr.code === 'LIMIT_FILE_SIZE') {
      message = '文件大小超过限制（最大 5MB）';
    } else if (multerErr.code === 'LIMIT_UNEXPECTED_FILE') {
      message = '上传字段名不正确';
    } else {
      message = multerErr.message || message;
    }
    logger.warn('文件上传错误', { code: multerErr.code, message });
    res.status(400).json({
      ok: false,
      error: message,
    });
    return;
  }

  logger.error('未处理错误', { name: err.name, message: err.message, stack: err.stack });
  res.status(500).json({
    ok: false,
    error: '服务器内部错误',
  });
};

/**
 * 404 处理中间件
 */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    ok: false,
    error: `路径不存在: ${req.method} ${req.path}`,
  });
};
