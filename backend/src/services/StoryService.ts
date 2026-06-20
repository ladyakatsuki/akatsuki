import { storyRepository } from '../db/repositories/StoryRepository.js';
import { roomRepository } from '../db/repositories/RoomRepository.js';
import { markdownStoryParser } from './MarkdownStoryParser.js';
import { jsonStoryParser } from './JsonStoryParser.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import type { Story, StoryFormat } from '../types/models.js';
import type { StoryEventPayload } from '../types/socket.js';

/** 上传文件结构（抽象 multer 文件对象，便于测试） */
export interface StoryUploadFile {
  buffer: Buffer;
  originalname: string;
}

/**
 * 故事书业务逻辑服务
 *
 * 封装故事上传、查询、章节推进、场景跳转、事件触发、删除等业务规则：
 * - 所有写操作仅 DM 可执行（除获取状态）
 * - 上传时删除旧故事（每房间最多一条）
 * - Markdown 与 JSON 两种格式分别由对应解析器处理
 */
export class StoryService {
  /**
   * 上传故事书
   * - DM 权限校验
   * - 读取文件内容
   * - 根据格式调用对应解析器
   * - 删除旧故事（如有）
   * - 创建新故事
   * @param roomId 房间 ID
   * @param playerId 操作者 ID（用于权限校验）
   * @param file 上传的文件
   * @param format 故事格式：md / json
   * @returns 新创建的故事
   */
  uploadStory(
    roomId: string,
    playerId: string,
    file: StoryUploadFile,
    format: StoryFormat,
  ): Story {
    this.assertDm(roomId, playerId);

    if (!file || !file.buffer) {
      throw new AppError(400, '缺少上传文件');
    }

    const content = file.buffer.toString('utf-8');
    if (!content.trim()) {
      throw new AppError(400, '文件内容为空');
    }

    // 根据格式解析
    let parsed: Omit<Story, 'id' | 'roomId' | 'createdAt' | 'updatedAt'>;
    const title = this.deriveTitle(file.originalname);

    if (format === 'md') {
      parsed = markdownStoryParser.parse(content, title);
    } else if (format === 'json') {
      let data: unknown;
      try {
        data = JSON.parse(content) as unknown;
      } catch {
        throw new AppError(400, 'JSON 格式非法');
      }
      parsed = jsonStoryParser.parse(data, title);
    } else {
      throw new AppError(400, `不支持的故事格式: ${format}`);
    }

    // 删除旧故事
    const oldStory = storyRepository.findByRoom(roomId);
    if (oldStory) {
      storyRepository.delete(oldStory.id);
      logger.info('旧故事已删除', { roomId, oldStoryId: oldStory.id });
    }

    // 创建新故事
    const story = storyRepository.create({
      roomId,
      ...parsed,
    });

    // 更新房间关联的故事 ID
    roomRepository.updateStoryId(roomId, story.id);

    logger.info('故事已上传', {
      roomId,
      storyId: story.id,
      format,
      title: story.title,
    });
    return story;
  }

  /**
   * 获取房间故事
   * @param roomId 房间 ID
   * @returns 故事（不存在返回 null）
   */
  getStory(roomId: string): Story | null {
    this.assertRoomExists(roomId);
    return storyRepository.findByRoom(roomId);
  }

  /**
   * 推进章节（Markdown 格式用）
   * - DM 权限校验
   * - 推进到下一章或指定章节
   * - 更新 currentChapter
   * @param roomId 房间 ID
   * @param playerId 操作者 ID
   * @param targetChapter 目标章节索引（不传则推进到下一章）
   * @returns 更新后的故事
   */
  advanceChapter(roomId: string, playerId: string, targetChapter?: number): Story {
    this.assertDm(roomId, playerId);
    const story = this.getStoryOrThrow(roomId);

    if (story.format !== 'md') {
      throw new AppError(400, '仅 Markdown 格式故事可推进章节');
    }

    let nextChapter: number;
    if (targetChapter !== undefined) {
      if (typeof targetChapter !== 'number' || targetChapter < 0) {
        throw new AppError(400, 'targetChapter 必须为非负整数');
      }
      if (targetChapter >= story.chapters.length) {
        throw new AppError(400, `章节索引越界: ${targetChapter}`);
      }
      nextChapter = targetChapter;
    } else {
      nextChapter = story.currentChapter + 1;
      if (nextChapter >= story.chapters.length) {
        throw new AppError(400, '已是最后一章，无法继续推进');
      }
    }

    const updated = storyRepository.update(story.id, { currentChapter: nextChapter });
    if (!updated) {
      throw new AppError(404, '故事不存在');
    }
    logger.info('章节已推进', { roomId, currentChapter: nextChapter });
    return updated;
  }

