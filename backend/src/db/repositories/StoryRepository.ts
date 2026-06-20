import { getDb } from '../index.js';
import { generateId } from '../../utils/id.js';
import type {
  Story,
  StoryChapter,
  StoryEncounter,
  StoryFormat,
  StoryNpc,
  StoryScene,
} from '../../types/models.js';

/** stories 表的原始行结构 */
interface StoryRow {
  id: string;
  room_id: string;
  format: string;
  title: string;
  chapters: string;
  scenes: string;
  npcs: string;
  encounters: string;
  current_chapter: number;
  current_scene: string | null;
  assets: string;
  created_at: number;
  updated_at: number;
}

/** 创建故事时的输入参数（不含 id / createdAt / updatedAt） */
export type CreateStoryInput = Omit<Story, 'id' | 'createdAt' | 'updatedAt'>;

/** 更新故事时可修改的字段 */
export type StoryUpdatePatch = Partial<
  Pick<
    Story,
    | 'format'
    | 'title'
    | 'chapters'
    | 'scenes'
    | 'npcs'
    | 'encounters'
    | 'currentChapter'
    | 'currentScene'
    | 'assets'
  >
>;

/**
 * 故事书数据访问层
 *
 * 每个房间最多一条故事记录。
 */
export class StoryRepository {
  /** 将数据库行解析为 Story 实体 */
  private parseRow(row: StoryRow): Story {
    return {
      id: row.id,
      roomId: row.room_id,
      format: row.format as StoryFormat,
      title: row.title,
      chapters: JSON.parse(row.chapters) as StoryChapter[],
      scenes: JSON.parse(row.scenes) as StoryScene[],
      npcs: JSON.parse(row.npcs) as StoryNpc[],
      encounters: JSON.parse(row.encounters) as StoryEncounter[],
      currentChapter: row.current_chapter,
      currentScene: row.current_scene,
      assets: JSON.parse(row.assets) as string[],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /** 按主键查询 */
  findById(id: string): Story | null {
    const row = getDb().prepare('SELECT * FROM stories WHERE id = ?').get(id) as
      | StoryRow
      | undefined;
    return row ? this.parseRow(row) : null;
  }

  /** 按房间 ID 查询故事（每房间最多一条） */
  findByRoom(roomId: string): Story | null {
    const row = getDb()
      .prepare('SELECT * FROM stories WHERE room_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(roomId) as StoryRow | undefined;
    return row ? this.parseRow(row) : null;
  }

  /**
   * 创建故事
   * @param story 故事数据（不含 id / createdAt / updatedAt）
   * @returns 新创建的故事
   */
  create(story: CreateStoryInput): Story {
    const now = Date.now();
    const entity: Story = {
      ...story,
      id: generateId('story_'),
      createdAt: now,
      updatedAt: now,
    };
    getDb()
      .prepare(
        `INSERT INTO stories (id, room_id, format, title, chapters, scenes, npcs, encounters, current_chapter, current_scene, assets, created_at, updated_at)
         VALUES (@id, @room_id, @format, @title, @chapters, @scenes, @npcs, @encounters, @current_chapter, @current_scene, @assets, @created_at, @updated_at)`,
      )
      .run({
        id: entity.id,
        room_id: entity.roomId,
        format: entity.format,
        title: entity.title,
        chapters: JSON.stringify(entity.chapters),
        scenes: JSON.stringify(entity.scenes),
        npcs: JSON.stringify(entity.npcs),
        encounters: JSON.stringify(entity.encounters),
        current_chapter: entity.currentChapter,
        current_scene: entity.currentScene,
        assets: JSON.stringify(entity.assets),
        created_at: entity.createdAt,
        updated_at: entity.updatedAt,
      });
    return entity;
  }

  /**
   * 更新故事
   * @param id 故事 ID
   * @param patch 需要更新的字段
   * @returns 更新后的故事，不存在则返回 null
   */
  update(id: string, patch: StoryUpdatePatch): Story | null {
    const sets: string[] = [];
    const params: Record<string, unknown> = { id };

    if (patch.format !== undefined) {
      sets.push('format = @format');
      params.format = patch.format;
    }
    if (patch.title !== undefined) {
      sets.push('title = @title');
      params.title = patch.title;
    }
    if (patch.chapters !== undefined) {
      sets.push('chapters = @chapters');
      params.chapters = JSON.stringify(patch.chapters);
    }
    if (patch.scenes !== undefined) {
      sets.push('scenes = @scenes');
      params.scenes = JSON.stringify(patch.scenes);
    }
    if (patch.npcs !== undefined) {
      sets.push('npcs = @npcs');
      params.npcs = JSON.stringify(patch.npcs);
    }
    if (patch.encounters !== undefined) {
      sets.push('encounters = @encounters');
      params.encounters = JSON.stringify(patch.encounters);
    }
    if (patch.currentChapter !== undefined) {
      sets.push('current_chapter = @current_chapter');
      params.current_chapter = patch.currentChapter;
    }
    if (patch.currentScene !== undefined) {
      sets.push('current_scene = @current_scene');
      params.current_scene = patch.currentScene;
    }
    if (patch.assets !== undefined) {
      sets.push('assets = @assets');
      params.assets = JSON.stringify(patch.assets);
    }

    if (sets.length === 0) {
      return this.findById(id);
    }

    sets.push('updated_at = @updated_at');
    params.updated_at = Date.now();

    getDb()
      .prepare(`UPDATE stories SET ${sets.join(', ')} WHERE id = @id`)
      .run(params);

    return this.findById(id);
  }

  /**
   * 删除故事
   * @param id 故事 ID
   * @returns 删除成功返回 true，不存在返回 false
   */
  delete(id: string): boolean {
    const result = getDb().prepare('DELETE FROM stories WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * 按房间删除故事
   * @param roomId 房间 ID
   * @returns 删除成功返回 true，不存在返回 false
   */
  deleteByRoom(roomId: string): boolean {
    const result = getDb()
      .prepare('DELETE FROM stories WHERE room_id = ?')
      .run(roomId);
    return result.changes > 0;
  }
}

/** 故事仓库单例 */
export const storyRepository = new StoryRepository();
