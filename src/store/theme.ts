import { create } from 'zustand'

export type ThemeName = 'light' | 'dark'

const STORAGE_KEY = 'dongseon-theme'

function readSavedTheme(): ThemeName {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // 저장소를 못 쓰는 환경(시크릿 모드 등)에서는 그냥 기본값을 쓴다.
  }
  const prefersDark =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

function applyTheme(theme: ThemeName) {
  document.documentElement.dataset.theme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0E131D' : '#F5F7FB')
}

interface ThemeState {
  theme: ThemeName
  toggle: () => void
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: 'light',
  toggle: () => {
    const next: ThemeName = get().theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // 저장이 안 돼도 이번 화면에서는 바뀐 테마가 그대로 보인다.
    }
    set({ theme: next })
  },
}))

/** 앱이 처음 뜰 때 한 번 부른다. */
export function initTheme() {
  const theme = readSavedTheme()
  applyTheme(theme)
  useTheme.setState({ theme })
}
