'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Building2, Phone, Mail, MapPin, Briefcase, FileText,
  Plus, Edit3, Loader2, ClipboardList, Clock, Calendar, AlertCircle, ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Contacto {
  id: string
  nombre: string
  empresa: string
  telefono: string
  email: string
  tipo: string
  pais: string
  departamento: string
  municipio: string
  notas: string
  vendedor: string
  createdAt: string
}

interface CotizacionResumen {
  id: string
  correlativo: string
  cliente: string
  empresa: string
  proyecto: string
  tipo: string
  estado: string
  monto: number
  fecha: string
  vendedor: string
  createdAt: string
}

interface ProyectoResumen {
  id: string
  correlativo: string
  cliente: string
  empresa: string
  nombre: string
  tipo: string
  estado: string
  monto: number
  vendedor: string
  fechaInicio: string
}

const TIPO_COLORS: Record<string, string> = {
  cliente:    'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  prospecto:  'bg-blue-500/20 text-blue-400 border-blue-500/30',
  proveedor:  'bg-amber-500/20 text-amber-400 border-amber-500/30',
}

const ESTADO_COLORS: Record<string, string> = {
  borrador:   'bg-slate-500/20 text-slate-400',
  enviada:    'bg-blue-500/20 text-blue-400',
  confirmada: 'bg-emerald-500/20 text-emerald-400',
  cancelada:  'bg-red-500/20 text-red-400',
  activo:     'bg-emerald-500/20 text-emerald-400',
  completado: 'bg-blue-500/20 text-blue-400',
  pausado:    'bg-amber-500/20 text-amber-400',
}

const formatQ = (n: number) => `Q ${Math.round(n).toLocaleString('es-GT')}`

export default function PerfilContactoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [contacto, setContacto] = useState<Contacto | null>(null)
  const [cotizaciones, setCotizaciones] = useState<CotizacionResumen[]>([])
  const [proyectos, setProyectos] = useState<ProyectoResumen[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/contactos/${id}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null }
        return r.ok ? r.json() : null
      })
      .then(data => {
        if (!data) return
        setContacto(data.contacto)
        setCotizaciones(data.cotizaciones ?? [])
        setProyectos(data.proyectos ?? [])
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Cargando perfil...</span>
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
  const totalCotizado = cotizaciones.reduce((a, c) => a + c.monto, 0)
  const montoProyectos = proyectos.reduce((a, p) => a + p.monto, 0)
  const confirmadas = cotizaciones.filter(c => c.estado === 'confirmada').length

  // URL de "Nueva cotización" con pre-fill desde query params
  const nuevaCotURL = `/cotizaciones/nueva?contactoId=${encodeURIComponent(contacto.id)}`

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-[1200px]">
      {/* Header con back */}
      <div className="flex items-center justify-between">
        <Link href="/contactos" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm">
          <ArrowLeft className="w-4 h-4" /> Contactos
        </Link>
        <Link href={nuevaCotURL}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-500/20">
          <Plus className="w-4 h-4" /> Nueva Cotización
        </Link>
      </div>

      {/* Tarjeta principal del contacto */}
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

      {/* KPIs del expediente */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={<FileText className="w-4 h-4 text-blue-400" />}   label="Cotizaciones" value={String(cotizaciones.length)} sub={formatQ(totalCotizado)} color="blue" />
        <KPI icon={<ClipboardList className="w-4 h-4 text-emerald-400" />} label="Confirmadas"  value={String(confirmadas)}        sub="cerradas" color="emerald" />
        <KPI icon={<Briefcase className="w-4 h-4 text-violet-400" />} label="Proyectos"    value={String(proyectos.length)}    sub={formatQ(montoProyectos)} color="violet" />
        <KPI icon={<Calendar className="w-4 h-4 text-amber-400" />}  label="Cliente desde" value={new Date(contacto.createdAt).toLocaleDateString('es-GT', { year: 'numeric', month: 'short' })} sub="fecha de alta" color="amber" />
      </div>

      {/* Cotizaciones */}
      <div className="bg-[#0d1526] rounded-2xl border border-white/5 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">Cotizaciones</h2>
            <span className="text-[11px] text-slate-500">({cotizaciones.length})</span>
          </div>
          <Link href={nuevaCotURL} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Nueva
          </Link>
        </div>
        {cotizaciones.length === 0 ? (
          <div className="py-10 flex flex-col items-center text-slate-600">
            <FileText className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm text-slate-500">Sin cotizaciones todavía</p>
            <Link href={nuevaCotURL} className="mt-2 text-blue-400 hover:text-blue-300 text-xs underline">Crear la primera</Link>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {cotizaciones.map(c => (
              <Link key={c.id} href={`/cotizaciones/nueva?edit=${c.correlativo}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-white/2 transition-colors">
                <span className="font-mono text-[11px] text-blue-400 min-w-[60px]">{c.correlativo}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{c.proyecto}</p>
                  <p className="text-[10px] text-slate-500">{c.fecha} · {c.vendedor} · {c.tipo === 'perforacion' ? 'Perforación' : 'Limpieza'}</p>
                </div>
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md', ESTADO_COLORS[c.estado] ?? 'bg-slate-500/20 text-slate-400')}>
                  {c.estado}
                </span>
                <span className="text-sm font-bold text-white tabular-nums min-w-[100px] text-right">{formatQ(c.monto)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Proyectos */}
      <div className="bg-[#0d1526] rounded-2xl border border-white/5 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white">Proyectos / Bitácoras</h2>
            <span className="text-[11px] text-slate-500">({proyectos.length})</span>
          </div>
        </div>
        {proyectos.length === 0 ? (
          <div className="py-10 flex flex-col items-center text-slate-600">
            <ClipboardList className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm text-slate-500">Sin proyectos en ejecución</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {proyectos.map(p => (
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
        )}
      </div>
    </div>
  )
}

function KPI({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string;
  color: 'blue' | 'emerald' | 'violet' | 'amber'
}) {
  const cls = {
    blue:    'border-blue-500/15 bg-blue-500/5',
    emerald: 'border-emerald-500/15 bg-emerald-500/5',
    violet:  'border-violet-500/15 bg-violet-500/5',
    amber:   'border-amber-500/15 bg-amber-500/5',
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
