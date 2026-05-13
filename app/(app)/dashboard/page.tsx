'use client'

import { useState, useEffect } from 'react'
import { type CotizacionRecord } from '@/lib/quotation-store'
import { type Rol } from '@/lib/config-store'
import {
  TrendingUp, CheckCircle, FileText, Send, AlertCircle,
  Plus, Download, Printer, Users, Award, XCircle,
  RefreshCw, ChevronDown, ArrowUpRight, Archive, X, HardHat, Clock,
  Drill, FlaskConical, Droplets
} from 'lucide-react'
import type { QuotationData } from '@/lib/quotation-store'
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { KPICard } from '@/components/kpi-card'
import { parseFechaFlexible } from '@/lib/date-format'
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, startOfQuarter, endOfQuarter,
  startOfYear, subMonths, format
} from 'date-fns'
import { es } from 'date-fns/locale'
import { exportXlsx } from '@/lib/export-xlsx'

// ── Types ──────────────────────────────────────────────────────────────────────
type Periodo = 'historial' | 'hoy' | 'semana' | 'mes' | 'trimestre' | 'anio' | 'personalizado'

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
  const m = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return m ? decodeURIComponent(m[1]) : ''
}

const fmtQ  = (n: number) => 'Q ' + (Number.isFinite(n) ? n : 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtQk = (n: number) =>
  n >= 1_000_000 ? `Q${(n/1_000_000).toFixed(1)}M` :
  n >= 1_000     ? `Q${(n/1_000).toFixed(0)}k`     : `Q${n}`

function parseFecha(f: string): Date {
  return parseFechaFlexible(f) ?? new Date()
}

function diasDesde(f: string) {
  return Math.max(0, Math.floor((Date.now() - parseFecha(f).getTime()) / 86400000))
}

const M = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const D = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']

function getPeriodRange(p: Periodo, from: string, to: string) {
  const now = new Date()
  switch (p) {
    case 'historial':
      return { from: null, to: endOfDay(now), label: 'Historial hasta hoy' }
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

  if (periodo === 'historial') {
    const fechas = cots
      .map(c => parseFechaFlexible(c.fecha))
      .filter((d): d is Date => Boolean(d))
      .sort((a, b) => a.getTime() - b.getTime())
    if (!fechas.length) return null

    const result: TrendPoint[] = []
    const cur = new Date(fechas[0].getFullYear(), fechas[0].getMonth(), 1)
    const end = new Date(to.getFullYear(), to.getMonth(), 1)
    while (cur <= end) {
      const yr = cur.getFullYear()
      const mo = cur.getMonth()
      const items = cots.filter(c => sameMonth(parseFecha(c.fecha), yr, mo))
      if (items.length > 0) {
        result.push({
          label: `${M[mo]} ${String(yr).slice(-2)}`,
          monto: Math.round(items.reduce((a,b)=>a+b.monto,0)/1000),
          count: items.length,
        })
      }
      cur.setMonth(cur.getMonth() + 1)
    }
    return result
  }

  if (!from) return null

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
  historial:    'Historial por mes (Q miles)',
  hoy:          '',
  semana:       'Monto por día esta semana (Q miles)',
  mes:          'Monto por semana este mes (Q miles)',
  trimestre:    'Monto por mes este trimestre (Q miles)',
  anio:         'Monto por mes este año (Q miles)',
  personalizado:'Tendencia del período (Q miles)',
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [periodo, setPeriodo]       = useState<Periodo>('historial')
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
  const [proyectosActivos, setProyectosActivos] = useState<{
    id: string; correlativo: string; cliente: string; empresa: string
    nombre: string; tipo: string; monto: number; vendedor: string
    fechaInicio: string; estado: string
    entradas: { fecha: string }[]
  }[]>([])
  const [operaciones, setOperaciones] = useState<{
    proyectosActivos: number
    porProyecto: {
      id: string; correlativo: string; cliente: string; empresa: string
      bentonita: { real: number; plan: number; clientePago: number; clienteQ: number; costoRealQ: number; pctUsado: number }
      pies:      { real: number; plan: number; pctUsado: number }
      pipas:     { real: number; clienteQ: number }
    }[]
    bentonita: { real: number; plan: number; clientePago: number; clienteQ: number; costoRealQ: number; pctUsado: number }
    pies:      { real: number; plan: number; pctUsado: number }
    pipas:     { real: number; clienteQ: number }
    alertas:   { gastosVencidos: number; gastosPorVencer: number }
  } | null>(null)

  // Resumen de Cuentas por Pagar / Cobrar (solo superadmin — el middleware bloquea el endpoint para admin)
  const [cuentas, setCuentas] = useState<{
    pagar:  { totalPendiente: number; countPendientes: number; countVencidas: number; montoVencidas: number; countPorVencer: number }
    cobrar: { totalPendiente: number; countPendientes: number; countVencidas: number; montoVencidas: number; countPorVencer: number }
  } | null>(null)

  const [refreshTick, setRefreshTick] = useState(0)
  const [generatedAtLabel, setGeneratedAtLabel] = useState('')

  // Read auth cookies once
  useEffect(() => {
    const r = getCookie('user_role') as Rol || 'admin'
    const v = getCookie('user_vendedor') || ''
    setRole(r); setVendedor(v); setInit(true)
  }, [])

  useEffect(() => {
    setGeneratedAtLabel(format(new Date(), "dd 'de' MMMM yyyy HH:mm", { locale: es }))
  }, [])

  // Auto-refresh: revalida cuando el tab vuelve a estar visible o recupera foco
  // (ej. el user aprobó una cotización en otra pestaña y vuelve al dashboard).
  useEffect(() => {
    const bump = () => setRefreshTick(n => n + 1)
    const onVisibility = () => { if (document.visibilityState === 'visible') bump() }
    window.addEventListener('focus', bump)
    document.addEventListener('visibilitychange', onVisibility)
    // Además polling cada 30s como fallback
    const iv = setInterval(bump, 30000)
    return () => {
      window.removeEventListener('focus', bump)
      document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(iv)
    }
  }, [])

  // Fetch proyectos sin bitácora hoy
  useEffect(() => {
    if (!init) return
    const q = role === 'superadmin' ? '' : `?vendedor=${encodeURIComponent(vendedor)}`
    fetch(`/api/proyectos/sin-actualizar${q}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : [])
      .then(setSinBitacora)
      .catch(() => {})
  }, [init, role, vendedor, refreshTick])

  // Fetch proyectos activos para widget en campo
  useEffect(() => {
    if (!init) return
    const params = new URLSearchParams({ estado: 'activo' })
    if (role !== 'superadmin' && vendedor) params.set('vendedor', vendedor)
    fetch(`/api/proyectos?${params}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : [])
      .then(setProyectosActivos)
      .catch(() => {})
  }, [init, role, vendedor, refreshTick])

  // Fetch métricas operativas agregadas (bentonita, pies, alertas)
  useEffect(() => {
    if (!init) return
    const q = role === 'superadmin' ? '' : `?vendedor=${encodeURIComponent(vendedor)}`
    fetch(`/api/dashboard/operaciones${q}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(setOperaciones)
      .catch(() => {})
  }, [init, role, vendedor, refreshTick])

  // Fetch resumen contable (solo superadmin tiene acceso por middleware)
  useEffect(() => {
    if (!init || role !== 'superadmin') { setCuentas(null); return }
    fetch('/api/dashboard/cuentas', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(setCuentas)
      .catch(() => {})
  }, [init, role, refreshTick])

  // Fetch period-filtered report (re-runs whenever period or auth changes)
  useEffect(() => {
    if (!init) return
    const load = async () => {
      setLoading(true)
      const { from, to } = getPeriodRange(periodo, customFrom, customTo)
      const params = new URLSearchParams()
      if (from) params.set('from', from.toISOString())
      params.set('to', to.toISOString())
      if (role !== 'superadmin' && vendedor) params.set('vendedor', vendedor)
      const res = await fetch(`/api/reportes?${params}`, { cache: 'no-store' })
      if (res.ok) setData(await res.json())
      setLoading(false)
    }
    load()
  }, [init, periodo, customFrom, customTo, role, vendedor, refreshTick])

  const isSuperAdmin = role === 'superadmin'
  const periodLabel  = getPeriodRange(periodo, customFrom, customTo).label

  // Trend: computed from the same period data, grouped by the right interval
  const trendData = data ? buildTrend(data.cotizaciones, periodo, customFrom, customTo) : null

  const pendientes = [...(data?.cotizaciones.filter(c => c.estado === 'enviada') ?? [])]
    .sort((a, b) => parseFecha(a.fecha).getTime() - parseFecha(b.fecha).getTime())
    .slice(0, 5)
  const kpiScope = periodo === 'historial' ? 'hasta hoy' : 'en el periodo'
  const conversionBase = data
    ? data.resumen.confirmadas + data.resumen.enviadas + data.resumen.canceladas
    : 0

  // ── Excel export ───────────────────────────────────────────────────────────
  async function exportExcel() {
    if (!data) return

    const resumenRows = [
      ['REPORTE HIDROPERFORACIONES GUATEMALA'],
      [`Periodo: ${periodLabel}`],
      [`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`],
      [],
      ['Vendedor', 'Cotizaciones', 'Monto Total (Q)', 'Confirmadas', 'Monto Confirmado (Q)', 'Enviadas', 'Canceladas', '% Conv.'],
      ...data.porVendedor.map(v => [
        v.vendedor, v.total, v.monto, v.confirmadas, v.confirmadoMonto, v.enviadas, v.canceladas, `${v.conversionPct}%`,
      ]),
      [],
      ['TOTALES', data.resumen.total, data.resumen.monto, data.resumen.confirmadas, data.resumen.confirmadoMonto, data.resumen.enviadas, data.resumen.canceladas, `${data.resumen.conversionPct}%`],
      [],
      ['--- POR TIPO ---'],
      ['Tipo', 'Cotizaciones', 'Monto (Q)'],
      ['Perforacion', data.resumen.perforacion, data.resumen.montoPerforacion],
      ['Limpieza', data.resumen.limpieza, data.resumen.montoLimpieza],
    ]

    const cotizacionRows = [
      ['Correlativo', 'Fecha', 'Cliente', 'Empresa', 'Proyecto', 'Tipo', 'Monto (Q)', 'Estado', 'Vendedor'],
      ...data.cotizaciones.map(c => [
        c.correlativo, c.fecha, c.cliente, c.empresa ?? '', c.proyecto,
        c.tipo === 'perforacion' ? 'Perforacion' : 'Limpieza', c.monto, c.estado, c.vendedor,
      ]),
    ]

    const vendedorSheets = data.porVendedor.map(vs => ({
      name: vs.vendedor.split(' ')[0].slice(0, 12) || 'Vendedor',
      rows: [
        [`COTIZACIONES - ${vs.vendedor}`],
        [`Periodo: ${periodLabel}`],
        [],
        ['Cotizaciones:', vs.total],
        ['Monto Total:', fmtQ(vs.monto)],
        ['Confirmadas:', vs.confirmadas],
        ['Monto Confirmado:', fmtQ(vs.confirmadoMonto)],
        ['% Conversion:', `${vs.conversionPct}%`],
        [],
        ['Correlativo', 'Fecha', 'Cliente', 'Empresa', 'Tipo', 'Monto (Q)', 'Estado'],
        ...data.cotizaciones.filter(c => c.vendedor === vs.vendedor).map(c => [
          c.correlativo, c.fecha, c.cliente, c.empresa ?? '',
          c.tipo === 'perforacion' ? 'Perforacion' : 'Limpieza', c.monto, c.estado,
        ]),
      ],
      widths: [14, 12, 24, 24, 14, 14, 12],
    }))

    await exportXlsx(`HidroCRM_${periodLabel.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`, [
      { name: 'Resumen', rows: resumenRows, widths: [28, 14, 20, 14, 22, 10, 12, 14] },
      { name: 'Cotizaciones', rows: cotizacionRows, widths: [14, 12, 24, 24, 32, 18, 14, 12, 22] },
      ...vendedorSheets,
    ])
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
      // Cargar cuentas bancarias una sola vez para todos los PDFs
      let cuentasBancarias: { banco: string; tipo: string; numero: string }[] = []
      try {
        const cfg = await fetch('/api/config').then(r => r.ok ? r.json() : null)
        cuentasBancarias = cfg?.cuentasBancarias ?? []
      } catch { /* ignore */ }
      const zip = new JSZip()
      for (let i = 0; i < cots.length; i++) {
        const c = cots[i]
        try {
          const qdata = JSON.parse(c.datos ?? '{}') as QuotationData
          const pdfBytes = await generarPDF(qdata, cuentasBancarias)
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
    <div className="flex flex-col md:h-full bg-[#070d1a]">

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
            <button
              onClick={() => setRefreshTick(n => n + 1)}
              title="Actualizar dashboard"
              className="flex items-center gap-2 bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:border-white/20 px-3 py-2 rounded-xl text-sm font-medium transition-all">
              <RefreshCw className="w-4 h-4" />
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
            { id: 'historial',     label: 'Historial'     },
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
        <p className="text-slate-500 text-sm">{generatedAtLabel ? `Generado el ${generatedAtLabel}` : 'Generado el ...'}</p>
      </div>

      {/* ── CONTENT ─────────────────────────────────────────────────── */}
      <div className="flex-1 md:overflow-auto p-4 sm:p-6 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-32 gap-3 text-slate-500">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm">Cargando datos...</span>
          </div>
        ) : !data ? null : (
          <>
            {/* KPI cards */}
            <div className={cn(
              'grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3',
              isSuperAdmin ? 'lg:grid-cols-6' : 'lg:grid-cols-5'
            )}>
              <KPICard variant="stacked" icon={<FileText    className="w-4 h-4 text-blue-400"    />} label="Cotizaciones" value={String(data.resumen.total)}          sub={kpiScope}                        color="blue"    />
              {isSuperAdmin && (
                <KPICard variant="stacked" icon={<TrendingUp  className="w-4 h-4 text-slate-300"   />} label="Monto Total"  value={fmtQk(data.resumen.monto)}            sub={fmtQ(data.resumen.monto)}             color="slate"   />
              )}
              <KPICard variant="stacked" icon={<CheckCircle className="w-4 h-4 text-emerald-400" />} label="Confirmadas"  value={String(data.resumen.confirmadas)}      sub={isSuperAdmin ? fmtQ(data.resumen.confirmadoMonto) : 'cerradas'}   color="emerald" />
              <KPICard variant="stacked" icon={<Send        className="w-4 h-4 text-amber-400"   />} label="Enviadas"     value={String(data.resumen.enviadas)}          sub="sin respuesta"                        color="amber"   />
              <KPICard variant="stacked" icon={<XCircle     className="w-4 h-4 text-red-400"     />} label="Canceladas"   value={String(data.resumen.canceladas)}        sub="perdidas"                             color="red"     />
              <KPICard variant="stacked" icon={<Award       className="w-4 h-4 text-violet-400"  />} label="Conversión"   value={`${data.resumen.conversionPct}%`}       sub={`${data.resumen.confirmadas}/${conversionBase}`} color="violet" />
            </div>

            {/* Cuentas contables (solo superadmin) — Pagar / Cobrar */}
            {isSuperAdmin && cuentas && (cuentas.pagar.countPendientes > 0 || cuentas.cobrar.countPendientes > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <Link href="/cuentas-por-cobrar"
                  className="bg-[#0d1526] rounded-2xl border border-emerald-500/15 hover:border-emerald-500/30 p-4 sm:p-5 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs font-semibold text-emerald-400/80 uppercase tracking-wider">Por Cobrar</p>
                      <p className="text-[10px] text-slate-600">Clientes / empresas que nos deben</p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-emerald-400/60" />
                  </div>
                  <p className="text-2xl font-black text-emerald-300 tabular-nums">{fmtQ(cuentas.cobrar.totalPendiente)}</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {cuentas.cobrar.countPendientes} pendiente(s)
                    {cuentas.cobrar.countVencidas > 0 && (
                      <span className="ml-2 text-red-400 font-semibold">· ⚠ {cuentas.cobrar.countVencidas} vencida(s) ({fmtQ(cuentas.cobrar.montoVencidas)})</span>
                    )}
                    {cuentas.cobrar.countPorVencer > 0 && (
                      <span className="ml-2 text-amber-400">· {cuentas.cobrar.countPorVencer} por vencer</span>
                    )}
                  </p>
                </Link>
                <Link href="/cuentas-por-pagar"
                  className="bg-[#0d1526] rounded-2xl border border-red-500/15 hover:border-red-500/30 p-4 sm:p-5 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs font-semibold text-red-400/80 uppercase tracking-wider">Por Pagar</p>
                      <p className="text-[10px] text-slate-600">Proveedores a quienes debemos</p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-red-400/60" />
                  </div>
                  <p className="text-2xl font-black text-red-300 tabular-nums">{fmtQ(cuentas.pagar.totalPendiente)}</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {cuentas.pagar.countPendientes} pendiente(s)
                    {cuentas.pagar.countVencidas > 0 && (
                      <span className="ml-2 text-red-400 font-semibold">· ⚠ {cuentas.pagar.countVencidas} vencida(s) ({fmtQ(cuentas.pagar.montoVencidas)})</span>
                    )}
                    {cuentas.pagar.countPorVencer > 0 && (
                      <span className="ml-2 text-amber-400">· {cuentas.pagar.countPorVencer} por vencer</span>
                    )}
                  </p>
                </Link>
              </div>
            )}

            {/* Operaciones en campo — desglose POR PROYECTO */}
            {operaciones && operaciones.proyectosActivos > 0 && (
              <div className="bg-[#0d1526] rounded-2xl border border-white/5 p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Operaciones en campo</p>
                    <p className="text-[10px] text-slate-600">
                      Desglose de {operaciones.proyectosActivos} proyecto(s) activo(s)
                    </p>
                  </div>
                  {(operaciones.alertas.gastosVencidos > 0 || operaciones.alertas.gastosPorVencer > 0) && (
                    <div className="flex items-center gap-2 text-[11px]">
                      {operaciones.alertas.gastosVencidos > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-red-500/15 border border-red-500/30 text-red-300 font-semibold">
                          ⚠ {operaciones.alertas.gastosVencidos} pago(s) vencidos
                        </span>
                      )}
                      {operaciones.alertas.gastosPorVencer > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold">
                          {operaciones.alertas.gastosPorVencer} por vencer ≤ 3 días
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Una tarjeta por proyecto con sus métricas individuales */}
                <div className="space-y-4">
                  {operaciones.porProyecto.map(p => (
                    <div key={p.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <Link href={`/proyectos/${p.id}`}
                        className="flex items-center justify-between mb-3 group">
                        <div>
                          <p className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">
                            {p.cliente}{p.empresa ? ` · ${p.empresa}` : ''}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono">{p.correlativo}</p>
                        </div>
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-400 transition-colors" />
                      </Link>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <OpCard
                          icon={<Drill className="w-3.5 h-3.5" />}
                          label="Pies perforados"
                          real={p.pies.real}
                          plan={p.pies.plan}
                          pct={p.pies.pctUsado}
                          unidad="pies"
                          colorBase="blue"
                          subPagado={`${p.pies.plan.toLocaleString('es-GT')} pies contratados`}
                        />
                        <OpCard
                          icon={<FlaskConical className="w-3.5 h-3.5" />}
                          label="Bentonita"
                          real={p.bentonita.real}
                          plan={p.bentonita.clientePago}
                          pct={p.bentonita.pctUsado}
                          unidad="sacos"
                          colorBase="amber"
                          subPagado={`Cliente pagó ${fmtQ(p.bentonita.clienteQ)} · costo real ${fmtQ(p.bentonita.costoRealQ)}`}
                        />
                        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-semibold text-cyan-300 flex items-center gap-1.5"><Droplets className="w-3.5 h-3.5" /> Pipas de agua</span>
                          </div>
                          <p className="text-2xl font-bold text-white tabular-nums">
                            {p.pipas.real.toLocaleString('es-GT')}
                            <span className="text-sm font-normal text-slate-500"> pipas consumidas</span>
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Cliente pagó <b className="text-cyan-400">{fmtQ(p.pipas.clienteQ)}</b>
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

            {/* Proyectos activos en campo */}
            {proyectosActivos.length > 0 && (
              <div className="bg-[#0d1526] rounded-xl border border-white/5 overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardHat className="w-4 h-4 text-amber-400" />
                    <p className="text-sm font-semibold text-slate-300">Proyectos en campo</p>
                    <span className="text-xs text-slate-600 bg-white/4 px-2 py-0.5 rounded-full">{proyectosActivos.length}</span>
                  </div>
                  <Link href="/proyectos" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    Ver todos <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>
                <div className="divide-y divide-white/4">
                  {proyectosActivos.map(p => {
                    const diasEnObra = Math.max(1, Math.floor((Date.now() - new Date(p.fechaInicio).getTime()) / 86400000) + 1)
                    const lastEntry  = p.entradas?.[0]?.fecha ?? null
                    const today      = new Date().toISOString().slice(0, 10)
                    const sinEntrada = lastEntry !== today
                    return (
                      <Link key={p.id} href={`/proyectos/${p.id}`}
                        className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/2 transition-colors group">
                        <div className={cn(
                          'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold',
                          p.tipo === 'perforacion' ? 'bg-blue-500/15 text-blue-400' : 'bg-cyan-500/15 text-cyan-400'
                        )}>
                          {p.tipo === 'perforacion' ? 'PERF' : 'LIMP'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-200 truncate group-hover:text-white transition-colors">
                            {p.cliente}{p.empresa ? ` · ${p.empresa}` : ''}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono">{p.correlativo} · {p.vendedor}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-right">
                          <div>
                            <p className="text-xs font-bold text-white">{diasEnObra}d</p>
                            <p className="text-[10px] text-slate-600">en obra</p>
                          </div>
                          {sinEntrada ? (
                            <div className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                              <Clock className="w-2.5 h-2.5" /> Sin entrada hoy
                            </div>
                          ) : (
                            <div className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                              ✓ Al día
                            </div>
                          )}
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Trend chart + Enviadas pendientes */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
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
                        formatter={(v, _, p) => [`Q ${Number(v).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}k  ·  ${(p.payload as {count:number}).count} cot.`, '']}
                      />
                      <Area type="monotone" dataKey="monto" stroke="#3b82f6" strokeWidth={2} fill="url(#blueGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                /* hoy: span 2 with a summary bar */
                <div className="lg:col-span-2 bg-[#0d1526] rounded-xl border border-white/5 p-5 flex flex-col justify-center items-center gap-2">
                  <p className="text-sm font-semibold text-slate-300">Resumen del día</p>
                  {isSuperAdmin
                    ? <p className="text-4xl font-black text-white">{fmtQk(data.resumen.monto)}</p>
                    : <p className="text-4xl font-black text-white">{data.resumen.total}</p>
                  }
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
                <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                <table className="w-full min-w-[560px] text-sm">
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
                <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                  <table className="w-full min-w-[580px] text-sm">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0d1526] border border-white/10 rounded-2xl p-5 sm:p-6 w-full max-w-[380px] max-h-[85vh] overflow-y-auto shadow-2xl">
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

// ── OpCard (operaciones: consumo real vs plan) ──────────────────────────────
function OpCard({ icon, label, real, plan, pct, unidad, colorBase, subPagado }: {
  icon: React.ReactNode; label: string; real: number; plan: number; pct: number; unidad: string
  colorBase: 'blue' | 'amber'
  subPagado?: string
}) {
  const over = pct >= 100
  const alto = pct >= 80 && pct < 100
  const cls = over
    ? 'border-red-500/30 bg-red-500/8'
    : alto
      ? 'border-amber-500/30 bg-amber-500/8'
      : colorBase === 'blue'
        ? 'border-blue-500/20 bg-blue-500/5'
        : 'border-amber-500/20 bg-amber-500/5'
  const barColor = over ? 'bg-red-500' : alto ? 'bg-amber-500' : 'bg-emerald-500'
  const txtLabel = colorBase === 'blue' ? 'text-blue-300' : 'text-amber-300'
  return (
    <div className={cn('rounded-xl border p-3', cls)}>
      <div className="flex items-center justify-between mb-1">
        <span className={cn('text-[11px] font-semibold flex items-center gap-1.5', txtLabel)}>{icon} {label}</span>
        <span className={cn('text-[10px] font-bold tabular-nums',
          over ? 'text-red-400' : alto ? 'text-amber-400' : 'text-emerald-400')}>
          {pct.toFixed(0)}%
        </span>
      </div>
      <p className="text-2xl font-bold text-white tabular-nums">
        {real.toLocaleString('es-GT')}
        <span className="text-sm font-normal text-slate-500"> / {plan.toLocaleString('es-GT')}</span>
      </p>
      <p className="text-[10px] text-slate-500 mb-1.5">{unidad} consumidos / {unidad === 'sacos' ? 'pagados cliente' : 'contratados'}</p>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={cn('h-full transition-all', barColor)} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      {subPagado && (
        <p className="text-[10px] text-slate-500 mt-1.5 leading-tight">{subPagado}</p>
      )}
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
