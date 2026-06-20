import { describe, it, expect } from 'vitest';
import { JsonStoryParser } from '../../src/services/JsonStoryParser.js';
import { AppError } from '../../src/middleware/errorHandler.js';

describe('JsonStoryParser', () => {
  const parser = new JsonStoryParser();

  describe('parse - 合法 JSON', () => {
    it('应正确解析完整的 JSON 故事', () => {
      const data = {
        chapters: [
          { id: 'ch1', title: '第一章', content: '章节内容一' },
          { id: 'ch2', title: '第二章', content: '章节内容二' },
        ],
        scenes: [
          {
            chapterId: 'ch1',
            title: '场景一',
            description: '场景描述',
            npcIds: ['npc-1'],
            choices: [
              { text: '选项 A', targetSceneId: 'scene-2', action: '前进' },
              { text: '选项 B' },
            ],
          },
        ],
        npcs: [
          { name: 'NPC 1', description: '描述', portraitUrl: '/img.png' },
        ],
        encounters: [
          {
            name: '遇敌 1',
            description: '遇敌描述',
            enemies: ['哥布林', '兽人'],
            difficulty: '困难',
          },
        ],
        assets: ['/img/1.png', '/img/2.png'],
      };

      const result = parser.parse(data, '测试故事');

      expect(result.format).toBe('json');
      expect(result.title).toBe('测试故事');

      // 章节校验
      expect(result.chapters).toHaveLength(2);
      expect(result.chapters[0].title).toBe('第一章');
      expect(result.chapters[0].content).toBe('章节内容一');
      expect(result.chapters[0].id).toBe('ch1');

      // 场景校验
      expect(result.scenes).toHaveLength(1);
      expect(result.scenes[0].title).toBe('场景一');
      expect(result.scenes[0].description).toBe('场景描述');
      expect(result.scenes[0].chapterId).toBe('ch1');
      expect(result.scenes[0].id.startsWith('scene_')).toBe(true);
      expect(result.scenes[0].npcIds).toEqual(['npc-1']);
      expect(result.scenes[0].choices).toHaveLength(2);
      expect(result.scenes[0].choices?.[0].text).toBe('选项 A');
      expect(result.scenes[0].choices?.[0].targetSceneId).toBe('scene-2');
      expect(result.scenes[0].choices?.[0].action).toBe('前进');
      expect(result.scenes[0].choices?.[0].id.startsWith('choice_')).toBe(true);

      // NPC 校验
      expect(result.npcs).toHaveLength(1);
      expect(result.npcs[0].name).toBe('NPC 1');
      expect(result.npcs[0].description).toBe('描述');
      expect(result.npcs[0].portraitUrl).toBe('/img.png');
      expect(result.npcs[0].id.startsWith('npc_')).toBe(true);

      // 遇敌校验
      expect(result.encounters).toHaveLength(1);
      expect(result.encounters[0].name).toBe('遇敌 1');
      expect(result.encounters[0].enemies).toEqual(['哥布林', '兽人']);
      expect(result.encounters[0].difficulty).toBe('困难');
      expect(result.encounters[0].id.startsWith('encounter_')).toBe(true);

      // 素材校验
      expect(result.assets).toEqual(['/img/1.png', '/img/2.png']);

      // 状态校验
      expect(result.currentChapter).toBe(0);
      expect(result.currentScene).toBe(result.scenes[0].id);
    });

    it('currentScene 应为第一个场景的 ID', () => {
      const data = {
        chapters: [{ id: 'ch1', title: '章节', content: '内容' }],
        scenes: [
          { chapterId: 'ch1', title: '场景一', description: '描述一' },
          { chapterId: 'ch1', title: '场景二', description: '描述二' },
        ],
      };
      const result = parser.parse(data, '故事');
      expect(result.currentScene).toBe(result.scenes[0].id);
    });

    it('无场景时 currentScene 应为 null', () => {
      const data = {
        chapters: [{ id: 'ch1', title: '章节', content: '内容' }],
      };
      const result = parser.parse(data, '故事');
      expect(result.currentScene).toBeNull();
    });

    it('缺少可选字段应使用默认值', () => {
      const data = {
        chapters: [{ id: 'ch1', title: '章节', content: '内容' }],
        npcs: [{ name: 'NPC' }],
        encounters: [{ name: '遇敌' }],
      };
      const result = parser.parse(data, '故事');
      expect(result.npcs[0].description).toBe('');
      expect(result.encounters[0].description).toBe('');
      expect(result.encounters[0].enemies).toEqual([]);
    });

    it('空对象应返回空数组字段', () => {
      const result = parser.parse({}, '空故事');
      expect(result.chapters).toEqual([]);
      expect(result.scenes).toEqual([]);
      expect(result.npcs).toEqual([]);
      expect(result.encounters).toEqual([]);
      expect(result.assets).toEqual([]);
      expect(result.currentScene).toBeNull();
    });

    it('章节 order 字段缺失时应使用索引', () => {
      const data = {
        chapters: [
          { id: 'ch1', title: '一', content: '内容一' },
          { id: 'ch2', title: '二', content: '内容二' },
        ],
      };
      const result = parser.parse(data, '故事');
      expect(result.chapters[0].order).toBe(0);
      expect(result.chapters[1].order).toBe(1);
    });

    it('章节未提供 id 时应生成新 ID', () => {
      const data = {
        chapters: [{ title: '章节', content: '内容' }],
      };
      const result = parser.parse(data, '故事');
      expect(result.chapters[0].id.startsWith('chapter_')).toBe(true);
    });
  });

  describe('parse - 非法结构校验', () => {
    it('非对象数据应抛 400', () => {
      try {
        parser.parse('字符串', '故事');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });

    it('数组数据应抛 400', () => {
      try {
        parser.parse([1, 2, 3], '故事');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });

    it('null 数据应抛 400', () => {
      try {
        parser.parse(null, '故事');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });

    it('chapters 非数组应抛 400', () => {
      try {
        parser.parse({ chapters: '不是数组' }, '故事');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });

    it('scenes 非数组应抛 400', () => {
      try {
        parser.parse({ scenes: '不是数组' }, '故事');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });

    it('npcs 非数组应抛 400', () => {
      try {
        parser.parse({ npcs: '不是数组' }, '故事');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });

    it('encounters 非数组应抛 400', () => {
      try {
        parser.parse({ encounters: '不是数组' }, '故事');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });

    it('assets 非数组应抛 400', () => {
      try {
        parser.parse({ assets: '不是数组' }, '故事');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });

    it('场景引用不存在的 chapterId 应抛 400', () => {
      const data = {
        chapters: [{ title: '章节', content: '内容' }],
        scenes: [
          { chapterId: '不存在的ID', title: '场景', description: '描述' },
        ],
      };
      try {
        parser.parse(data, '故事');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
        expect((err as AppError).message).toContain('不存在');
      }
    });
  });

  describe('parse - 缺失字段处理', () => {
    it('章节缺少 title 应抛 400', () => {
      try {
        parser.parse({ chapters: [{ content: '内容' }] }, '故事');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
        expect((err as AppError).message).toContain('title');
      }
    });

    it('章节 title 为空字符串应抛 400', () => {
      try {
        parser.parse({ chapters: [{ title: '', content: '内容' }] }, '故事');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
      }
    });

    it('章节缺少 content 应抛 400', () => {
      try {
        parser.parse({ chapters: [{ title: '标题' }] }, '故事');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
        expect((err as AppError).message).toContain('content');
      }
    });

    it('场景缺少 chapterId 应抛 400', () => {
      try {
        parser.parse(
          { scenes: [{ title: '场景', description: '描述' }] },
          '故事',
        );
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
        expect((err as AppError).message).toContain('chapterId');
      }
    });

    it('场景缺少 title 应抛 400', () => {
      try {
        parser.parse(
          { scenes: [{ chapterId: 'x', description: '描述' }] },
          '故事',
        );
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
        expect((err as AppError).message).toContain('title');
      }
    });

    it('场景缺少 description 应抛 400', () => {
      try {
        parser.parse(
          { scenes: [{ chapterId: 'x', title: '场景' }] },
          '故事',
        );
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
        expect((err as AppError).message).toContain('description');
      }
    });

    it('NPC 缺少 name 应抛 400', () => {
      try {
        parser.parse({ npcs: [{ description: '描述' }] }, '故事');
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
        expect((err as AppError).message).toContain('name');
      }
    });

    it('遇敌缺少 name 应抛 400', () => {
      try {
        parser.parse(
          { encounters: [{ description: '描述' }] },
          '故事',
        );
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
        expect((err as AppError).message).toContain('name');
      }
    });

    it('选择缺少 text 应抛 400', () => {
      try {
        parser.parse(
          {
            chapters: [{ id: 'ch1', title: '章节', content: '内容' }],
            scenes: [
              {
                chapterId: 'ch1',
                title: '场景',
                description: '描述',
                choices: [{ action: '动作' }],
              },
            ],
          },
          '故事',
        );
        expect.fail('应抛出错误');
      } catch (err) {
        expect((err as AppError).statusCode).toBe(400);
        expect((err as AppError).message).toContain('text');
      }
    });
  });
});
