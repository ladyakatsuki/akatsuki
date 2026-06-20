import { generateId } from '../utils/id.js';
import { AppError } from '../middleware/errorHandler.js';
import type {
  Story,
  StoryChapter,
  StoryChoice,
  StoryEncounter,
  StoryNpc,
  StoryScene,
} from '../types/models.js';

/** JSON 故事解析结果（不含 id / roomId / createdAt / updatedAt） */
export type ParsedStory = Omit<Story, 'id' | 'roomId' | 'createdAt' | 'updatedAt'>;

/** JSON 故事书原始结构（解析前） */
interface RawStoryData {
  chapters?: unknown;
  scenes?: unknown;
  npcs?: unknown;
  encounters?: unknown;
  assets?: unknown;
}

/** 原始章节结构 */
interface RawChapter {
  id?: unknown;
  title?: unknown;
  content?: unknown;
  order?: unknown;
}

/** 原始场景结构 */
interface RawScene {
  chapterId?: unknown;
  title?: unknown;
  description?: unknown;
  npcIds?: unknown;
  encounterIds?: unknown;
  choices?: unknown;
}

/** 原始选择结构 */
interface RawChoice {
  text?: unknown;
  targetSceneId?: unknown;
  action?: unknown;
}

/** 原始 NPC 结构 */
interface RawNpc {
  name?: unknown;
  description?: unknown;
  portraitUrl?: unknown;
}

/** 原始遇敌结构 */
interface RawEncounter {
  name?: unknown;
  description?: unknown;
  enemies?: unknown;
  difficulty?: unknown;
}

/**
 * JSON 故事书解析器
 *
 * 解析规则：
 * - 校验 JSON 结构（chapters/scenes/npcs/encounters）
 * - chapters: 必须有 title 和 content
 * - scenes: 必须有 chapterId、title、description
 * - npcs: 必须有 name
 * - encounters: 必须有 name
 * - choices: 可选，必须有 text
 * - 生成 ID
 * - 设置 currentChapter = 0, currentScene = 第一个场景 ID
 */
export class JsonStoryParser {
  /**
   * 解析 JSON 数据为故事书结构
   * @param data 原始 JSON 数据
   * @param title 故事标题
   * @returns 解析后的故事数据（不含 id / roomId / createdAt / updatedAt）
   * @throws AppError 当 JSON 结构非法时
   */
  parse(data: unknown, title: string): ParsedStory {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new AppError(400, '故事 JSON 必须为对象');
    }

    const raw = data as RawStoryData;

    const chapters = this.parseChapters(raw.chapters);
    const scenes = this.parseScenes(raw.scenes);
    const npcs = this.parseNpcs(raw.npcs);
    const encounters = this.parseEncounters(raw.encounters);
    const assets = this.parseAssets(raw.assets);

    // 校验场景引用的 chapterId 存在
    const chapterIds = new Set(chapters.map((c) => c.id));
    for (const scene of scenes) {
      if (!chapterIds.has(scene.chapterId)) {
        throw new AppError(
          400,
          `场景 ${scene.title} 引用了不存在的章节 ID: ${scene.chapterId}`,
        );
      }
    }

    // currentScene 为第一个场景 ID（若存在）
    const currentScene = scenes.length > 0 ? scenes[0].id : null;

