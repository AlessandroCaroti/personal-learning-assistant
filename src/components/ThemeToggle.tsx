import { useAppStore } from '../store/appStore'

export function ThemeToggle() {
  const theme = useAppStore((state) => state.theme)
  const toggleTheme = useAppStore((state) => state.toggleTheme)

  return (
    <button
      type="button"
      title="Cambia tema"
      aria-label="Cambia tema"
      onClick={toggleTheme}
      style={{
        minWidth: '44px',
        minHeight: '44px',
        padding: '0.35rem 0.5rem',
        borderRadius: '8px',
        background: 'var(--bg-elevated)',
        color: 'var(--text)',
        fontWeight: 600,
      }}
    >
      {theme === 'dark' ? 'Chiaro' : 'Scuro'}
    </button>
  )
}
