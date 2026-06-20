// UI 状态管理：主题、面板开关

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RuleSet } from '@/types/models'

export type ThemeKey = 'dnd' | 'coc'

export const useUiStore = defineStore('ui', () => {
  // 当前主题
  const theme = ref<ThemeKey>('dnd')
  // 侧边栏开关
  const sidebarOpen = ref(true)
  // 日志面板开关
  const logPanelOpen = ref(true)
  // 全局加载遮罩
  const globalLoading = ref(false)

  /** 设置主题（同步到 html data-theme） */
  function setTheme(key: ThemeKey) {
    theme.value = key
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', key)
    }
  }

  /** 根据规则集自动切换主题 */
  function syncThemeFromRuleSet(ruleSet: RuleSet) {
    setTheme(ruleSet === 'coc7' ? 'coc' : 'dnd')
  }

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  function toggleLogPanel() {
    logPanelOpen.value = !logPanelOpen.value
  }

  function setGlobalLoading(v: boolean) {
    globalLoading.value = v
  }

  return {
    theme,
    sidebarOpen,
    logPanelOpen,
    globalLoading,
    setTheme,
    syncThemeFromRuleSet,
    toggleSidebar,
    toggleLogPanel,
    setGlobalLoading,
  }
})
