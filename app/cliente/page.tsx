'use client'

// Dashboard del cliente: lista sus proyectos con avance y estado de pagos.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  Droplet, LogOut, Loader2, Briefcase, Calendar, CheckCircle2, Clock,
  ArrowRight, Building2, MapPin, Phone, Mail,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface PortalData {
  contacto: {
    id: string; nombre: string; empresa: string; telefono: string; email: string
    municipio: string; departamento: string
  }
  proyectos: Array<{
    id: string; correlativo: string; nombre: string; tipo: string; estado: string
    fechaInicio: string; monto: number; vendedor: string
    avance: { piesAcumulados: number; ultimaActualizacion: string | null }
    pagos: { totalProyecto: number; recibido: number; pendiente: number; pctCobrado: number }
  }>
  totales: { proyectos: number; activos: number; completados: number }
}

const formatQ = (n: number) => `Q ${Math.round(n).toLocaleString('es-GT')}`

export default function ClienteDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/cliente/portal')
      .then(r => {
        if (r.status === 401) { router.push('/cliente/login'); return null }
        return r.ok ? r.json() : null
      })
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [router])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    router.push('/cliente/login')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" /> Cargando tu portal…
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="min-h-screen bg-[#070d1a]">
      {/* Header */}
      <header className="bg-[#0d1526] border-b border-white/5 sticky top-0 z-10">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="bg-white rounded-lg p-1 w-9 h-9 flex items-center justify-center">
            <Image src="/logo.png" alt="HP" width={32} height={32} className="object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-cyan-400 font-semibold flex items-center gap-1">
              <Droplet className="w-3 h-3" /> HIDROPERFORACIONES · Portal Cliente
            </p>
            <p className="text-sm text-white font-medium truncate">{data.contacto.nombre}</p>
          </div>
          <button onClick={logout}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Salir
          </button>
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Saludo */}
        <div className="bg-gradient-to-br from-blue-600/10 to-cyan-500/5 border border-blue-500/20 rounded-2xl p-5 sm:p-6">
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            Hola, {data.contacto.nombre.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Acá podés ver el estado de tu{data.totales.proyectos > 1 ? 's' : ''} proyecto{data.totales.proyectos > 1 ? 's' : ''} con Hidroperforaciones.
          </p>
          {data.contacto.empresa && (
            <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
              <Building2 className="w-3.5 h-3.5" /> {data.contacto.empresa}
            </div>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <KPI label="Proyectos" value={String(data.totales.proyectos)} color="blue" />
          <KPI label="Activos" value={String(data.totales.activos)} color="emerald" />
          <KPI label="Completados" value={String(data.totales.completados)} color="slate" />
        </div>

        {/* Lista de proyectos */}
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Tus proyectos</h2>
          {data.proyectos.length === 0 ? (
            <div className="bg-[#0d1526] rounded-2xl border border-white/5 py-12 flex flex-col items-center text-slate-500">
              <Briefcase className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Aún no tenés proyectos en ejecución</p>
              <p className="text-[11px] text-slate-600 mt-1">Cuando tu asesor apruebe una cotización aparecerá aquí</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.proyectos.map(p => (
                <Link key={p.id} href={`/cliente/proyectos/${p.id}`}
                  className="block bg-[#0d1526] border border-white/5 hover:border-blue-500/30 rounded-2xl p-5 transition-colors group">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-mono text-xs text-blue-400">{p.correlativo}</span>
                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full capitalize',
                      p.estado === 'activo'     && 'bg-emerald-500/20 text-emerald-400',
                      p.estado === 'completado' && 'bg-blue-500/20 text-blue-400',
                      p.estado === 'pausado'    && 'bg-amber-500/20 text-amber-400',
                    )}>{p.estado}</span>
                    <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 ml-auto transition-colors" />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-1">{p.nombre}</h3>
                  <p className="text-xs text-slate-500 mb-3 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Inicio {p.fechaInicio}</span>
                    {p.avance.ultimaActualizacion && (
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Última actualización {p.avance.ultimaActualizacion}</span>
                    )}
                  </p>
                  {/* Progreso de avance */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span>Perforado</span>
                      <span className="text-white font-medium tabular-nums">{p.avance.piesAcumulados.toFixed(0)} pies</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400"
                        style={{ width: `${Math.min(100, (p.avance.piesAcumulados / 800) * 100)}%` }} />
                    </div>
                  </div>
                  {/* Progreso de pagos */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span>Pagos al día</span>
                      <span className="text-emerald-400 font-medium tabular-nums">
                        {formatQ(p.pagos.recibido)} / {formatQ(p.pagos.totalProyecto)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400"
                        style={{ width: `${Math.min(100, p.pagos.pctCobrado)}%` }} />
                    </div>
                    {p.pagos.pendiente > 0 && (
                      <p className="text-[10px] text-amber-400 mt-1">
                        Pendiente: {formatQ(p.pagos.pendiente)}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Contacto */}
        <div className="bg-[#0d1526] rounded-2xl border border-white/5 p-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">¿Dudas? Tu asesor</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <a href="tel:50225992626" className="flex items-center gap-2 text-slate-300 hover:text-blue-400 transition-colors">
              <Phone className="w-4 h-4 text-slate-500" /> (502) 2259-2626
            </a>
            <a href="mailto:info@hidroperforaciones.com" className="flex items-center gap-2 text-slate-300 hover:text-blue-400 transition-colors">
              <Mail className="w-4 h-4 text-slate-500" /> info@hidroperforaciones.com
            </a>
            <div className="flex items-center gap-2 text-slate-400">
              <MapPin className="w-4 h-4 text-slate-500" /> Guatemala, C.A.
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function KPI({ label, value, color }: { label: string; value: string; color: 'blue' | 'emerald' | 'slate' }) {
  const cls = {
    blue:    'border-blue-500/20 bg-blue-500/5',
    emerald: 'border-emerald-500/20 bg-emerald-500/5',
    slate:   'border-slate-500/20 bg-slate-500/5',
  }[color]
  return (
    <div className={cn('rounded-xl border p-3 text-center', cls)}>
      <p className="text-2xl font-black text-white tabular-nums">{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">{label}</p>
    </div>
  )
}
