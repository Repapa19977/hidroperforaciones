'use client'

import { startTransition, useDeferredValue, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Briefcase,
  CheckCircle,
  ChevronRight,
  Clock3,
  PauseCircle,
  RefreshCw,
  Search,
  Download,
  Trash2,
} from 'lucide-react'
import type { Rol } from '@/lib/config-store'
import { cn } from '@/lib/utils'
import * as XLSX from 'xlsx'

interface ProyectoRow {
  id: string
  correlativo: string
  cotizacionId: string
  cliente: string
  empresa: string
  nombre: string
  tipo: string
  monto: number
  vendedor: string
  estado: 'activo' | 'completado' | 'pausado'
  fechaInicio: string
  entradas: { id: string; fecha: string }[]
}

function getCookie(name: string) {
  if (typeof document === 'undefined') return ''
  return document.cookie.match(new RegExp(`${name}=([^;]+)`))?.[1] ?? ''
}

const formatQ = (n: number) => `Q ${Math.round(n).toLocaleString('es-GT')}`

function tipoLabel(tipo: string) {
  return tipo === 'perforacion' ? 'Perforacion' : 'Limpieza'
}

function estadoBadge(estado: ProyectoRow['estado']) {
  const map = {
    activo: 'bg-emerald-500/20 text-emerald-400',
    pausado: 'bg-amber-500/20 text-amber-400',
    completado: 'bg-blue-500/20 text-blue-400',
  } as const
  return map[estado] ?? 'bg-slate-500/20 text-slate-400'
}

