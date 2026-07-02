import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'

export default function ThemeToggle({ size = 15 }) {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? '診察室モード（ライト）に切替' : 'ダークモードに切替'}
      aria-label="テーマ切替"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
        background: 'var(--surface2)', color: 'var(--text-muted)',
        border: '1px solid var(--border)', fontSize: 12, fontWeight: 600,
      }}
    >
      {isDark ? <Sun size={size} /> : <Moon size={size} />}
      {isDark ? '診察室' : 'ダーク'}
    </button>
  )
}
