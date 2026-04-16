'use client'

import { useState, useEffect } from 'react'
import { type CotizacionRecord } from '@/lib/quotation-store'
import { type Rol } from '@/lib/config-store'
import {
  TrendingUp, CheckCircle, FileText, Send, AlertCircle,
  Plus, Download, Printer, Users, Award, XCircle,
  RefreshCw, ChevronDown, ArrowUpRight, Archive, X
} from 'lucide-react'
import type { QuotationData } from '@/lib/quotation-store'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfQuarter, endOfQuarter,
  startOfYear, subMonths, format
} from 'date-fns'
import { es } from 'date-fns/locale'
import * as XLSX from 'xlsx'

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
  cotizaciones: CotizacionRecord[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function getCookie(name: string) {
  if (typeof document === 'undefined') return ''
  return document.cookie.match(new RegExp(`${name}=([^;]+)`))?.[1] ?? ''
}

const fmtQ  = (n: number) => 'Q ' + Math.round(n).toLocaleString('es-GT')
const fmtQk = (n: number) =>
  n >= 1_000_000 ? `Q${(n/1_000_000).toFixed(1)}M` :
  n >= 1_000     ? `Q${(n/1_000).toFixed(0)}k`     : `Q${n}`

function parseFecha(f: string): Date {
  const p = f.split('/')
  return p.length === 3 ? new Date(+p[2], +p[1]-1, +p[0]) : new Date()
}

function diasDesde(f: string) {
  return Math.max(0, Math.floor((Date.now() - parseFecha(f).getTime()) / 86400000))
}

const M = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const D = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']

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

const ESTADO_COLORS: Record<string, string> = {
  borrador: '#64748b', enviada: '#3b82f6', confirmada: '#10b981', cancelada: '#ef4444',
}
const TIPO_COLORS = ['#3b82f6', '#06b6d4']

// ── Period-aware trend chart builder ───────────────────────────────────────────
type TrendPoint = { label: string; monto: number; count: number }

function buildTrend(cots: CotizacionRecord[], periodo: Periodo, customFrom: string, customTo: string): TrendPoint[] | null {
  if (!cots.length || periodo === 'hoy') return null

  const { from, to } = getPeriodRange(periodo, customFrom, customTo)

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  const sameMonth = (f: Date, yr: number, mo: number) =>
    f.getFullYear() === yr && f.getMonth() === mo

  const sumRange = (start: Date, end: Date): TrendPoint => {
    const items = cots.filter(c => { const f = parseFecha(c.fecha); return f >= start && f <= end })
    return { label: '', monto: Math.round(items.reduce((a,b) => a+b.monto,0)/1000), count: items.length }
  }

  if (periodo === 'semana') {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(from); d.setDate(d.getDate() + i)
      const items = cots.filter(c => sameDay(parseFecha(c.fecha), d))
      return { label: D[i], monto: Math.round(items.reduce((a,b)=>a+b.monto,0)/1000), count: items.length }
    })
  }

  if (periodo === 'mes') {
    const weeks: TrendPoint[] = []
    const cur = new Date(from)
    let w = 1
    while (cur <= to) {
      const start = new Date(cur)
      const end   = new Date(cur); end.setDate(end.getDate() + 6)
      if (end > to) end.setTime(to.getTime())
      weeks.push({ ...sumRange(start, end), label: `Sem ${w}` })
      cur.setDate(cur.getDate() + 7); w++
    }
    return weeks
  }

  if (periodo === 'trimestre') {
    return Array.from({ length: 3 }, (_, i) => {
      const yr = from.getFullYear(), mo = from.getMonth() + i
      const items = cots.filter(c => sameMonth(parseFecha(c.fecha), yr, mo))
      return { label: M[mo % 12], monto: Math.round(items.reduce((a,b)=>a+b.monto,0)/1000), count: items.length }
    })
  }

  if (periodo === 'anio') {
    return Array.from({ length: 12 }, (_, mo) => {
      const items = cots.filter(c => sameMonth(parseFecha(c.fecha), from.getFullYear(), mo))
      return { label: M[mo], monto: Math.round(items.reduce((a,b)=>a+b.monto,0)/1000), count: items.length }
    })
  }

  if (periodo === 'personalizado') {
    const days = Math.ceil((to.getTime() - from.getTime()) / 86400000)
    if (days <= 31) {
      const result: TrendPoint[] = []
      const cur = new Date(from)
      while (cur <= to) {
        const d = new Date(cur)
        const items = cots.filter(c => sameDay(parseFecha(c.fecha), d))
        result.push({ label: `${d.getDate()}/${d.getMonth()+1}`, monto: Math.round(items.reduce((a,b)=>a+b.monto,0)/1000), count: items.length })
        cur.setDate(cur.getDate() + 1)
      }
      return result
    } else if (days <= 91) {
      const result: TrendPoint[] = []
      const cur = new Date(from); let w = 1
      while (cur <= to) {
        const start = new Date(cur); const end = new Date(cur); end.setDate(end.getDate() + 6)
        if (end > to) end.setTime(to.getTime())
        result.push({ ...sumRange(start, end), label: `Sem ${w}` })
        cur.setDate(cur.getDate() + 7); w++
      }
      return result
    } else {
      const result: TrendPoint[] = []
      const cur = new Date(from.getFullYear(), from.getMonth(), 1)
      while (cur <= to) {
        const items = cots.filter(c => sameMonth(parseFecha(c.fecha), cur.getFullYear(), cur.getMonth()))
        result.push({ label: M[cur.getMonth()], monto: Math.round(items.reduce((a,b)=>a+b.monto,0)/1000), count: items.length })
        cur.setMonth(cur.getMonth() + 1)
      }
      return result
    }
  }

  return null
}

