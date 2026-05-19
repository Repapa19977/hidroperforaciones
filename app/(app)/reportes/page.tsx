'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { type Rol } from '@/lib/config-store'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import {
  Download, RefreshCw, TrendingUp, CheckCircle, FileText,
  Send, XCircle, BarChart2, ChevronLeft, ChevronRight, Eye
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfQuarter, endOfQuarter,
  startOfYear, format, subMonths
} from 'date-fns'
import { es } from 'date-fns/locale'
import { exportXlsx } from '@/lib/export-xlsx'

// ── Types ──────────────────────────────────────────────────────────────────────
type Periodo = 'hoy' | 'semana' | 'mes' | 'trimestre' | 'anio' | 'personalizado'

interface VendedorStats {
  vendedor: string; total: number; monto: number
  confirmadas: number; confirmadoMonto: number
  enviadas: number; borradores: number; canceladas: number; conversionPct: number
}

interface ReportData {
  resumen: {
    total: number; monto: number; confirmadas: number; confirmadoMonto: number
    canceladas: number; enviadas: number; borradores: number; conversionPct: number
    perforacion: number; limpieza: number; montoPerforacion: number; montoLimpieza: number
  }
  porVendedor: VendedorStats[]
  cotizaciones: {
    id: string; correlativo: string; cliente: string; empresa: string
    proyecto: string; tipo: string; estado: string; monto: number
    fecha: string; vendedor: string
  }[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function getCookie(name: string) {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return m ? decodeURIComponent(m[1]) : ''
}

function normalizeRol(value: unknown): Rol {
  return value === 'superadmin' || value === 'admin_operativo' ? value : 'admin'
}

const fmtQ  = (n: number) => 'Q ' + (Number.isFinite(n) ? n : 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtQk = (n: number) =>
  n >= 1_000_000 ? `Q${(n/1_000_000).toFixed(1)}M` :
  n >= 1_000     ? `Q${(n/1_000).toFixed(0)}k`     : `Q${n}`

function getPeriodRange(p: Periodo, from: string, to: string) {
  const now = new Date()
  switch (p) {
    case 'hoy':
      return { from: startOfDay(now), to: endOfDay(now), label: format(now, "dd 'de' MMMM yyyy", { locale: es }) }
    case 'semana':
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }), label: 'Esta semana' }
    case 'mes':
      return { from: startOfMonth(now), to: endOfMonth(now), label: format(now, 'MMMM yyyy', { locale: es }) }
    case 'trimestre':
      return { from: startOfQuarter(now), to: endOfQuarter(now), label: `Q${Math.ceil((now.getMonth()+1)/3)} ${now.getFullYear()}` }
    case 'anio':
      return { from: startOfYear(now), to: endOfDay(now), label: `Año ${now.getFullYear()}` }
    case 'personalizado': {
      const f = from ? new Date(from) : subMonths(now, 1)
      const t = to   ? new Date(to)   : now
      return { from: startOfDay(f), to: endOfDay(t), label: `${format(f,'dd/MM/yy')} – ${format(t,'dd/MM/yy')}` }
    }
  }
}

const VENDOR_COLORS = ['#3b82f6','#8b5cf6','#f59e0b','#06b6d4','#10b981','#ef4444']
const TIPO_COLORS   = ['#3b82f6','#06b6d4']

const ESTADO_MAP: Record<string, { label: string; cls: string }> = {
  borrador:   { label: 'Borrador',   cls: 'bg-slate-500/20 text-slate-400' },
  enviada:    { label: 'Enviada',    cls: 'bg-blue-500/20 text-blue-400' },
  confirmada: { label: 'Confirmada', cls: 'bg-emerald-500/20 text-emerald-400' },
  cancelada:  { label: 'Cancelada',  cls: 'bg-red-500/20 text-red-400' },
}

const PERIODOS: { id: Periodo; label: string }[] = [
  { id: 'hoy',          label: 'Hoy'          },
  { id: 'semana',       label: 'Semana'        },
  { id: 'mes',          label: 'Mes'           },
  { id: 'trimestre',    label: 'Trimestre'     },
  { id: 'anio',         label: 'Año'           },
  { id: 'personalizado',label: 'Personalizado' },
]

const PAGE_SIZE = 20

