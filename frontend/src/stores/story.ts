// 故事书状态管理（对接后端 REST + Socket 契约）

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { storiesApi } from '@/api/stories'
import { useSocket } from '@/composables/useSocket'
import { useLogStore } from '@/stores/log'
import type { Story, StoryChapter, StoryFormat, StoryScene } from '@/types/models'
import type { SocketAck, StoryEventPayload } from '@/types/socket'

export const useStoryStore = defineStore('story', () => {
  const logStore = useLogStore()

  // ===== 状态 =====
  /** 当前故事书 */
  const story = ref<Story | null>(null)
  /** 加载状态 */
  const isLoading = ref(false)
  /** 上传进度（0-100） */
  const uploadProgress = ref(0)
  /** 是否正在上传 */
  const isUploading = ref(false)
  /** 错误信息 */
  const error = ref<string | null>(null)
  /** 最近收到的事件（用于触发阅读器动画 / 选择反馈） */
  const lastEvent = ref<StoryEventPayload | null>(null)

  /** Socket 事件清理函数集合 */
  let socketCleanups: Array<() => void> = []

  // ===== Getters =====
  /** 是否有故事 */
  const hasStory = computed(() => story.value !== null)
  /** 是否为 JSON 格式 */
  const isJsonFormat = computed(() => story.value?.format === 'json')
  /** 是否为 Markdown 格式 */
  const isMdFormat = computed(() => story.value?.format === 'md')
  /** 章节列表 */
  const chapters = computed<StoryChapter[]>(() => story.value?.chapters ?? [])
  /** 场景列表 */
  const scenes = computed<StoryScene[]>(() => story.value?.scenes ?? [])
  /** 当前章节 */
  const currentChapter = computed<StoryChapter | null>(() => {
    if (!story.value) return null
    const idx = story.value.currentChapter
    if (idx < 0 || idx >= chapters.value.length) return null
    return chapters.value[idx] ?? null
  })
  /** 当前场景 */
  const currentScene = computed<StoryScene | null>(() => {
    if (!story.value || !story.value.currentScene) return null
    return scenes.value.find((s) => s.id === story.value!.currentScene) ?? null
  })
  /** 当前章节索引（1 基，用于展示） */
  const currentChapterIndex = computed(() => {
    if (!story.value) return 0
    return story.value.currentChapter + 1
  })
  /** 章节总数 */
  const chapterCount = computed(() => chapters.value.length)

  // ===== Actions =====
  /** 拉取房间故事 */
  async function fetchStory(roomCode: string) {
    isLoading.value = true
    error.value = null
    try {
      const data = await storiesApi.get(roomCode)
      story.value = data
    } catch (e) {
      error.value = (e as Error).message || '获取故事失败'
      logStore.addLog('system', `获取故事失败：${error.value}`)
    } finally {
      isLoading.value = false
    }
  }

  /** 上传故事书 */
  async function uploadStory(
    roomCode: string,
    playerId: string,
    file: File,
    format: StoryFormat,
  ): Promise<Story | null> {
    isUploading.value = true
    uploadProgress.value = 0
    error.value = null
    try {
      const data = await storiesApi.upload(roomCode, playerId, file, format, (p) => {
        uploadProgress.value = p
      })
      story.value = data
      logStore.addLog('story', `已上传故事书「${data.title}」`)
      return data
    } catch (e) {
      error.value = (e as Error).message || '上传故事书失败'
      logStore.addLog('system', `上传故事书失败：${error.value}`)
      return null
    } finally {
      isUploading.value = false
      setTimeout(() => {
        uploadProgress.value = 0
      }, 500)
    }
  }

  /** 删除故事书 */
  async function deleteStory(roomCode: string, playerId: string): Promise<boolean> {
    isLoading.value = true
    error.value = null
    try {
      await storiesApi.delete(roomCode, playerId)
      story.value = null
      logStore.addLog('story', '故事书已删除')
      return true
    } catch (e) {
      error.value = (e as Error).message || '删除故事书失败'
      logStore.addLog('system', `删除故事书失败：${error.value}`)
      return false
    } finally {
      isLoading.value = false
    }
  }

  /** DM 推进章节（无参数则下一章） */
  function advanceChapter(targetChapter?: number) {
    error.value = null
    const { emit } = useSocket()
    emit('story:advance', { targetChapter }, (res: SocketAck<Story | null>) => {
      if (!res.ok) {
        error.value = res.error ?? '推进章节失败'
        logStore.addLog('system', `推进章节失败：${error.value}`)
      }
    })
  }

  /** DM 上一章 */
  function prevChapter() {
    if (!story.value) return
    const target = Math.max(0, story.value.currentChapter - 1)
    advanceChapter(target)
  }

  /** DM 下一章 */
  function nextChapter() {
    if (!story.value) return
    const target = Math.min(chapters.value.length - 1, story.value.currentChapter + 1)
    advanceChapter(target)
  }

  /** DM 推进场景 */
  function advanceScene(targetScene: string) {
    error.value = null
    const { emit } = useSocket()
    emit('story:advance', { targetScene }, (res: SocketAck<Story | null>) => {
      if (!res.ok) {
        error.value = res.error ?? '推进场景失败'
        logStore.addLog('system', `推进场景失败：${error.value}`)
      }
    })
  }

  /** DM 触发故事事件（NPC、遇敌、选择等） */
  function triggerEvent(event: StoryEventPayload) {
    error.value = null
    const { emit } = useSocket()
    emit('story:event', event, (res: SocketAck<StoryEventPayload>) => {
      if (!res.ok) {
        error.value = res.error ?? '触发事件失败'
        logStore.addLog('system', `触发故事事件失败：${error.value}`)
      }
    })
  }

  /** 通过 Socket 拉取故事状态（连接后调用） */
  function fetchStoryState(): Promise<void> {
    return new Promise((resolve) => {
      const { emit } = useSocket()
      emit('story:getState', (res: SocketAck<Story | null>) => {
        if (res.ok) {
          story.value = res.data ?? null
        }
        resolve()
      })
    })
  }

  // ===== Socket 事件处理 =====
  /** 处理故事状态同步 */
  function handleStoryState(payload: { story: Story | null }) {
    story.value = payload.story
  }

  /** 处理故事事件 */
  function handleStoryEvent(payload: StoryEventPayload) {
    lastEvent.value = payload
    const labels: Record<StoryEventPayload['type'], string> = {
      chapter: '章节事件',
      scene: '场景事件',
      npc: 'NPC 事件',
      encounter: '遇敌事件',
      choice: '选择事件',
    }
    logStore.addLog('story', `${labels[payload.type]}触发`)
  }

  /** 订阅 Socket 故事事件 */
  function connectSocket() {
    disconnectSocket()
    const { on } = useSocket()

    socketCleanups.push(
      on('story:state', (payload) => {
        handleStoryState(payload)
      }),
    )
    socketCleanups.push(
      on('story:event', (payload) => {
        handleStoryEvent(payload)
      }),
    )
  }

  /** 取消 Socket 事件订阅 */
  function disconnectSocket() {
    socketCleanups.forEach((fn) => fn())
    socketCleanups = []
  }

  /** 重置所有状态 */
  function reset() {
    disconnectSocket()
    story.value = null
    isLoading.value = false
    isUploading.value = false
    uploadProgress.value = 0
    error.value = null
    lastEvent.value = null
  }

  return {
    // 状态
    story,
    isLoading,
    isUploading,
    uploadProgress,
    error,
    lastEvent,
    // Getters
    hasStory,
    isJsonFormat,
    isMdFormat,
    chapters,
    scenes,
    currentChapter,
    currentScene,
    currentChapterIndex,
    chapterCount,
    // Actions
    fetchStory,
    uploadStory,
    deleteStory,
    advanceChapter,
    prevChapter,
    nextChapter,
    advanceScene,
    triggerEvent,
    fetchStoryState,
    // Socket
    connectSocket,
    disconnectSocket,
    handleStoryState,
    handleStoryEvent,
    reset,
  }
})
