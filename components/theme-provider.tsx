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
    const timer = setTimeout(() => {
      try {
        setTheme(localStorage.getItem('hidrocrm_theme') === 'light' ? 'light' : 'dark')
      } catch {
        setTheme('dark')
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Fix global UX: al hacer focus en <input type="number">
  //   - Si el valor actual es "0" o vacío → SELECCIONA TODO (user quiere reemplazar el default)
  //   - Si tiene un valor real (ej "303") → CURSOR AL FINAL (user puede agregar más dígitos)
  // Si el user empieza a tipear antes de que los timers de Safari ejecuten el positionCursor,
  // ABORTAMOS los timers pendientes para no interrumpir el typing.
  useEffect(() => {
    function positionCursor(el: HTMLInputElement) {
      try {
        const val = el.value.trim()
        const isDefault = val === '' || val === '0'
        if (isDefault) {
          el.select()
          if (typeof el.setSelectionRange === 'function') {
            el.setSelectionRange(0, el.value.length)
          }
        } else {
          // Cursor al final → permite agregar dígitos al valor existente
          if (typeof el.setSelectionRange === 'function') {
            const end = el.value.length
            el.setSelectionRange(end, end)
          }
        }
      } catch { /* ignorar errores en inputs removidos del DOM */ }
    }

    function handleFocus(e: FocusEvent) {
      const el = e.target as HTMLElement | null
      if (!(el instanceof HTMLInputElement)) return
      if (el.type !== 'number') return

      // Si el user ya empezó a escribir o movió el cursor manualmente, cancelar los timers
      // para NO interrumpir el typing (bug visible en Safari macOS).
      let cancelled = false
      const cancel = () => { cancelled = true }
      el.addEventListener('input',    cancel, { once: true })
      el.addEventListener('keydown',  cancel, { once: true })
      el.addEventListener('click',    cancel, { once: true })

      const tryPosition = () => { if (!cancelled) positionCursor(el) }

      // Estrategia tri-faceta; la primera que gane es la única que corre.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          tryPosition()
          cancelled = true  // cualquier timer posterior queda abortado
        })
      })
      setTimeout(tryPosition, 50)
      setTimeout(tryPosition, 150)
      // Cleanup de listeners si no se disparan
      setTimeout(() => {
        el.removeEventListener('input',   cancel)
        el.removeEventListener('keydown', cancel)
        el.removeEventListener('click',   cancel)
      }, 250)
    }
    document.addEventListener('focusin', handleFocus)
    return () => document.removeEventListener('focusin', handleFocus)
  }, [])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try { localStorage.setItem('hidrocrm_theme', next) } catch {}
  }

  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>
}

export const useTheme = () => useContext(Ctx)
