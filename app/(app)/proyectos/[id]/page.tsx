'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  AlertTriangle, ArrowLeft, Plus, RefreshCw, Trash2,
  FileDown, Archive, X, Save, Sun, Moon, AlertCircle,
  TrendingUp, Clock, Layers, Calendar, ChevronDown,
  Mail, CheckCircle,
} from 'lucide-react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { cn } from '@/lib/utils'
import {
  generarPDFEntrada, generarPDFExpediente, descargarPDF,
  type ProyectoBitacora,
} from '@/lib/pdf-bitacora'
import { formatFechaArchivoPdf, formatFechaDDMMYYYY } from '@/lib/date-format'
import { format, parseISO, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertasConsumo } from '@/components/alertas-consumo'
import { LiquidacionProyectoPanel } from '@/components/liquidacion-proyecto-panel'

// ── Types ─────────────────────────────────────────────────────────────────────
interface BitacoraEntry {
  id: string; fecha: string; turno: 'dia' | 'noche'; estado: string; tipo: string
  perforacionDia: number; ampliacion1Dia: number; ampliacion2Dia: number; rehabilitacionDia: number
  perforacionTotal: number; ampliacion1Total: number; ampliacion2Total: number; rehabilitacionTotal: number
  horasPerforacion: number; bentonitaSacos: number; pipas: number
  horasLimpieza: number; horasAforo: number
  diaAdverso: boolean; notaInterna: string; notaCliente: string
  // Campos del Excel DATOS BITACORA DIARIA
  diaActivo?: boolean
  tubosExtraidos?: number; diamExtraidos?: string
  tubosInstalados?: number; diamInstalados?: string
  quimicoProducto?: string; quimicoCanecas?: number
  camareo?: string; otrosTrabajos?: string
  // Nuevos: formación y % circulación
  formacionGeologica?: string
  circulacionPct?: number
}
interface Proyecto {
  id: string; correlativo: string; cliente: string; empresa: string; nombre: string
  tipo: string; monto: number; vendedor: string; estado: string; fechaInicio: string
  entradas: BitacoraEntry[]
  telefonoCliente?: string
  emailCliente?: string
  profundidadTotal?: number
  diasHabilesTotal?: number
  bentonitaPlan?: number
  pipasPlan?: number
}

type FormData = Omit<BitacoraEntry, 'id'>

function emptyForm(tipo: string, lastEntry?: BitacoraEntry): FormData {
  return {
    fecha: new Date().toISOString().slice(0, 10),
    turno: 'dia', estado: '', tipo,
    perforacionDia: 0, ampliacion1Dia: 0, ampliacion2Dia: 0, rehabilitacionDia: 0,
    perforacionTotal: lastEntry?.perforacionTotal ?? 0,
    ampliacion1Total: lastEntry?.ampliacion1Total ?? 0,
    ampliacion2Total: lastEntry?.ampliacion2Total ?? 0,
    rehabilitacionTotal: lastEntry?.rehabilitacionTotal ?? 0,
    horasPerforacion: 0, bentonitaSacos: 0, pipas: 0,
    horasLimpieza: 0, horasAforo: 0,
    diaAdverso: false, notaInterna: '', notaCliente: '',
    // Nuevos campos Excel DATOS BITACORA DIARIA
    diaActivo: true,
    tubosExtraidos: 0, diamExtraidos: '',
    tubosInstalados: 0, diamInstalados: '',
    quimicoProducto: '', quimicoCanecas: 0,
    camareo: '', otrosTrabajos: '',
    formacionGeologica: '', circulacionPct: 0,
  }
}