  /**
   * 跳转场景（JSON 格式用）
   * - DM 权限校验
   * - 跳转到指定场景
   * - 更新 currentScene
   * @param roomId 房间 ID
   * @param playerId 操作者 ID
   * @param targetScene 目标场景 ID
   * @returns 更新后的故事
   */
  advanceScene(roomId: string, playerId: string, targetScene: string): Story {
    this.assertDm(roomId, playerId);
    const story = this.getStoryOrThrow(roomId);

    if (story.format !== 'json') {
      throw new AppError(400, '仅 JSON 格式故事可跳转场景');
    }

    if (!targetScene || typeof targetScene !== 'string') {
      throw new AppError(400, '缺少参数: targetScene');
    }

    const sceneExists = story.scenes.some((s) => s.id === targetScene);
    if (!sceneExists) {
      throw new AppError(404, `场景不存在: ${targetScene}`);
    }

    const updated = storyRepository.update(story.id, { currentScene: targetScene });
    if (!updated) {
      throw new AppError(404, '故事不存在');
    }
    logger.info('场景已跳转', { roomId, currentScene: targetScene });
    return updated;
  }

  /**
   * 触发故事事件（NPC 出现、遇敌等）
   * - DM 权限校验
   * - 返回事件数据
   * @param roomId 房间 ID
   * @param playerId 操作者 ID
   * @param event 事件 Payload
   * @returns 事件数据
   */
  triggerEvent(
    roomId: string,
    playerId: string,
    event: StoryEventPayload,
  ): StoryEventPayload {
    this.assertDm(roomId, playerId);

    if (!event || typeof event !== 'object') {
      throw new AppError(400, '缺少参数: event');
    }

    const validTypes: StoryEventPayload['type'][] = [
      'chapter',
      'scene',
      'npc',
      'encounter',
      'choice',
    ];
    if (!validTypes.includes(event.type)) {
      throw new AppError(400, `无效的事件类型: ${event.type}`);
    }

    logger.info('故事事件已触发', {
      roomId,
      playerId,
      type: event.type,
    });
    return event;
  }

  /**
   * 删除故事
   * - DM 权限校验
   * - 删除故事
   * @param roomId 房间 ID
   * @param playerId 操作者 ID
   */
  deleteStory(roomId: string, playerId: string): void {
    this.assertDm(roomId, playerId);
    const story = storyRepository.findByRoom(roomId);
    if (!story) {
      throw new AppError(404, '故事不存在');
    }
    storyRepository.deleteByRoom(roomId);
    roomRepository.updateStoryId(roomId, null);
    logger.info('故事已删除', { roomId, storyId: story.id });
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
    const room = roomRepository.findById(roomId);
    if (!room || room.dmId !== playerId) {
      throw new AppError(403, '需要 DM 权限');
    }
  }

  /** 获取故事或抛 404 */
  private getStoryOrThrow(roomId: string): Story {
    const story = storyRepository.findByRoom(roomId);
    if (!story) {
      throw new AppError(404, '故事不存在');
    }
    return story;
  }

  /** 从文件名推导故事标题（去除扩展名） */
  private deriveTitle(filename: string): string {
    const baseName = filename.replace(/\.[^.]+$/, '');
    return baseName || '未命名故事';
  }
}

/** 故事服务单例 */
export const storyService = new StoryService();
