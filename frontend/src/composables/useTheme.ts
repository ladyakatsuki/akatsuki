// 主题切换组合式函数

import { useLocalStorage, useToggle } from '@vueuse/core'
import { computed } from 'vue'
import { useUiStore, type ThemeKey } from '@/stores/ui'

export function useTheme() {
  const uiStore = useUiStore()
  // 持久化主题选择
  const stored = useLocalStorage<ThemeKey>('trpg_theme', 'dnd')

  const theme = computed<ThemeKey>({
    get: () => uiStore.theme,
    set: (val) => {
      uiStore.setTheme(val)
      stored.value = val
    },
  })

  const isCoc = computed(() => theme.value === 'coc')
  const [isDark, toggleDark] = useToggle(false)

  /** 应用持久化主题到 DOM */
  function applyStoredTheme() {
    uiStore.setTheme(stored.value)
  }

  /** 在 DND / COC 间切换 */
  function toggleTheme() {
    theme.value = theme.value === 'dnd' ? 'coc' : 'dnd'
  }

  return {
    theme,
    isCoc,
    isDark,
    toggleDark,
    toggleTheme,
    applyStoredTheme,
  }
}
