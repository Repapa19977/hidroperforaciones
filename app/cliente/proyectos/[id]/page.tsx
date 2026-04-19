'use client'

// Detalle del proyecto desde el portal del cliente.
// Muestra: avance, bitácora (solo nota cliente), pagos + plan.
// NUNCA muestra: costos internos, márgenes, inventario, gastos.

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, Calendar, Clock, CheckCircle2, AlertCircle,
  Droplet, Sun, Moon, Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProyectoDetalle {
  proyecto: {
    id: string; correlativo: string; nombre: string; tipo: string; estado: string
    fechaInicio: string; vendedor: string
  }
  avance: { profundidadTotal: number; piesAcumulados: number; pctAvance: number; ultimaBitacora: string | null }
  pagos: {
    totalProyecto: number; recibido: number; pendiente: number; pctCobrado: number
    historial: Array<{ id: string; fecha: string; monto: number; metodo: string; hitoLabel: string }>
    planPagos: Array<{ id: string; label: string; pct: number }>
  }
  bitacora: Array<{
    id: string; fecha: string; turno: string
    perforacionDia: number; perforacionTotal: number
    notaCliente: string; diaAdverso: boolean; diaActivo: boolean
  }>
}

const formatQ = (n: number) => `Q ${Math.round(n).toLocaleString('es-GT')}`

