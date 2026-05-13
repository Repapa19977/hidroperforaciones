'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { updateEstadoCotizacion, type CotizacionRecord } from '@/lib/quotation-store'
import {
  Plus, Search, FileText, Send, CheckCircle, XCircle, FileEdit,
  ArrowUpRight, Trash2, ChevronDown, Loader2, LayoutList, Kanban,
  TrendingUp, Award, Drill, Wrench, ExternalLink, Download,
  Pencil, Clock, X, User, Copy
} from 'lucide-react'
import Link from 'next/link'
import { cn, formatQ } from '@/lib/utils'
import { KPICard } from '@/components/kpi-card'
import { type Rol } from '@/lib/config-store'
import { exportJsonXlsx } from '@/lib/export-xlsx'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { type VendedorOption } from '@/lib/vendedores'

// ── Formatters específicos (formatQ estándar viene de lib/utils) ──────────────
const fmtQk    = (n: number) =>
  n >= 1_000_000 ? `Q${(n/1_000_000).toFixed(1)}M` :
  n >= 1_000     ? `Q${(n/1_000).toFixed(0)}k`     :
  `Q${n.toLocaleString()}`

function getCookie(name: string) {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return m ? decodeURIComponent(m[1]) : ''
}

const tipoLabel = (t: string) => t === 'perforacion' ? 'Perforación' : 'Limpieza Mecánica'

// ── Status map ─────────────────────────────────────────────────────────────────
const statusMap: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  borrador:   { label: 'Borrador',   icon: <FileEdit  className="w-3 h-3" />, cls: 'bg-slate-500/20 text-slate-400' },
  enviada:    { label: 'Enviada',    icon: <Send      className="w-3 h-3" />, cls: 'bg-blue-500/20 text-blue-400' },
  confirmada: { label: 'Confirmada', icon: <CheckCircle className="w-3 h-3" />, cls: 'bg-emerald-500/20 text-emerald-400' },
  cancelada:  { label: 'Cancelada',  icon: <XCircle   className="w-3 h-3" />, cls: 'bg-red-500/20 text-red-400' },
}

// ── Kanban columns ─────────────────────────────────────────────────────────────
const COLS = [
  { id: 'borrador'   as const, label: 'Por Enviar', icon: <FileEdit   className="w-3.5 h-3.5" />, accent: 'bg-slate-500',  colBg: 'bg-slate-500/5',  headerText: 'text-slate-300',  countBg: 'bg-slate-500/20 text-slate-400',  border: 'border-slate-500/15'  },
  { id: 'enviada'    as const, label: 'Enviada',    icon: <Send       className="w-3.5 h-3.5" />, accent: 'bg-blue-500',   colBg: 'bg-blue-500/5',   headerText: 'text-blue-300',   countBg: 'bg-blue-500/20 text-blue-400',   border: 'border-blue-500/15'   },
  { id: 'confirmada' as const, label: 'Confirmada', icon: <CheckCircle className="w-3.5 h-3.5" />, accent: 'bg-emerald-500', colBg: 'bg-emerald-500/5', headerText: 'text-emerald-300', countBg: 'bg-emerald-500/20 text-emerald-400', border: 'border-emerald-500/15' },
  { id: 'cancelada'  as const, label: 'Cancelada',  icon: <XCircle    className="w-3.5 h-3.5" />, accent: 'bg-red-500',    colBg: 'bg-red-500/5',    headerText: 'text-red-300',    countBg: 'bg-red-500/20 text-red-400',    border: 'border-red-500/15'    },
]

const AVATAR_COLORS: Record<string, string> = {
  RD: 'from-blue-500 to-blue-700',
  GG: 'from-violet-500 to-purple-700',
  MR: 'from-amber-500 to-orange-600',
  CS: 'from-cyan-500 to-teal-600',
}

type View = 'lista' | 'kanban'