    return {
      format: 'json',
      title,
      chapters,
      scenes,
      npcs,
      encounters,
      currentChapter: 0,
      currentScene,
      assets,
    };
  }

  /** 解析章节列表 */
  private parseChapters(raw: unknown): StoryChapter[] {
    if (raw === undefined || raw === null) {
      return [];
    }
    if (!Array.isArray(raw)) {
      throw new AppError(400, 'chapters 必须为数组');
    }

    return raw.map((item, index) => {
      const chapter = item as RawChapter;
      if (typeof chapter.title !== 'string' || chapter.title.trim() === '') {
        throw new AppError(400, `第 ${index + 1} 个章节缺少 title`);
      }
      if (typeof chapter.content !== 'string') {
        throw new AppError(400, `第 ${index + 1} 个章节缺少 content`);
      }
      // 若提供了 id 则使用，否则生成新 ID
      const id =
        typeof chapter.id === 'string' && chapter.id.trim() !== ''
          ? chapter.id
          : generateId('chapter_');
      return {
        id,
        title: chapter.title,
        content: chapter.content,
        order: typeof chapter.order === 'number' ? chapter.order : index,
      };
    });
  }

  /** 解析场景列表 */
  private parseScenes(raw: unknown): StoryScene[] {
    if (raw === undefined || raw === null) {
      return [];
    }
    if (!Array.isArray(raw)) {
      throw new AppError(400, 'scenes 必须为数组');
    }

    return raw.map((item, index) => {
      const scene = item as RawScene;
      if (typeof scene.chapterId !== 'string' || scene.chapterId.trim() === '') {
        throw new AppError(400, `第 ${index + 1} 个场景缺少 chapterId`);
      }
      if (typeof scene.title !== 'string' || scene.title.trim() === '') {
        throw new AppError(400, `第 ${index + 1} 个场景缺少 title`);
      }
      if (typeof scene.description !== 'string') {
        throw new AppError(400, `第 ${index + 1} 个场景缺少 description`);
      }

      const parsed: StoryScene = {
        id: generateId('scene_'),
        chapterId: scene.chapterId,
        title: scene.title,
        description: scene.description,
      };

      if (Array.isArray(scene.npcIds)) {
        parsed.npcIds = scene.npcIds.filter(
          (id): id is string => typeof id === 'string',
        );
      }
      if (Array.isArray(scene.encounterIds)) {
        parsed.encounterIds = scene.encounterIds.filter(
          (id): id is string => typeof id === 'string',
        );
      }
      if (Array.isArray(scene.choices)) {
        parsed.choices = this.parseChoices(scene.choices, index);
      }

      return parsed;
    });
  }

  /** 解析选择分支列表 */
  private parseChoices(raw: unknown[], sceneIndex: number): StoryChoice[] {
    return raw.map((item, index) => {
      const choice = item as RawChoice;
      if (typeof choice.text !== 'string' || choice.text.trim() === '') {
        throw new AppError(
          400,
          `第 ${sceneIndex + 1} 个场景的第 ${index + 1} 个选择缺少 text`,
        );
      }
      const parsed: StoryChoice = {
        id: generateId('choice_'),
        text: choice.text,
      };
      if (typeof choice.targetSceneId === 'string') {
        parsed.targetSceneId = choice.targetSceneId;
      }
      if (typeof choice.action === 'string') {
        parsed.action = choice.action;
      }
      return parsed;
    });
  }

  /** 解析 NPC 列表 */
  private parseNpcs(raw: unknown): StoryNpc[] {
    if (raw === undefined || raw === null) {
      return [];
    }
    if (!Array.isArray(raw)) {
      throw new AppError(400, 'npcs 必须为数组');
    }

    return raw.map((item, index) => {
      const npc = item as RawNpc;
      if (typeof npc.name !== 'string' || npc.name.trim() === '') {
        throw new AppError(400, `第 ${index + 1} 个 NPC 缺少 name`);
      }
      const parsed: StoryNpc = {
        id: generateId('npc_'),
        name: npc.name,
        description: typeof npc.description === 'string' ? npc.description : '',
      };
      if (typeof npc.portraitUrl === 'string') {
        parsed.portraitUrl = npc.portraitUrl;
      }
      return parsed;
    });
  }

  /** 解析遇敌列表 */
  private parseEncounters(raw: unknown): StoryEncounter[] {
    if (raw === undefined || raw === null) {
      return [];
    }
    if (!Array.isArray(raw)) {
      throw new AppError(400, 'encounters 必须为数组');
    }

    return raw.map((item, index) => {
      const encounter = item as RawEncounter;
      if (typeof encounter.name !== 'string' || encounter.name.trim() === '') {
        throw new AppError(400, `第 ${index + 1} 个遇敌缺少 name`);
      }
      const parsed: StoryEncounter = {
        id: generateId('encounter_'),
        name: encounter.name,
        description:
          typeof encounter.description === 'string' ? encounter.description : '',
        enemies: Array.isArray(encounter.enemies)
          ? encounter.enemies.filter(
              (e): e is string => typeof e === 'string',
            )
          : [],
      };
      if (typeof encounter.difficulty === 'string') {
        parsed.difficulty = encounter.difficulty;
      }
      return parsed;
    });
  }

  /** 解析素材 URL 列表 */
  private parseAssets(raw: unknown): string[] {
    if (raw === undefined || raw === null) {
      return [];
    }
    if (!Array.isArray(raw)) {
      throw new AppError(400, 'assets 必须为数组');
    }
    return raw.filter((item): item is string => typeof item === 'string');
  }
}

/** JSON 故事解析器单例 */
export const jsonStoryParser = new JsonStoryParser();
