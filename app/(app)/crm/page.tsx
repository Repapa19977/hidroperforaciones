'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Plus, Search, TrendingUp, Target, ChevronRight, ChevronLeft,
  Trash2, Edit2, X, Loader2, CheckCircle, XCircle, AlertCircle,
  ExternalLink, DollarSign
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { VENDEDORES } from '@/lib/quotation-store'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Oportunidad {
  id: string
  correlativo: string
  cliente: string
  empresa: string
  monto: number
  etapa: string
  vendedor: string
  avatar: string
  fecha: string
  tipo: string
  profundidad: number | null
  proyecto: string
  diasSinActividad: number
  createdAt: string
  updatedAt: string
}

// ── Etapas config ──────────────────────────────────────────────────────────────
const ETAPAS = [
  { id: 'new',         label: 'Nuevo',       colBg: 'bg-slate-500/8',   border: 'border-slate-500/20', header: 'text-slate-300',  badge: 'bg-slate-500/20 text-slate-300',  dot: 'bg-slate-400'   },
  { id: 'qualified',   label: 'Contactado',  colBg: 'bg-blue-500/8',    border: 'border-blue-500/20',  header: 'text-blue-300',   badge: 'bg-blue-500/20 text-blue-300',    dot: 'bg-blue-400'    },
  { id: 'proposition', label: 'Propuesta',   colBg: 'bg-violet-500/8',  border: 'border-violet-500/20',header: 'text-violet-300', badge: 'bg-violet-500/20 text-violet-300',dot: 'bg-violet-400'  },
  { id: 'negotiation', label: 'Negociación', colBg: 'bg-amber-500/8',   border: 'border-amber-500/20', header: 'text-amber-300',  badge: 'bg-amber-500/20 text-amber-300',  dot: 'bg-amber-400'   },
  { id: 'won',         label: 'Ganado',      colBg: 'bg-emerald-500/8', border: 'border-emerald-500/20',header:'text-emerald-300',badge: 'bg-emerald-500/20 text-emerald-300',dot:'bg-emerald-400'},
  { id: 'lost',        label: 'Perdido',     colBg: 'bg-red-500/8',     border: 'border-red-500/20',   header: 'text-red-300',    badge: 'bg-red-500/20 text-red-300',      dot: 'bg-red-400'     },
]
const ETAPA_ORDER = ETAPAS.map(e => e.id)

// ── Helpers ────────────────────────────────────────────────────────────────────
function getCookie(name: string) {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(new RegExp(`${name}=([^;]+)`))
  return m ? decodeURIComponent(m[1]) : ''
}

const fmtQ  = (n: number) => 'Q ' + Math.round(n).toLocaleString('es-GT')
const fmtQk = (n: number) =>
  n >= 1_000_000 ? `Q${(n/1_000_000).toFixed(1)}M` :
  n >= 1_000     ? `Q${(n/1_000).toFixed(0)}k`     : `Q${n}`

function initials(v: string) {
  return v.split(' ').map(p => p[0]).join('').slice(0,2).toUpperCase()
}

const AVATAR_BG: Record<string, string> = {
  RD: 'from-blue-500 to-blue-700',
  GG: 'from-violet-500 to-purple-700',
  MR: 'from-amber-500 to-orange-600',
  CS: 'from-cyan-500 to-teal-600',
}

function getNextCorrelativo(ops: Oportunidad[]) {
  const max = ops.reduce((m, o) => {
    const n = parseInt(o.correlativo.replace(/\D/g, '') || '0')
    return Math.max(m, n)
  }, 0)
  return `HP-OPO-${String(max + 1).padStart(4, '0')}`
}

// ── Blank form ─────────────────────────────────────────────────────────────────
const blankForm = (): Partial<Oportunidad> => ({
  cliente: '', empresa: '', monto: 0, tipo: 'Perforación de Pozo',
  etapa: 'new', profundidad: null, proyecto: '', vendedor: '', diasSinActividad: 0,
})

