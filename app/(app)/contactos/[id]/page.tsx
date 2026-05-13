'use client'

// Expediente completo del contacto (Fase B).
// - Tabs: Resumen · Timeline · Cotizaciones · Proyectos · Oportunidades
// - Timeline cronológico mergeando eventos de los 3 módulos
// - KPIs agregados: total cotizado, ganado, tasa conversión, proyectos activos

import { useCallback, useEffect, useState, use, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Building2, Phone, Mail, MapPin, Briefcase, FileText,
  Plus, Edit3, Loader2, ClipboardList, Clock, Calendar, AlertCircle, ShieldCheck,
  TrendingUp, Activity, CheckCircle2, XCircle, Send, FileEdit, Award, Target,
  UserRound,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AccesoClienteCard } from '@/components/acceso-cliente-card'

interface Contacto {
  id: string
  nombre: string
  empresa: string
  telefono: string
  email: string
  tipo: string
  tipoPersona?: 'individual' | 'empresa'
  pais: string
  departamento: string
  municipio: string
  notas: string
  vendedor: string
  createdAt: string
}

interface CotizacionResumen {
  id: string; correlativo: string; cliente: string; empresa: string
  proyecto: string; tipo: string; estado: string; monto: number
  fecha: string; vendedor: string; createdAt: string
  eliminadaEn?: string | null
}

interface ProyectoResumen {
  id: string; correlativo: string; cliente: string; empresa: string
  nombre: string; tipo: string; estado: string; monto: number
  vendedor: string; fechaInicio: string
  eliminadoEn?: string | null
}

interface OportunidadResumen {
  id: string; correlativo: string; cliente: string; empresa: string
  monto: number; etapa: string; vendedor: string; fecha: string; tipo: string
  eliminadaEn?: string | null
}

const TIPO_COLORS: Record<string, string> = {
  cliente:    'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  prospecto:  'bg-blue-500/20 text-blue-400 border-blue-500/30',
  proveedor:  'bg-amber-500/20 text-amber-400 border-amber-500/30',
}

const TIPO_PERSONA_LABELS: Record<'individual' | 'empresa', string> = {
  individual: 'Persona individual',
  empresa: 'Empresa',
}

const tipoPersonaContacto = (contacto: Contacto) =>
  contacto.tipoPersona === 'empresa' || (!contacto.tipoPersona && contacto.empresa) ? 'empresa' : 'individual'

const ESTADO_COLORS: Record<string, string> = {
  borrador:   'bg-slate-500/20 text-slate-400',
  enviada:    'bg-blue-500/20 text-blue-400',
  confirmada: 'bg-emerald-500/20 text-emerald-400',
  cancelada:  'bg-red-500/20 text-red-400',
  activo:     'bg-emerald-500/20 text-emerald-400',
  completado: 'bg-blue-500/20 text-blue-400',
  pausado:    'bg-amber-500/20 text-amber-400',
}

const ETAPA_COLORS: Record<string, string> = {
  new:         'bg-slate-500/20 text-slate-300',
  qualified:   'bg-blue-500/20 text-blue-300',
  proposition: 'bg-indigo-500/20 text-indigo-300',
  negotiation: 'bg-amber-500/20 text-amber-400',
  won:         'bg-emerald-500/20 text-emerald-400',
  lost:        'bg-red-500/20 text-red-400',
}

