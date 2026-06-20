import { describe, it, expect } from 'vitest';
import { MarkdownStoryParser } from '../../src/services/MarkdownStoryParser.js';

describe('MarkdownStoryParser', () => {
  const parser = new MarkdownStoryParser();

  describe('parse - 多章节解析', () => {
    it('应正确解析多章节 Markdown', () => {
      const content = [
        '## 第一章 开始',
        '',
        '冒险开始了。',
        '',
        '## 第二章 高潮',
        '',
        '英雄登场。',
        '',
        '## 第三章 结局',
        '',
        '故事结束。',
      ].join('\n');

      const result = parser.parse(content, '测试故事');

      expect(result.format).toBe('md');
      expect(result.title).toBe('测试故事');
      expect(result.chapters).toHaveLength(3);

      expect(result.chapters[0].title).toBe('第一章 开始');
      expect(result.chapters[0].content).toContain('冒险开始了');
      expect(result.chapters[0].order).toBe(0);
      expect(result.chapters[0].id.startsWith('chapter_')).toBe(true);

      expect(result.chapters[1].title).toBe('第二章 高潮');
      expect(result.chapters[1].content).toContain('英雄登场');
      expect(result.chapters[1].order).toBe(1);

      expect(result.chapters[2].title).toBe('第三章 结局');
      expect(result.chapters[2].content).toContain('故事结束');
      expect(result.chapters[2].order).toBe(2);
    });

    it('应设置 currentChapter = 0', () => {
      const content = '## 章节一\n内容';
      const result = parser.parse(content, '故事');
      expect(result.currentChapter).toBe(0);
    });

    it('应设置 currentScene = null', () => {
      const content = '## 章节一\n内容';
      const result = parser.parse(content, '故事');
      expect(result.currentScene).toBeNull();
    });

    it('应初始化空 scenes / npcs / encounters', () => {
      const content = '## 章节一\n内容';
      const result = parser.parse(content, '故事');
      expect(result.scenes).toEqual([]);
      expect(result.npcs).toEqual([]);
      expect(result.encounters).toEqual([]);
    });

    it('章节内容应包含标题到下一个 ## 之间的文本', () => {
      const content = '## 第一章\n第一段\n\n第二段\n## 第二章\n第二章节内容';
      const result = parser.parse(content, '故事');
      expect(result.chapters[0].content).toBe('第一段\n\n第二段');
      expect(result.chapters[1].content).toBe('第二章节内容');
    });
  });

  describe('parse - 图片引用提取', () => {
    it('应提取图片引用到 assets', () => {
      const content = [
        '## 第一章',
        '',
        '![地图](/uploads/map.png)',
        '',
        '![角色](/uploads/char.jpg)',
        '',
        '正文内容',
      ].join('\n');

      const result = parser.parse(content, '故事');
      expect(result.assets).toHaveLength(2);
      expect(result.assets).toContain('/uploads/map.png');
      expect(result.assets).toContain('/uploads/char.jpg');
    });

    it('应去重相同的图片 URL', () => {
      const content = [
        '## 第一章',
        '',
        '![图1](/uploads/img.png)',
        '',
        '![图2](/uploads/img.png)',
      ].join('\n');

      const result = parser.parse(content, '故事');
      expect(result.assets).toHaveLength(1);
      expect(result.assets).toEqual(['/uploads/img.png']);
    });

    it('无图片时 assets 应为空数组', () => {
      const content = '## 第一章\n纯文本内容';
      const result = parser.parse(content, '故事');
      expect(result.assets).toEqual([]);
    });
  });

  describe('parse - 空内容处理', () => {
    it('空字符串应返回空章节数组', () => {
      const result = parser.parse('', '空故事');
      expect(result.chapters).toEqual([]);
      expect(result.assets).toEqual([]);
    });

    it('仅含空白字符应返回空章节数组', () => {
      const result = parser.parse('   \n\n  ', '空故事');
      expect(result.chapters).toEqual([]);
    });
  });

  describe('parse - 无章节标题处理', () => {
    it('无二级标题的内容应返回空章节数组', () => {
      const content = '这是一段没有章节标题的文本。\n\n# 一级标题不算\n\n更多内容。';
      const result = parser.parse(content, '无章节故事');
      expect(result.chapters).toEqual([]);
    });

    it('一级标题不应被识别为章节边界', () => {
      const content = '# 一级标题\n\n## 二级标题\n\n内容';
      const result = parser.parse(content, '故事');
      expect(result.chapters).toHaveLength(1);
      expect(result.chapters[0].title).toBe('二级标题');
    });

    it('## 后无空格不应被识别为章节', () => {
      const content = '##无空格标题\n\n内容';
      const result = parser.parse(content, '故事');
      expect(result.chapters).toEqual([]);
    });

    it('### 三级标题不应被识别为章节', () => {
      const content = '### 三级标题\n\n## 二级标题\n\n内容';
      const result = parser.parse(content, '故事');
      expect(result.chapters).toHaveLength(1);
      expect(result.chapters[0].title).toBe('二级标题');
    });
  });

  describe('parse - 章节内容 trim', () => {
    it('章节内容应去除首尾空白', () => {
      const content = '## 第一章\n\n\n  内容文本  \n\n';
      const result = parser.parse(content, '故事');
      expect(result.chapters[0].content).toBe('内容文本');
    });
  });
});
