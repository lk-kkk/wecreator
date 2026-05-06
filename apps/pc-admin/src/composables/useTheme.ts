/**
 * useTheme — 主题管理（已简化为单一亮色主题）
 *
 * 改造说明：
 * - 移除一键换肤功能，整站强制使用亮色主题
 * - 保留 API（mode / resolved / setMode / toggle）以兼容旧调用方
 * - 启动时强制写入 <html data-theme="light">
 */

import { computed, ref, onMounted } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'auto'

// 强制亮色 —— 始终返回 'light'
const mode = ref<ThemeMode>('light')
const systemDark = ref<boolean>(false)
const resolved = computed<'light' | 'dark'>(() => 'light')

function applyTheme() {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = 'light'
  document.documentElement.style.colorScheme = 'light'
}

// 首次立刻应用
applyTheme()

// 清理旧版 localStorage 残留（避免 FOUC）
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('wc_theme')
  }
} catch {
  // ignore
}

export function useTheme() {
  onMounted(() => {
    applyTheme()
  })

  // 保留 API，但所有调用都是 no-op（始终亮色）
  function setMode(_next: ThemeMode) {
    applyTheme()
  }

  function toggle() {
    applyTheme()
  }

  return {
    mode,
    resolved,
    systemDark,
    setMode,
    toggle,
  }
}

export function getThemeState() {
  return { mode, resolved, systemDark }
}

export const __themeInitialized = true