function parseDiasPactados(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value)
  if (typeof value !== 'string') return null
  const match = value.match(/\d+(?:[.,]\d+)?/)
  if (!match) return null
  const parsed = Number(match[0].replace(',', '.'))
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatChip({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={cn('px-3 py-2 rounded-lg border', accent ? 'border-blue-500/30 bg-blue-500/8' : 'border-white/5 bg-white/3')}>
      <p className="text-[10px] text-slate-500 leading-none mb-1">{label}</p>
      <p className={cn('text-sm font-bold leading-none', accent ? 'text-blue-300' : 'text-white')}>{value}</p>
      {sub && <p className="text-[10px] text-slate-600 mt-1 leading-none">{sub}</p>}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ProyectoDetallePage() {
  const params   = useParams()
  const id       = Array.isArray(params?.id) ? params.id[0] : (params?.id ?? '')

  const [proyecto, setProyecto]     = useState<Proyecto | null>(null)
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [editEntry, setEditEntry]   = useState<BitacoraEntry | null>(null)
  const [form, setForm]             = useState<FormData>(emptyForm('perforacion'))
  const [saving, setSaving]         = useState(false)
  const [pdfLoad, setPdfLoad]         = useState<string | null>(null)
  const [emailLoad, setEmailLoad]     = useState<string | null>(null)
  const [emailSent, setEmailSent]     = useState<string | null>(null)
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [profObjetivo, setProfObjetivo]       = useState<number | null>(null)
  const [duracionEstimada, setDuracionEstimada] = useState<number | null>(null)
  const today = new Date().toISOString().slice(0, 10)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/proyectos/${id}`)
      .then(r => r.json())
      .then(d => {
        setProyecto(d)
        const dias = parseDiasPactados(d?.diasHabilesTotal)
        if (dias) setDuracionEstimada(dias)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  // Lee cookies solo en el cliente después de hidratación
  useEffect(() => { if (id) load() }, [id, load])

  // Fetch profundidad objetivo desde la cotización asociada
  useEffect(() => {
    if (!proyecto?.correlativo) return
    fetch(`/api/cotizaciones/${encodeURIComponent(proyecto.correlativo)}`)
      .then(r => r.ok ? r.json() : null)
      .then(cot => {
        if (!cot) return
        const datos = typeof cot.datos === 'string' ? JSON.parse(cot.datos) : (cot.datos ?? {})
        const prof = datos?.ip?.profundidad ?? null
        if (prof) setProfObjetivo(Number(prof))
        const dur = parseDiasPactados(datos?.duracion)
        if (dur) setDuracionEstimada(dur)
      })
      .catch(() => {})
  }, [proyecto?.correlativo])

  function openNew() {
    const last = proyecto?.entradas.at(-1)
    setEditEntry(null)
    setForm(emptyForm(proyecto?.tipo ?? 'perforacion', last))
    setShowModal(true)
  }

  function openEdit(e: BitacoraEntry) {
    setEditEntry(e)
    setForm({ ...e })
    setShowModal(true)
  }

  function patchForm<K extends keyof FormData>(key: K, val: FormData[K]) {
    setForm(prev => {
      const next = { ...prev, [key]: val }
      // Auto-actualizar totales cuando cambia el día
      if (!editEntry) {
        const last = proyecto?.entradas.at(-1)
        if (key === 'perforacionDia')    next.perforacionTotal    = (last?.perforacionTotal ?? 0) + (val as number)
        if (key === 'ampliacion1Dia')    next.ampliacion1Total    = (last?.ampliacion1Total ?? 0) + (val as number)
        if (key === 'ampliacion2Dia')    next.ampliacion2Total    = (last?.ampliacion2Total ?? 0) + (val as number)
        if (key === 'rehabilitacionDia') next.rehabilitacionTotal = (last?.rehabilitacionTotal ?? 0) + (val as number)
      }
      return next
    })
  }

  async function handleSave() {
    if (!proyecto) return
    setSaving(true)
    try {
      if (editEntry) {
        await fetch(`/api/proyectos/${id}/bitacora/${editEntry.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      } else {
        await fetch(`/api/proyectos/${id}/bitacora`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      }
      setShowModal(false)
      load()
    } finally { setSaving(false) }
  }

  async function handleDelete(entryId: string) {
    if (!confirm('¿Eliminar esta entrada?')) return
    await fetch(`/api/proyectos/${id}/bitacora/${entryId}`, { method: 'DELETE' })
    load()
  }

  async function updateEstado(estado: string) {
    await fetch(`/api/proyectos/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    })
    load()
  }

  // Modal selector de plantilla PDF (4 opciones)
  const [plantillaModal, setPlantillaModal] = useState<{ entry: BitacoraEntry | null } | null>(null)

  async function pdfEntrada(e: BitacoraEntry) {
    // Abre el selector de plantilla — el usuario elige qué enviar al cliente
    setPlantillaModal({ entry: e })
  }

  async function pdfExpediente() {
    setPlantillaModal({ entry: null })
  }

  async function generarConPlantilla(plantilla: 'dia-sin' | 'dia-con' | 'exp-con' | 'exp-sin') {
    if (!proyecto || !plantillaModal) return
    // Si plantilla "día" y no hay entry específica, usar la más reciente
    const sorted = [...(proyecto.entradas ?? [])].sort((a, b) => b.fecha.localeCompare(a.fecha))
    const entry = plantillaModal.entry ?? sorted[0] ?? null
    setPdfLoad(entry ? entry.id : 'exp')
    setPlantillaModal(null)
    try {
      if (plantilla === 'dia-sin' || plantilla === 'dia-con') {
        if (!entry) {
          alert('No hay entradas de bitácora todavía. Agrega al menos una.')
          return
        }
        const b = await generarPDFEntrada(proyecto as ProyectoBitacora, entry, {
          incluirConsumos: plantilla === 'dia-con',
        })
        descargarPDF(b, `Bitacora_${proyecto.correlativo}_${formatFechaArchivoPdf(entry.fecha)}.pdf`)
      } else {
        const b = await generarPDFExpediente(proyecto as ProyectoBitacora, {
          incluirConsumos: plantilla === 'exp-con',
        })
        descargarPDF(b, `Expediente_${proyecto.correlativo}.pdf`)
      }
    } finally { setPdfLoad(null) }
  }

  async function emailEntrada(e: BitacoraEntry) {
    if (!proyecto) return
    if (!proyecto.emailCliente) {
      alert('Este cliente no tiene email registrado en Contactos.')
      return
    }
    setEmailLoad(e.id)
    try {
      const bytes = await generarPDFEntrada(proyecto as ProyectoBitacora, e)
      const uint8 = new Uint8Array(bytes)
      let binary = ''
      const chunk = 8192
      for (let i = 0; i < uint8.length; i += chunk)
        binary += String.fromCharCode(...uint8.slice(i, i + chunk))
      const pdfBase64 = btoa(binary)

      const res = await fetch('/api/email/bitacora', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfBase64,
          emailTo:    proyecto.emailCliente,
          correlativo: proyecto.correlativo,
          cliente:    proyecto.cliente,
          empresa:    proyecto.empresa,
          fecha:      formatFechaDDMMYYYY(e.fecha),
          vendedor:   proyecto.vendedor,
        }),
      })
      if (res.ok) {
        setEmailSent(e.id)
        setTimeout(() => setEmailSent(null), 3000)
      } else {
        const err = await res.json()
        alert(`Error al enviar: ${err.error ?? 'Intente de nuevo'}`)
      }
    } catch {
      alert('Error al generar el PDF. Intente de nuevo.')
    } finally {
      setEmailLoad(null)
    }
  }

  function whatsappEntrada(e: BitacoraEntry) {
    if (!proyecto) return
    const tel = (proyecto.telefonoCliente ?? '').replace(/\D/g, '')
    const msg =
      `📋 *Reporte diario — ${proyecto.correlativo}*\n` +
      `📅 ${formatFechaDDMMYYYY(e.fecha)} · Turno ${e.turno === 'dia' ? 'DIURNO' : 'NOCTURNO'}` +
      (e.diaAdverso ? ' · ⚠️ Día adverso' : '') + `\n\n` +
      (proyecto.tipo === 'perforacion'
        ? `🔩 Perforación del día: *${e.perforacionDia.toFixed(1)} pies*\n📊 Acumulado: *${e.perforacionTotal.toFixed(1)} pies*\n` +
          (e.bentonitaSacos > 0 ? `🧴 Bentonita: ${e.bentonitaSacos} sacos\n` : '') +
          (e.pipas > 0 ? `🚰 Pipas: ${e.pipas}\n` : '')
        : `🔧 Horas limpieza: *${e.horasLimpieza.toFixed(1)} h*\n⏱️ Horas aforo: *${e.horasAforo.toFixed(1)} h*\n`) +
      (e.notaCliente ? `\n📝 ${e.notaCliente}\n` : '') +
      `\n— ${proyecto.vendedor} · Hidroperforaciones Guatemala`
    window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  // ── Cálculos de totales ────────────────────────────────────────────────────
  const entradas     = proyecto?.entradas ?? []
  const sorted       = [...entradas].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const last         = sorted.at(-1)
  const esPerf       = proyecto?.tipo === 'perforacion'

  const totalPerfDia   = sorted.reduce((s, e) => s + e.perforacionDia, 0)
  const totalAmp1      = sorted.reduce((s, e) => s + e.ampliacion1Dia, 0)
  const totalBentonita = sorted.reduce((s, e) => s + e.bentonitaSacos, 0)
  const totalPipas     = sorted.reduce((s, e) => s + e.pipas, 0)
  const totalLimpieza  = sorted.reduce((s, e) => s + e.horasLimpieza, 0)
  const totalAforo     = sorted.reduce((s, e) => s + e.horasAforo, 0)
  const diasAdversos   = sorted.filter(e => e.diaAdverso).length
  const diasPerf       = sorted.filter(e => e.perforacionDia > 0).length
  const turnosDiurnos  = sorted.filter(e => e.turno === 'dia').length
  const turnosNocturnos= sorted.filter(e => e.turno === 'noche').length
  const diasProyecto   = (() => {
    if (!proyecto?.fechaInicio) return 0
    try {
      const d = differenceInDays(new Date(), parseISO(proyecto.fechaInicio)) + 1
      return Number.isFinite(d) && d >= 0 ? d : 0
    } catch { return 0 }
  })()
  const diasInactivos  = Math.max(0, diasProyecto - sorted.length)
  const promPerf       = diasPerf > 0 ? totalPerfDia / diasPerf : 0
  const perfAcum       = last?.perforacionTotal ?? 0
  const hayHoy         = sorted.some(e => e.fecha === today)

  // Datos para gráfica
  const chartData = sorted.map(e => ({
    fecha: format(parseISO(e.fecha), 'dd/MM', { locale: es }),
    'Pies del día': e.perforacionDia,
    'Acumulado': e.perforacionTotal,
  }))

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-full gap-3 text-slate-500">
      <RefreshCw className="w-5 h-5 animate-spin" /><span>Cargando proyecto...</span>
    </div>
  )
  if (!proyecto) return (
    <div className="flex items-center justify-center h-full flex-col gap-3 text-slate-600">
      <AlertTriangle className="w-10 h-10 opacity-40" />
      <p>Proyecto no encontrado</p>
    </div>
  )

  return (
    <div className="flex flex-col bg-[#070d1a] min-h-full md:h-full md:overflow-auto">

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 py-4 border-b border-white/5 bg-[#0a1020] shrink-0">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/proyectos" className="text-slate-500 hover:text-slate-300 transition-colors shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[10px] font-mono text-blue-400">{proyecto.correlativo}</p>
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium border',
                  proyecto.estado === 'activo'     ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' :
                  proyecto.estado === 'pausado'    ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' :
                  proyecto.estado === 'cancelado'  ? 'bg-red-500/15 text-red-400 border-red-500/20' :
                  'bg-slate-500/15 text-slate-400 border-slate-500/20'
                )}>{proyecto.estado}</span>
                {!hayHoy && proyecto.estado === 'activo' && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                    <AlertCircle className="w-3 h-3" /> Sin entrada hoy
                  </span>
                )}
              </div>
              <h1 className="text-lg font-bold text-white leading-tight truncate">{proyecto.nombre}</h1>
              <p className="text-xs text-slate-400">{proyecto.cliente}{proyecto.empresa ? ` · ${proyecto.empresa}` : ''} · {proyecto.vendedor}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={proyecto.estado} onChange={e => updateEstado(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-slate-300 outline-none">
              <option value="activo">Activo</option>
              <option value="pausado">Pausado</option>
              <option value="completado">Completado</option>
              <option value="cancelado">Cancelado</option>
            </select>
            <button onClick={pdfExpediente} disabled={pdfLoad === 'exp' || sorted.length === 0}
              className="flex items-center gap-1.5 bg-violet-600/20 border border-violet-500/30 text-violet-400 hover:bg-violet-600/30 disabled:opacity-40 px-3 py-2 rounded-lg text-xs font-medium transition-all">
              {pdfLoad === 'exp' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Expediente</span>
            </button>
            {sorted.length > 0 && (
              <a
                href={`https://wa.me/${(proyecto.telefonoCliente ?? '').replace(/\D/g,'')}?text=${encodeURIComponent(
                  `📋 *Reporte de avance — ${proyecto.correlativo}*\n\n` +
                  `Cliente: ${proyecto.cliente}${proyecto.empresa ? ` (${proyecto.empresa})` : ''}\n` +
                  `Proyecto: ${proyecto.nombre}\n` +
                  (esPerf
                    ? `Avance: *${perfAcum.toFixed(1)} pies* perforados\nDías trabajados: ${diasPerf}\nDías adversos: ${diasAdversos}\n`
                    : `Horas limpieza: ${totalLimpieza.toFixed(1)} h\nHoras aforo: ${totalAforo.toFixed(1)} h\n`) +
                  `Última entrada: ${last?.fecha ?? '—'}\nVendedor: ${proyecto.vendedor}\n\n` +
                  `Se adjunta el expediente PDF completo para su revisión.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-[#25D366]/15 border border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/25 px-3 py-2 rounded-lg text-xs font-medium transition-all">
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                <span className="hidden sm:inline">WhatsApp</span>
              </a>
            )}
            <button onClick={openNew}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors">
              <Plus className="w-3.5 h-3.5" /> Nueva entrada
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5">

        {/* ── ALERTAS DE CONSUMO (Fase F) ─────────────────────────────────── */}
        <AlertasConsumo proyectoId={proyecto.id} />

        {/* Control de Pagos movido a /gastos/[id] (refactor 2026-04-22) */}

        {/* ── RESUMEN RÁPIDO ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="bg-[#0d1526] rounded-xl border border-blue-500/20 p-4">
            <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wide">Pies perforados</p>
            <p className="text-2xl font-bold text-blue-300 leading-none">{perfAcum.toFixed(1)}</p>
            <p className="text-[10px] text-slate-600 mt-1">pies lineales acumulados</p>
          </div>
          <div className="bg-[#0d1526] rounded-xl border border-white/5 p-4">
            <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wide">% Completado</p>
            {profObjetivo ? (
              <>
                <p className="text-2xl font-bold text-emerald-300 leading-none">
                  {Math.min(100, (perfAcum / profObjetivo) * 100).toFixed(1)}%
                </p>
                <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (perfAcum / profObjetivo) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-600 mt-1">{perfAcum.toFixed(0)} / {profObjetivo} pies obj.</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-slate-500 leading-none">—</p>
                <p className="text-[10px] text-slate-700 mt-1">sin profundidad objetivo</p>
              </>
            )}
          </div>
          <div className="bg-[#0d1526] rounded-xl border border-white/5 p-4">
            <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wide">Días en obra</p>
            <p className="text-2xl font-bold text-white leading-none">{diasProyecto}</p>
            <p className="text-[10px] text-slate-600 mt-1">{sorted.length} dias con entrada</p>
          </div>
          {/* Bentonita con plan + % */}
          <div className="bg-[#0d1526] rounded-xl border border-amber-500/20 p-4">
            <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wide">Bentonita</p>
            {proyecto.bentonitaPlan ? (() => {
              const pct = Math.min(100, (totalBentonita / proyecto.bentonitaPlan) * 100)
              const color = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
              return <>
                <p className="text-2xl font-bold text-amber-300 leading-none tabular-nums">
                  {totalBentonita}<span className="text-sm text-slate-500"> / {proyecto.bentonitaPlan}</span>
                </p>
                <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className={cn('h-full transition-all', color)} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">sacos · llevamos <b className="text-amber-400">{pct.toFixed(0)}%</b></p>
              </>
            })() : (
              <>
                <p className="text-2xl font-bold text-white leading-none">{totalBentonita}</p>
                <p className="text-[10px] text-slate-600 mt-1">sacos consumidos</p>
              </>
            )}
          </div>
          {/* Pipas con plan estimado + % */}
          <div className="bg-[#0d1526] rounded-xl border border-cyan-500/20 p-4">
            <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wide">Pipas de agua</p>
            {proyecto.pipasPlan ? (() => {
              const pct = Math.min(100, (totalPipas / proyecto.pipasPlan) * 100)
              const color = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
              return <>
                <p className="text-2xl font-bold text-cyan-300 leading-none tabular-nums">
                  {totalPipas}<span className="text-sm text-slate-500"> / {proyecto.pipasPlan}</span>
                </p>
                <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className={cn('h-full transition-all', color)} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">pipas · llevamos <b className="text-cyan-400">{pct.toFixed(0)}%</b></p>
              </>
            })() : (
              <>
                <p className="text-2xl font-bold text-white leading-none">{totalPipas}</p>
                <p className="text-[10px] text-slate-600 mt-1">pipas consumidas</p>
              </>
            )}
          </div>
          <div className="bg-[#0d1526] rounded-xl border border-violet-500/20 p-4">
            <p className="text-[10px] text-slate-500 mb-1 uppercase tracking-wide">Avance dias proyecto</p>
            {duracionEstimada ? (() => {
              const pct = Math.min(100, (diasProyecto / duracionEstimada) * 100)
              const excedido = diasProyecto > duracionEstimada
              return <>
                <p className={cn('text-2xl font-bold leading-none tabular-nums', excedido ? 'text-red-300' : 'text-violet-300')}>
                  {diasProyecto}<span className="text-sm text-slate-500"> / {duracionEstimada}</span>
                </p>
                <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className={cn('h-full transition-all', excedido ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-violet-500')} style={{ width: `${pct}%` }} />
                </div>
                <p className={cn('text-[10px] mt-1', excedido ? 'text-red-400' : 'text-slate-500')}>
                  {excedido ? `+${diasProyecto - duracionEstimada} dias sobre plazo` : `${duracionEstimada - diasProyecto} dias disponibles`}
                </p>
              </>
            })() : (
              <>
                <p className="text-2xl font-bold text-slate-500 leading-none">-</p>
                <p className="text-[10px] text-slate-600 mt-1">sin plazo pactado</p>
              </>
            )}
          </div>
        </div>

        {/* ── ALERTA DÍAS EXCEDIDOS ───────────────────────────────────────── */}
        {proyecto.estado === 'activo' && duracionEstimada && diasProyecto > duracionEstimada && (
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-300">Proyecto fuera de plazo</p>
              <p className="text-xs text-red-400/80 mt-0.5">
                Se cotizó en <b>{duracionEstimada} días</b> — llevan <b>{diasProyecto} días</b> en campo
                {' '}(<b>+{diasProyecto - duracionEstimada} días</b> sobre el plazo).
              </p>
            </div>
          </div>
        )}

        {/* ── RESUMEN DE CIERRE ────────────────────────────────────────────── */}
        {proyecto.estado === 'completado' && (
          <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-emerald-300">Proyecto completado — Resumen final</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#0a1a14] rounded-lg border border-emerald-500/15 p-3">
                <p className="text-[10px] text-slate-500 mb-1">Pies perforados</p>
                <p className="text-lg font-bold text-white">{perfAcum.toFixed(1)}</p>
                {profObjetivo && (
                  <p className={cn('text-[10px] mt-0.5', perfAcum >= profObjetivo ? 'text-emerald-400' : 'text-amber-400')}>
                    {perfAcum >= profObjetivo ? '✓' : '↓'} objetivo: {profObjetivo} pies
                  </p>
                )}
              </div>
              <div className="bg-[#0a1a14] rounded-lg border border-emerald-500/15 p-3">
                <p className="text-[10px] text-slate-500 mb-1">Días en obra</p>
                <p className="text-lg font-bold text-white">{diasProyecto}</p>
                {duracionEstimada && (
                  <p className={cn('text-[10px] mt-0.5', diasProyecto <= duracionEstimada ? 'text-emerald-400' : 'text-red-400')}>
                    {diasProyecto <= duracionEstimada ? `✓ ${duracionEstimada - diasProyecto}d antes` : `+${diasProyecto - duracionEstimada}d sobre plazo`}
                  </p>
                )}
              </div>
              <div className="bg-[#0a1a14] rounded-lg border border-emerald-500/15 p-3">
                <p className="text-[10px] text-slate-500 mb-1">Días adversos</p>
                <p className="text-lg font-bold text-amber-300">{diasAdversos}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">de {sorted.length} días registrados</p>
              </div>
              <div className="bg-[#0a1a14] rounded-lg border border-emerald-500/15 p-3">
                <p className="text-[10px] text-slate-500 mb-1">Bentonita total</p>
                <p className="text-lg font-bold text-white">{totalBentonita}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">sacos · {totalPipas} pipas</p>
              </div>
            </div>
          </div>
        )}

        {/* ── TOTALES ─────────────────────────────────────────────────────── */}
        <div className="bg-[#0d1526] rounded-xl border border-white/5 p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Layers className="w-3.5 h-3.5" /> TOTALES
          </p>

          <div className="space-y-4">
            {/* Pies + promedio — solo el real que trackean */}
            <div className="flex flex-wrap gap-2">
              <StatChip label="Perforado total" value={`${perfAcum.toFixed(1)} pies`} accent />
              <StatChip label="Promedio/día" value={`${promPerf.toFixed(1)} pies`} sub={`${diasPerf} día(s) activos`} />
            </div>

            {/* Días */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {[
                ['Días proyecto',    diasProyecto],
                ['Días perforación', diasPerf],
                ['Días activos',     sorted.length],
                ['Días inactivos',   Math.max(0, diasInactivos)],
                ['Días adversos',    diasAdversos],
                ['Turnos diurnos',   turnosDiurnos],
                ['Turnos nocturnos', turnosNocturnos],
              ].map(([l, v]) => (
                <div key={String(l)} className="flex justify-between py-1 border-b border-white/4">
                  <span className="text-slate-500">{l}</span>
                  <span className="text-slate-300 font-semibold">{v}</span>
                </div>
              ))}
            </div>

            {/* Insumos */}
            <div className="flex flex-wrap gap-2">
              <StatChip label="Bentonita" value={`${totalBentonita.toFixed(0)} sacos`} />
              <StatChip label="Pipas de agua" value={`${totalPipas.toFixed(0)}`} />
              <StatChip label="Limpieza" value={`${totalLimpieza.toFixed(1)} h`} />
              <StatChip label="Aforo" value={`${totalAforo.toFixed(1)} h`} />
            </div>
          </div>
        </div>

        {/* ── GRÁFICA ─────────────────────────────────────────────────────── */}
        {chartData.length > 1 && (
          <div className="bg-[#0d1526] rounded-xl border border-white/5 p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5" /> Comparación de perforación por día vs acumulado
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" />
                <XAxis dataKey="fecha" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left"  tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#1a2540', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(v, name) => [typeof v === 'number' ? `${v.toFixed(1)} pies` : '', String(name)]}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                <Bar yAxisId="left" dataKey="Pies del día" fill="#3b82f6" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="Acumulado" stroke="#10b981" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── TABLA BITÁCORA ───────────────────────────────────────────────── */}
        <div className="bg-[#0d1526] rounded-xl border border-white/5 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" /> Historial de bitácora diaria
            </p>
            <span className="text-xs text-slate-600">{sorted.length} registros</span>
          </div>

          {sorted.length === 0 ? (
            <div className="py-16 text-center text-slate-600">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm mb-1">Sin entradas todavía</p>
              <p className="text-xs">Presioná &quot;Nueva entrada&quot; para empezar el registro diario</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-white/5 bg-[#0a1020]">
                    <tr className="text-slate-500">
                      <th className="text-left px-4 py-3 font-medium">Fecha</th>
                      <th className="text-left px-4 py-3 font-medium">Turno</th>
                      <th className="text-right px-4 py-3 font-medium">Perf. día</th>
                      <th className="text-right px-4 py-3 font-medium">Total acum.</th>
                      <th className="text-right px-4 py-3 font-medium">Amp 1</th>
                      <th className="text-right px-4 py-3 font-medium">H. Perf.</th>
                      <th className="text-right px-4 py-3 font-medium">Bentonita / Pipas</th>
                      <th className="text-right px-4 py-3 font-medium">Limp. / Aforo</th>
                      <th className="text-left px-4 py-3 font-medium">Nota cliente</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/4">
                    {[...sorted].reverse().map(e => (
                      <React.Fragment key={e.id}>
                        <tr className={cn(
                          'transition-colors',
                          e.diaAdverso
                            ? 'bg-amber-500/5 hover:bg-amber-500/8 border-l-2 border-l-amber-500/40'
                            : e.fecha === today
                              ? 'bg-blue-500/5 hover:bg-blue-500/8'
                              : 'hover:bg-white/2'
                        )}>
                          <td className="px-4 py-3">
                            <p className="text-slate-200 font-medium">
                              {format(parseISO(e.fecha), "EEEE, dd-MM-yyyy", { locale: es })}
                            </p>
                            {e.diaAdverso && <span className="text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Día adverso</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1 text-slate-400">
                              {e.turno === 'dia' ? <Sun className="w-3 h-3 text-amber-400" /> : <Moon className="w-3 h-3 text-blue-400" />}
                              {e.turno === 'dia' ? 'DIURNO' : 'NOCTURNO'}
                            </span>
                            {e.estado && <p className="text-[10px] text-slate-600 mt-0.5">{e.estado}</p>}
                          </td>
                          <td className={cn('px-4 py-3 text-right font-semibold',
                            e.perforacionDia === 0 ? 'text-slate-600'
                              : e.perforacionDia < 20 ? 'text-red-400'
                              : e.perforacionDia === 20 ? 'text-amber-400'
                              : 'text-emerald-400')}>
                            {e.perforacionDia > 0 ? e.perforacionDia.toFixed(1) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-white">{e.perforacionTotal.toFixed(1)}</td>
                          <td className="px-4 py-3 text-right text-slate-400">{e.ampliacion1Dia > 0 ? e.ampliacion1Dia.toFixed(1) : '—'}</td>
                          <td className="px-4 py-3 text-right text-slate-400">{e.horasPerforacion > 0 ? e.horasPerforacion.toFixed(1) : '—'}</td>
                          <td className="px-4 py-3 text-right text-slate-400">
                            {e.bentonitaSacos > 0 || e.pipas > 0
                              ? `${e.bentonitaSacos > 0 ? `${e.bentonitaSacos} sac.` : '—'} / ${e.pipas > 0 ? e.pipas : '—'}`
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-400">
                            {e.horasLimpieza > 0 || e.horasAforo > 0
                              ? `${e.horasLimpieza.toFixed(1)} / ${e.horasAforo.toFixed(1)}`
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-500 max-w-[200px]">
                            {e.notaCliente
                              ? <button onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                                  className="text-left hover:text-slate-300 transition-colors line-clamp-2">
                                  {e.notaCliente}
                                </button>
                              : <span className="text-slate-700">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 justify-end">
                              <button onClick={() => pdfEntrada(e)} disabled={pdfLoad === e.id} title="Descargar PDF del día"
                                className="text-slate-600 hover:text-blue-400 transition-colors disabled:opacity-40">
                                {pdfLoad === e.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                              </button>
                              <button onClick={() => whatsappEntrada(e)} title="Enviar por WhatsApp"
                                className="text-slate-600 hover:text-[#25D366] transition-colors">
                                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                              </button>
                              <button onClick={() => emailEntrada(e)} disabled={emailLoad === e.id} title="Enviar por email"
                                className="transition-colors disabled:opacity-40"
                                style={{ color: emailSent === e.id ? '#10b981' : emailLoad === e.id ? '#94a3b8' : '#475569' }}
                                onMouseEnter={e2 => { if (emailLoad !== e.id && emailSent !== e.id) (e2.target as HTMLButtonElement).style.color = '#3b82f6' }}
                                onMouseLeave={e2 => { if (emailLoad !== e.id && emailSent !== e.id) (e2.target as HTMLButtonElement).style.color = '#475569' }}>
                                {emailLoad === e.id
                                  ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  : emailSent === e.id
                                    ? <CheckCircle className="w-3.5 h-3.5" />
                                    : <Mail className="w-3.5 h-3.5" />}
                              </button>
                              <button onClick={() => openEdit(e)} title="Editar"
                                className="text-slate-600 hover:text-slate-300 transition-colors text-[10px] border border-white/5 px-1.5 py-0.5 rounded hover:border-white/15">
                                Editar
                              </button>
                              <button onClick={() => handleDelete(e.id)} title="Eliminar"
                                className="text-slate-700 hover:text-red-400 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {/* Fila expandida con notas completas */}
                        {expandedId === e.id && (
                          <tr key={`${e.id}-exp`} className="bg-blue-500/5">
                            <td colSpan={10} className="px-4 py-3">
                              {e.notaCliente && (
                                <div className="mb-2">
                                  <span className="text-[10px] text-blue-400 font-semibold">NOTA CLIENTE: </span>
                                  <span className="text-xs text-slate-300">{e.notaCliente}</span>
                                </div>
                              )}
                              {e.notaInterna && (
                                <div>
                                  <span className="text-[10px] text-amber-400 font-semibold">NOTA INTERNA: </span>
                                  <span className="text-xs text-slate-400">{e.notaInterna}</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                  {/* Fila de totales */}
                  <tfoot className="border-t-2 border-white/10 bg-[#0a1020]">
                    <tr className="text-xs font-bold text-slate-300">
                      <td className="px-4 py-3" colSpan={2}>TOTALES</td>
                      <td className="px-4 py-3 text-right text-blue-300">{totalPerfDia.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-white">{perfAcum.toFixed(1)} pies</td>
                      <td className="px-4 py-3 text-right">{totalAmp1.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right">—</td>
                      <td className="px-4 py-3 text-right">{totalBentonita.toFixed(0)} s. / {totalPipas.toFixed(0)}</td>
                      <td className="px-4 py-3 text-right">{totalLimpieza.toFixed(1)} / {totalAforo.toFixed(1)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-white/5">
                {[...sorted].reverse().map(e => (
                  <div key={e.id} className={cn(
                    'px-4 py-4',
                    e.diaAdverso ? 'bg-amber-500/5 border-l-2 border-l-amber-500/40' : (e.fecha === today && 'bg-blue-500/5')
                  )}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-200">
                          {format(parseISO(e.fecha), "EEE dd MMM", { locale: es })}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1 text-[10px] text-slate-500">
                            {e.turno === 'dia' ? <Sun className="w-3 h-3 text-amber-400" /> : <Moon className="w-3 h-3 text-blue-400" />}
                            {e.turno === 'dia' ? 'Diurno' : 'Nocturno'}
                          </span>
                          {e.diaAdverso && <span className="text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Adverso</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => pdfEntrada(e)} disabled={pdfLoad === e.id} title="PDF"
                          className="text-slate-600 hover:text-blue-400 transition-colors disabled:opacity-40">
                          {pdfLoad === e.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => whatsappEntrada(e)} title="WhatsApp"
                          className="text-slate-600 hover:text-[#25D366] transition-colors">
                          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        </button>
                        <button onClick={() => emailEntrada(e)} disabled={emailLoad === e.id} title="Email"
                          className="transition-colors disabled:opacity-40"
                          style={{ color: emailSent === e.id ? '#10b981' : '#475569' }}>
                          {emailLoad === e.id
                            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            : emailSent === e.id
                              ? <CheckCircle className="w-3.5 h-3.5" />
                              : <Mail className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => openEdit(e)} className="text-slate-400 hover:text-slate-200 transition-colors text-[10px] border border-white/10 px-1.5 py-0.5 rounded">
                          Editar
                        </button>
                        <button onClick={() => handleDelete(e.id)} aria-label="Eliminar entrada" className="text-slate-500 hover:text-red-400 active:scale-90 transition-all p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-2">
                      <span className="text-slate-500">Perf. día: <b className={cn(
                        e.perforacionDia === 0 ? 'text-slate-500'
                          : e.perforacionDia < 20 ? 'text-red-400'
                          : e.perforacionDia === 20 ? 'text-amber-400'
                          : 'text-emerald-400'
                      )}>{e.perforacionDia > 0 ? `${e.perforacionDia} pies` : '—'}</b></span>
                      <span className="text-slate-500">Acum.: <b className="text-white">{e.perforacionTotal} pies</b></span>
                      {e.bentonitaSacos > 0 && <span className="text-slate-500">Bentonita: <b className="text-slate-300">{e.bentonitaSacos} sac.</b></span>}
                      {e.pipas > 0 && <span className="text-slate-500">Pipas: <b className="text-slate-300">{e.pipas}</b></span>}
                    </div>
                    {e.notaCliente && <p className="text-xs text-slate-400 bg-blue-500/5 rounded px-2 py-1">{e.notaCliente}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <LiquidacionProyectoPanel proyectoId={proyecto.id} onProyectoUpdated={load} />
      </div>

      {/* ── MODAL NUEVA / EDITAR ENTRADA ──────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-auto">
          <div className="bg-[#0d1526] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="text-sm font-semibold text-white">
                {editEntry ? `Editar entrada — ${editEntry.fecha}` : 'Nueva entrada de bitácora'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-slate-300 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 overflow-auto max-h-[78vh]">
              {/* 1 · Fecha */}
              <div>
                <label className="text-[11px] font-semibold text-slate-300 mb-1 block">Fecha</label>
                <input type="date" value={form.fecha}
                  onChange={e => patchForm('fecha', e.target.value)}
                  style={{ colorScheme: 'dark' }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50" />
                <p className="text-[10px] text-slate-600 mt-0.5">Por defecto se toma la fecha de hoy, editable.</p>
              </div>

              {/* 2 · Día inactivo (toggle) + motivo si aplica */}
              <div className="bg-white/3 border border-white/5 rounded-xl p-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.diaActivo === false}
                    onChange={e => {
                      patchForm('diaActivo', !e.target.checked)
                      if (e.target.checked) patchForm('perforacionDia', 0)
                    }}
                    className="w-4 h-4 accent-amber-500" />
                  <span className="text-sm font-medium text-slate-200">Día inactivo</span>
                  <span className="text-[10px] text-slate-500">(marcar si NO se trabajó en el pozo)</span>
                </label>
                {form.diaActivo === false && (
                  <input value={form.estado ?? ''} onChange={e => patchForm('estado', e.target.value)}
                    placeholder="Detalle del día inactivo (lluvia, avería, feriado, falta pago...)"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50" />
                )}
              </div>

              {/* Campos de trabajo — solo si día activo */}
              {form.diaActivo !== false && (
                <>
                  {/* 3 · Pies perforados (con semáforo: <20 rojo, =20 amarillo, >20 verde) */}
                  <div>
                    {(() => {
                      const pies = form.perforacionDia
                      const color = pies === 0 ? { border: 'border-blue-500/40', bg: 'bg-white/10', text: 'text-white', chip: '', label: '' }
                        : pies < 20 ? { border: 'border-red-500/60', bg: 'bg-red-500/10', text: 'text-red-300', chip: 'bg-red-500/20 text-red-300', label: '🔴 Adverso (< 20 pies)' }
                        : pies === 20 ? { border: 'border-amber-500/60', bg: 'bg-amber-500/10', text: 'text-amber-200', chip: 'bg-amber-500/20 text-amber-300', label: '🟡 Mínimo exacto (20 pies)' }
                        : { border: 'border-emerald-500/60', bg: 'bg-emerald-500/10', text: 'text-emerald-200', chip: 'bg-emerald-500/20 text-emerald-300', label: '🟢 Día normal' }
                      return <>
                        <label className="text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                          <span>Pies perforados</span>
                          {color.label && <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', color.chip)}>{color.label}</span>}
                        </label>
                        <input type="number" inputMode="decimal" step="0.1" min={0}
                          value={form.perforacionDia}
                          onChange={e => {
                            const v = parseFloat(e.target.value) || 0
                            patchForm('perforacionDia', v)
                            if (v > 0 && v < 20) patchForm('diaAdverso', true)
                            else if (v >= 20) patchForm('diaAdverso', false)
                          }}
                          className={cn('w-full rounded-lg px-3 py-2.5 text-lg font-bold tabular-nums outline-none transition-colors border',
                            color.bg, color.border, color.text)} />
                      </>
                    })()}
                  </div>

                  {/* 4 · Bentonita */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 mb-1 block">Bentonita</label>
                    <div className="relative">
                      <input type="number" inputMode="decimal" step="1" min={0}
                        value={form.bentonitaSacos}
                        onChange={e => patchForm('bentonitaSacos', parseFloat(e.target.value) || 0)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-3 pr-14 py-2 text-sm text-white tabular-nums focus:border-blue-500/50 outline-none" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">sacos</span>
                    </div>
                  </div>

                  {/* 5 · Pipas de agua */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 mb-1 block">Pipas de agua</label>
                    <div className="relative">
                      <input type="number" inputMode="decimal" step="1" min={0}
                        value={form.pipas}
                        onChange={e => patchForm('pipas', parseFloat(e.target.value) || 0)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-3 pr-14 py-2 text-sm text-white tabular-nums focus:border-blue-500/50 outline-none" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">pipas</span>
                    </div>
                  </div>

                  {/* 6 · Circulación */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 mb-1 block">Circulación</label>
                    <div className="flex items-center gap-3">
                      <input type="range" min={0} max={100} step={10}
                        value={form.circulacionPct ?? 0}
                        onChange={e => patchForm('circulacionPct', parseInt(e.target.value) || 0)}
                        className="flex-1 accent-blue-500" />
                      <span className={cn('text-base font-bold tabular-nums min-w-[60px] text-right',
                        (form.circulacionPct ?? 0) >= 70 ? 'text-emerald-400'
                          : (form.circulacionPct ?? 0) >= 40 ? 'text-amber-400'
                          : (form.circulacionPct ?? 0) > 0 ? 'text-red-400' : 'text-slate-500')}>
                        {form.circulacionPct ?? 0}%
                      </span>
                    </div>
                  </div>

                  {/* 7 · Formación */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 mb-1 block">Formación geológica</label>
                    <textarea value={form.formacionGeologica ?? ''}
                      onChange={e => patchForm('formacionGeologica', e.target.value)}
                      rows={2}
                      placeholder="Ej: arcilla reactiva 30-45 m, roca caliza 45-60 m"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-blue-500/50 outline-none resize-none" />
                  </div>
                </>
              )}

              {/* 8 · Nota para el cliente */}
              <div>
                <label className="text-[11px] font-semibold text-blue-300 mb-1 block">Nota para el cliente 📎</label>
                <textarea value={form.notaCliente} onChange={e => patchForm('notaCliente', e.target.value)}
                  rows={2} placeholder="Si queda vacía, no aparece en el PDF"
                  className="w-full bg-blue-500/5 border border-blue-500/25 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-blue-500/60 outline-none resize-none" />
              </div>

              {/* Nota interna opcional (colapsada) */}
              <details className="bg-white/3 border border-white/5 rounded-lg group">
                <summary className="cursor-pointer px-3 py-2 text-[11px] font-semibold text-slate-500 hover:text-slate-300 flex items-center justify-between">
                  <span>+ Nota interna (no se imprime)</span>
                  <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-3 pb-3 pt-1">
                  <textarea value={form.notaInterna} onChange={e => patchForm('notaInterna', e.target.value)}
                    rows={2} placeholder="Observaciones internas, visibles solo al equipo"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-blue-500/50 outline-none resize-none" />
                </div>
              </details>
            </div>

            <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-white/5 flex-wrap">
              <button onClick={() => setShowModal(false)}
                className="px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors">
                Cancelar
              </button>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 border border-white/10 hover:border-white/20 text-slate-200 px-4 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {editEntry ? 'Guardar cambios' : 'Guardar'}
                </button>
                <button onClick={async () => {
                  await handleSave()
                  // Tras guardar abrir el selector de plantillas (usa la entrada recién creada o editada)
                  setPlantillaModal({ entry: editEntry ?? null })
                }}
                  disabled={saving}
                  title="Guarda la entrada y abre el selector de las 4 plantillas para enviar al cliente"
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/25">
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                  Guardar y enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: selector de plantilla PDF (4 opciones SIEMPRE) ──────────── */}
      {plantillaModal && (() => {
        const sorted = [...(proyecto?.entradas ?? [])].sort((a, b) => b.fecha.localeCompare(a.fecha))
        const entryUsado = plantillaModal.entry ?? sorted[0] ?? null
        const fechaDiaPDF = entryUsado?.fecha ?? '(sin entradas)'
        return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1526] rounded-2xl border border-white/10 w-full max-w-2xl shadow-2xl overflow-auto max-h-[92vh]">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
              <h3 className="text-sm font-semibold text-white">Elegí qué enviar al cliente</h3>
              <button onClick={() => setPlantillaModal(null)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-[11px] text-slate-500">
                El PDF se vincula al correlativo <b className="text-blue-400">{proyecto?.correlativo}</b>.
              </p>

              {/* Grupo 1: BITÁCORA DEL DÍA */}
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  📄 Bitácora del día <span className="text-blue-400 font-normal normal-case">· {fechaDiaPDF}</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button onClick={() => generarConPlantilla('dia-sin')} disabled={!entryUsado}
                    className="text-left bg-white/3 border border-white/10 hover:border-blue-500/50 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl p-4 transition-colors">
                    <div className="text-xs font-bold text-blue-300 mb-1">1 · Sin consumos</div>
                    <div className="text-[11px] text-slate-500">Solo perforación/avance. Oculta bentonita y pipas.</div>
                  </button>
                  <button onClick={() => generarConPlantilla('dia-con')} disabled={!entryUsado}
                    className="text-left bg-emerald-500/5 border border-emerald-500/30 hover:border-emerald-500/60 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl p-4 transition-colors">
                    <div className="text-xs font-bold text-emerald-300 mb-1">2 · Con consumos</div>
                    <div className="text-[11px] text-slate-500">Incluye bentonita y pipas de agua del día.</div>
                  </button>
                </div>
              </div>

              {/* Grupo 2: INFORME COMPLETO */}
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  📚 Informe completo <span className="text-blue-400 font-normal normal-case">· {sorted.length} día(s)</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button onClick={() => generarConPlantilla('exp-con')}
                    className="text-left bg-emerald-500/5 border border-emerald-500/30 hover:border-emerald-500/60 rounded-xl p-4 transition-colors">
                    <div className="text-xs font-bold text-emerald-300 mb-1">3 · Con consumos</div>
                    <div className="text-[11px] text-slate-500">Todos los días con bentonita y pipas.</div>
                  </button>
                  <button onClick={() => generarConPlantilla('exp-sin')}
                    className="text-left bg-white/3 border border-white/10 hover:border-blue-500/50 rounded-xl p-4 transition-colors">
                    <div className="text-xs font-bold text-blue-300 mb-1">4 · Sin consumos</div>
                    <div className="text-[11px] text-slate-500">Todos los días, sin bentonita ni pipas.</div>
                  </button>
                </div>
              </div>

              <p className="text-[10px] text-slate-600">
                ℹ Las 4 plantillas están disponibles. La del &quot;día&quot; usa la fecha mostrada arriba.
              </p>
            </div>
          </div>
        </div>
        )
      })()}
    </div>
  )
}
