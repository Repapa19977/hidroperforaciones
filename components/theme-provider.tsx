'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

const Ctx = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'dark',
  toggle: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const saved = localStorage.getItem('hidrocrm_theme') as Theme | null
    const t = saved === 'light' ? 'light' : 'dark'
    setTheme(t)
    document.documentElement.setAttribute('data-theme', t)
  }, [])

  // Fix global UX: al hacer focus en cualquier <input type="number"> seleccionar todo el texto.
  // Resuelve el bug donde al borrar el valor anterior aparecía un "0" fantasma al tipear.
  // Funciona en Chrome/Edge/Firefox desktop + iOS Safari + Android Chrome.
  useEffect(() => {
    function selectNumberOnFocus(e: FocusEvent) {
      const el = e.target as HTMLElement | null
      if (!(el instanceof HTMLInputElement)) return
      if (el.type !== 'number') return
      // Pequeño delay para que el browser termine de posicionar el cursor antes de seleccionar.
      // En iOS Safari el setTimeout 50ms es más confiable que 0ms porque el teclado virtual
      // todavía está montándose en ese momento.
      setTimeout(() => {
        try {
          el.select()  // Desktop + Android
          // Fallback robusto para iOS Safari (el.select() a veces no resalta visualmente)
          if (typeof el.setSelectionRange === 'function') {
            el.setSelectionRange(0, el.value.length)
          }
        } catch { /* ignorar errores de focus en inputs removidos del DOM */ }
      }, 50)
    }
    document.addEventListener('focusin', selectNumberOnFocus)
    return () => document.removeEventListener('focusin', selectNumberOnFocus)
  }, [])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('hidrocrm_theme', next)
  }

  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>
}

export const useTheme = () => useContext(Ctx)