const formatQ = (n: number) => `Q ${(Number.isFinite(n) ? n : 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

type Tab = 'resumen' | 'timeline' | 'cotizaciones' | 'proyectos' | 'oportunidades'

export default function PerfilContactoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [contacto, setContacto] = useState<Contacto | null>(null)
  const [cotizaciones, setCotizaciones] = useState<CotizacionResumen[]>([])
  const [proyectos, setProyectos] = useState<ProyectoResumen[]>([])
  const [oportunidades, setOportunidades] = useState<OportunidadResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState<Tab>('resumen')

  const loadContacto = useCallback(async () => {
    setLoading(true)
    setNotFound(false)
    try {
      const r = await fetch(`/api/contactos/${id}`)
      if (r.status === 404) {
        setNotFound(true)
        return
      }
      if (!r.ok) return
      const data = await r.json()
      if (!data) return
      setContacto(data.contacto)
      setCotizaciones(data.cotizaciones ?? [])
      setProyectos(data.proyectos ?? [])
      setOportunidades(data.oportunidades ?? [])
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void loadContacto()
  }, [loadContacto])

  // ── KPIs calculados ────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalCotizado = cotizaciones.reduce((a, c) => a + c.monto, 0)
    const confirmadas = cotizaciones.filter(c => c.estado === 'confirmada')
    const canceladas  = cotizaciones.filter(c => c.estado === 'cancelada')
    const enviadas    = cotizaciones.filter(c => c.estado === 'enviada')
    const borradores  = cotizaciones.filter(c => c.estado === 'borrador')
    const montoGanado = confirmadas.reduce((a, c) => a + c.monto, 0)
    const totalResueltas = confirmadas.length + canceladas.length
    const tasaConv = totalResueltas > 0 ? (confirmadas.length / totalResueltas) * 100 : 0
    const proyectosActivos = proyectos.filter(p => p.estado === 'activo').length
    const proyectosCompletados = proyectos.filter(p => p.estado === 'completado').length
    const oportunidadesAbiertas = oportunidades.filter(o => !['won', 'lost'].includes(o.etapa)).length
    return {
      totalCotizado, montoGanado, tasaConv,
      counts: {
        cotizaciones: cotizaciones.length,
        confirmadas: confirmadas.length,
        canceladas: canceladas.length,
        enviadas: enviadas.length,
        borradores: borradores.length,
      },
      proyectosActivos, proyectosCompletados,
      oportunidadesAbiertas,
    }
  }, [cotizaciones, proyectos, oportunidades])

  // ── Timeline (eventos cronológicos) ─────────────────────────────────
  const timeline = useMemo(() => buildTimeline(cotizaciones, proyectos, oportunidades), [cotizaciones, proyectos, oportunidades])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Cargando expediente...</span>
      </div>
    )
  }

  if (notFound || !contacto) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <AlertCircle className="w-12 h-12 mb-3 text-slate-600" />
        <p className="font-medium">Contacto no encontrado</p>
        <Link href="/contactos" className="mt-2 text-blue-400 hover:text-blue-300 text-sm underline">
          Volver a contactos
        </Link>
      </div>
    )
  }

  const iniciales = contacto.nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const nuevaCotURL = `/cotizaciones/nueva?contactoId=${encodeURIComponent(contacto.id)}`
  const tipoPersona = tipoPersonaContacto(contacto)

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/contactos" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm">
          <ArrowLeft className="w-4 h-4" /> Contactos
        </Link>
        <Link href={nuevaCotURL}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-500/20">
          <Plus className="w-4 h-4" /> Nueva Cotización
        </Link>
      </div>

      {/* Tarjeta principal */}
      <div className="bg-[#0d1526] rounded-2xl border border-white/5 p-5 sm:p-6">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xl font-bold text-white shrink-0 shadow-lg shadow-blue-500/25">
            {iniciales}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-white">{contacto.nombre}</h1>
              <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium border capitalize',
                TIPO_COLORS[contacto.tipo] ?? 'bg-slate-500/20 text-slate-400')}>
                {contacto.tipo}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium border bg-white/5 text-slate-300 border-white/10">
                {tipoPersona === 'empresa' ? <Building2 className="w-3 h-3" /> : <UserRound className="w-3 h-3" />}
                {TIPO_PERSONA_LABELS[tipoPersona]}
              </span>
            </div>
            {contacto.empresa && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <p className="text-sm text-slate-300 font-medium">{contacto.empresa}</p>
              </div>
            )}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4">
              {contacto.email && (
                <a href={`mailto:${contacto.email}`}
                  className="flex items-center gap-2 text-xs text-slate-400 hover:text-blue-400 transition-colors">
                  <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{contacto.email}</span>
                </a>
              )}
              {contacto.telefono && (
                <a href={`tel:${contacto.telefono}`}
                  className="flex items-center gap-2 text-xs text-slate-400 hover:text-blue-400 transition-colors">
                  <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{contacto.telefono}</span>
                </a>
              )}
              {(contacto.municipio || contacto.departamento) && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>
                    {contacto.municipio && <span>{contacto.municipio}</span>}
                    {contacto.municipio && contacto.departamento && <span className="text-slate-600">, </span>}
                    <span>{contacto.departamento}</span>
                  </span>
                </div>
              )}
              {contacto.vendedor && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Vendedor: {contacto.vendedor}</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => router.push(`/contactos?edit=${contacto.id}`)}
            className="text-slate-500 hover:text-white border border-white/10 hover:border-white/20 p-2 rounded-lg transition-colors"
            title="Editar datos del contacto"
          >
            <Edit3 className="w-4 h-4" />
          </button>
        </div>

        {contacto.notas && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Notas</p>
            <p className="text-sm text-slate-300 whitespace-pre-wrap">{contacto.notas}</p>
          </div>
        )}
      </div>

      {/* KPIs Grid — 6 métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        <KPI icon={<FileText className="w-4 h-4 text-blue-400" />}
          label="Total cotizado" value={formatQ(kpis.totalCotizado)} sub={`${kpis.counts.cotizaciones} cotizaciones`} color="blue" />
        <KPI icon={<Award className="w-4 h-4 text-emerald-400" />}
          label="Monto ganado" value={formatQ(kpis.montoGanado)} sub={`${kpis.counts.confirmadas} confirmadas`} color="emerald" />
        <KPI icon={<Target className="w-4 h-4 text-violet-400" />}
          label="Tasa conversión" value={`${kpis.tasaConv.toFixed(0)}%`} sub="confirmadas / resueltas" color="violet" />
        <KPI icon={<Briefcase className="w-4 h-4 text-amber-400" />}
          label="Proyectos" value={`${kpis.proyectosActivos}/${proyectos.length}`} sub={`${kpis.proyectosCompletados} completados`} color="amber" />
        <KPI icon={<Activity className="w-4 h-4 text-cyan-400" />}
          label="Oportunidades" value={String(kpis.oportunidadesAbiertas)} sub={`${oportunidades.length} totales`} color="cyan" />
        <KPI icon={<Calendar className="w-4 h-4 text-slate-400" />}
          label="Cliente desde" value={new Date(contacto.createdAt).toLocaleDateString('es-GT', { year: 'numeric', month: 'short' })} sub="fecha de alta" color="slate" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 sm:gap-2 flex-wrap border-b border-white/5 overflow-x-auto">
        {([
          { id: 'resumen', label: 'Resumen', icon: Activity },
          { id: 'timeline', label: 'Timeline', icon: Clock },
          { id: 'cotizaciones', label: `Cotizaciones (${cotizaciones.length})`, icon: FileText },
          { id: 'proyectos', label: `Proyectos (${proyectos.length})`, icon: ClipboardList },
          { id: 'oportunidades', label: `Oportunidades (${oportunidades.length})`, icon: TrendingUp },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium rounded-t-lg transition-colors border-b-2 whitespace-nowrap shrink-0',
              tab === t.id ? 'bg-white/5 text-white border-blue-500' : 'text-slate-400 hover:text-slate-200 border-transparent'
            )}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* Contenido del tab */}
      {tab === 'resumen' && (
        <div className="space-y-4">
          <AccesoClienteCard contactoId={contacto.id} contactoNombre={contacto.nombre} contactoEmail={contacto.email} />
          <ResumenTab cotizaciones={cotizaciones} proyectos={proyectos} oportunidades={oportunidades} kpis={kpis} nuevaCotURL={nuevaCotURL} />
        </div>
      )}
      {tab === 'timeline' && <TimelineTab eventos={timeline} />}
      {tab === 'cotizaciones' && <CotizacionesTab rows={cotizaciones} nuevaCotURL={nuevaCotURL} />}
      {tab === 'proyectos' && <ProyectosTab rows={proyectos} />}
      {tab === 'oportunidades' && <OportunidadesTab rows={oportunidades} />}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// Tabs individuales
// ────────────────────────────────────────────────────────────────────

function ResumenTab({ cotizaciones, proyectos, oportunidades, kpis, nuevaCotURL }: {
  cotizaciones: CotizacionResumen[]
  proyectos: ProyectoResumen[]
  oportunidades: OportunidadResumen[]
  kpis: { totalCotizado: number; montoGanado: number; tasaConv: number; counts: Record<string, number> }
  nuevaCotURL: string
}) {
  const ultimaCot = cotizaciones[0]
  const proyectoActivo = proyectos.find(p => p.estado === 'activo')
  const oportunidadAbierta = oportunidades.find(o => !['won', 'lost'].includes(o.etapa))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Estado de pipeline */}
        <div className="bg-[#0d1526] rounded-2xl border border-white/5 p-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Estado del Pipeline</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <StatCompact icon={<FileEdit className="w-3.5 h-3.5" />} label="Borradores" value={kpis.counts.borradores} tone="slate" />
            <StatCompact icon={<Send className="w-3.5 h-3.5" />} label="Enviadas" value={kpis.counts.enviadas} tone="blue" />
            <StatCompact icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="Confirmadas" value={kpis.counts.confirmadas} tone="emerald" />
            <StatCompact icon={<XCircle className="w-3.5 h-3.5" />} label="Canceladas" value={kpis.counts.canceladas} tone="red" />
          </div>
        </div>

        {/* Último movimiento */}
        <div className="bg-[#0d1526] rounded-2xl border border-white/5 p-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Actividad Reciente</h3>
          <div className="space-y-2 text-sm">
            {ultimaCot && (
              <div>
                <p className="text-slate-400 text-xs">Última cotización</p>
                <Link href={`/cotizaciones/nueva?edit=${ultimaCot.correlativo}`} className="text-white hover:text-blue-400 font-medium">
                  {ultimaCot.correlativo} — {ultimaCot.proyecto}
                </Link>
                <p className="text-[10px] text-slate-500">{ultimaCot.fecha} · {formatQ(ultimaCot.monto)}</p>
              </div>
            )}
            {proyectoActivo && (
              <div className="pt-2 border-t border-white/5">
                <p className="text-slate-400 text-xs">Proyecto activo</p>
                <Link href={`/proyectos/${proyectoActivo.id}`} className="text-white hover:text-violet-400 font-medium">
                  {proyectoActivo.correlativo} — {proyectoActivo.nombre}
                </Link>
                <p className="text-[10px] text-slate-500">Inicio {proyectoActivo.fechaInicio}</p>
              </div>
            )}
            {oportunidadAbierta && (
              <div className="pt-2 border-t border-white/5">
                <p className="text-slate-400 text-xs">Oportunidad abierta</p>
                <Link href="/crm" className="text-white hover:text-amber-400 font-medium">
                  {oportunidadAbierta.correlativo} — {oportunidadAbierta.tipo}
                </Link>
                <p className="text-[10px] text-slate-500">Etapa {oportunidadAbierta.etapa} · {formatQ(oportunidadAbierta.monto)}</p>
              </div>
            )}
            {!ultimaCot && !proyectoActivo && !oportunidadAbierta && (
              <div className="text-center py-4">
                <p className="text-sm text-slate-500 mb-2">Sin actividad todavía</p>
                <Link href={nuevaCotURL} className="text-blue-400 hover:text-blue-300 text-xs underline">Crear primera cotización</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function TimelineTab({ eventos }: { eventos: TimelineEvento[] }) {
  if (eventos.length === 0) {
    return (
      <div className="bg-[#0d1526] rounded-2xl border border-white/5 py-16 flex flex-col items-center text-slate-500">
        <Clock className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm">Sin actividad registrada</p>
      </div>
    )
  }
  return (
    <div className="bg-[#0d1526] rounded-2xl border border-white/5 p-5">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Timeline de actividad</h3>
      <div className="relative pl-6 space-y-4">
        <div className="absolute left-[11px] top-1 bottom-1 w-px bg-white/10" />
        {eventos.map((ev, i) => (
          <div key={i} className="relative">
            <div className={cn(
              'absolute -left-6 top-0.5 w-5 h-5 rounded-full border-2 border-[#0d1526] flex items-center justify-center',
              ev.color === 'blue'    && 'bg-blue-500',
              ev.color === 'emerald' && 'bg-emerald-500',
              ev.color === 'violet'  && 'bg-violet-500',
              ev.color === 'amber'   && 'bg-amber-500',
              ev.color === 'red'     && 'bg-red-500',
              ev.color === 'slate'   && 'bg-slate-500',
            )}>
              <ev.icon className="w-3 h-3 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-white">{ev.titulo}</p>
                {ev.badge && (
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md',
                    ev.color === 'blue'    && 'bg-blue-500/20 text-blue-400',
                    ev.color === 'emerald' && 'bg-emerald-500/20 text-emerald-400',
                    ev.color === 'violet'  && 'bg-violet-500/20 text-violet-400',
                    ev.color === 'amber'   && 'bg-amber-500/20 text-amber-400',
                    ev.color === 'red'     && 'bg-red-500/20 text-red-400',
                    ev.color === 'slate'   && 'bg-slate-500/20 text-slate-400',
                  )}>{ev.badge}</span>
                )}
              </div>
              {ev.descripcion && <p className="text-xs text-slate-400 mt-0.5">{ev.descripcion}</p>}
              <p className="text-[10px] text-slate-500 mt-0.5">
                {new Date(ev.fecha).toLocaleString('es-GT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {ev.vendedor && <span> · {ev.vendedor}</span>}
                {ev.monto !== undefined && <span> · {formatQ(ev.monto)}</span>}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CotizacionesTab({ rows, nuevaCotURL }: { rows: CotizacionResumen[]; nuevaCotURL: string }) {
  if (rows.length === 0) {
    return (
      <div className="bg-[#0d1526] rounded-2xl border border-white/5 py-10 flex flex-col items-center text-slate-600">
        <FileText className="w-8 h-8 mb-2 opacity-30" />
        <p className="text-sm text-slate-500">Sin cotizaciones todavía</p>
        <Link href={nuevaCotURL} className="mt-2 text-blue-400 hover:text-blue-300 text-xs underline">Crear la primera</Link>
      </div>
    )
  }
  return (
    <div className="bg-[#0d1526] rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5">
      {rows.map(c => (
        <Link key={c.id} href={`/cotizaciones/nueva?edit=${c.correlativo}`}
          className="flex items-center gap-3 px-5 py-3 hover:bg-white/2 transition-colors">
          <span className="font-mono text-[11px] text-blue-400 min-w-[60px]">{c.correlativo}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-200 truncate">{c.proyecto}</p>
            <p className="text-[10px] text-slate-500">{c.fecha} · {c.vendedor} · {c.tipo === 'perforacion' ? 'Perforación' : 'Limpieza'}</p>
          </div>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md capitalize', ESTADO_COLORS[c.estado] ?? 'bg-slate-500/20 text-slate-400')}>
            {c.estado}
          </span>
          <span className="text-sm font-bold text-white tabular-nums min-w-[100px] text-right">{formatQ(c.monto)}</span>
        </Link>
      ))}
    </div>
  )
}

function ProyectosTab({ rows }: { rows: ProyectoResumen[] }) {
  if (rows.length === 0) {
    return (
      <div className="bg-[#0d1526] rounded-2xl border border-white/5 py-10 flex flex-col items-center text-slate-600">
        <ClipboardList className="w-8 h-8 mb-2 opacity-30" />
        <p className="text-sm text-slate-500">Sin proyectos en ejecución</p>
      </div>
    )
  }
  return (
    <div className="bg-[#0d1526] rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5">
      {rows.map(p => (
        <Link key={p.id} href={`/proyectos/${p.id}`}
          className="flex items-center gap-3 px-5 py-3 hover:bg-white/2 transition-colors">
          <span className="font-mono text-[11px] text-violet-400 min-w-[60px]">{p.correlativo}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-200 truncate">{p.nombre}</p>
            <p className="text-[10px] text-slate-500">
              <Clock className="inline w-3 h-3 mr-1" />
              {p.fechaInicio} · {p.vendedor}
            </p>
          </div>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md capitalize', ESTADO_COLORS[p.estado] ?? 'bg-slate-500/20 text-slate-400')}>
            {p.estado}
          </span>
          <span className="text-sm font-bold text-white tabular-nums min-w-[100px] text-right">{formatQ(p.monto)}</span>
        </Link>
      ))}
    </div>
  )
}

function OportunidadesTab({ rows }: { rows: OportunidadResumen[] }) {
  if (rows.length === 0) {
    return (
      <div className="bg-[#0d1526] rounded-2xl border border-white/5 py-10 flex flex-col items-center text-slate-600">
        <TrendingUp className="w-8 h-8 mb-2 opacity-30" />
        <p className="text-sm text-slate-500">Sin oportunidades en el pipeline</p>
      </div>
    )
  }
  return (
    <div className="bg-[#0d1526] rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5">
      {rows.map(o => (
        <Link key={o.id} href="/crm"
          className="flex items-center gap-3 px-5 py-3 hover:bg-white/2 transition-colors">
          <span className="font-mono text-[11px] text-amber-400 min-w-[60px]">{o.correlativo}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-200 truncate">{o.tipo}</p>
            <p className="text-[10px] text-slate-500">
              <Calendar className="inline w-3 h-3 mr-1" />
              {o.fecha} · {o.vendedor}
            </p>
          </div>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md capitalize', ETAPA_COLORS[o.etapa] ?? 'bg-slate-500/20 text-slate-400')}>
            {o.etapa}
          </span>
          <span className="text-sm font-bold text-white tabular-nums min-w-[100px] text-right">{formatQ(o.monto)}</span>
        </Link>
      ))}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────
// Helpers + componentes internos
// ────────────────────────────────────────────────────────────────────

interface TimelineEvento {
  fecha: string
  titulo: string
  descripcion?: string
  badge?: string
  icon: typeof FileText
  color: 'blue' | 'emerald' | 'violet' | 'amber' | 'red' | 'slate'
  vendedor?: string
  monto?: number
}

function buildTimeline(cots: CotizacionResumen[], proys: ProyectoResumen[], ops: OportunidadResumen[]): TimelineEvento[] {
  const eventos: TimelineEvento[] = []

  for (const c of cots) {
    const iconMap = {
      confirmada: { icon: CheckCircle2, color: 'emerald' as const, verb: 'Cotización confirmada' },
      cancelada:  { icon: XCircle,      color: 'red'     as const, verb: 'Cotización cancelada' },
      enviada:    { icon: Send,         color: 'blue'    as const, verb: 'Cotización enviada' },
      borrador:   { icon: FileEdit,     color: 'slate'   as const, verb: 'Cotización en borrador' },
    }
    const cfg = iconMap[c.estado as keyof typeof iconMap] ?? iconMap.borrador
    eventos.push({
      fecha: c.createdAt,
      titulo: `${cfg.verb} · ${c.correlativo}`,
      descripcion: c.proyecto,
      badge: c.tipo === 'perforacion' ? 'Perforación' : 'Limpieza',
      icon: cfg.icon,
      color: cfg.color,
      vendedor: c.vendedor,
      monto: c.monto,
    })
  }

  for (const p of proys) {
    eventos.push({
      fecha: p.fechaInicio || new Date().toISOString(),
      titulo: `Proyecto ${p.estado === 'completado' ? 'completado' : 'iniciado'} · ${p.correlativo}`,
      descripcion: p.nombre,
      badge: p.estado,
      icon: Briefcase,
      color: p.estado === 'completado' ? 'violet' : 'amber',
      vendedor: p.vendedor,
      monto: p.monto,
    })
  }

  for (const o of ops) {
    const isClosed = ['won', 'lost'].includes(o.etapa)
    eventos.push({
      fecha: o.fecha || new Date().toISOString(),
      titulo: `Oportunidad ${isClosed ? 'cerrada' : 'abierta'} · ${o.correlativo}`,
      descripcion: o.tipo,
      badge: o.etapa,
      icon: TrendingUp,
      color: o.etapa === 'won' ? 'emerald' : o.etapa === 'lost' ? 'red' : 'amber',
      vendedor: o.vendedor,
      monto: o.monto,
    })
  }

  // Ordenar por fecha descendente (más reciente arriba)
  return eventos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
}

function KPI({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string
  color: 'blue' | 'emerald' | 'violet' | 'amber' | 'cyan' | 'slate'
}) {
  const cls = {
    blue:    'border-blue-500/15 bg-blue-500/5',
    emerald: 'border-emerald-500/15 bg-emerald-500/5',
    violet:  'border-violet-500/15 bg-violet-500/5',
    amber:   'border-amber-500/15 bg-amber-500/5',
    cyan:    'border-cyan-500/15 bg-cyan-500/5',
    slate:   'border-slate-500/15 bg-slate-500/5',
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

function StatCompact({ icon, label, value, tone }: {
  icon: React.ReactNode; label: string; value: number; tone: 'slate' | 'blue' | 'emerald' | 'red'
}) {
  const cls = {
    slate:   'text-slate-400',
    blue:    'text-blue-400',
    emerald: 'text-emerald-400',
    red:     'text-red-400',
  }[tone]
  return (
    <div className="flex items-center gap-2">
      <span className={cls}>{icon}</span>
      <div className="min-w-0">
        <p className={cn('text-lg font-bold leading-none', cls)}>{value}</p>
        <p className="text-[10px] text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}
