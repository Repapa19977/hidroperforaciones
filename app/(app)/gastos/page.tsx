'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ChevronRight, RefreshCw, Wallet, TrendingUp, AlertTriangle, CheckCircle, Clock3,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProyectoRow {
  id: string
  correlativo: string
  cliente: string
  empresa: string
  nombre: string
  tipo: string
  monto: number
  vendedor: string
  estado: 'activo' | 'completado' | 'pausado'
  fechaInicio: string
}

interface ResumenGastos {
  presupuestoTotal: number
  ejecutadoQ: number      // bitácora + gastos extras
  avancePct: number
  desviacionQ: number
}

const formatQ = (n: number) => `Q ${Math.round(n).toLocaleString('es-GT')}`

function estadoBadge(estado: ProyectoRow['estado']) {
  const map = {
    activo: 'bg-emerald-500/20 text-emerald-400',
    pausado: 'bg-amber-500/20 text-amber-400',
    completado: 'bg-blue-500/20 text-blue-400',
  } as const
  return map[estado] ?? 'bg-slate-500/20 text-slate-400'
}

export default function ControlGastosPage() {
  const [rows, setRows] = useState<ProyectoRow[]>([])
  const [resumenes, setResumenes] = useState<Record<string, ResumenGastos>>({})
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | 'activo' | 'pausado' | 'completado'>('activo')

  async function loadData() {
    setLoading(true)
    try {
      const res = await fetch('/api/proyectos')
      const proyectos: ProyectoRow[] = res.ok ? await res.json() : []
      setRows(proyectos)

      // Fetch resumen de gastos para cada proyecto en paralelo
      const entries = await Promise.all(proyectos.map(async p => {
        try {
          const r = await fetch(`/api/proyectos/${p.id}/control-gastos`)
          if (!r.ok) return [p.id, null] as const
          const d = await r.json()
          return [p.id, {
            presupuestoTotal: d.presupuesto?.total ?? 0,
            ejecutadoQ: d.totalEjecutadoMasExtras ?? 0,
            avancePct: d.avancePct ?? 0,
            desviacionQ: d.desviacionQ ?? 0,
          } as ResumenGastos] as const
        } catch {
          return [p.id, null] as const
        }
      }))

      const map: Record<string, ResumenGastos> = {}
      entries.forEach(([id, resumen]) => { if (resumen) map[id] = resumen })
      setResumenes(map)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadData() }, [])

  const filtrados = filtro === 'todos' ? rows : rows.filter(r => r.estado === filtro)

  const totalPresupuesto = filtrados.reduce((a, p) => a + (resumenes[p.id]?.presupuestoTotal ?? 0), 0)
  const totalEjecutado   = filtrados.reduce((a, p) => a + (resumenes[p.id]?.ejecutadoQ ?? 0), 0)
  const enAlerta         = filtrados.filter(p => (resumenes[p.id]?.desviacionQ ?? 0) > 0).length

  return (
    <div className="flex flex-col h-full bg-[#070d1a]">
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-white/5 bg-[#0a1020] shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-400" />
              Control de Gastos
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {loading ? 'Cargando...' : `${filtrados.length} proyecto(s)`}
            </p>
          </div>
          <button onClick={() => void loadData()}
            className="flex items-center gap-1.5 border border-white/10 text-slate-300 hover:text-white hover:border-white/20 px-3 py-2 rounded-lg text-xs font-medium transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Actualizar
          </button>
        </div>

        {/* KPIs agregados */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <KPI icon={<Wallet className="w-4 h-4 text-blue-400" />}     label="Presupuesto total" value={formatQ(totalPresupuesto)} sub="aprobado"   color="blue" />
          <KPI icon={<TrendingUp className="w-4 h-4 text-violet-400" />} label="Ejecutado"        value={formatQ(totalEjecutado)}  sub={totalPresupuesto > 0 ? `${((totalEjecutado/totalPresupuesto)*100).toFixed(0)}% del total` : '—'} color="violet" />
          <KPI icon={<AlertTriangle className="w-4 h-4 text-amber-400" />} label="En alerta"      value={String(enAlerta)}         sub="sobre presupuesto" color={enAlerta > 0 ? 'amber' : 'slate'} />
          <KPI icon={<CheckCircle className="w-4 h-4 text-emerald-400" />} label="Al día"        value={String(filtrados.length - enAlerta)} sub="bajo presupuesto" color="emerald" />
        </div>

        {/* Filtro */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['todos', 'activo', 'pausado', 'completado'] as const).map(s => (
            <button key={s} onClick={() => setFiltro(s)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                filtro === s ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5')}>
              {s === 'todos' ? 'Todos' : s === 'activo' ? 'Activos' : s === 'pausado' ? 'Pausados' : 'Completados'}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center gap-3 text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm">Cargando gastos...</span>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
          <Clock3 className="w-12 h-12 mb-4 opacity-30" />
          <p className="font-medium text-slate-500">Sin proyectos para el filtro actual</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-3 sm:p-4 space-y-3">
          {filtrados.map(p => {
            const r = resumenes[p.id]
            const pctEjecutado = r && r.presupuestoTotal > 0 ? (r.ejecutadoQ / r.presupuestoTotal) * 100 : 0
            const sobreExtrap = (r?.desviacionQ ?? 0) > 0
            const colorAvance = pctEjecutado >= 100 ? 'bg-red-500' : pctEjecutado >= 90 ? 'bg-amber-500' : 'bg-emerald-500'

            return (
              <Link key={p.id} href={`/gastos/${p.id}`}
                className="block bg-[#0d1526] rounded-xl border border-white/5 hover:border-white/10 p-4 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11px] text-blue-400">{p.correlativo}</span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded', estadoBadge(p.estado))}>{p.estado}</span>
                      {sobreExtrap && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 font-semibold">
                          ⚠ +{formatQ(r!.desviacionQ)}
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-slate-200 mt-1 truncate">{p.cliente}</p>
                    <p className="text-xs text-slate-500 truncate">{p.nombre}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-600 shrink-0 mt-1" />
                </div>

                {r ? (
                  <div className="space-y-2">
                    {/* Avance físico */}
                    <div>
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-slate-500">Avance físico</span>
                        <span className="text-blue-400 font-semibold">{r.avancePct.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all" style={{ width: `${Math.min(100, r.avancePct)}%` }} />
                      </div>
                    </div>
                    {/* Ejecutado financiero */}
                    <div>
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-slate-500">Ejecutado / Presupuesto</span>
                        <span className="text-slate-300 tabular-nums">{formatQ(r.ejecutadoQ)} / {formatQ(r.presupuestoTotal)} ({pctEjecutado.toFixed(0)}%)</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className={cn('h-full transition-all', colorAvance)} style={{ width: `${Math.min(100, pctEjecutado)}%` }} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-600">Sin datos de presupuesto</p>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function KPI({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string;
  color: 'blue' | 'violet' | 'emerald' | 'amber' | 'slate'
}) {
  const cls = {
    blue:    'border-blue-500/15 bg-blue-500/5',
    violet:  'border-violet-500/15 bg-violet-500/5',
    emerald: 'border-emerald-500/15 bg-emerald-500/5',
    amber:   'border-amber-500/20 bg-amber-500/8',
    slate:   'border-white/5 bg-white/3',
  }[color]
  return (
    <div className={cn('rounded-xl border px-3.5 py-2.5 flex items-center gap-3', cls)}>
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-base font-black text-white leading-none truncate">{value}</p>
        <p className="text-[10px] text-slate-500 mt-0.5 truncate">{label}</p>
        <p className="text-[10px] text-slate-600 truncate">{sub}</p>
      </div>
    </div>
  )
}