// ── Main component ─────────────────────────────────────────────────────────────
export default function ReportesPage() {
  const [role, setRole]             = useState<Rol>('admin')
  const [myVendedor, setMyVendedor] = useState('')
  const [periodo, setPeriodo]       = useState<Periodo>('mes')
  const [fromDate, setFromDate]     = useState('')
  const [toDate, setToDate]         = useState('')
  const [vendedorFilt, setVendFilt] = useState('Todos')
  const [vendedores, setVendedores] = useState<string[]>([])
  const [data, setData]             = useState<ReportData | null>(null)
  const [loading, setLoading]       = useState(false)
  const [page, setPage]             = useState(1)
  const [openingId, setOpeningId]   = useState<string | null>(null)

  const isSuperAdmin = role === 'superadmin'

  const fetchReport = useCallback(async (p: Periodo, from: string, to: string, vend: string, r: Rol) => {
    setLoading(true)
    const { from: f, to: t } = getPeriodRange(p, from, to)
    const params = new URLSearchParams({ from: f.toISOString(), to: t.toISOString() })
    if (r !== 'superadmin' && vend) params.set('vendedor', vend)
    if (r === 'superadmin' && vend !== 'Todos') params.set('vendedor', vend)
    const res = await fetch(`/api/reportes?${params}`)
    setData(res.ok ? await res.json() : null)
    setLoading(false)
    setPage(1)
  }, [])

  const fetchVendedores = useCallback(async () => {
    const res = await fetch('/api/vendedores', { cache: 'no-store' })
    if (!res.ok) return
    const rows = await res.json().catch(() => [])
    const nombres = Array.isArray(rows)
      ? rows.map(v => String(v?.nombre ?? '').trim()).filter(Boolean)
      : []
    setVendedores([...new Set(nombres)].sort((a, b) => a.localeCompare(b, 'es')))
  }, [])

  useEffect(() => {
    let cancelled = false
    void Promise.resolve().then(async () => {
      let r = normalizeRol(getCookie('user_role'))
      let v = getCookie('user_vendedor') || ''

      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        const me = res.ok ? await res.json() : null
        r = normalizeRol(me?.role)
        if (typeof me?.vendedor === 'string') v = me.vendedor
      } catch {}

      if (cancelled) return
      setRole(r)
      setMyVendedor(v)
      fetchReport('mes', '', '', v, r)
    })
    return () => { cancelled = true }
  }, [fetchReport])

  useEffect(() => {
    if (!isSuperAdmin) return
    fetchVendedores().catch(() => {})
  }, [fetchVendedores, isSuperAdmin])

  function generar() {
    fetchReport(periodo, fromDate, toDate, isSuperAdmin ? vendedorFilt : myVendedor, role)
  }

  async function openCotizacion(correlativo: string) {
    setOpeningId(correlativo)
    try {
      const res = await fetch(`/api/cotizaciones/${encodeURIComponent(correlativo)}`, { cache: 'no-store' })
      if (!res.ok) {
        alert('No se pudo cargar la cotizacion. Intenta de nuevo.')
        return
      }

      const row: { correlativo?: string; datos?: unknown; monto?: number } = await res.json()
      if (!row.datos || row.datos === '{}') {
        alert('Esta cotizacion no tiene datos suficientes para abrir la vista previa.')
        return
      }

      const parsedDatos = typeof row.datos === 'string' ? JSON.parse(row.datos) : row.datos
      const datos = parsedDatos && typeof parsedDatos === 'object' ? parsedDatos as Record<string, unknown> : {}
      const ip = datos.ip && typeof datos.ip === 'object' ? datos.ip as Record<string, unknown> : null
      const esLegacy =
        String(row.correlativo ?? '').startsWith('HP-COT-') ||
        Boolean(ip?.numeroDeTubos || ip?.numeroDeFilteros) ||
        Boolean(datos.tipo === 'perforacion' && ip && typeof ip.tubosLisos !== 'number')

      localStorage.setItem('hidrocrm_quotation_draft', JSON.stringify({
        ...datos,
        correlativo: row.correlativo ?? correlativo,
        ...(esLegacy && typeof row.monto === 'number' ? { montoGuardado: row.monto } : {}),
      }))
      window.location.href = `/imprimir?returnTo=${encodeURIComponent('/reportes')}`
    } catch {
      alert('Error al procesar la cotizacion.')
    } finally {
      setOpeningId(null)
    }
  }

  // ── Excel export ─────────────────────────────────────────────────────────────
  async function exportExcel() {
    if (!data) return
    const { label } = getPeriodRange(periodo, fromDate, toDate)

    const resumenRows = [
      ['HidroCRM - Reporte de Cotizaciones'],
      [`Periodo: ${label}`],
      [`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`],
      [],
      ['KPI', 'Valor'],
      ['Total cotizaciones', data.resumen.total],
      ['Monto total (Q)', Math.round(data.resumen.monto)],
      ['Confirmadas', data.resumen.confirmadas],
      ['Monto confirmado (Q)', Math.round(data.resumen.confirmadoMonto)],
      ['Tasa de conversion (%)', data.resumen.conversionPct.toFixed(1)],
      ['Canceladas', data.resumen.canceladas],
      ['Enviadas', data.resumen.enviadas],
      [],
      ['Por tipo', 'Cantidad', 'Monto (Q)'],
      ['Perforacion de Pozo', data.resumen.perforacion, Math.round(data.resumen.montoPerforacion)],
      ['Limpieza Mecanica', data.resumen.limpieza, Math.round(data.resumen.montoLimpieza)],
    ]

    const vendedorRows = [
      ['Vendedor', 'Total', 'Monto Total (Q)', 'Confirmadas', 'Monto Conf. (Q)', 'Enviadas', 'Canceladas', '% Conversion'],
      ...data.porVendedor.map(v => [
        v.vendedor, v.total, Math.round(v.monto), v.confirmadas,
        Math.round(v.confirmadoMonto), v.enviadas, v.canceladas,
        `${v.conversionPct.toFixed(1)}%`,
      ]),
    ]

    const cotizacionRows = [
      ['Correlativo', 'Cliente', 'Empresa', 'Tipo', 'Estado', 'Monto (Q)', 'Fecha', 'Vendedor'],
      ...data.cotizaciones.map(c => [
        c.correlativo, c.cliente, c.empresa,
        c.tipo === 'perforacion' ? 'Perforacion' : 'Limpieza',
        c.estado, Math.round(c.monto), c.fecha, c.vendedor,
      ]),
    ]

    await exportXlsx(`Reporte_HidroCRM_${format(new Date(), 'yyyyMMdd')}.xlsx`, [
      { name: 'Resumen', rows: resumenRows, widths: [30, 20, 20] },
      { name: 'Por Vendedor', rows: vendedorRows, widths: [22, 8, 18, 12, 18, 10, 12, 14] },
      { name: 'Cotizaciones', rows: cotizacionRows, widths: [16, 20, 18, 14, 12, 16, 12, 18] },
    ])
  }

  const { label: periodoLabel } = getPeriodRange(periodo, fromDate, toDate)
  const cotizaciones = data?.cotizaciones ?? []
  const totalPages   = Math.max(1, Math.ceil(cotizaciones.length / PAGE_SIZE))
  const paginated    = cotizaciones.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const vendedoresFiltro = useMemo(() => {
    const set = new Set(vendedores)
    data?.porVendedor.forEach(v => { if (v.vendedor) set.add(v.vendedor) })
    return [...set].sort((a, b) => a.localeCompare(b, 'es'))
  }, [data?.porVendedor, vendedores])

  const barData = (data?.porVendedor ?? []).map(v => ({
    name: v.vendedor.split(' ')[0],
    monto: Math.round(v.monto / 1000),
    confirmado: Math.round(v.confirmadoMonto / 1000),
  }))
  const pieData = data ? [
    { name: 'Perforación', value: data.resumen.perforacion },
    { name: 'Limpieza',    value: data.resumen.limpieza    },
  ] : []

  return (
    <div className="flex flex-col bg-[#070d1a] min-h-full md:h-full md:overflow-y-auto">

      {/* HEADER */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-white/5 bg-[#0a1020] shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">Reportes</h1>
            <p className="text-xs text-slate-500 mt-0.5">{periodoLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={generar}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs rounded-xl transition-colors"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
            <button
              onClick={exportExcel}
              disabled={!data}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/80 hover:bg-emerald-500 text-white text-xs font-medium rounded-xl transition-colors disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Excel</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-white/5 border border-white/8 rounded-xl p-1 gap-0.5 flex-wrap">
            {PERIODOS.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriodo(p.id)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                  periodo === p.id ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {periodo === 'personalizado' && (
            <div className="flex items-center gap-1.5">
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="bg-white/5 border border-white/10 text-slate-300 text-xs rounded-xl px-2.5 py-1.5 outline-none" />
              <span className="text-slate-600 text-xs">–</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="bg-white/5 border border-white/10 text-slate-300 text-xs rounded-xl px-2.5 py-1.5 outline-none" />
            </div>
          )}

          {isSuperAdmin && (
            <select
              value={vendedorFilt}
              onChange={e => setVendFilt(e.target.value)}
              className="bg-white/5 border border-white/10 text-slate-300 text-xs rounded-xl px-2.5 py-1.5 outline-none focus:border-blue-500/50"
            >
              <option value="Todos">Todos los vendedores</option>
              {vendedoresFiltro.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          )}

          <button
            onClick={generar}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-xl transition-colors"
          >
            Generar
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 px-4 sm:px-6 py-5 space-y-5">

        {/* KPI CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard icon={<FileText className="w-4 h-4 text-blue-400" />}      label="Total cotizaciones" value={String(data?.resumen.total ?? 0)}                sub={`${data?.resumen.enviadas ?? 0} enviadas`} />
          <KpiCard icon={<TrendingUp className="w-4 h-4 text-emerald-400" />} label="Monto total"        value={fmtQk(data?.resumen.monto ?? 0)}                sub={`${fmtQk(data?.resumen.confirmadoMonto ?? 0)} confirmado`} highlight />
          <KpiCard icon={<CheckCircle className="w-4 h-4 text-emerald-400" />}label="Conversión"         value={`${(data?.resumen.conversionPct ?? 0).toFixed(1)}%`} sub={`${data?.resumen.confirmadas ?? 0} confirmadas`} />
          <KpiCard icon={<XCircle className="w-4 h-4 text-red-400" />}        label="Canceladas"         value={String(data?.resumen.canceladas ?? 0)}           sub={`de ${data?.resumen.total ?? 0} total`} />
        </div>

        {/* CHARTS */}
        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Bar chart */}
            <div className="bg-[#0d1526] border border-white/8 rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-blue-400" /> Monto por vendedor (Q miles)
              </h3>
              {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={barData} barGap={4}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}k`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0d1526', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }}
                      labelStyle={{ color: '#94a3b8' }}
                      formatter={(v) => [`Q ${typeof v === 'number' ? v : 0}k`]}
                    />
                    <Bar dataKey="monto"      name="Monto total"     radius={[4,4,0,0]} fill="#3b82f6" />
                    <Bar dataKey="confirmado" name="Monto confirmado" radius={[4,4,0,0]} fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-slate-600 text-sm">Sin datos en el período</div>
              )}
            </div>

            {/* Pie chart */}
            <div className="bg-[#0d1526] border border-white/8 rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Send className="w-4 h-4 text-cyan-400" /> Por tipo de servicio
              </h3>
              {pieData.some(d => d.value > 0) ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="55%" height={180}>
                    <PieChart>
                      <Pie data={pieData} innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                        {pieData.map((_, i) => <Cell key={i} fill={TIPO_COLORS[i]} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0d1526', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }}
                        formatter={(v) => [typeof v === 'number' ? v : 0, 'cotizaciones']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-3">
                    {pieData.map((d, i) => (
                      <div key={d.name}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: TIPO_COLORS[i] }} />
                          <span className="text-xs font-medium text-slate-300">{d.name}</span>
                        </div>
                        <p className="text-xs text-slate-500 ml-4">
                          {d.value} cot · {fmtQk(i === 0 ? data.resumen.montoPerforacion : data.resumen.montoLimpieza)}
                        </p>
                      </div>
                    ))}
                    <div className="pt-1 border-t border-white/5">
                      <p className="text-xs text-slate-500">Total: {data.resumen.total} cotizaciones</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-slate-600 text-sm">Sin datos en el período</div>
              )}
            </div>
          </div>
        )}

        {/* VENDOR TABLE (superadmin only) */}
        {isSuperAdmin && data && data.porVendedor.length > 0 && (
          <div className="bg-[#0d1526] border border-white/8 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5">
              <h3 className="text-sm font-semibold text-white">Comparativo por vendedor</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Vendedor','Total','Monto Total','Confirmadas','Enviadas','Canceladas','% Conversión'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-slate-500 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...data.porVendedor].sort((a, b) => b.monto - a.monto).map((v, i) => (
                    <tr key={v.vendedor} className={cn('border-b border-white/3', i % 2 !== 0 && 'bg-white/2')}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                            style={{ backgroundColor: VENDOR_COLORS[i % VENDOR_COLORS.length] }}>
                            {v.vendedor.split(' ').map(p => p[0]).join('').slice(0,2)}
                          </div>
                          <span className="text-slate-300">{v.vendedor}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400">{v.total}</td>
                      <td className="px-4 py-2.5 text-slate-300 font-medium whitespace-nowrap">{fmtQ(v.monto)}</td>
                      <td className="px-4 py-2.5 text-emerald-400">{v.confirmadas}</td>
                      <td className="px-4 py-2.5 text-blue-400">{v.enviadas}</td>
                      <td className="px-4 py-2.5 text-red-400">{v.canceladas}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium',
                          v.conversionPct >= 50 ? 'bg-emerald-500/20 text-emerald-400' :
                          v.conversionPct >= 25 ? 'bg-amber-500/20 text-amber-400' :
                                                  'bg-red-500/20 text-red-400'
                        )}>
                          {v.conversionPct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/8 bg-white/3">
                    <td className="px-4 py-2.5 text-slate-300 font-semibold">Total</td>
                    <td className="px-4 py-2.5 text-slate-300 font-semibold">{data.resumen.total}</td>
                    <td className="px-4 py-2.5 text-white font-bold whitespace-nowrap">{fmtQ(data.resumen.monto)}</td>
                    <td className="px-4 py-2.5 text-emerald-400 font-semibold">{data.resumen.confirmadas}</td>
                    <td className="px-4 py-2.5 text-blue-400 font-semibold">{data.resumen.enviadas}</td>
                    <td className="px-4 py-2.5 text-red-400 font-semibold">{data.resumen.canceladas}</td>
                    <td className="px-4 py-2.5 text-slate-300 font-semibold">{data.resumen.conversionPct.toFixed(1)}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* COTIZACIONES TABLE */}
        {data && (
          <div className="bg-[#0d1526] border border-white/8 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Cotizaciones del período</h3>
              <span className="text-xs text-slate-500">{cotizaciones.length} registros</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Correlativo','Cliente','Empresa','Tipo','Estado','Monto','Fecha','Vendedor'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-slate-500 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((c, i) => {
                    const est = ESTADO_MAP[c.estado] ?? { label: c.estado, cls: 'bg-slate-500/20 text-slate-400' }
                    return (
                      <tr key={c.id} className={cn(
                        'border-b border-white/3',
                        i % 2 !== 0 && 'bg-white/2',
                        c.estado === 'confirmada' && 'bg-emerald-500/3',
                        c.estado === 'cancelada'  && 'bg-red-500/3'
                      )}>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openCotizacion(c.correlativo)}
                            disabled={openingId === c.correlativo}
                            className="inline-flex items-center gap-1.5 font-mono text-[11px] text-blue-400 hover:text-blue-300 hover:underline disabled:opacity-50"
                            title="Abrir cotizacion"
                          >
                            <Eye className="w-3 h-3" />
                            {c.correlativo}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-slate-300 max-w-[120px] truncate">{c.cliente}</td>
                        <td className="px-4 py-2.5 text-slate-500 max-w-[100px] truncate">{c.empresa}</td>
                        <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{c.tipo === 'perforacion' ? 'Perforación' : 'Limpieza'}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-medium', est.cls)}>{est.label}</span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-300 font-medium whitespace-nowrap">{fmtQ(c.monto)}</td>
                        <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{c.fecha}</td>
                        <td className="px-4 py-2.5 text-slate-400 max-w-[80px] truncate">{c.vendedor.split(' ')[0]}</td>
                      </tr>
                    )
                  })}
                  {paginated.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-600">
                        Sin cotizaciones en el período seleccionado
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                <span className="text-xs text-slate-500">
                  Pág. {page} de {totalPages} · {cotizaciones.length} total
                </span>
                <div className="flex gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 disabled:opacity-30 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 disabled:opacity-30 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!data && !loading && (
          <div className="flex items-center justify-center py-16 text-slate-600 text-sm">
            Selecciona un período y presiona &quot;Generar&quot;
          </div>
        )}
      </div>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, highlight = false }: {
  icon: React.ReactNode; label: string; value: string; sub: string; highlight?: boolean
}) {
  return (
    <div className={cn('bg-[#0d1526] border rounded-2xl p-4', highlight ? 'border-emerald-500/25' : 'border-white/8')}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-500">{label}</span>
        {icon}
      </div>
      <p className={cn('text-xl font-bold', highlight ? 'text-emerald-400' : 'text-white')}>{value}</p>
      <p className="text-xs text-slate-600 mt-0.5">{sub}</p>
    </div>
  )
}