// ── Main component ─────────────────────────────────────────────────────────────
export default function CrmPage() {
  const [rows, setRows]             = useState<Oportunidad[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterVendedor, setFVend]  = useState('Todos')
  const [role, setRole]             = useState('')
  const [myVendedor, setMyVendedor] = useState('')
  const [modalOpen, setModalOpen]   = useState(false)
  const [editing, setEditing]       = useState<Oportunidad | null>(null)
  const [form, setForm]             = useState<Partial<Oportunidad>>(blankForm())
  const [saving, setSaving]         = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Oportunidad | null>(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleting, setDeleting]     = useState(false)
  const [lostTarget, setLostTarget] = useState<Oportunidad | null>(null)

  const isSuperAdmin = role === 'superadmin'

  const fetchRows = useCallback(async (vend: string, r: string) => {
    setLoading(true)
    const url = r === 'superadmin' ? '/api/oportunidades' : `/api/oportunidades?vendedor=${encodeURIComponent(vend)}`
    const res = await fetch(url)
    setRows(res.ok ? await res.json() : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const r = getCookie('user_role')
    const v = getCookie('user_vendedor')
    setRole(r)
    setMyVendedor(v)
    fetchRows(v, r)
  }, [fetchRows])

  // ── Filtered rows ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => rows.filter(o => {
    const q = search.toLowerCase()
    const matchSearch = o.cliente.toLowerCase().includes(q) ||
      o.empresa.toLowerCase().includes(q) || o.proyecto.toLowerCase().includes(q)
    const matchVend = !isSuperAdmin || filterVendedor === 'Todos' || o.vendedor === filterVendedor
    return matchSearch && matchVend
  }), [rows, search, filterVendedor, isSuperAdmin])

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const activos   = filtered.filter(o => o.etapa !== 'won' && o.etapa !== 'lost')
  const ganados   = filtered.filter(o => o.etapa === 'won')
  const perdidos  = filtered.filter(o => o.etapa === 'lost')
  const pipeline  = activos.reduce((s, o) => s + o.monto, 0)
  const winRate   = (ganados.length + perdidos.length) > 0
    ? Math.round(ganados.length / (ganados.length + perdidos.length) * 100)
    : 0

  // ── Stage actions ─────────────────────────────────────────────────────────────
  async function setEtapa(o: Oportunidad, etapa: string) {
    const res = await fetch(`/api/oportunidades/${o.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etapa }),
    })
    if (res.ok) {
      setRows(prev => prev.map(r => r.id === o.id ? { ...r, etapa } : r))
    }
  }

  function avanzar(o: Oportunidad) {
    const idx = ETAPA_ORDER.indexOf(o.etapa)
    if (idx < ETAPA_ORDER.length - 1) setEtapa(o, ETAPA_ORDER[idx + 1])
  }

  function retroceder(o: Oportunidad) {
    const idx = ETAPA_ORDER.indexOf(o.etapa)
    if (idx > 0) setEtapa(o, ETAPA_ORDER[idx - 1])
  }

  function marcarPerdido(o: Oportunidad) { setLostTarget(o) }
  function eliminar(o: Oportunidad) {
    setDeleteTarget(o)
    setDeleteReason('')
  }

  async function ejecutarEliminar() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const url = `/api/oportunidades/${deleteTarget.id}${deleteReason ? `?motivo=${encodeURIComponent(deleteReason)}` : ''}`
      const res = await fetch(url, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'No se pudo eliminar')
        return
      }
      setRows(prev => prev.filter(r => r.id !== deleteTarget.id))
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  // ── Modal ────────────────────────────────────────────────────────────────────
  function openCreate() {
    setEditing(null)
    setForm({ ...blankForm(), vendedor: myVendedor })
    setModalOpen(true)
  }

  function openEdit(o: Oportunidad) {
    setEditing(o)
    setForm({ ...o })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.cliente?.trim()) { alert('El nombre del cliente es requerido'); return }
    setSaving(true)
    try {
      if (editing) {
        // Editar existente
        const res = await fetch(`/api/oportunidades/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (res.ok) {
          const updated = await res.json()
          setRows(prev => prev.map(r => r.id === editing.id ? updated : r))
        }
      } else {
        // Crear nueva
        const correlativo = getNextCorrelativo(rows)
        const today = new Date().toISOString().slice(0, 10)
        const payload = {
          ...form,
          correlativo,
          fecha: today,
          avatar: initials(form.vendedor || myVendedor || 'HP'),
          vendedor: form.vendedor || myVendedor,
        }
        const res = await fetch('/api/oportunidades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const created = await res.json()
          setRows(prev => [created, ...prev])
        }
      }
      setModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const f = (k: keyof Oportunidad, v: unknown) => setForm(p => ({ ...p, [k]: v }))

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col md:h-full bg-[#070d1a]">

      {/* HEADER */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-white/5 bg-[#0a1020] shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">Oportunidades</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {loading ? 'Cargando...' : `${activos.length} activas · ${fmtQk(pipeline)} en cartera`}
            </p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nueva</span>
          </button>
        </div>

        {/* KPIs + filtros */}
        <div className="flex flex-wrap items-center gap-3">
          {/* KPI chips */}
          <div className="flex items-center gap-1.5 bg-white/5 rounded-xl px-3 py-1.5">
            <Target className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs text-slate-300">{activos.length} activas</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/5 rounded-xl px-3 py-1.5">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs text-slate-300">{fmtQk(pipeline)}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/5 rounded-xl px-3 py-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-xs text-slate-300">{winRate}% cierre</span>
          </div>

          <div className="flex-1" />

          {/* Vendor filter (superadmin only) */}
          {isSuperAdmin && (
            <select
              value={filterVendedor}
              onChange={e => setFVend(e.target.value)}
              className="bg-white/5 border border-white/10 text-slate-300 text-xs rounded-xl px-2.5 py-1.5 outline-none focus:border-blue-500/50"
            >
              <option value="Todos">Todos</option>
              {VENDEDORES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="bg-white/5 border border-white/10 text-slate-300 text-xs rounded-xl pl-8 pr-3 py-1.5 outline-none focus:border-blue-500/50 w-36 sm:w-48"
            />
          </div>
        </div>
      </div>

      {/* KANBAN BOARD */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto px-4 py-4">
          <div className="flex gap-3 min-w-max pb-4 h-full">
            {ETAPAS.map(etapa => {
              const cards = filtered.filter(o => o.etapa === etapa.id)
              const totalQ = cards.reduce((s, o) => s + o.monto, 0)
              return (
                <div
                  key={etapa.id}
                  className={cn(
                    'flex flex-col rounded-xl border w-64 sm:w-72 shrink-0',
                    etapa.colBg, etapa.border
                  )}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <div className={cn('w-2 h-2 rounded-full', etapa.dot)} />
                      <span className={cn('text-sm font-semibold', etapa.header)}>{etapa.label}</span>
                      <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', etapa.badge)}>{cards.length}</span>
                    </div>
                    {totalQ > 0 && <span className="text-xs text-slate-500">{fmtQk(totalQ)}</span>}
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {cards.map(o => (
                      <OportunidadCard
                        key={o.id}
                        oportunidad={o}
                        etapaConfig={etapa}
                        onAvanzar={() => avanzar(o)}
                        onRetroceder={() => retroceder(o)}
                        onEdit={() => openEdit(o)}
                        onDelete={() => eliminar(o)}
                        onPerdido={() => marcarPerdido(o)}
                      />
                    ))}
                    {cards.length === 0 && (
                      <div className="text-center py-6 text-xs text-slate-600">Sin oportunidades</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* MODAL CREATE/EDIT */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setModalOpen(false)} />
          <div className="relative bg-[#0d1526] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">
                {editing ? 'Editar Oportunidad' : 'Nueva Oportunidad'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Cliente *</label>
                  <input
                    value={form.cliente ?? ''}
                    onChange={e => f('cliente', e.target.value)}
                    placeholder="Nombre del cliente"
                    className="w-full bg-white/5 border border-white/10 text-slate-200 text-sm rounded-xl px-3 py-2 outline-none focus:border-blue-500/60"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Empresa</label>
                  <input
                    value={form.empresa ?? ''}
                    onChange={e => f('empresa', e.target.value)}
                    placeholder="Empresa"
                    className="w-full bg-white/5 border border-white/10 text-slate-200 text-sm rounded-xl px-3 py-2 outline-none focus:border-blue-500/60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Tipo de servicio</label>
                  <select
                    value={form.tipo ?? 'Perforación de Pozo'}
                    onChange={e => f('tipo', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 text-slate-200 text-sm rounded-xl px-3 py-2 outline-none focus:border-blue-500/60"
                  >
                    <option value="Perforación de Pozo">Perforación de Pozo</option>
                    <option value="Limpieza Mecánica">Servicios de Mantenimiento</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Monto estimado (Q)</label>
                  <input
                    type="number"
                    value={form.monto ?? 0}
                    onChange={e => f('monto', parseFloat(e.target.value) || 0)}
                    className="w-full bg-white/5 border border-white/10 text-slate-200 text-sm rounded-xl px-3 py-2 outline-none focus:border-blue-500/60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Profundidad (pies)</label>
                  <input
                    type="number"
                    value={form.profundidad ?? ''}
                    onChange={e => f('profundidad', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Opcional"
                    className="w-full bg-white/5 border border-white/10 text-slate-200 text-sm rounded-xl px-3 py-2 outline-none focus:border-blue-500/60"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Etapa</label>
                  <select
                    value={form.etapa ?? 'new'}
                    onChange={e => f('etapa', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 text-slate-200 text-sm rounded-xl px-3 py-2 outline-none focus:border-blue-500/60"
                  >
                    {ETAPAS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1 block">Descripción del proyecto</label>
                <input
                  value={form.proyecto ?? ''}
                  onChange={e => f('proyecto', e.target.value)}
                  placeholder="Ubicación, detalles, etc."
                  className="w-full bg-white/5 border border-white/10 text-slate-200 text-sm rounded-xl px-3 py-2 outline-none focus:border-blue-500/60"
                />
              </div>

              {isSuperAdmin && (
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Vendedor</label>
                  <select
                    value={form.vendedor ?? myVendedor}
                    onChange={e => f('vendedor', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 text-slate-200 text-sm rounded-xl px-3 py-2 outline-none focus:border-blue-500/60"
                  >
                    {VENDEDORES.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editing ? 'Guardar cambios' : 'Crear oportunidad'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onCancel={() => { setDeleteTarget(null); setDeleteReason('') }}
        onConfirm={ejecutarEliminar}
        title={`¿Eliminar oportunidad de "${deleteTarget?.cliente ?? ''}"?`}
        description="La oportunidad pasa a la papelera. Puedes restaurarla cuando quieras."
        confirmLabel="Sí, eliminar"
        variant="destructive"
        loading={deleting}
        askReason
        reason={deleteReason}
        onReasonChange={setDeleteReason}
      />

      <ConfirmDialog
        open={lostTarget !== null}
        onCancel={() => setLostTarget(null)}
        onConfirm={() => { if (lostTarget) { setEtapa(lostTarget, 'lost'); setLostTarget(null) } }}
        title={`¿Marcar "${lostTarget?.cliente ?? ''}" como perdido?`}
        description="La oportunidad queda en la columna 'Perdido'. Sigue visible, solo cambia de etapa."
        confirmLabel="Sí, marcar perdido"
        variant="info"
      />
    </div>
  )
}

// ── Oportunidad Card ─────────────────────────────────────────────────────────
interface CardProps {
  oportunidad: Oportunidad
  etapaConfig: typeof ETAPAS[0]
  onAvanzar: () => void
  onRetroceder: () => void
  onEdit: () => void
  onDelete: () => void
  onPerdido: () => void
}

function OportunidadCard({ oportunidad: o, onAvanzar, onRetroceder, onEdit, onDelete, onPerdido }: CardProps) {
  const ini = initials(o.vendedor)
  const avatarBg = AVATAR_BG[ini] || 'from-slate-500 to-slate-700'
  const etapaIdx = ETAPA_ORDER.indexOf(o.etapa)
  const canAdvance = etapaIdx < ETAPA_ORDER.length - 1 && o.etapa !== 'won' && o.etapa !== 'lost'
  const canRetreat = etapaIdx > 0 && o.etapa !== 'won' && o.etapa !== 'lost'
  const isWon  = o.etapa === 'won'
  const isLost = o.etapa === 'lost'

  return (
    <div className={cn(
      'bg-[#0d1526] border rounded-xl p-3 space-y-2 group',
      isWon  ? 'border-emerald-500/30' :
      isLost ? 'border-red-500/20 opacity-70' :
               'border-white/8 hover:border-white/15 transition-colors'
    )}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{o.cliente}</p>
          {o.empresa && <p className="text-xs text-slate-500 truncate">{o.empresa}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isWon  && <CheckCircle className="w-4 h-4 text-emerald-400" />}
          {isLost && <XCircle     className="w-4 h-4 text-red-400" />}
        </div>
      </div>

      {/* Monto + tipo */}
      <div className="flex items-center justify-between">
        <span className="text-base font-bold text-emerald-400">{fmtQ(o.monto)}</span>
        <span className={cn(
          'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
          o.tipo.toLowerCase().includes('limpieza') ? 'bg-cyan-500/20 text-cyan-300' : 'bg-blue-500/20 text-blue-300'
        )}>
          {o.tipo.toLowerCase().includes('limpieza') ? 'Limpieza' : 'Perforación'}
        </span>
      </div>

      {/* Meta info */}
      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className={cn('w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white bg-gradient-to-br', avatarBg)}>
            {ini}
          </div>
          <span>{o.vendedor.split(' ')[0]}</span>
        </div>
        {o.diasSinActividad > 7 && (
          <div className="flex items-center gap-1 text-orange-400">
            <AlertCircle className="w-3 h-3" />
            <span>{o.diasSinActividad}d sin actividad</span>
          </div>
        )}
        {o.profundidad && <span>{o.profundidad} pies</span>}
      </div>

      {/* Project description */}
      {o.proyecto && (
        <p className="text-[10px] text-slate-600 leading-relaxed line-clamp-2">{o.proyecto}</p>
      )}

      {/* Actions */}
      {!isWon && !isLost && (
        <div className="flex items-center gap-1 pt-1 border-t border-white/5">
          {canRetreat && (
            <button
              onClick={onRetroceder}
              className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg text-[10px] text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
          )}
          {canAdvance && (
            <button
              onClick={onAvanzar}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-colors"
            >
              Avanzar <ChevronRight className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={onPerdido}
            className="ml-auto flex items-center gap-0.5 px-1.5 py-1 rounded-lg text-[10px] text-slate-600 hover:text-red-400 hover:bg-red-500/5 transition-colors"
          >
            <XCircle className="w-3 h-3" />
          </button>

          {/* Link to create cotización */}
          {(o.etapa === 'proposition' || o.etapa === 'negotiation') && (
            <Link
              href={`/cotizaciones/nueva?cliente=${encodeURIComponent(o.cliente)}&empresa=${encodeURIComponent(o.empresa)}&tipo=${o.tipo.toLowerCase().includes('limpieza') ? 'limpieza' : 'perforacion'}`}
              className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg text-[10px] text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 transition-colors"
              title="Crear cotización"
            >
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}

          <button
            onClick={onEdit}
            className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg text-[10px] text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
          >
            <Edit2 className="w-3 h-3" />
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg text-[10px] text-slate-600 hover:text-red-400 hover:bg-red-500/5 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Won/Lost quick actions */}
      {(isWon || isLost) && (
        <div className="flex items-center gap-1 pt-1 border-t border-white/5">
          <button
            onClick={onRetroceder}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
          >
            <ChevronLeft className="w-3 h-3" /> Reabrir
          </button>
          <button onClick={onEdit} className="ml-auto flex items-center px-1.5 py-1 rounded-lg text-[10px] text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors">
            <Edit2 className="w-3 h-3" />
          </button>
          <button onClick={onDelete} className="flex items-center px-1.5 py-1 rounded-lg text-[10px] text-slate-600 hover:text-red-400 hover:bg-red-500/5 transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  )
}
