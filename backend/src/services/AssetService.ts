import path from 'node:path';
import fs from 'node:fs';
import { assetRepository } from '../db/repositories/AssetRepository.js';
import { roomRepository } from '../db/repositories/RoomRepository.js';
import type { Asset, AssetType } from '../types/models.js';
import { AppError } from '../middleware/errorHandler.js';
import { getEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';

/** 上传文件信息（Multer file 对象的最小子集） */
export interface UploadedAssetFile {
  /** 存储文件名 */
  filename: string;
  /** 文件磁盘路径 */
  path: string;
  /** 文件大小（字节） */
  size: number;
  /** MIME 类型 */
  mimetype: string;
  /** 原始文件名 */
  originalName: string;
}

/** 合法的素材类型 */
const VALID_ASSET_TYPES: AssetType[] = ['portrait', 'map', 'token', 'other'];

/**
 * 素材业务逻辑服务
 *
 * 封装素材上传、查询、删除等业务规则。
 * - 仅 DM 可上传/删除素材，玩家只读
 * - 素材按房间隔离
 * - 文件校验：仅 jpg/png/webp/gif，≤ 5MB
 */
export class AssetService {
  /**
   * 上传素材
   * - DM 权限校验
   * - 文件已由 Multer 处理存储到 uploads/{roomId}/{type}/
   * - 创建 Asset 记录
   * @returns 新建的 Asset（含 URL）
   */
  upload(
    roomId: string,
    playerId: string,
    file: UploadedAssetFile,
    type: AssetType,
  ): Asset {
    // 校验素材类型
    if (!VALID_ASSET_TYPES.includes(type)) {
      throw new AppError(400, `无效的素材类型: ${type}，仅支持 portrait/map/token/other`);
    }

    // 校验房间存在
    const room = roomRepository.findById(roomId);
    if (!room) {
      throw new AppError(404, '房间不存在');
    }

    // 校验 DM 权限
    if (room.dmId !== playerId) {
      throw new AppError(403, '仅 DM 可上传素材');
    }

    // 构造可访问的 URL（相对于静态文件服务根路径）
    const env = getEnv();
    const relativePath = path.relative(env.uploadDir, file.path).replace(/\\/g, '/');
    const url = `/uploads/${relativePath}`;

    // 创建素材记录
    const asset = assetRepository.create({
      roomId,
      type,
      filename: file.filename,
      originalName: file.originalName,
      url,
      size: file.size,
      uploadedBy: playerId,
    });

    logger.info('素材已上传', {
      assetId: asset.id,
      roomId,
      playerId,
      type,
      filename: file.filename,
    });
    return asset;
  }

  /** 获取房间内所有素材 */
  getByRoom(roomId: string): Asset[] {
    return assetRepository.findByRoom(roomId);
  }

  /** 按类型获取房间内素材 */
  getByRoomAndType(roomId: string, type: AssetType): Asset[] {
    if (!VALID_ASSET_TYPES.includes(type)) {
      throw new AppError(400, `无效的素材类型: ${type}，仅支持 portrait/map/token/other`);
    }
    return assetRepository.findByRoomAndType(roomId, type);
  }

  /**
   * 删除素材
   * - DM 权限校验
   * - 删除磁盘文件
   * - 删除数据库记录
   * @returns 删除成功返回 true
   */
  delete(roomId: string, playerId: string, assetId: string): boolean {
    // 校验房间存在
    const room = roomRepository.findById(roomId);
    if (!room) {
      throw new AppError(404, '房间不存在');
    }

    // 校验 DM 权限
    if (room.dmId !== playerId) {
      throw new AppError(403, '仅 DM 可删除素材');
    }

    // 获取素材记录
    const asset = assetRepository.findById(assetId);
    if (!asset) {
      throw new AppError(404, '素材不存在');
    }

    // 校验素材属于该房间
    if (asset.roomId !== roomId) {
      throw new AppError(403, '素材不属于该房间');
    }

    // 删除磁盘文件
    const env = getEnv();
    const filePath = path.join(env.uploadDir, asset.url.replace('/uploads/', ''));
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        logger.warn('删除素材文件失败', {
          assetId,
          filePath,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 删除数据库记录
    const success = assetRepository.delete(assetId);
    if (!success) {
      throw new AppError(404, '素材不存在');
    }

    logger.info('素材已删除', { assetId, roomId, playerId });
    return true;
  }
}

/** 素材服务单例 */
export const assetService = new AssetService();