// ── Main page ──────────────────────────────────────────────────────────────────
export default function CotizacionesPage() {
  const [view, setView]             = useState<View>('lista')
  const [rows, setRows]             = useState<CotizacionRecord[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterStatus, setFStatus]  = useState('todos')
  const [filterVendedor, setFVend]  = useState('Todos')
  const [menuOpen, setMenuOpen]       = useState<string | null>(null)
  const [role, setRole]               = useState<Rol>('admin')
  const [myVendedor, setMyVendedor]   = useState('')
  const [historialOpen, setHisOpen]   = useState<string | null>(null)
  const [historialRows, setHisRows]   = useState<{ id: string; campo: string; valorAntes: string; valorDespues: string; usuario: string; createdAt: string }[]>([])
  const [historialLoading, setHisLd]  = useState(false)
  const [proyectoNoti, setProjNoti]   = useState<{ correlativo: string; id: string } | null>(null)
  // Modal de confirmación para eliminar
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Modal de reasignación (solo superadmin)
  const [reasignarTarget, setReasignarTarget] = useState<CotizacionRecord | null>(null)
  const [vendedoresDB, setVendedoresDB] = useState<VendedorOption[]>([])

  // Persist view
  useEffect(() => {
    const saved = localStorage.getItem('hidrocrm_view') as View | null
    if (saved === 'kanban' || saved === 'lista') setView(saved)
  }, [])

  const fetchRows = useCallback(async (v: string, r: Rol) => {
    setLoading(true)
    const url = r === 'superadmin' ? '/api/cotizaciones' : `/api/cotizaciones?vendedor=${encodeURIComponent(v)}`
    const res = await fetch(url)
    setRows(res.ok ? await res.json() : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const r = getCookie('user_role') as Rol || 'admin'
    const v = getCookie('user_vendedor') || ''
    setRole(r)
    setMyVendedor(v)
    fetchRows(v, r)
    // Vendedores activos desde BD (para el modal de reasignar — solo superadmin)
    if (r === 'superadmin') {
      fetch('/api/vendedores')
        .then(res => res.ok ? res.json() : [])
        .then((rows: VendedorOption[]) => setVendedoresDB(rows.filter(x => x.nombre)))
        .catch(() => {})
    }
  }, [fetchRows])

  async function handleReasignar(correlativo: string, nuevoVendedor: string) {
    const res = await fetch(`/api/cotizaciones/${encodeURIComponent(correlativo)}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ vendedor: nuevoVendedor, usuario: myVendedor }),
    })
    if (res.ok) {
      setRows(prev => prev.map(r => r.correlativo === correlativo ? { ...r, vendedor: nuevoVendedor } : r))
      setReasignarTarget(null)
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error ?? 'No se pudo reasignar')
    }
  }

  const isSuperAdmin = role === 'superadmin'

  const vendedores = useMemo(() => {
    const all = [...new Set(rows.map(c => c.vendedor))]
    return ['Todos', ...all]
  }, [rows])

  const filtered = useMemo(() => rows.filter(c => {
    const q = search.toLowerCase()
    const matchSearch =
      c.cliente.toLowerCase().includes(q) ||
      c.correlativo.toLowerCase().includes(q) ||
      (c.empresa || '').toLowerCase().includes(q)
    const matchStatus  = filterStatus === 'todos' || c.estado === filterStatus
    const matchVendedor = !isSuperAdmin || filterVendedor === 'Todos' || c.vendedor === filterVendedor
    return matchSearch && matchStatus && matchVendedor
  }), [rows, search, filterStatus, filterVendedor, isSuperAdmin])

  // KPIs
  const activas     = filtered.filter(c => c.estado !== 'cancelada')
  const enviadas    = filtered.filter(c => c.estado === 'enviada')
  const confirmadas = filtered.filter(c => c.estado === 'confirmada')
  const canceladas  = filtered.filter(c => c.estado === 'cancelada')
  const totalActivo = activas.reduce((a, b) => a + b.monto, 0)
  const totalConf   = confirmadas.reduce((a, b) => a + b.monto, 0)

  function toggleView(v: View) {
    setView(v)
    localStorage.setItem('hidrocrm_view', v)
  }

  async function changeEstado(correlativo: string, estado: CotizacionRecord['estado']) {
    const result = await updateEstadoCotizacion(correlativo, estado, myVendedor || 'sistema')
    if (estado === 'confirmada' && result?.proyectoCreado) {
      setProjNoti(result.proyectoCreado)
    }
    await fetchRows(myVendedor, role)
    setMenuOpen(null)
  }

  async function openHistorial(correlativo: string) {
    setHisOpen(correlativo)
    setHisLd(true)
    const res = await fetch(`/api/cotizaciones/historial?correlativo=${encodeURIComponent(correlativo)}`)
    setHisRows(res.ok ? await res.json() : [])
    setHisLd(false)
  }

  function handleDelete(correlativo: string) {
    setDeleteTarget(correlativo)
    setDeleteReason('')
  }

  async function ejecutarDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const url = `/api/cotizaciones/${encodeURIComponent(deleteTarget)}${deleteReason ? `?motivo=${encodeURIComponent(deleteReason)}` : ''}`
      const res = await fetch(url, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'No se pudo eliminar')
        return
      }
      await fetchRows(myVendedor, role)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  async function exportExcel() {
    const exportRows = filtered.map(c => ({
      'Correlativo': c.correlativo,
      'Cliente': c.cliente,
      'Empresa': c.empresa || '',
      'Tipo': c.tipo === 'perforacion' ? 'Perforación' : 'Limpieza',
      'Estado': c.estado,
      'Monto (Q)': Math.round(c.monto),
      'Vendedor': c.vendedor,
      'Fecha': c.fecha,
    }))
    await exportJsonXlsx(
      `Cotizaciones_${new Date().toISOString().split('T')[0]}.xlsx`,
      'Cotizaciones',
      exportRows,
      [16, 20, 18, 14, 12, 16, 18, 12],
    )
  }

  async function openCotizacion(correlativo: string) {
    const res = await fetch(`/api/cotizaciones/${encodeURIComponent(correlativo)}`)
    if (!res.ok) {
      alert('No se pudo cargar la cotización. Intente de nuevo.')
      return
    }
    const row = await res.json()
    if (!row.datos || row.datos === '{}') {
      alert('Esta cotización no tiene datos suficientes para generar el PDF.')
      return
    }
    try {
      const datos = typeof row.datos === 'string' ? JSON.parse(row.datos) : row.datos
      const esLegacy =
        String(row.correlativo ?? '').startsWith('HP-COT-') ||
        Boolean(datos?.ip?.numeroDeTubos || datos?.ip?.numeroDeFilteros) ||
        Boolean(datos?.tipo === 'perforacion' && datos?.ip && typeof datos.ip.tubosLisos !== 'number')

      localStorage.setItem('hidrocrm_quotation_draft', JSON.stringify({
        ...datos,
        ...(esLegacy && typeof row.monto === 'number' ? { montoGuardado: row.monto } : {}),
      }))
      window.open(`/imprimir?returnTo=${encodeURIComponent('/cotizaciones')}`, '_blank')
    } catch {
      alert('Error al procesar la cotización.')
    }
  }

  return (
    <div className="flex flex-col md:h-full bg-[#070d1a]">

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-white/5 bg-[#0a1020] shrink-0">
        {/* Title row */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">Cotizaciones</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {loading
                ? 'Cargando...'
                : `${filtered.length} cotización${filtered.length !== 1 ? 'es' : ''} · ${fmtQk(totalActivo)} activo`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex bg-white/5 border border-white/8 rounded-xl p-1 gap-0.5">
              <button
                onClick={() => toggleView('lista')}
                title="Vista lista"
                className={cn(
                  'flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  view === 'lista' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'
                )}
              >
                <LayoutList className="w-3.5 h-3.5" /><span className="hidden sm:inline ml-1">Lista</span>
              </button>
              <button
                onClick={() => toggleView('kanban')}
                title="Vista tablero"
                className={cn(
                  'flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  view === 'kanban' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'
                )}
              >
                <Kanban className="w-3.5 h-3.5" /><span className="hidden sm:inline ml-1">Tablero</span>
              </button>
            </div>
            <button
              onClick={exportExcel}
              title="Exportar a Excel"
              className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 px-3 py-2 rounded-xl text-sm transition-all"
            >
              <Download className="w-4 h-4" /><span className="hidden sm:inline">Excel</span>
            </button>
            <Link
              href="/cotizaciones/nueva"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-500/20"
            >
              <Plus className="w-4 h-4" /> Nueva
            </Link>
          </div>
        </div>

        {/* KPI chips */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <KPICard icon={<TrendingUp className="w-4 h-4 text-blue-400" />}
            label="Proyectos activos" value={fmtQk(totalActivo)}
            sub={`${activas.length} cotizaciones`} color="blue" />
          <KPICard icon={<Send className="w-4 h-4 text-amber-400" />}
            label="Enviadas" value={String(enviadas.length)}
            sub={enviadas.length > 0 ? fmtQk(enviadas.reduce((a,b)=>a+b.monto,0)) : 'sin respuesta'}
            color="amber" />
          <KPICard icon={<Award className="w-4 h-4 text-emerald-400" />}
            label="Confirmadas" value={fmtQk(totalConf)}
            sub={`${confirmadas.length} proyectos`} color="emerald" />
          <KPICard icon={<XCircle className="w-4 h-4 text-red-400" />}
            label="Canceladas" value={String(canceladas.length)}
            sub="en el período" color={canceladas.length > 0 ? 'red' : 'slate'} />
        </div>

        {/* Search + filters */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="relative w-full sm:w-auto">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar cliente, empresa..."
              className="bg-white/5 border border-white/8 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500/40 outline-none w-full sm:w-52 transition-all"
            />
          </div>

          {/* Status pills — list view */}
          {view === 'lista' && (['todos', 'borrador', 'enviada', 'confirmada', 'cancelada'] as const).map(s => (
            <button key={s} onClick={() => setFStatus(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                filterStatus === s
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              )}
            >
              {s === 'todos' ? 'Todas' : statusMap[s]?.label}
            </button>
          ))}

          {/* Vendedor filter — kanban + superadmin */}
          {view === 'kanban' && isSuperAdmin && vendedores.map(v => {
            const ini = v === 'Todos' ? null : v.split(' ').map(n => n[0]).join('')
            return (
              <button key={v} onClick={() => setFVend(v)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all',
                  filterVendedor === v
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-white/5'
                )}
              >
                {ini && (
                  <div className={cn(
                    'w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center',
                    filterVendedor === v ? 'bg-white/20' : `bg-gradient-to-br ${AVATAR_COLORS[ini] ?? 'from-slate-500 to-slate-700'}`
                  )}>{ini}</div>
                )}
                {v}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── CONTENT ─────────────────────────────────────────────────── */}
      {/* Notificación de proyecto creado */}
      {proyectoNoti && (
        <div className="mx-4 mt-3 flex items-center justify-between gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-sm text-emerald-300 font-medium">
              Cotización confirmada · Proyecto {proyectoNoti.correlativo} creado automáticamente
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/proyectos/${proyectoNoti.id}`}
              className="text-xs text-emerald-400 hover:text-emerald-300 underline">
              Ver proyecto →
            </Link>
            <button onClick={() => setProjNoti(null)} className="text-emerald-600 hover:text-emerald-400">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center gap-3 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Cargando cotizaciones...</span>
        </div>
      ) : view === 'lista' ? (
        <ListView
          filtered={filtered} search={search} isSuperAdmin={isSuperAdmin}
          menuOpen={menuOpen} setMenuOpen={setMenuOpen}
          changeEstado={changeEstado} handleDelete={handleDelete}
          openCotizacion={openCotizacion} openHistorial={openHistorial}
          onReasignar={setReasignarTarget}
        />
      ) : (
        <KanbanView
          filtered={filtered} totalActivo={totalActivo} isSuperAdmin={isSuperAdmin}
          menuOpen={menuOpen} setMenuOpen={setMenuOpen}
          changeEstado={changeEstado} openCotizacion={openCotizacion}
        />
      )}

      {menuOpen && <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />}

      {/* Modal Historial */}
      {historialOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setHisOpen(null)} />
          <div className="relative bg-[#0d1526] border border-white/10 rounded-2xl w-full max-w-lg p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white">Historial de cambios</h2>
                <p className="text-xs text-slate-500 font-mono">{historialOpen}</p>
              </div>
              <button onClick={() => setHisOpen(null)} className="text-slate-500 hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            {historialLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
            ) : historialRows.length === 0 ? (
              <p className="text-center text-slate-600 text-sm py-8">Sin cambios registrados aún</p>
            ) : (
              <div className="overflow-auto max-h-80">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/8 text-left">
                      <th className="py-2 pr-3 text-slate-500 font-medium">Fecha</th>
                      <th className="py-2 pr-3 text-slate-500 font-medium">Campo</th>
                      <th className="py-2 pr-3 text-slate-500 font-medium">Antes</th>
                      <th className="py-2 pr-3 text-slate-500 font-medium">Después</th>
                      <th className="py-2 text-slate-500 font-medium">Usuario</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/4">
                    {historialRows.map(h => (
                      <tr key={h.id}>
                        <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">
                          {new Date(h.createdAt).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="py-2 pr-3">
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400">{h.campo}</span>
                        </td>
                        <td className="py-2 pr-3 text-slate-500">{h.valorAntes || '—'}</td>
                        <td className="py-2 pr-3 text-slate-200 font-medium">{h.valorDespues || '—'}</td>
                        <td className="py-2 text-slate-500">{h.usuario || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal confirmación eliminar */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onCancel={() => { setDeleteTarget(null); setDeleteReason('') }}
        onConfirm={ejecutarDelete}
        title={`¿Eliminar cotización ${deleteTarget ?? ''}?`}
        description="La cotización pasa a la papelera. Puedes restaurarla cuando quieras. El correlativo NO se reutiliza."
        confirmLabel="Sí, eliminar"
        variant="destructive"
        loading={deleting}
        askReason
        reason={deleteReason}
        onReasonChange={setDeleteReason}
      />

      {/* Modal reasignar vendedor (solo superadmin) */}
      {reasignarTarget && isSuperAdmin && (
        <ReasignarModal
          cotizacion={reasignarTarget}
          vendedoresActivos={vendedoresDB}
          onCancel={() => setReasignarTarget(null)}
          onConfirm={nuevo => handleReasignar(reasignarTarget.correlativo, nuevo)}
        />
      )}
    </div>
  )
}

// ── Modal: reasignar vendedor de una cotización ──────────────────────────────
function ReasignarModal({ cotizacion, vendedoresActivos, onCancel, onConfirm }: {
  cotizacion: CotizacionRecord
  vendedoresActivos: VendedorOption[]
  onCancel: () => void
  onConfirm: (nuevo: string) => void
}) {
  const [nuevo, setNuevo] = useState(cotizacion.vendedor)
  const vendedorActualEnLista = vendedoresActivos.some(v => v.nombre === cotizacion.vendedor)
  const asesorSeleccionado = vendedoresActivos.find(v => v.nombre === nuevo)
  const sinCambio = nuevo === cotizacion.vendedor
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0d1526] border border-cyan-500/30 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
          <User className="w-4 h-4 text-cyan-400" />
          <p className="text-sm font-bold text-white">Reasignar {cotizacion.correlativo}</p>
        </div>
        <div className="px-5 py-5 space-y-3">
          <p className="text-xs text-slate-500">
            Cliente: <b className="text-slate-300">{cotizacion.cliente}</b>
            {cotizacion.empresa && <span className="text-slate-500"> · {cotizacion.empresa}</span>}
          </p>
          <p className="text-xs text-slate-500">
            Vendedor actual: <b className="text-amber-400">{cotizacion.vendedor}</b>
          </p>
          <div>
            <label className="text-xs text-slate-500 mb-1.5 block">Nuevo vendedor</label>
            <select value={nuevo} onChange={e => setNuevo(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-500/50">
              {vendedoresActivos.map(v => (
                <option key={v.nombre} value={v.nombre} className="bg-[#0d1526]">
                  {v.nombre}{v.rol ? ` - ${v.rol}` : ''}
                </option>
              ))}
              {/* Si el vendedor actual no está en la lista activa, lo agregamos para no perderlo */}
              {!vendedorActualEnLista && (
                <option value={cotizacion.vendedor} className="bg-[#0d1526] text-slate-500">
                  {cotizacion.vendedor} (legacy)
                </option>
              )}
            </select>
            {asesorSeleccionado?.email && (
              <p className="mt-1 text-[10px] text-slate-500 truncate">{asesorSeleccionado.email}</p>
            )}
          </div>
          <p className="text-[10px] text-slate-600 leading-relaxed">
            El proyecto asociado (si existe) también cambia de dueño.
            Queda registrado en el historial de la cotización.
          </p>
        </div>
        <div className="px-5 py-3 border-t border-white/10 flex gap-2 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 border border-white/10 text-slate-300 hover:text-white rounded-lg text-sm transition-all">
            Cancelar
          </button>
          <button onClick={() => onConfirm(nuevo)} disabled={sinCambio}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-all">
            Reasignar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Lista view ─────────────────────────────────────────────────────────────────
function ListView({ filtered, search, isSuperAdmin, menuOpen, setMenuOpen, changeEstado, handleDelete, openCotizacion, openHistorial, onReasignar }: {
  filtered: CotizacionRecord[]
  search: string
  isSuperAdmin: boolean
  menuOpen: string | null
  setMenuOpen: (v: string | null) => void
  changeEstado: (c: string, e: CotizacionRecord['estado']) => void
  handleDelete: (c: string) => void
  openCotizacion: (c: string) => void
  openHistorial: (c: string) => void
  onReasignar: (c: CotizacionRecord) => void
}) {
  if (filtered.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-600">
        <FileText className="w-12 h-12 mb-4 opacity-30" />
        <p className="font-medium text-slate-500">
          {search ? `Sin resultados para "${search}"` : 'No hay cotizaciones todavía'}
        </p>
        {!search && (
          <Link href="/cotizaciones/nueva" className="mt-2 text-blue-400 hover:text-blue-300 text-xs underline">
            Crear primera cotización
          </Link>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Desktop table — md+ */}
      <div className="hidden md:block flex-1 md:overflow-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-white/5 bg-[#0a1020] sticky top-0 z-20">
            <tr className="text-xs text-slate-500">
              <th className="text-left px-5 py-3 font-medium">Correlativo</th>
              <th className="text-left px-5 py-3 font-medium">Cliente</th>
              <th className="text-left px-5 py-3 font-medium">Proyecto</th>
              <th className="text-left px-5 py-3 font-medium">Tipo</th>
              <th className="text-right px-5 py-3 font-medium">Monto</th>
              <th className="text-left px-5 py-3 font-medium">Estado</th>
              <th className="text-left px-5 py-3 font-medium">Fecha</th>
              <th className="text-left px-5 py-3 font-medium">Vendedor</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/4">
            {filtered.map(c => (
              <ListRow key={c.correlativo} c={c}
                menuOpen={menuOpen} setMenuOpen={setMenuOpen}
                changeEstado={changeEstado} handleDelete={handleDelete}
                openCotizacion={openCotizacion} openHistorial={openHistorial}
                isSuperAdmin={isSuperAdmin}
                onReasignar={() => onReasignar(c)} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards — < md */}
      <div className="md:hidden flex-1 divide-y divide-white/5">
        {filtered.map(c => (
          <MobileRow key={c.correlativo} c={c}
            menuOpen={menuOpen} setMenuOpen={setMenuOpen}
            changeEstado={changeEstado} handleDelete={handleDelete}
            openCotizacion={openCotizacion} openHistorial={openHistorial} />
        ))}
      </div>
    </>
  )
}

// ── List row ───────────────────────────────────────────────────────────────────
function ListRow({ c, menuOpen, setMenuOpen, changeEstado, handleDelete, openCotizacion, openHistorial, isSuperAdmin, onReasignar }: {
  c: CotizacionRecord
  menuOpen: string | null
  setMenuOpen: (v: string | null) => void
  changeEstado: (correlativo: string, estado: CotizacionRecord['estado']) => void
  handleDelete: (c: string) => void
  openCotizacion: (c: string) => void
  openHistorial: (c: string) => void
  isSuperAdmin: boolean
  onReasignar: () => void
}) {
  const s = statusMap[c.estado]
  const btnRef = useRef<HTMLButtonElement>(null)
  const [dropPos, setDropPos] = useState<{ top: number; left: number } | null>(null)
  const isOpen = menuOpen === c.correlativo

  useEffect(() => {
    if (isOpen && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const dropH = 172
      const top = window.innerHeight - r.bottom < dropH
        ? r.top - dropH - 4
        : r.bottom + 4
      setDropPos({ top, left: r.left })
    } else {
      setDropPos(null)
    }
  }, [isOpen])

  return (
    <tr className="hover:bg-white/2 transition-colors group">
      <td className="px-5 py-3.5">
        <span className="font-mono text-xs text-blue-400">{c.correlativo}</span>
      </td>
      <td className="px-5 py-3.5">
        <p className="font-medium text-slate-200">{c.cliente}</p>
        {c.empresa && <p className="text-xs text-slate-500">{c.empresa}</p>}
      </td>
      <td className="px-5 py-3.5 text-slate-400 max-w-[200px] truncate">{c.proyecto}</td>
      <td className="px-5 py-3.5">
        <span className={cn('text-xs px-2 py-0.5 rounded-md',
          c.tipo === 'perforacion' ? 'bg-blue-500/15 text-blue-400' : 'bg-cyan-500/15 text-cyan-400'
        )}>
          {tipoLabel(c.tipo)}
        </span>
      </td>
      <td className="px-5 py-3.5 text-right font-bold text-white">{formatQ(c.monto)}</td>
      <td className="px-5 py-3.5">
        <button
          ref={btnRef}
          onClick={() => setMenuOpen(isOpen ? null : c.correlativo)}
          className={cn('flex items-center gap-1.5 w-fit text-xs px-2.5 py-1 rounded-full font-medium cursor-pointer hover:opacity-80', s?.cls)}
        >
          {s?.icon} {s?.label}
          <ChevronDown className="w-2.5 h-2.5 ml-0.5" />
        </button>
        {isOpen && dropPos && typeof document !== 'undefined' && createPortal(
          <div
            style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, zIndex: 9999 }}
            className="hidden md:block bg-[#1a2540] border border-white/10 rounded-lg shadow-2xl min-w-[160px] overflow-hidden"
          >
            {(['borrador', 'enviada', 'confirmada', 'cancelada'] as const).map(e => (
              <button key={e} onClick={() => changeEstado(c.correlativo, e)}
                className={cn(
                  'flex items-center gap-2 w-full text-left px-3 py-2.5 text-xs transition-colors',
                  c.estado === e ? 'bg-white/8 text-white font-medium' : 'hover:bg-white/5 text-slate-300'
                )}
              >
                {statusMap[e].icon}
                <span>{statusMap[e].label}</span>
                {c.estado === e && <span className="ml-auto text-[10px] text-slate-500">actual</span>}
              </button>
            ))}
          </div>,
          document.body
        )}
      </td>
      <td className="px-5 py-3.5 text-slate-500 text-xs">{c.fecha}</td>
      <td className="px-5 py-3.5 text-slate-400 text-xs">{c.vendedor}</td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          {c.estado === 'borrador' ? (
            <Link href={`/cotizaciones/nueva?edit=${c.correlativo}`} title="Editar"
              className="text-slate-500 hover:text-amber-400 transition-colors">
              <Pencil className="w-4 h-4" />
            </Link>
          ) : (
            <Link href={`/cotizaciones/nueva?duplicate=${c.correlativo}`}
              title={`Duplicar (${c.estado}: se crea una nueva con otro correlativo)`}
              className="text-slate-500 hover:text-emerald-400 transition-colors">
              <Copy className="w-4 h-4" />
            </Link>
          )}
          <button onClick={() => openCotizacion(c.correlativo)} title="Ver PDF"
            className="text-slate-500 hover:text-blue-400 transition-colors">
            <ArrowUpRight className="w-4 h-4" />
          </button>
          {isSuperAdmin && (
            <button onClick={onReasignar} title="Reasignar vendedor"
              className="text-slate-500 hover:text-cyan-400 transition-colors">
              <User className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => openHistorial(c.correlativo)} title="Historial"
            className="text-slate-500 hover:text-violet-400 transition-colors">
            <Clock className="w-4 h-4" />
          </button>
          <button onClick={() => handleDelete(c.correlativo)} title="Eliminar"
            className="text-slate-600 hover:text-red-400 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Mobile row (card) ─────────────────────────────────────────────────────────
function MobileRow({ c, menuOpen, setMenuOpen, changeEstado, handleDelete, openCotizacion, openHistorial }: {
  c: CotizacionRecord
  menuOpen: string | null
  setMenuOpen: (v: string | null) => void
  changeEstado: (correlativo: string, estado: CotizacionRecord['estado']) => void
  handleDelete: (c: string) => void
  openCotizacion: (c: string) => void
  openHistorial: (c: string) => void
}) {
  const s = statusMap[c.estado]
  const btnRef = useRef<HTMLButtonElement>(null)
  const [dropPos, setDropPos] = useState<{ top: number; left: number } | null>(null)
  const isOpen = menuOpen === c.correlativo

  useEffect(() => {
    if (isOpen && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const dropH = 172
      const top = window.innerHeight - r.bottom < dropH
        ? r.top - dropH - 4
        : r.bottom + 4
      setDropPos({ top, left: r.left })
    } else {
      setDropPos(null)
    }
  }, [isOpen])

  return (
    <div className="px-4 py-3.5 hover:bg-white/2 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-200 truncate">{c.cliente}</p>
          {c.empresa && <p className="text-xs text-slate-500 truncate">{c.empresa}</p>}
        </div>
        <p className="font-bold text-white text-sm shrink-0">{formatQ(c.monto)}</p>
      </div>
      <p className="text-xs text-slate-500 truncate mb-2.5">{c.proyecto}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] text-blue-400">{c.correlativo}</span>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded',
            c.tipo === 'perforacion' ? 'bg-blue-500/15 text-blue-400' : 'bg-cyan-500/15 text-cyan-400'
          )}>{c.tipo === 'perforacion' ? 'Perf.' : 'Limp.'}</span>
          <button
            ref={btnRef}
            onClick={() => setMenuOpen(isOpen ? null : c.correlativo)}
            className={cn('flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium cursor-pointer hover:opacity-80', s?.cls)}
          >
            {s?.icon} {s?.label}
            <ChevronDown className="w-2 h-2 ml-0.5" />
          </button>
          {isOpen && dropPos && typeof document !== 'undefined' && createPortal(
            <div
              style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, zIndex: 9999 }}
              className="md:hidden bg-[#1a2540] border border-white/10 rounded-lg shadow-2xl min-w-[160px] overflow-hidden"
            >
              {(['borrador', 'enviada', 'confirmada', 'cancelada'] as const).map(e => (
                <button key={e} onClick={() => changeEstado(c.correlativo, e)}
                  className={cn(
                    'flex items-center gap-2 w-full text-left px-3 py-2.5 text-xs transition-colors',
                    c.estado === e ? 'bg-white/8 text-white font-medium' : 'hover:bg-white/5 text-slate-300'
                  )}
                >
                  {statusMap[e].icon}
                  <span>{statusMap[e].label}</span>
                  {c.estado === e && <span className="ml-auto text-[10px] text-slate-500">actual</span>}
                </button>
              ))}
            </div>,
            document.body
          )}
        </div>
        <div className="flex items-center gap-2.5">
          {c.estado === 'borrador' ? (
            <Link href={`/cotizaciones/nueva?edit=${c.correlativo}`} title="Editar"
              className="text-slate-500 hover:text-amber-400 transition-colors">
              <Pencil className="w-4 h-4" />
            </Link>
          ) : (
            <Link href={`/cotizaciones/nueva?duplicate=${c.correlativo}`}
              title={`Duplicar (${c.estado})`}
              className="text-slate-500 hover:text-emerald-400 transition-colors">
              <Copy className="w-4 h-4" />
            </Link>
          )}
          <button onClick={() => openCotizacion(c.correlativo)} title="Ver PDF"
            className="text-slate-500 hover:text-blue-400 transition-colors">
            <ArrowUpRight className="w-4 h-4" />
          </button>
          <button onClick={() => openHistorial(c.correlativo)} title="Historial"
            className="text-slate-500 hover:text-violet-400 transition-colors">
            <Clock className="w-4 h-4" />
          </button>
          <button onClick={() => handleDelete(c.correlativo)} title="Eliminar"
            className="text-slate-600 hover:text-red-400 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <p className="text-[10px] text-slate-600 mt-1.5">{c.fecha} · {c.vendedor}</p>
    </div>
  )
}

// ── Kanban view ────────────────────────────────────────────────────────────────
function KanbanView({ filtered, totalActivo, isSuperAdmin, menuOpen, setMenuOpen, changeEstado, openCotizacion }: {
  filtered: CotizacionRecord[]
  totalActivo: number
  isSuperAdmin: boolean
  menuOpen: string | null
  setMenuOpen: (v: string | null) => void
  changeEstado: (c: string, e: CotizacionRecord['estado']) => void
  openCotizacion: (c: string) => void
}) {
  return (
    <div className="flex-1 w-full max-w-full overflow-x-auto p-5">
      <div className="flex gap-4 md:h-full" style={{ minWidth: `${COLS.length * 296}px` }}>
        {COLS.map(col => {
          const cards    = filtered.filter(c => c.estado === col.id)
          const colMonto = cards.reduce((a, b) => a + b.monto, 0)
          const pct      = totalActivo > 0 ? (colMonto / totalActivo) * 100 : 0

          return (
            <div key={col.id} className="w-72 flex flex-col shrink-0">
              {/* Column header */}
              <div className={cn('rounded-t-xl overflow-hidden', col.colBg)}>
                <div className={cn('h-[3px] w-full', col.accent)} />
                <div className="px-3.5 pt-3 pb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn('flex items-center justify-center', col.headerText)}>{col.icon}</span>
                    <span className={cn('text-sm font-semibold', col.headerText)}>{col.label}</span>
                    <span className={cn('text-[11px] px-1.5 py-0.5 rounded-full font-bold', col.countBg)}>
                      {cards.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-white">{fmtQk(colMonto)}</span>
                    <span className="text-[10px] text-slate-600">{pct.toFixed(0)}% del activo</span>
                  </div>
                  <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all duration-700', col.accent)}
                      style={{ width: `${Math.min(pct, 100)}%`, opacity: 0.7 }} />
                  </div>
                </div>
              </div>

              {/* Cards — en desktop columnas con scroll interno, en móvil crecen con la página (scroll global) */}
              <div className={cn(
                'flex-1 rounded-b-xl border-x border-b p-2.5 space-y-2.5 min-h-[180px]',
                'md:overflow-y-auto md:max-h-[calc(100vh-360px)]',
                col.colBg, col.border
              )}>
                {cards.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-28 text-slate-700">
                    <div className="w-9 h-9 rounded-xl border border-dashed border-white/8 flex items-center justify-center mb-2">
                      <Plus className="w-4 h-4" />
                    </div>
                    <p className="text-xs">Sin cotizaciones</p>
                  </div>
                ) : (
                  cards.map(c => (
                    <KanbanCard key={c.correlativo} c={c} isSuperAdmin={isSuperAdmin}
                      menuOpen={menuOpen} setMenuOpen={setMenuOpen}
                      changeEstado={changeEstado} openCotizacion={openCotizacion} />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Kanban card ────────────────────────────────────────────────────────────────
function KanbanCard({ c, isSuperAdmin, menuOpen, setMenuOpen, changeEstado, openCotizacion }: {
  c: CotizacionRecord
  isSuperAdmin: boolean
  menuOpen: string | null
  setMenuOpen: (v: string | null) => void
  changeEstado: (correlativo: string, estado: CotizacionRecord['estado']) => void
  openCotizacion: (c: string) => void
}) {
  const ini        = c.vendedor.split(' ').map(n => n[0]).join('')
  const avatarGrad = AVATAR_COLORS[ini] ?? 'from-slate-500 to-slate-700'
  const btnRef     = useRef<HTMLButtonElement>(null)
  const [dropPos, setDropPos] = useState<{ top: number; left: number } | null>(null)
  const isOpen = menuOpen === c.correlativo

  useEffect(() => {
    if (isOpen && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const dropH = 172
      const top = window.innerHeight - r.bottom < dropH
        ? r.top - dropH - 4
        : r.bottom + 6
      setDropPos({ top, left: r.left })
    } else {
      setDropPos(null)
    }
  }, [isOpen])

  return (
    <div className="bg-[#0d1829] rounded-xl border border-white/6 hover:border-blue-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 p-3.5">
      <div className="mb-2.5">
        <p className="text-sm font-bold text-white leading-tight truncate">{c.cliente}</p>
        {c.empresa && <p className="text-[11px] text-slate-500 truncate mt-0.5">{c.empresa}</p>}
      </div>

      <p className="text-lg font-black text-white tracking-tight mb-2.5">{formatQ(c.monto)}</p>

      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <span className={cn(
          'inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg font-semibold',
          c.tipo === 'perforacion'
            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
            : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20'
        )}>
          {c.tipo === 'perforacion'
            ? <><Drill className="w-2.5 h-2.5" />Perforación</>
            : <><Wrench className="w-2.5 h-2.5" />Limpieza</>}
        </span>
        <span className="text-[10px] font-mono text-slate-600">{c.correlativo}</span>
      </div>

      <div className="flex items-center justify-between pt-2.5 border-t border-white/5">
        <div className="flex items-center gap-1.5">
          <div className={cn('w-5 h-5 rounded-full bg-gradient-to-br flex items-center justify-center text-[8px] font-bold text-white', avatarGrad)}>
            {ini}
          </div>
          <span className="text-[10px] text-slate-500 truncate">{c.vendedor}</span>
        </div>
        <span className="text-[10px] text-slate-600">{c.fecha}</span>
      </div>

      <button
        onClick={() => openCotizacion(c.correlativo)}
        className="mt-2.5 w-full flex items-center justify-center gap-1.5 text-[11px] text-slate-500 hover:text-blue-400 hover:bg-blue-500/5 py-1.5 rounded-lg border border-white/5 hover:border-blue-500/20 transition-all"
      >
        <ExternalLink className="w-3 h-3" /> Ver cotización
      </button>

      {isSuperAdmin && (
        <div className="mt-2.5 pt-2.5 border-t border-white/5">
          <button
            ref={btnRef}
            onClick={() => setMenuOpen(isOpen ? null : c.correlativo)}
            className={cn(
              'flex items-center gap-1.5 w-fit text-[10px] px-2.5 py-1 rounded-full font-medium cursor-pointer hover:opacity-80',
              statusMap[c.estado]?.cls
            )}
          >
            {statusMap[c.estado]?.label}
            <ChevronDown className="w-2.5 h-2.5" />
          </button>

          {isOpen && dropPos && typeof document !== 'undefined' && createPortal(
            <div
              style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, zIndex: 9999 }}
              className="bg-[#1a2540] border border-white/10 rounded-lg shadow-2xl min-w-[150px] overflow-hidden"
            >
              {(['borrador', 'enviada', 'confirmada', 'cancelada'] as const).map(e => (
                <button key={e} onClick={() => changeEstado(c.correlativo, e)}
                  className={cn(
                    'flex items-center gap-2 w-full text-left px-3 py-2.5 text-xs transition-colors',
                    c.estado === e ? 'bg-white/8 text-white font-medium' : 'hover:bg-white/5 text-slate-300'
                  )}
                >
                  {statusMap[e].label}
                  {c.estado === e && <span className="ml-auto text-[10px] text-slate-500">actual</span>}
                </button>
              ))}
            </div>,
            document.body
          )}
        </div>
      )}
    </div>
  )
}