export default function ClienteProyectoDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [data, setData] = useState<ProyectoDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/cliente/proyectos/${id}`)
      .then(async r => {
        if (r.status === 401) { router.push('/cliente/login'); return null }
        if (r.status === 403 || r.status === 404) {
          setError('Proyecto no encontrado o no disponible')
          return null
        }
        return r.ok ? r.json() : null
      })
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [id, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" /> Cargando proyecto…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-500 p-6">
        <AlertCircle className="w-12 h-12 mb-3 text-slate-600" />
        <p>{error ?? 'No se pudo cargar el proyecto'}</p>
        <Link href="/cliente" className="mt-3 text-blue-400 hover:text-blue-300 text-sm underline">
          Volver al inicio
        </Link>
      </div>
    )
  }

  // Calcular hitos con estado simple para mostrar al cliente
  const hitosConEstado = data.pagos.planPagos.map(h => {
    const montoEsperado = Math.round(data.pagos.totalProyecto * h.pct / 100)
    const pagosDelHito = data.pagos.historial.filter(p => p.hitoLabel === h.label || p.hitoLabel === h.id)
    const montoRecibido = pagosDelHito.reduce((a, p) => a + p.monto, 0)
    const pagado = montoRecibido >= montoEsperado
    const parcial = montoRecibido > 0 && !pagado
    return { ...h, montoEsperado, montoRecibido, pagado, parcial, pagosDelHito }
  })

  return (
    <div className="min-h-screen bg-[#070d1a]">
      {/* Header */}
      <header className="bg-[#0d1526] border-b border-white/5 sticky top-0 z-10">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link href="/cliente" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm">
            <ArrowLeft className="w-4 h-4" /> Mis proyectos
          </Link>
          <span className="font-mono text-xs text-blue-400 ml-auto">{data.proyecto.correlativo}</span>
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Título + estado */}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-white">{data.proyecto.nombre}</h1>
            <span className={cn('text-[10px] px-2 py-0.5 rounded-full capitalize',
              data.proyecto.estado === 'activo'     && 'bg-emerald-500/20 text-emerald-400',
              data.proyecto.estado === 'completado' && 'bg-blue-500/20 text-blue-400',
              data.proyecto.estado === 'pausado'    && 'bg-amber-500/20 text-amber-400',
            )}>{data.proyecto.estado}</span>
          </div>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Inicio {data.proyecto.fechaInicio}</span>
            <span>· {data.proyecto.tipo === 'perforacion' ? 'Perforación de pozo' : 'Limpieza mecánica'}</span>
            <span>· Asesor {data.proyecto.vendedor}</span>
          </p>
        </div>

        {/* Avance */}
        <div className="bg-gradient-to-br from-blue-600/10 to-cyan-500/5 border border-blue-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Droplet className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-semibold text-white">Avance del pozo</h2>
          </div>
          <div className="flex items-baseline gap-3 mb-3">
            <span className="text-4xl font-black text-white tabular-nums">
              {data.avance.piesAcumulados.toFixed(0)}
            </span>
            <span className="text-sm text-slate-400">
              de {data.avance.profundidadTotal} pies · {data.avance.pctAvance.toFixed(0)}%
            </span>
          </div>
          <div className="h-3 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all"
              style={{ width: `${Math.min(100, data.avance.pctAvance)}%` }} />
          </div>
          {data.avance.ultimaBitacora && (
            <p className="text-xs text-slate-500 mt-2">
              Última actualización: {data.avance.ultimaBitacora}
            </p>
          )}
        </div>

        {/* Pagos */}
        <div className="bg-[#0d1526] rounded-2xl border border-white/5 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <h2 className="text-base font-semibold text-white">Estado de pagos</h2>
          </div>
          <div className="px-5 py-4 bg-[#0a1020]">
            <div className="flex items-baseline gap-3 mb-2">
              <span className="text-2xl font-black text-emerald-400 tabular-nums">
                {formatQ(data.pagos.recibido)}
              </span>
              <span className="text-sm text-slate-400">
                de {formatQ(data.pagos.totalProyecto)} · {data.pagos.pctCobrado.toFixed(0)}%
              </span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400"
                style={{ width: `${Math.min(100, data.pagos.pctCobrado)}%` }} />
            </div>
            {data.pagos.pendiente > 0 && (
              <p className="text-xs text-amber-300 mt-2">
                Pendiente: <span className="font-semibold">{formatQ(data.pagos.pendiente)}</span>
              </p>
            )}
          </div>

          {/* Hitos plan */}
          <div className="divide-y divide-white/5">
            {hitosConEstado.map(h => (
              <div key={h.id} className="px-5 py-3 flex items-center gap-3">
                <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0',
                  h.pagado ? 'bg-emerald-500/20' : h.parcial ? 'bg-amber-500/20' : 'bg-slate-500/10')}>
                  {h.pagado
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    : <Clock className={cn('w-4 h-4', h.parcial ? 'text-amber-400' : 'text-slate-500')} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium">{h.label}</p>
                  <p className="text-[11px] text-slate-500">{h.pct}% del total</p>
                </div>
                <div className="text-right">
                  <p className={cn('text-sm font-semibold tabular-nums',
                    h.pagado ? 'text-emerald-400' : 'text-white')}>
                    {formatQ(h.montoEsperado)}
                  </p>
                  {h.parcial && (
                    <p className="text-[10px] text-amber-300">Recibido {formatQ(h.montoRecibido)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bitácora */}
        {data.bitacora.length > 0 && (
          <div className="bg-[#0d1526] rounded-2xl border border-white/5 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <h2 className="text-base font-semibold text-white">Bitácora diaria</h2>
            </div>
            <div className="divide-y divide-white/5">
              {data.bitacora.map(b => (
                <div key={b.id} className="px-5 py-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-white font-medium">{b.fecha}</span>
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      {b.turno === 'dia' ? <Sun className="w-3 h-3 text-amber-400" /> : <Moon className="w-3 h-3 text-blue-400" />}
                      {b.turno === 'dia' ? 'Día' : 'Noche'}
                    </span>
                    {b.diaAdverso && (
                      <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">Día adverso</span>
                    )}
                    {b.perforacionDia > 0 && (
                      <span className="text-xs text-emerald-400 tabular-nums ml-auto">+{b.perforacionDia.toFixed(1)} pies</span>
                    )}
                  </div>
                  {b.notaCliente && (
                    <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap">{b.notaCliente}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
