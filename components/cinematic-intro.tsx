'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

const SESSION_KEY = 'hc_intro_water_20260505'

function shouldSkipIntro() {
  if (typeof window === 'undefined') return false
  try {
    if (sessionStorage.getItem(SESSION_KEY) === '1') return true
  } catch { /* sessionStorage puede fallar en modos privados */ }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Intro cinematografica: perforacion, capas geologicas y acuifero.
 * Se muestra una vez por sesion y dura maximo 5 segundos.
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
    const t2 = setTimeout(() => setStage('exiting'), 4300)
    const t3 = setTimeout(() => {
      try { sessionStorage.setItem(SESSION_KEY, '1') } catch {}
      setStage('done')
    }, 5000)

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
      <div className="hc-intro-sky" />

      <div className="hc-intro-rig" aria-hidden="true">
        <span className="hc-intro-rig-top" />
        <span className="hc-intro-rig-leg hc-intro-rig-leg-left" />
        <span className="hc-intro-rig-leg hc-intro-rig-leg-right" />
      </div>

      <div className="hc-intro-earth" aria-hidden="true">
        <span className="hc-intro-layer hc-intro-layer-top" />
        <span className="hc-intro-layer hc-intro-layer-sand" />
        <span className="hc-intro-layer hc-intro-layer-clay" />
        <span className="hc-intro-layer hc-intro-layer-rock" />
        <span className="hc-intro-aquifer" />
        <span className="hc-intro-water-wave hc-intro-water-wave-1" />
        <span className="hc-intro-water-wave hc-intro-water-wave-2" />
      </div>

      <div className="hc-intro-drill" aria-hidden="true">
        <span className="hc-intro-drill-cable" />
        <span className="hc-intro-drill-bit" />
      </div>

      <div className="hc-intro-stack">
        <div className="hc-intro-logo">
          <Image src="/logo.png" alt="Hidroperforaciones" width={96} height={96} priority className="object-contain" />
        </div>
        <div className="hc-intro-title">
          <span className="hc-intro-title-word">Hidro</span>
          <span className="hc-intro-title-word hc-intro-title-accent">perforaciones</span>
        </div>
        <div className="hc-intro-tag">Pozos mecánicos · Agua subterránea · Guatemala</div>
      </div>

      <button type="button" onClick={skip} className="hc-intro-skip">Saltar</button>
    </div>
  )
}
