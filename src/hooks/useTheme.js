import { useState, useEffect } from 'react'

const KEY = 'karte-theme'

export function getInitialTheme() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {}
  return 'dark'
}

// アプリ起動時に一度だけ呼び、data-themeを確定させる（描画チラつき防止）
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    applyTheme(theme)
    try { localStorage.setItem(KEY, theme) } catch {}
  }, [theme])

  const toggle = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  return { theme, toggle }
}
