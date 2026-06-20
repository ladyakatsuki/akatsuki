import { generateId } from '../utils/id.js';
import type { Story, StoryChapter } from '../types/models.js';

/** Markdown 故事解析结果（不含 id / roomId / createdAt / updatedAt） */
export type ParsedStory = Omit<Story, 'id' | 'roomId' | 'createdAt' | 'updatedAt'>;

/** 匹配 Markdown 图片引用 ![alt](url) */
const IMAGE_REGEX = /!\[[^\]]*\]\(([^)]+)\)/g;

/**
 * Markdown 故事书解析器
 *
 * 解析规则：
 * - 按 `## ` 分章节（二级标题为章节边界）
 * - 章节标题为 `## ` 后的文本
 * - 章节内容为该标题到下一个 `## ` 之间的文本
 * - 提取图片引用 `![alt](url)`，记录到 assets
 * - 生成章节 ID（基于顺序）
 * - 设置 currentChapter = 0
 */
export class MarkdownStoryParser {
  /**
   * 解析 Markdown 内容为故事书结构
   * @param content Markdown 文本
   * @param title 故事标题
   * @returns 解析后的故事数据（不含 id / roomId / createdAt / updatedAt）
   */
  parse(content: string, title: string): ParsedStory {
    const chapters = this.parseChapters(content);
    const assets = this.extractAssets(content);

    return {
      format: 'md',
      title,
      chapters,
      scenes: [],
      npcs: [],
      encounters: [],
      currentChapter: 0,
      currentScene: null,
      assets,
    };
  }

  /**
   * 将 Markdown 内容按 `## ` 分章节
   */
  private parseChapters(content: string): StoryChapter[] {
    const chapters: StoryChapter[] = [];
    const lines = content.split(/\r?\n/);

    let currentTitle = '';
    let currentLines: string[] = [];
    let inChapter = false;
    let order = 0;

    /** 收集当前章节 */
    const flush = (): void => {
      if (!inChapter) {
        return;
      }
      const chapterContent = currentLines.join('\n').trim();
      chapters.push({
        id: generateId('chapter_'),
        title: currentTitle.trim(),
        content: chapterContent,
        order,
      });
      order++;
      currentLines = [];
    };

    for (const line of lines) {
      // 匹配二级标题（## 后必须有空格）
      const match = /^##\s+(.+)$/.exec(line);
      if (match) {
        // 遇到新章节，先收集上一章节
        flush();
        currentTitle = match[1];
        inChapter = true;
      } else if (inChapter) {
        currentLines.push(line);
      }
    }
    // 收集最后一个章节
    flush();

    return chapters;
  }

  /**
   * 提取 Markdown 中所有图片引用 URL
   * @param content Markdown 文本
   * @returns 去重后的图片 URL 列表
   */
  private extractAssets(content: string): string[] {
    const assets: string[] = [];
    const seen = new Set<string>();
    let match: RegExpExecArray | null;
    // 重置正则 lastIndex（全局正则需注意复用）
    IMAGE_REGEX.lastIndex = 0;
    while ((match = IMAGE_REGEX.exec(content)) !== null) {
      const url = match[1].trim();
      if (url && !seen.has(url)) {
        seen.add(url);
        assets.push(url);
      }
    }
    return assets;
  }
}

/** Markdown 故事解析器单例 */
export const markdownStoryParser = new MarkdownStoryParser();
