'use client'

import { cn } from '@/lib/utils'

export type ProjectStatTone = 'slate' | 'blue' | 'emerald' | 'amber' | 'red'

export function ProjectStatBox({
  label,
  value,
  sub,
  tone = 'slate',
}: {
  label: string
  value: string
  sub?: string
  tone?: ProjectStatTone
}) {
  const toneClass = {
    slate: 'border-white/5 text-white',
    blue: 'border-blue-500/20 text-blue-300',
    emerald: 'border-emerald-500/20 text-emerald-300',
    amber: 'border-amber-500/20 text-amber-300',
    red: 'border-red-500/20 text-red-300',
  }[tone]

  return (
    <div className={cn('bg-[#0a1020] rounded-lg border p-3', toneClass)}>
      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-lg font-bold leading-none tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-slate-600 mt-1 leading-tight">{sub}</p>}
    </div>
  )
}
