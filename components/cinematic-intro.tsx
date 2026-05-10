'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

const SESSION_KEY = 'hc_intro_shown'

function shouldSkipIntro() {
  if (typeof window === 'undefined') return false
  try {
    if (sessionStorage.getItem(SESSION_KEY) === '1') return true
  } catch { /* sessionStorage puede fallar en modos privados */ }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Intro cinematográfica — se muestra UNA sola vez por sesión de navegador.
 * Secuencia: fade-in logo → escala sutil → blur out → desmonta.
 * Respeta prefers-reduced-motion y la puede saltar tapeando cualquier parte.
 */
export function CinematicIntro() {
  const [stage, setStage] = useState<'pending' | 'mounted' | 'visible' | 'exiting' | 'done'>('pending')

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (shouldSkipIntro()) {
      try { sessionStorage.setItem(SESSION_KEY, '1') } catch {}
      return
    }

    const t0 = setTimeout(() => setStage('mounted'), 0)
    const t1 = setTimeout(() => setStage('visible'), 20)
    const t2 = setTimeout(() => setStage('exiting'), 1900)
    const t3 = setTimeout(() => {
      try { sessionStorage.setItem(SESSION_KEY, '1') } catch {}
      setStage('done')
    }, 2600)

    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  function skip() {
    try { sessionStorage.setItem(SESSION_KEY, '1') } catch {}
    setStage('done')
  }

  if (stage === 'pending' || stage === 'done') return null

  return (
    <div
      onClick={skip}
      className={`hc-intro-root ${stage === 'exiting' ? 'hc-intro-exiting' : ''} ${stage === 'visible' ? 'hc-intro-visible' : ''}`}
      aria-hidden="true"
    >
      {/* Gradient radial de fondo */}
      <div className="hc-intro-glow" />

      {/* Líneas decorativas (agua / perforación) */}
      <div className="hc-intro-line hc-intro-line-1" />
      <div className="hc-intro-line hc-intro-line-2" />

      {/* Logo + nombre */}
      <div className="hc-intro-stack">
        <div className="hc-intro-logo">
          <Image src="/logo.png" alt="Hidroperforaciones" width={96} height={96} priority className="object-contain" />
        </div>
        <div className="hc-intro-title">
          <span className="hc-intro-title-word">Hidro</span>
          <span className="hc-intro-title-word hc-intro-title-accent">perforaciones</span>
        </div>
        <div className="hc-intro-tag">Guatemala · CRM</div>
      </div>

      <button onClick={skip} className="hc-intro-skip">Saltar</button>
    </div>
  )
}