const TREND_TITLE: Record<Periodo, string> = {
  hoy:          '',
  semana:       'Monto por día esta semana (Q miles)',
  mes:          'Monto por semana este mes (Q miles)',
  trimestre:    'Monto por mes este trimestre (Q miles)',
  anio:         'Monto por mes este año (Q miles)',
  personalizado:'Tendencia del período (Q miles)',
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [periodo, setPeriodo]       = useState<Periodo>('mes')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]     = useState('')
  const [loading, setLoading]       = useState(true)
  const [data, setData]             = useState<ReportData | null>(null)
  const [role, setRole]             = useState<Rol>('admin')
  const [vendedor, setVendedor]     = useState('')
  const [init, setInit]             = useState(false)
  const [expandedVendor, setExpanded] = useState<string | null>(null)
  const [zipOpen, setZipOpen]           = useState(false)
  const [zipSelected, setZipSelected]   = useState<Set<string>>(new Set())
  const [zipProgress, setZipProgress]   = useState<{ done: number; total: number } | null>(null)
  const [sinBitacora, setSinBitacora]   = useState<{ id: string; cliente: string; vendedor: string }[]>([])

  // Read auth cookies once
  useEffect(() => {
    const r = getCookie('user_role') as Rol || 'admin'
    const v = getCookie('user_vendedor') || ''
    setRole(r); setVendedor(v); setInit(true)
  }, [])

  // Fetch proyectos sin bitácora hoy
  useEffect(() => {
    if (!init) return
    const q = role === 'superadmin' ? '' : `?vendedor=${encodeURIComponent(vendedor)}`
    fetch(`/api/proyectos/sin-actualizar${q}`)
      .then(r => r.ok ? r.json() : [])
      .then(setSinBitacora)
      .catch(() => {})
  }, [init, role, vendedor])

  // Fetch period-filtered report (re-runs whenever period or auth changes)
  useEffect(() => {
    if (!init) return
    const load = async () => {
      setLoading(true)
      const { from, to } = getPeriodRange(periodo, customFrom, customTo)
      const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })
      if (role !== 'superadmin' && vendedor) params.set('vendedor', vendedor)
      const res = await fetch(`/api/reportes?${params}`)
      if (res.ok) setData(await res.json())
      setLoading(false)
    }
    load()
  }, [init, periodo, customFrom, customTo, role, vendedor])

  const isSuperAdmin = role === 'superadmin'
  const periodLabel  = getPeriodRange(periodo, customFrom, customTo).label

  // ── Derived chart data (all computed from the same period-filtered data) ────
  const estadoData = (['borrador','enviada','confirmada','cancelada'] as const).map(key => ({
    name:  key === 'borrador' ? 'Borrador' : key === 'enviada' ? 'Enviada' : key === 'confirmada' ? 'Confirmada' : 'Cancelada',
    monto: Math.round((data?.cotizaciones.filter(c => c.estado === key).reduce((a,b)=>a+b.monto,0) ?? 0) / 1000),
    count: data?.cotizaciones.filter(c => c.estado === key).length ?? 0,
    color: ESTADO_COLORS[key],
  }))

  const tipoData = [
    { name: 'Perforación', value: data?.resumen.perforacion ?? 0 },
    { name: 'Limpieza',    value: data?.resumen.limpieza    ?? 0 },
  ].filter(d => d.value > 0)

  // Trend: computed from the same period data, grouped by the right interval
  const trendData = data ? buildTrend(data.cotizaciones, periodo, customFrom, customTo) : null

  const pendientes = [...(data?.cotizaciones.filter(c => c.estado === 'enviada') ?? [])]
    .sort((a, b) => parseFecha(a.fecha).getTime() - parseFecha(b.fecha).getTime())
    .slice(0, 5)

  // ── Excel export ───────────────────────────────────────────────────────────
  function exportExcel() {
    if (!data) return
    const wb = XLSX.utils.book_new()

    const wsRes = XLSX.utils.aoa_to_sheet([
      ['REPORTE HIDROPERFORACIONES GUATEMALA'],
      [`Período: ${periodLabel}`],
      [`Generado: ${format(new Date(),'dd/MM/yyyy HH:mm')}`],
      [],
      ['Vendedor','Cotizaciones','Monto Total (Q)','Confirmadas','Monto Confirmado (Q)','Enviadas','Canceladas','% Conv.'],
      ...data.porVendedor.map(v => [v.vendedor, v.total, v.monto, v.confirmadas, v.confirmadoMonto, v.enviadas, v.canceladas, `${v.conversionPct}%`]),
      [], ['TOTALES', data.resumen.total, data.resumen.monto, data.resumen.confirmadas, data.resumen.confirmadoMonto, data.resumen.enviadas, data.resumen.canceladas, `${data.resumen.conversionPct}%`],
      [], ['--- POR TIPO ---'],
      ['Tipo','Cotizaciones','Monto (Q)'],
      ['Perforación', data.resumen.perforacion, data.resumen.montoPerforacion],
      ['Limpieza',    data.resumen.limpieza,    data.resumen.montoLimpieza],
    ])
    wsRes['!cols'] = [{wch:28},{wch:14},{wch:20},{wch:14},{wch:22},{wch:10},{wch:12},{wch:14}]
    XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen')

    const wsCot = XLSX.utils.aoa_to_sheet([
      ['Correlativo','Fecha','Cliente','Empresa','Proyecto','Tipo','Monto (Q)','Estado','Vendedor'],
      ...data.cotizaciones.map(c => [c.correlativo, c.fecha, c.cliente, c.empresa ?? '', c.proyecto, c.tipo === 'perforacion' ? 'Perforación' : 'Limpieza', c.monto, c.estado, c.vendedor]),
    ])
    wsCot['!cols'] = [{wch:14},{wch:12},{wch:24},{wch:24},{wch:32},{wch:18},{wch:14},{wch:12},{wch:22}]
    XLSX.utils.book_append_sheet(wb, wsCot, 'Cotizaciones')

    data.porVendedor.forEach(vs => {
      const ws = XLSX.utils.aoa_to_sheet([
        [`COTIZACIONES — ${vs.vendedor}`], [`Período: ${periodLabel}`], [],
        ['Cotizaciones:', vs.total], ['Monto Total:', `Q ${vs.monto.toLocaleString('es-GT')}`],
        ['Confirmadas:', vs.confirmadas], ['Monto Confirmado:', `Q ${vs.confirmadoMonto.toLocaleString('es-GT')}`],
        ['% Conversión:', `${vs.conversionPct}%`], [],
        ['Correlativo','Fecha','Cliente','Empresa','Tipo','Monto (Q)','Estado'],
        ...data.cotizaciones.filter(c => c.vendedor === vs.vendedor).map(c => [
          c.correlativo, c.fecha, c.cliente, c.empresa ?? '',
          c.tipo === 'perforacion' ? 'Perforación' : 'Limpieza', c.monto, c.estado,
        ]),
      ])
      ws['!cols'] = [{wch:14},{wch:12},{wch:24},{wch:24},{wch:14},{wch:14},{wch:12}]
      XLSX.utils.book_append_sheet(wb, ws, vs.vendedor.split(' ')[0].slice(0,12))
    })

    XLSX.writeFile(wb, `HidroCRM_${periodLabel.replace(/[^a-zA-Z0-9]/g,'_')}.xlsx`)
  }

  // ── ZIP de PDFs ────────────────────────────────────────────────────────────
  function openZipModal() {
    const all = new Set(data?.porVendedor.map(v => v.vendedor) ?? [])
    setZipSelected(all)
    setZipOpen(true)
  }

  async function downloadZip(selectedVendors?: Set<string>) {
    if (!data) return
    const vendors = selectedVendors ?? new Set([vendedor])
    const cots = data.cotizaciones.filter(c => vendors.has(c.vendedor) && c.datos)
    if (cots.length === 0) {
      alert('No hay cotizaciones con datos completos en este período para los vendedores seleccionados.')
      return
    }
    setZipProgress({ done: 0, total: cots.length })
    try {
      const [{ generarPDF, sanitize }, { default: JSZip }] = await Promise.all([
        import('@/lib/pdf-cotizacion'),
        import('jszip'),
      ])
      const zip = new JSZip()
      for (let i = 0; i < cots.length; i++) {
        const c = cots[i]
        try {
          const qdata = JSON.parse(c.datos ?? '{}') as QuotationData
          const pdfBytes = await generarPDF(qdata)
          const folder = sanitize(c.vendedor)
          const fileName = `${c.correlativo}_${sanitize(c.cliente)}.pdf`
          zip.folder(folder)?.file(fileName, pdfBytes)
        } catch { /* omitir cotización con error */ }
        setZipProgress({ done: i + 1, total: cots.length })
        await new Promise(r => setTimeout(r, 0))
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `HidroCRM_PDFs_${periodLabel.replace(/[^a-zA-Z0-9]/g,'_')}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setZipProgress(null)
      setZipOpen(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#070d1a]">

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-white/5 bg-[#0a1020] shrink-0 no-print">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">Dashboard</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {loading ? 'Cargando...' : `${data?.resumen.total ?? 0} cotizaciones · ${periodLabel}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()}
              className="flex items-center gap-2 bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600/30 px-3 py-2 rounded-xl text-sm font-medium transition-all">
              <Printer className="w-4 h-4" /><span className="hidden sm:inline"> Imprimir</span>
            </button>
            <button onClick={exportExcel} disabled={!data || loading}
              className="flex items-center gap-2 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 px-3 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-40">
              <Download className="w-4 h-4" /><span className="hidden sm:inline"> Excel</span>
            </button>
            <button
              onClick={() => isSuperAdmin ? openZipModal() : downloadZip()}
              disabled={!data || loading || zipProgress !== null}
              title="Descargar cotizaciones como PDFs comprimidos en ZIP"
              className="flex items-center gap-2 bg-violet-600/20 border border-violet-500/30 text-violet-400 hover:bg-violet-600/30 px-3 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-40">
              {zipProgress
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> {zipProgress.done}/{zipProgress.total}</>
                : <><Archive className="w-4 h-4" /><span className="hidden sm:inline"> PDFs</span></>
              }
            </button>
            <Link href="/cotizaciones/nueva"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-500/20">
              <Plus className="w-4 h-4" /> Nueva
            </Link>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-2 flex-wrap">
          {([
            { id: 'hoy',           label: 'Hoy'          },
            { id: 'semana',        label: 'Esta Semana'  },
            { id: 'mes',           label: 'Este Mes'     },
            { id: 'trimestre',     label: 'Trimestre'    },
            { id: 'anio',          label: 'Este Año'     },
            { id: 'personalizado', label: 'Personalizado'},
          ] as const).map(p => (
            <button key={p.id} onClick={() => setPeriodo(p.id)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-medium transition-all',
                periodo === p.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-white/8'
              )}>
              {p.label}
            </button>
          ))}
          {periodo === 'personalizado' && (
            <div className="flex items-center gap-2 ml-1">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500/50" />
              <span className="text-slate-600 text-xs">—</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500/50" />
            </div>
          )}
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block px-6 py-4 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard — Hidroperforaciones Guatemala</h1>
        <p className="text-slate-600 mt-1">Período: {periodLabel}</p>
        <p className="text-slate-500 text-sm">Generado el {format(new Date(), "dd 'de' MMMM yyyy HH:mm", { locale: es })}</p>
      </div>

      {/* ── CONTENT ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-32 gap-3 text-slate-500">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm">Cargando datos...</span>
          </div>
        ) : !data ? null : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <KPICard icon={<FileText    className="w-4 h-4 text-blue-400"    />} label="Cotizaciones" value={String(data.resumen.total)}          sub="en el período"                        color="blue"    />
              <KPICard icon={<TrendingUp  className="w-4 h-4 text-slate-300"   />} label="Monto Total"  value={fmtQk(data.resumen.monto)}            sub={fmtQ(data.resumen.monto)}             color="slate"   />
              <KPICard icon={<CheckCircle className="w-4 h-4 text-emerald-400" />} label="Confirmadas"  value={String(data.resumen.confirmadas)}      sub={fmtQ(data.resumen.confirmadoMonto)}   color="emerald" />
              <KPICard icon={<Send        className="w-4 h-4 text-amber-400"   />} label="Enviadas"     value={String(data.resumen.enviadas)}          sub="sin respuesta"                        color="amber"   />
              <KPICard icon={<XCircle     className="w-4 h-4 text-red-400"     />} label="Canceladas"   value={String(data.resumen.canceladas)}        sub="perdidas"                             color="red"     />
              <KPICard icon={<Award       className="w-4 h-4 text-violet-400"  />} label="Conversión"   value={`${data.resumen.conversionPct}%`}       sub={`${data.resumen.confirmadas}/${data.resumen.total}`} color="violet" />
            </div>

            {/* Bitácora pendiente */}
            {sinBitacora.length > 0 && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-300">
                    {sinBitacora.length} proyecto{sinBitacora.length > 1 ? 's' : ''} sin bitácora hoy
                  </p>
                  <p className="text-xs text-amber-400/70 mt-0.5">
                    {sinBitacora.map(p => p.cliente).join(', ')}
                  </p>
                </div>
                <Link href="/proyectos" className="text-xs text-amber-400 hover:text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg transition-colors shrink-0">
                  Ver proyectos
                </Link>
              </div>
            )}

            {/* Bar + Pie */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-[#0d1526] rounded-xl border border-white/5 p-5">
                <h2 className="text-sm font-semibold text-slate-300 mb-4">Monto por Estado (Q miles)</h2>
                {estadoData.every(d => d.monto === 0) ? (
                  <div className="flex items-center justify-center h-[200px] text-slate-600 text-sm">Sin cotizaciones en este período</div>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={estadoData} barSize={40}>
                      <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} unit="k" />
                      <Tooltip
                        contentStyle={{ background: '#0f1829', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, fontSize: 12, color: '#e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
                        labelStyle={{ color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}
                        itemStyle={{ color: '#e2e8f0' }}
                        formatter={(v, _, p) => [`Q ${Number(v).toLocaleString('es-GT')}k  ·  ${(p.payload as {count:number}).count} cot.`, '']}
                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      />
                      <Bar dataKey="monto" radius={[4,4,0,0]}>
                        {estadoData.map((e, i) => <Cell key={i} fill={e.color} fillOpacity={0.85} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-[#0d1526] rounded-xl border border-white/5 p-5">
                <h2 className="text-sm font-semibold text-slate-300 mb-4">Por Tipo de Servicio</h2>
                {tipoData.length === 0 ? (
                  <div className="flex items-center justify-center h-[200px] text-slate-600 text-sm">Sin datos</div>
                ) : (
                  <div className="flex flex-col items-center">
                    <PieChart width={160} height={160}>
                      <Pie data={tipoData} cx={80} cy={80} innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                        {tipoData.map((_, i) => <Cell key={i} fill={TIPO_COLORS[i]} />)}
                      </Pie>
                    </PieChart>
                    <div className="space-y-2 w-full mt-2">
                      {tipoData.map((d, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: TIPO_COLORS[i] }} />
                            <span className="text-slate-400">{d.name}</span>
                          </div>
                          <span className="font-semibold text-white">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Trend chart + Enviadas pendientes */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {trendData ? (
                <div className="lg:col-span-2 bg-[#0d1526] rounded-xl border border-white/5 p-5">
                  <h2 className="text-sm font-semibold text-slate-300 mb-4">{TREND_TITLE[periodo]}</h2>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} unit="k" />
                      <Tooltip
                        contentStyle={{ background: '#0f1829', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, fontSize: 12, color: '#e2e8f0', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
                        labelStyle={{ color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}
                        itemStyle={{ color: '#e2e8f0' }}
                        formatter={(v, _, p) => [`Q ${Number(v).toLocaleString('es-GT')}k  ·  ${(p.payload as {count:number}).count} cot.`, '']}
                      />
                      <Area type="monotone" dataKey="monto" stroke="#3b82f6" strokeWidth={2} fill="url(#blueGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                /* hoy: span 2 with a summary bar */
                <div className="lg:col-span-2 bg-[#0d1526] rounded-xl border border-white/5 p-5 flex flex-col justify-center items-center gap-2">
                  <p className="text-sm font-semibold text-slate-300">Resumen del día</p>
                  <p className="text-4xl font-black text-white">{fmtQk(data.resumen.monto)}</p>
                  <p className="text-xs text-slate-500">{data.resumen.total} cotización{data.resumen.total !== 1 ? 'es' : ''} hoy</p>
                </div>
              )}

              <div className="bg-[#0d1526] rounded-xl border border-white/5 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-slate-300">Enviadas sin confirmar</h2>
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                </div>
                {pendientes.length === 0 ? (
                  <p className="text-xs text-slate-600 text-center py-8">Sin cotizaciones enviadas pendientes</p>
                ) : (
                  <div className="space-y-3">
                    {pendientes.map(c => {
                      const dias = diasDesde(c.fecha)
                      return (
                        <div key={c.correlativo} className="flex items-center gap-3">
                          <div className={cn(
                            'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                            dias > 20 ? 'bg-red-500/20 text-red-400' :
                            dias > 10 ? 'bg-amber-500/20 text-amber-400' :
                                        'bg-blue-500/20 text-blue-400'
                          )}>{dias}d</div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-200 truncate">{c.cliente}</p>
                            <p className="text-[10px] text-slate-500">{fmtQ(c.monto)}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Vendor breakdown — superadmin only */}
            {isSuperAdmin && data.porVendedor.length > 0 && (
              <div className="bg-[#0d1526] rounded-xl border border-white/5 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <p className="text-sm font-semibold text-slate-300">Desglose por Vendedor</p>
                </div>
                <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-white/5">
                    <tr className="text-xs text-slate-500">
                      <th className="text-left px-5 py-3 font-medium">Vendedor</th>
                      <th className="text-right px-4 py-3 font-medium">Cotizaciones</th>
                      <th className="text-right px-4 py-3 font-medium">Monto Total</th>
                      <th className="text-right px-4 py-3 font-medium">Confirmadas</th>
                      <th className="text-right px-4 py-3 font-medium">Monto Conf.</th>
                      <th className="text-right px-4 py-3 font-medium">Enviadas</th>
                      <th className="text-right px-4 py-3 font-medium">% Conv.</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/4">
                    {data.porVendedor.map(v => (
                      <VendorRow key={v.vendedor} v={v} cotizaciones={data.cotizaciones}
                        expanded={expandedVendor === v.vendedor}
                        onToggle={() => setExpanded(expandedVendor === v.vendedor ? null : v.vendedor)} />
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}

            {/* Cotizaciones del período */}
            <div className="bg-[#0d1526] rounded-xl border border-white/5 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-300">
                  Cotizaciones del Período
                  <span className="ml-1.5 text-xs text-slate-500 font-normal">({data.cotizaciones.length})</span>
                </h2>
                <Link href="/cotizaciones" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  Ver todas <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
              {data.cotizaciones.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-slate-600">
                  <FileText className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">Sin cotizaciones en este período</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-500 border-b border-white/5">
                        <th className="text-left pb-3 font-medium">Correlativo</th>
                        <th className="text-left pb-3 font-medium">Cliente</th>
                        <th className="text-left pb-3 font-medium">Tipo</th>
                        <th className="text-right pb-3 font-medium">Monto</th>
                        <th className="text-left pb-3 font-medium">Estado</th>
                        {isSuperAdmin && <th className="text-left pb-3 font-medium">Vendedor</th>}
                        <th className="text-left pb-3 font-medium">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {data.cotizaciones.slice(0,10).map(c => (
                        <tr key={c.correlativo} className="hover:bg-white/2 transition-colors">
                          <td className="py-3 text-blue-400 font-mono text-xs">{c.correlativo}</td>
                          <td className="py-3">
                            <p className="text-slate-200 font-medium">{c.cliente}</p>
                            {c.empresa && <p className="text-[10px] text-slate-500">{c.empresa}</p>}
                          </td>
                          <td className="py-3 text-slate-400 text-xs">{c.tipo === 'perforacion' ? 'Perforación' : 'Limpieza'}</td>
                          <td className="py-3 text-white font-semibold text-right">{fmtQ(c.monto)}</td>
                          <td className="py-3"><StatusBadge status={c.estado} /></td>
                          {isSuperAdmin && <td className="py-3 text-slate-400 text-xs">{c.vendedor}</td>}
                          <td className="py-3 text-slate-500 text-xs">{c.fecha}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── MODAL ZIP ───────────────────────────────────────────────── */}
      {zipOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0d1526] border border-white/10 rounded-2xl p-6 w-[380px] shadow-2xl">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Archive className="w-4 h-4 text-violet-400" /> Descargar PDFs
              </h3>
              <button onClick={() => !zipProgress && setZipOpen(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              {periodLabel} · {data?.cotizaciones.filter(c => zipSelected.has(c.vendedor) && c.datos).length ?? 0} cotizaciones con datos
            </p>

            <div className="space-y-1.5 mb-5 max-h-52 overflow-y-auto">
              {/* Todos */}
              <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/4 cursor-pointer transition-colors">
                <input type="checkbox"
                  className="w-4 h-4 accent-violet-500 cursor-pointer"
                  checked={data?.porVendedor.length === zipSelected.size && zipSelected.size > 0}
                  onChange={e => {
                    if (e.target.checked) setZipSelected(new Set(data?.porVendedor.map(v => v.vendedor)))
                    else setZipSelected(new Set())
                  }}
                />
                <span className="text-sm text-slate-200 font-medium">Todos los vendedores</span>
              </label>
              {data?.porVendedor.map(v => {
                const count = data.cotizaciones.filter(c => c.vendedor === v.vendedor && c.datos).length
                return (
                  <label key={v.vendedor} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/4 cursor-pointer transition-colors pl-7">
                    <input type="checkbox"
                      className="w-4 h-4 accent-violet-500 cursor-pointer"
                      checked={zipSelected.has(v.vendedor)}
                      onChange={e => {
                        const next = new Set(zipSelected)
                        if (e.target.checked) next.add(v.vendedor)
                        else next.delete(v.vendedor)
                        setZipSelected(next)
                      }}
                    />
                    <span className="text-sm text-slate-300 flex-1">{v.vendedor}</span>
                    <span className="text-xs text-slate-600">{count} cot.</span>
                  </label>
                )
              })}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => !zipProgress && setZipOpen(false)}
                disabled={zipProgress !== null}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-slate-200 text-sm transition-all disabled:opacity-40">
                Cancelar
              </button>
              <button
                onClick={() => downloadZip(zipSelected)}
                disabled={zipSelected.size === 0 || zipProgress !== null}
                className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                {zipProgress
                  ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generando {zipProgress.done}/{zipProgress.total}</>
                  : <><Archive className="w-3.5 h-3.5" /> Descargar ZIP</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── VendorRow ─────────────────────────────────────────────────────────────────
function VendorRow({ v, cotizaciones, expanded, onToggle }: {
  v: VendedorStats; cotizaciones: CotizacionRecord[]; expanded: boolean; onToggle: () => void
}) {
  return (
    <>
      <tr className="hover:bg-white/2 transition-colors cursor-pointer" onClick={onToggle}>
        <td className="px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-[10px] font-bold text-white">
              {v.vendedor.split(' ').map(n => n[0]).join('').slice(0,2)}
            </div>
            <span className="font-medium text-slate-200">{v.vendedor}</span>
          </div>
        </td>
        <td className="text-right px-4 py-3 text-white font-bold">{v.total}</td>
        <td className="text-right px-4 py-3 text-white font-bold">{fmtQ(v.monto)}</td>
        <td className="text-right px-4 py-3 text-emerald-400 font-bold">{v.confirmadas}</td>
        <td className="text-right px-4 py-3 text-emerald-400 font-bold">{fmtQ(v.confirmadoMonto)}</td>
        <td className="text-right px-4 py-3 text-blue-400">{v.enviadas}</td>
        <td className="text-right px-4 py-3">
          <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-bold',
            v.conversionPct >= 50 ? 'bg-emerald-500/20 text-emerald-400' :
            v.conversionPct >= 25 ? 'bg-amber-500/20 text-amber-400' :
                                    'bg-red-500/20 text-red-400'
          )}>{v.conversionPct}%</span>
        </td>
        <td className="px-4 py-3 text-slate-600">
          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')} />
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} className="px-5 py-3 bg-white/2 text-xs text-slate-400">
            <p>Borradores: <span className="text-slate-300">{v.borradores}</span> · Canceladas: <span className="text-red-400">{v.canceladas}</span></p>
            <p className="text-slate-500 mt-0.5">{cotizaciones.filter(c => c.vendedor === v.vendedor).map(c => c.correlativo).join(', ')}</p>
          </td>
        </tr>
      )}
    </>
  )
}

// ── KPICard ────────────────────────────────────────────────────────────────────
function KPICard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string
  color: 'blue' | 'slate' | 'emerald' | 'amber' | 'red' | 'violet'
}) {
  const cls = {
    blue: 'border-blue-500/15 bg-blue-500/5', slate: 'border-white/5 bg-white/3',
    emerald: 'border-emerald-500/15 bg-emerald-500/5', amber: 'border-amber-500/15 bg-amber-500/5',
    red: 'border-red-500/15 bg-red-500/5', violet: 'border-violet-500/15 bg-violet-500/5',
  }[color]
  return (
    <div className={cn('rounded-xl border px-4 py-3', cls)}>
      <div className="mb-2">{icon}</div>
      <p className="text-xl font-black text-white leading-none">{value}</p>
      <p className="text-[11px] text-slate-500 mt-1">{label}</p>
      <p className="text-[10px] text-slate-600">{sub}</p>
    </div>
  )
}

// ── StatusBadge ────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    borrador:   { label: 'Borrador',   cls: 'bg-slate-500/20 text-slate-400'     },
    enviada:    { label: 'Enviada',    cls: 'bg-blue-500/20 text-blue-400'       },
    confirmada: { label: 'Confirmada', cls: 'bg-emerald-500/20 text-emerald-400' },
    cancelada:  { label: 'Cancelada',  cls: 'bg-red-500/20 text-red-400'         },
  }
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-slate-500/20 text-slate-400' }
  return <span className={cn('px-2 py-0.5 rounded-md text-xs font-medium', cls)}>{label}</span>
}
