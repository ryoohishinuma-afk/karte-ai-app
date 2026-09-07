import { useState } from 'react'

export function useLayoutPreference() {
  const [layout, setLayout] = useState(() =>
    localStorage.getItem('karte-layout') || 'sidebar'
  )

  function toggleLayout() {
    const next = layout === 'split' ? 'sidebar' : 'split'
    localStorage.setItem('karte-layout', next)
    setLayout(next)
  }

  return { layout, toggleLayout }
}
