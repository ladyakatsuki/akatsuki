import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createInMemoryDb,
  setDbInstance,
  closeDb,
} from '../../src/db/index.js';
import { StoryService } from '../../src/services/StoryService.js';
import { storyRepository } from '../../src/db/repositories/StoryRepository.js';
import { roomRepository } from '../../src/db/repositories/RoomRepository.js';
import { AppError } from '../../src/middleware/errorHandler.js';
import type { StoryEventPayload } from '../../src/types/socket.js';

describe('StoryService', () => {
  let service: StoryService;
  let roomId: string;
  let dmId: string;
  let playerId: string;

  beforeEach(() => {
    const db = createInMemoryDb();
    setDbInstance(db);
    service = new StoryService();

    // 创建测试房间（DM + 1 玩家）
    const room = roomRepository.create('dnd5e', 'dm-1', 'DM');
    roomId = room.id;
    dmId = 'dm-1';
    playerId = 'player-1';
    roomRepository.addPlayer(roomId, {
      id: playerId,
      name: '玩家1',
      role: 'player',
      joinedAt: Date.now(),
    });
  });

  afterEach(() => {
    closeDb();
  });

  /** 构造 Markdown 文件内容 */
  function buildMdFile(): { buffer: Buffer; originalname: string } {
    const content = [
      '## 第一章 开始',
      '',
      '冒险开始了。![地图](/uploads/map.png)',
      '',
      '## 第二章 高潮',
      '',
      '英雄登场。',
    ].join('\n');
    return {
      buffer: Buffer.from(content, 'utf-8'),
      originalname: 'story.md',
    };
  }

  /** 构造 JSON 文件内容（使用用户提供的 chapterId） */
  function buildJsonFile(): { buffer: Buffer; originalname: string } {
    const data = {
      chapters: [{ id: 'ch1', title: '第一章', content: '章节内容' }],
      scenes: [
        {
          chapterId: 'ch1',
          title: '场景一',
          description: '场景描述',
        },
        {
          chapterId: 'ch1',
          title: '场景二',
          description: '场景二描述',
        },
      ],
      npcs: [{ name: 'NPC 1', description: '描述' }],
      encounters: [
        { name: '遇敌 1', description: '描述', enemies: ['哥布林'] },
      ],
    };
    return {
      buffer: Buffer.from(JSON.stringify(data), 'utf-8'),
      originalname: 'story.json',
    };
  }

  describe('uploadStory - 上传 Markdown 故事', () => {
    it('DM 应能上传 Markdown 故事', () => {
      const file = buildMdFile();
      const story = service.uploadStory(roomId, dmId, file, 'md');

      expect(story.id.startsWith('story_')).toBe(true);
      expect(story.roomId).toBe(roomId);
      expect(story.format).toBe('md');
      expect(story.title).toBe('story');
      expect(story.chapters).toHaveLength(2);
      expect(story.chapters[0].title).toBe('第一章 开始');
      expect(story.currentChapter).toBe(0);
      expect(story.assets).toContain('/uploads/map.png');
      expect(story.createdAt).toBeGreaterThan(0);
      expect(story.updatedAt).toBeGreaterThan(0);
    });

    it('玩家不能上传故事，应抛 403', () => {
      const file = buildMdFile();
      try {
        service.uploadStory(roomId, playerId, file, 'md');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });

    it('缺少文件应抛 400', () => {
      try {
        service.uploadStory(roomId, dmId, {
          buffer: Buffer.alloc(0),
          originalname: 'empty.md',
        }, 'md');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });

    it('上传新故事应删除旧故事', () => {
      const file1 = buildMdFile();
      const story1 = service.uploadStory(roomId, dmId, file1, 'md');

      const file2 = {
        buffer: Buffer.from('## 新章节\n新内容', 'utf-8'),
        originalname: 'new.md',
      };
      const story2 = service.uploadStory(roomId, dmId, file2, 'md');

      expect(story2.id).not.toBe(story1.id);
      expect(storyRepository.findById(story1.id)).toBeNull();
      expect(storyRepository.findByRoom(roomId)?.id).toBe(story2.id);
    });

    it('上传后应更新房间 storyId', () => {
      const file = buildMdFile();
      const story = service.uploadStory(roomId, dmId, file, 'md');
      const room = roomRepository.findById(roomId);
      expect(room?.storyId).toBe(story.id);
    });
  });

  describe('uploadStory - 上传 JSON 故事', () => {
    it('DM 应能上传 JSON 故事', () => {
      const file = buildJsonFile();
      const story = service.uploadStory(roomId, dmId, file, 'json');

      expect(story.format).toBe('json');
      expect(story.chapters).toHaveLength(1);
      expect(story.scenes).toHaveLength(2);
      expect(story.npcs).toHaveLength(1);
      expect(story.encounters).toHaveLength(1);
      expect(story.currentScene).toBe(story.scenes[0].id);
    });

    it('非法 JSON 应抛 400', () => {
      const file = {
        buffer: Buffer.from('{ invalid json', 'utf-8'),
        originalname: 'bad.json',
      };
      try {
        service.uploadStory(roomId, dmId, file, 'json');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });

    it('JSON 结构非法应抛 400', () => {
      const file = {
        buffer: Buffer.from(
          JSON.stringify({ chapters: '不是数组' }),
          'utf-8',
        ),
        originalname: 'bad.json',
      };
      try {
        service.uploadStory(roomId, dmId, file, 'json');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });
  });

  describe('getStory - 获取故事', () => {
    it('应返回房间故事', () => {
      const file = buildMdFile();
      const uploaded = service.uploadStory(roomId, dmId, file, 'md');
      const story = service.getStory(roomId);
      expect(story).not.toBeNull();
      expect(story?.id).toBe(uploaded.id);
    });

    it('无故事时应返回 null', () => {
      const story = service.getStory(roomId);
      expect(story).toBeNull();
    });

    it('房间不存在应抛 404', () => {
      try {
        service.getStory('not-exist');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(404);
      }
    });
  });

  describe('advanceChapter - 推进章节', () => {
    it('DM 应能推进到下一章', () => {
      const file = buildMdFile();
      service.uploadStory(roomId, dmId, file, 'md');

      const story = service.advanceChapter(roomId, dmId);
      expect(story.currentChapter).toBe(1);
    });

    it('DM 应能跳转到指定章节', () => {
      const file = buildMdFile();
      service.uploadStory(roomId, dmId, file, 'md');

      const story = service.advanceChapter(roomId, dmId, 1);
      expect(story.currentChapter).toBe(1);
    });

    it('已是最后一章时推进应抛 400', () => {
      const file = buildMdFile();
      service.uploadStory(roomId, dmId, file, 'md');
      // 推进到最后一章
      service.advanceChapter(roomId, dmId, 1);

      try {
        service.advanceChapter(roomId, dmId);
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });

    it('章节索引越界应抛 400', () => {
      const file = buildMdFile();
      service.uploadStory(roomId, dmId, file, 'md');

      try {
        service.advanceChapter(roomId, dmId, 99);
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });

    it('玩家不能推进章节，应抛 403', () => {
      const file = buildMdFile();
      service.uploadStory(roomId, dmId, file, 'md');

      try {
        service.advanceChapter(roomId, playerId);
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });

    it('故事不存在应抛 404', () => {
      try {
        service.advanceChapter(roomId, dmId);
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(404);
      }
    });

    it('JSON 格式故事推进章节应抛 400', () => {
      const file = buildJsonFile();
      service.uploadStory(roomId, dmId, file, 'json');

      try {
        service.advanceChapter(roomId, dmId);
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });
  });

  describe('advanceScene - 跳转场景', () => {
    it('DM 应能跳转到指定场景', () => {
      const file = buildJsonFile();
      service.uploadStory(roomId, dmId, file, 'json');

      const story = service.getStory(roomId);
      const targetSceneId = story!.scenes[1].id;

      const updated = service.advanceScene(roomId, dmId, targetSceneId);
      expect(updated.currentScene).toBe(targetSceneId);
    });

    it('场景不存在应抛 404', () => {
      const file = buildJsonFile();
      service.uploadStory(roomId, dmId, file, 'json');

      try {
        service.advanceScene(roomId, dmId, 'not-exist');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(404);
      }
    });

    it('玩家不能跳转场景，应抛 403', () => {
      const file = buildJsonFile();
      service.uploadStory(roomId, dmId, file, 'json');

      const story = service.getStory(roomId);
      const targetSceneId = story!.scenes[1].id;

      try {
        service.advanceScene(roomId, playerId, targetSceneId);
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });

    it('Markdown 格式故事跳转场景应抛 400', () => {
      const file = buildMdFile();
      service.uploadStory(roomId, dmId, file, 'md');

      try {
        service.advanceScene(roomId, dmId, 'any-scene');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });
  });

  describe('triggerEvent - 触发事件', () => {
    it('DM 应能触发故事事件', () => {
      const event: StoryEventPayload = {
        type: 'npc',
        data: { npcId: 'npc-1', action: '出现' },
      };
      const result = service.triggerEvent(roomId, dmId, event);
      expect(result).toEqual(event);
    });

    it('应支持所有事件类型', () => {
      const types: StoryEventPayload['type'][] = [
        'chapter',
        'scene',
        'npc',
        'encounter',
        'choice',
      ];
      for (const type of types) {
        const event: StoryEventPayload = { type, data: {} };
        const result = service.triggerEvent(roomId, dmId, event);
        expect(result.type).toBe(type);
      }
    });

    it('无效事件类型应抛 400', () => {
      try {
        service.triggerEvent(roomId, dmId, {
          type: 'invalid' as StoryEventPayload['type'],
          data: {},
        });
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });

    it('玩家不能触发事件，应抛 403', () => {
      try {
        service.triggerEvent(roomId, playerId, {
          type: 'npc',
          data: {},
        });
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });
  });

  describe('deleteStory - 删除故事', () => {
    it('DM 应能删除故事', () => {
      const file = buildMdFile();
      service.uploadStory(roomId, dmId, file, 'md');

      service.deleteStory(roomId, dmId);

      expect(storyRepository.findByRoom(roomId)).toBeNull();
      const room = roomRepository.findById(roomId);
      expect(room?.storyId).toBeNull();
    });

    it('玩家不能删除故事，应抛 403', () => {
      const file = buildMdFile();
      service.uploadStory(roomId, dmId, file, 'md');

      try {
        service.deleteStory(roomId, playerId);
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(403);
      }
    });

    it('故事不存在应抛 404', () => {
      try {
        service.deleteStory(roomId, dmId);
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(404);
      }
    });
  });

  describe('完整流程', () => {
    it('上传 -> 获取 -> 推进 -> 删除 完整流程', () => {
      // 1. 上传
      const file = buildMdFile();
      const uploaded = service.uploadStory(roomId, dmId, file, 'md');
      expect(uploaded.chapters).toHaveLength(2);

      // 2. 获取
      const story = service.getStory(roomId);
      expect(story?.id).toBe(uploaded.id);

      // 3. 推进章节
      const advanced = service.advanceChapter(roomId, dmId);
      expect(advanced.currentChapter).toBe(1);

      // 4. 删除
      service.deleteStory(roomId, dmId);
      expect(service.getStory(roomId)).toBeNull();
    });
  });
});
