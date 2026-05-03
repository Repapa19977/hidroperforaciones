// Card de KPI compartido por dashboard, cotizaciones y control de gastos.
// Variantes:
//   - 'inline'  (default): icono a la izquierda + texto en columna a la derecha
//   - 'stacked': icono arriba, valor/label/sub apilados (más prominente)

import * as React from 'react'
import { cn } from '@/lib/utils'

export type KPIColor = 'blue' | 'violet' | 'emerald' | 'amber' | 'red' | 'slate'

const COLOR_CLS: Record<KPIColor, string> = {
  blue:    'border-blue-500/15 bg-blue-500/5',
  violet:  'border-violet-500/15 bg-violet-500/5',
  emerald: 'border-emerald-500/15 bg-emerald-500/5',
  amber:   'border-amber-500/15 bg-amber-500/5',
  red:     'border-red-500/15 bg-red-500/5',
  slate:   'border-white/5 bg-white/3',
}

export function KPICard({
  icon, label, value, sub, color = 'slate', variant = 'inline',
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  color?: KPIColor
  variant?: 'inline' | 'stacked'
}) {
  if (variant === 'stacked') {
    return (
      <div className={cn('rounded-xl border px-4 py-3', COLOR_CLS[color])}>
        <div className="mb-2">{icon}</div>
        <p className="text-xl font-black text-white leading-none">{value}</p>
        <p className="text-[11px] text-slate-500 mt-1">{label}</p>
        {sub && <p className="text-[10px] text-slate-600">{sub}</p>}
      </div>
    )
  }
  return (
    <div className={cn('rounded-xl border px-3.5 py-2.5 flex items-center gap-3', COLOR_CLS[color])}>
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-base font-black text-white leading-none truncate">{value}</p>
        <p className="text-[10px] text-slate-500 mt-0.5 truncate">{label}</p>
        {sub && <p className="text-[10px] text-slate-600 truncate">{sub}</p>}
      </div>
    </div>
  )
}
