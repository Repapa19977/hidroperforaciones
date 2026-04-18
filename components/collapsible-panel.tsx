'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Panel colapsable — header con chevron animado, contenido oculto/visible con
 * grid-template-rows 0fr / 1fr para animación fluida sin medir alturas.
 * Pensado para paneles secundarios que saturan la pantalla en móvil.
 */
export function CollapsiblePanel({
  title,
  subtitle,
  defaultOpen = false,
  badge,
  accent = 'slate',
  children,
  className,
}: {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  badge?: ReactNode
  accent?: 'slate' | 'blue' | 'violet' | 'emerald' | 'amber'
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)

  const accentStyles: Record<string, { dot: string; border: string; hover: string }> = {
    slate:   { dot: 'bg-slate-400',    border: 'border-white/8',               hover: 'hover:border-white/15' },
    blue:    { dot: 'bg-blue-400',     border: 'border-blue-500/20',           hover: 'hover:border-blue-500/35' },
    violet:  { dot: 'bg-violet-400',   border: 'border-violet-500/20',         hover: 'hover:border-violet-500/35' },
    emerald: { dot: 'bg-emerald-400',  border: 'border-emerald-500/20',        hover: 'hover:border-emerald-500/35' },
    amber:   { dot: 'bg-amber-400',    border: 'border-amber-500/20',          hover: 'hover:border-amber-500/35' },
  }
  const a = accentStyles[accent]

  return (
    <div className={cn(
      'rounded-2xl bg-[#0d1526] border transition-colors',
      a.border,
      open ? a.hover : a.hover,
      className,
    )}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/2 rounded-2xl transition-colors"
      >
        <span className={cn('w-1.5 h-6 rounded-full', a.dot)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-100 truncate">{title}</p>
            {badge}
          </div>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{subtitle}</p>}
        </div>
        <ChevronDown className={cn(
          'w-4 h-4 text-slate-500 shrink-0 transition-transform duration-300',
          open && 'rotate-180 text-slate-300',
        )} />
      </button>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1 border-t border-white/5">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
