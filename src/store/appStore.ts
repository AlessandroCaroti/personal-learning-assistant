import { create } from 'zustand'

export type Theme = 'dark' | 'light'

interface AppStore {
  theme: Theme
  toggleTheme: () => void
  currentExamId: string | null
  setCurrentExamId: (id: string | null) => void
}

const THEME_KEY = 'theme'

function isTheme(value: string | null): value is Theme {
  return value === 'dark' || value === 'light'
}

function getSavedTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'dark'

  try {
    const savedTheme = localStorage.getItem(THEME_KEY)
    return isTheme(savedTheme) ? savedTheme : 'dark'
  } catch {
    return 'dark'
  }
}

function applyTheme(theme: Theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme)
  }

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // Storage can be unavailable in tests, private mode, or restricted WebViews.
    }
  }
}

const initialTheme = getSavedTheme()
applyTheme(initialTheme)

export const useAppStore = create<AppStore>((set) => ({
  theme: initialTheme,
  toggleTheme: () =>
    set((state) => {
      const nextTheme: Theme = state.theme === 'dark' ? 'light' : 'dark'
      applyTheme(nextTheme)
      return { theme: nextTheme }
    }),
  currentExamId: null,
  setCurrentExamId: (id) => set({ currentExamId: id }),
}))