export default function ProyectosPage() {
  const [role, setRole]           = useState<Rol>('admin')
  const [myVendedor, setMyVendedor] = useState('')
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<ProyectoRow[]>([])
  const [sinActualizar, setSinActualizar] = useState<ProyectoRow[]>([])
  const [search, setSearch] = useState('')
  const [estado, setEstado] = useState<'todos' | 'activo' | 'pausado' | 'completado'>('todos')
  const [vendedorFiltro, setVendedorFiltro] = useState('Todos')

  const searchDeferred = useDeferredValue(search)
  const isSuperAdmin = role === 'superadmin'

  async function loadData() {
    setLoading(true)
    const [resRows, resSinActualizar] = await Promise.all([
      fetch('/api/proyectos'),
      fetch('/api/proyectos/sin-actualizar'),
    ])
    setRows(resRows.ok ? await resRows.json() : [])
    setSinActualizar(resSinActualizar.ok ? await resSinActualizar.json() : [])
    setLoading(false)
  }

  async function handleDelete(r: ProyectoRow) {
    const msg = r.entradas.length > 0
      ? `¿Eliminar el proyecto "${r.nombre}"?\n\nSe borrarán también las ${r.entradas.length} entrada(s) de bitácora. Esta acción no se puede deshacer.`
      : `¿Eliminar el proyecto "${r.nombre}"?\n\nEsta acción no se puede deshacer.`
    if (!confirm(msg)) return
    const res = await fetch(`/api/proyectos/${r.id}`, { method: 'DELETE' })
    if (!res.ok) {
      alert('No se pudo eliminar el proyecto.')
      return
    }
    await loadData()
  }

  // Lee cookies solo en el cliente (después de hidratación) y carga datos
  useEffect(() => {
    const r = (getCookie('user_role') as Rol) || 'admin'
    const v = getCookie('user_vendedor') || ''
    setRole(r)
    setMyVendedor(v)
    void loadData()
  }, [])

  const vendedores = ['Todos', ...new Set(rows.map(r => r.vendedor))]
  const filtrados = rows.filter(r => {
    const q = searchDeferred.trim().toLowerCase()
    const matchSearch =
      q === '' ||
      r.correlativo.toLowerCase().includes(q) ||
      r.cliente.toLowerCase().includes(q) ||
      r.nombre.toLowerCase().includes(q) ||
      (r.empresa || '').toLowerCase().includes(q)
    const matchEstado = estado === 'todos' || r.estado === estado
    const matchVendedor = vendedorFiltro === 'Todos' || r.vendedor === vendedorFiltro
    return matchSearch && matchEstado && matchVendedor
  })

  const activos = filtrados.filter(r => r.estado === 'activo')
  const pausados = filtrados.filter(r => r.estado === 'pausado')
  const completados = filtrados.filter(r => r.estado === 'completado')
  const montoActivo = activos.reduce((acc, r) => acc + r.monto, 0)

  return (
    <div className="flex flex-col h-full bg-[#070d1a]">
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-white/5 bg-[#0a1020] shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">Bitácora de Proyectos</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {loading ? 'Cargando...' : `${filtrados.length} proyecto(s)`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadData()}
              className="flex items-center gap-1.5 border border-white/10 text-slate-300 hover:text-white hover:border-white/20 px-3 py-2 rounded-lg text-xs font-medium transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Actualizar
            </button>
            <button
              onClick={() => {
                const exportRows = filtrados.map(r => ({
                  'Correlativo': r.correlativo,
                  'Cliente': r.cliente,
                  'Empresa': r.empresa || '',
                  'Proyecto': r.nombre,
                  'Tipo': r.tipo === 'perforacion' ? 'Perforación' : 'Limpieza',
                  'Estado': r.estado,
                  'Monto (Q)': Math.round(r.monto),
                  'Vendedor': r.vendedor,
                  'Fecha Inicio': r.fechaInicio,
                  'Entradas Bitácora': r.entradas.length,
                }))
                const wb = XLSX.utils.book_new()
                const ws = XLSX.utils.json_to_sheet(exportRows)
                ws['!cols'] = [14,20,18,24,12,12,16,18,14,18].map(w => ({ wch: w }))
                XLSX.utils.book_append_sheet(wb, ws, 'Proyectos')
                XLSX.writeFile(wb, `Proyectos_${new Date().toISOString().split('T')[0]}.xlsx`)
              }}
              title="Exportar a Excel"
              className="flex items-center gap-1.5 border border-white/10 text-slate-300 hover:text-white hover:border-white/20 px-3 py-2 rounded-lg text-xs font-medium transition-all"
            >
              <Download className="w-3.5 h-3.5" /><span className="hidden sm:inline">Excel</span>
            </button>
            <Link
              href="/cotizaciones"
              className="flex items-center gap-1.5 bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600/30 px-3 py-2 rounded-lg text-xs font-medium transition-all"
            >
              Ir a cotizaciones
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <KPIChip
            icon={<Briefcase className="w-4 h-4 text-blue-400" />}
            label="Activos"
            value={String(activos.length)}
            sub={formatQ(montoActivo)}
            color="blue"
          />
          <KPIChip
            icon={<PauseCircle className="w-4 h-4 text-amber-400" />}
            label="Pausados"
            value={String(pausados.length)}
            sub="requieren seguimiento"
            color="amber"
          />
          <KPIChip
            icon={<CheckCircle className="w-4 h-4 text-emerald-400" />}
            label="Completados"
            value={String(completados.length)}
            sub="cerrados"
            color="emerald"
          />
          <KPIChip
            icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
            label="Sin bitacora hoy"
            value={String(sinActualizar.length)}
            sub="pendientes de actualizar"
            color={sinActualizar.length > 0 ? 'red' : 'slate'}
          />
        </div>

        {sinActualizar.length > 0 && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
            Hay {sinActualizar.length} proyecto(s) activos sin entrada de bitacora hoy.
          </div>
        )}

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="relative w-full sm:w-auto">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar cliente o proyecto..."
              className="bg-white/5 border border-white/8 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/40 outline-none w-full sm:w-64 transition-all"
            />
          </div>

          {(['todos', 'activo', 'pausado', 'completado'] as const).map(s => (
            <button
              key={s}
              onClick={() => setEstado(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                estado === s
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              )}
            >
              {s === 'todos'
                ? 'Todos'
                : s === 'activo'
                  ? 'Activos'
                  : s === 'pausado'
                    ? 'Pausados'
                    : 'Completados'}
            </button>
          ))}

          {isSuperAdmin && vendedores.map(v => (
            <button
              key={v}
              onClick={() => {
                startTransition(() => setVendedorFiltro(v))
              }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                vendedorFiltro === v
                  ? 'bg-violet-600 text-white border-violet-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border-white/10'
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center gap-3 text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm">Cargando proyectos...</span>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
          <Clock3 className="w-12 h-12 mb-4 opacity-30" />
          <p className="font-medium text-slate-500">No hay proyectos para los filtros actuales.</p>
        </div>
      ) : (
        <>
          <div className="hidden md:block flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/5 bg-[#0a1020] sticky top-0 z-20">
                <tr className="text-xs text-slate-500">
                  <th className="text-left px-5 py-3 font-medium">Correlativo</th>
                  <th className="text-left px-5 py-3 font-medium">Cliente</th>
                  <th className="text-left px-5 py-3 font-medium">Proyecto</th>
                  <th className="text-left px-5 py-3 font-medium">Tipo</th>
                  <th className="text-right px-5 py-3 font-medium">Monto</th>
                  <th className="text-left px-5 py-3 font-medium">Estado</th>
                  <th className="text-left px-5 py-3 font-medium">Ultima bitacora</th>
                  <th className="text-left px-5 py-3 font-medium">Vendedor</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4">
                {filtrados.map(r => (
                  <tr key={r.id} className="hover:bg-white/2 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs text-blue-400">{r.correlativo}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-200">{r.cliente}</p>
                      {r.empresa && <p className="text-xs text-slate-500">{r.empresa}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-300">{r.nombre}</td>
                    <td className="px-5 py-3.5 text-slate-400 text-xs">{tipoLabel(r.tipo)}</td>
                    <td className="px-5 py-3.5 text-right text-white font-semibold">{formatQ(r.monto)}</td>
                    <td className="px-5 py-3.5">
                      <span className={cn('px-2 py-0.5 rounded-md text-xs font-medium', estadoBadge(r.estado))}>
                        {r.estado}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">
                      {r.entradas[0]?.fecha ?? 'Sin registro'}
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-xs">{r.vendedor}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-3">
                        <Link
                          href={`/proyectos/${r.id}`}
                          className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                        >
                          Abrir <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                        {isSuperAdmin && (
                          <button
                            onClick={() => handleDelete(r)}
                            title="Eliminar proyecto y todas sus entradas"
                            className="text-slate-600 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden flex-1 overflow-auto divide-y divide-white/5">
            {filtrados.map(r => (
              <div key={r.id} className="flex items-stretch hover:bg-white/2 transition-colors">
                <Link href={`/proyectos/${r.id}`} className="flex-1 min-w-0 px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-200 truncate">{r.cliente}</p>
                      <p className="text-xs text-slate-500 truncate">{r.nombre}</p>
                    </div>
                    <p className="font-bold text-white text-sm shrink-0">{formatQ(r.monto)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[10px] text-blue-400">{r.correlativo}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400">{tipoLabel(r.tipo)}</span>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded', estadoBadge(r.estado))}>{r.estado}</span>
                  </div>
                </Link>
                {isSuperAdmin && (
                  <button
                    onClick={() => handleDelete(r)}
                    aria-label="Eliminar proyecto"
                    className="px-4 flex items-center justify-center text-slate-600 hover:text-red-400 active:scale-90 border-l border-white/5 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function KPIChip({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  color: 'blue' | 'amber' | 'emerald' | 'red' | 'slate'
}) {
  const cls = {
    blue: 'border-blue-500/15 bg-blue-500/5',
    amber: 'border-amber-500/15 bg-amber-500/5',
    emerald: 'border-emerald-500/15 bg-emerald-500/5',
    red: 'border-red-500/20 bg-red-500/8',
    slate: 'border-white/5 bg-white/3',
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
