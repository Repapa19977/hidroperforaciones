'use client'

// Banner de alertas de consumo — compara bitácora vs cotización contratada.
// Muestra solo alertas activas (warning, crítico, exceso).

import { useState, useEffect } from 'react'
import { AlertTriangle, TrendingUp, CheckCircle2, Drill, FlaskConical, Droplets } from 'lucide-react'
import { cn, formatQ } from '@/lib/utils'

interface Alerta {
  producto: 'pies' | 'bentonita' | 'pipas' | 'grava'
  unidad: string
  contratado: number
  consumido: number
  pct: number
  nivel: 'ok' | 'warning' | 'critico' | 'exceso'
  mensaje: string
  costoExtra: number
  ventaExtra: number
  reservaDisponible?: number
}

interface Response {
  alertas?: Alerta[]
  alertasActivas?: Alerta[]
  totalCostoExtra?: number
  totalVentaExtra?: number
  motivo?: string
}

const ICONOS = {
  pies:      Drill,
  bentonita: FlaskConical,
  pipas:     Droplets,
  grava:     TrendingUp,
}

export function AlertasConsumo({ proyectoId }: { proyectoId: string }) {
  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/proyectos/${proyectoId}/consumo-alertas`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [proyectoId])

  if (loading) return null
  const activas = data?.alertasActivas ?? []
  if (activas.length === 0) {
    return (
      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <p className="text-sm text-emerald-300">
          {data?.motivo ?? 'Consumo dentro de lo contratado. Todo bien.'}
        </p>
      </div>
    )
  }

  const excesos = activas.filter(a => a.nivel === 'exceso')
  const tieneExcesos = excesos.length > 0

  return (
    <div className={cn(
      'border rounded-xl p-4 space-y-3',
      tieneExcesos ? 'bg-red-500/5 border-red-500/25' : 'bg-amber-500/5 border-amber-500/25'
    )}>
      <div className="flex items-center gap-2">
        <AlertTriangle className={cn('w-5 h-5 shrink-0', tieneExcesos ? 'text-red-400' : 'text-amber-400')} />
        <h3 className="text-sm font-semibold text-white">
          Alertas de consumo ({activas.length})
        </h3>
        {tieneExcesos && (
          <span className="ml-auto text-xs text-red-300">
            Exceso facturar: <b className="tabular-nums">{formatQ(data?.totalVentaExtra ?? 0)}</b>
          </span>
        )}
      </div>

      <div className="space-y-2">
        {activas.map(a => {
          const Icon = ICONOS[a.producto]
          const colors = {
            warning: { ring: 'border-amber-500/30', text: 'text-amber-300', iconColor: 'text-amber-400' },
            critico: { ring: 'border-orange-500/40', text: 'text-orange-300', iconColor: 'text-orange-400' },
            exceso:  { ring: 'border-red-500/50',   text: 'text-red-300',    iconColor: 'text-red-400' },
            ok:      { ring: 'border-emerald-500/20', text: 'text-emerald-300', iconColor: 'text-emerald-400' },
          }[a.nivel]
          return (
            <div key={a.producto} className={cn('bg-black/20 border rounded-lg px-3 py-2.5 flex items-start gap-3', colors.ring)}>
              <Icon className={cn('w-4 h-4 shrink-0 mt-0.5', colors.iconColor)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('text-xs font-semibold capitalize', colors.text)}>
                    {a.producto} · {a.pct}%
                  </span>
                  <span className="text-[10px] text-slate-500 tabular-nums">
                    {a.consumido} / {a.contratado} {a.unidad}
                  </span>
                </div>
                <p className={cn('text-xs mt-0.5', colors.text)}>{a.mensaje}</p>
                {a.reservaDisponible !== undefined && a.reservaDisponible > 0 && a.nivel === 'exceso' && (
                  <p className="text-[10px] text-emerald-400 mt-0.5">
                    💡 Reserva disponible: {a.reservaDisponible} {a.unidad}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
