import type { AppServer, AppSocket } from './index.js';
import { getSocketAuth } from '../middleware/auth.js';
import { requireDm } from '../middleware/permission.js';
import { storyService } from '../services/StoryService.js';
import { generateId } from '../utils/id.js';
import { logger } from '../utils/logger.js';
import type { Story } from '../types/models.js';
import type {
  LogEvent,
  StoryEventPayload,
  StoryStateEvent,
} from '../types/socket.js';

/**
 * 注册故事书事件处理器
 *
 * 事件：
 * - story:getState  获取故事状态（通过 ack 返回）
 * - story:advance   推进故事（DM only），广播 story:state 与 log:add
 * - story:event     触发故事事件（DM only），广播 story:event 与 log:add
 */
export function registerStoryHandler(io: AppServer, socket: AppSocket): void {
  const auth = getSocketAuth(socket);
  if (!auth) {
    logger.warn('[storyHandler] Socket 未鉴权', { socketId: socket.id });
    return;
  }
  const { roomId, playerId, playerName } = auth;

  /**
   * 广播故事状态给全房间
   */
  function broadcastStoryState(story: Story | null): void {
    const event: StoryStateEvent = { story };
    io.to(roomId).emit('story:state', event);
  }

  /**
   * 广播日志给全房间
   */
  function broadcastLog(message: string, data?: unknown): void {
    const logEvent: LogEvent = {
      id: generateId('log_'),
      type: 'story',
      message,
      data,
      playerId,
      playerName,
      timestamp: Date.now(),
    };
    io.to(roomId).emit('log:add', logEvent);
  }

  /**
   * 校验 DM 权限，失败则通过 ack 返回错误
   * @returns 是否通过校验
   */
  function checkDm(ack: (res: { ok: boolean; error?: string }) => void): boolean {
    const check = requireDm(socket);
    if (!check.ok) {
      ack({ ok: false, error: check.error });
      return false;
    }
    return true;
  }

  // ============ story:getState ============
  socket.on('story:getState', (ack) => {
    try {
      const story = storyService.getStory(roomId);
      logger.info('[story:getState] 已返回故事状态', {
        socketId: socket.id,
        roomId,
        hasStory: story !== null,
      });
      ack({ ok: true, data: story });
    } catch (err) {
      logger.error('[story:getState] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '获取故事状态失败',
      });
    }
  });

  // ============ story:advance (DM only) ============
  socket.on('story:advance', (payload, ack) => {
    if (!checkDm(ack)) return;
    try {
      if (!payload || typeof payload !== 'object') {
        ack({ ok: false, error: '缺少参数: payload' });
        return;
      }

      const { targetChapter, targetScene } = payload;
      let story: Story;

      if (targetScene !== undefined) {
        // 跳转场景（JSON 格式）
        if (typeof targetScene !== 'string' || targetScene === '') {
          ack({ ok: false, error: 'targetScene 必须为非空字符串' });
          return;
        }
        story = storyService.advanceScene(roomId, playerId, targetScene);
        broadcastLog(`故事跳转到场景: ${story.currentScene}`, {
          targetScene,
        });
      } else {
        // 推进章节（Markdown 格式）
        story = storyService.advanceChapter(roomId, playerId, targetChapter);
        broadcastLog(`故事推进到第 ${story.currentChapter + 1} 章`, {
          currentChapter: story.currentChapter,
        });
      }

      // 广播故事状态给全房间
      broadcastStoryState(story);

      logger.info('[story:advance] 故事已推进', {
        socketId: socket.id,
        roomId,
        currentChapter: story.currentChapter,
        currentScene: story.currentScene,
      });
      ack({ ok: true, data: story });
    } catch (err) {
      logger.error('[story:advance] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '推进故事失败',
      });
    }
  });

  // ============ story:event (DM only) ============
  socket.on('story:event', (payload: StoryEventPayload, ack) => {
    if (!checkDm(ack)) return;
    try {
      if (!payload || typeof payload !== 'object') {
        ack({ ok: false, error: '缺少参数: payload' });
        return;
      }

      const event = storyService.triggerEvent(roomId, playerId, payload);

      // 广播故事事件给全房间
      io.to(roomId).emit('story:event', event);

      // 根据事件类型生成日志消息
      const messages: Record<StoryEventPayload['type'], string> = {
        chapter: '章节事件触发',
        scene: '场景事件触发',
        npc: 'NPC 事件触发',
        encounter: '遇敌事件触发',
        choice: '选择事件触发',
      };
      broadcastLog(messages[event.type], event);

      logger.info('[story:event] 故事事件已触发', {
        socketId: socket.id,
        roomId,
        type: event.type,
      });
      ack({ ok: true, data: event });
    } catch (err) {
      logger.error('[story:event] 处理失败', err);
      ack({
        ok: false,
        error: err instanceof Error ? err.message : '触发故事事件失败',
      });
    }
  });
}
