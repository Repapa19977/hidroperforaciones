'use client'

// Panel de control de pagos de un proyecto.
// Muestra hitos con estado (pagado/parcial/pendiente/excedido), lista de pagos,
// y botón para registrar nuevo pago.

import { useState, useEffect, useCallback } from 'react'
import {
  Loader2, Plus, DollarSign, CheckCircle2, Clock, AlertCircle, TrendingUp,
  Banknote, Receipt, Building, CreditCard, Trash2, Settings2, RotateCcw, X, Save,
} from 'lucide-react'
import { cn, formatQ } from '@/lib/utils'
import { ConfirmDialog } from './confirm-dialog'

interface HitoCalculado {
  id: string
  label: string
  pct: number
  montoEsperado: number
  montoRecibido: number
  montoPendiente: number
  estado: 'pagado' | 'parcial' | 'pendiente' | 'excedido'
  pagos: Array<{ id: string; fecha: string; monto: number; metodo: string; referencia: string }>
}

interface HitoEditable {
  id: string
  label: string
  pct: number
  fijo?: boolean
}

interface PagoRow {
  id: string
  hitoId: string
  hitoLabel: string
  monto: number
  fecha: string
  metodo: string
  referencia: string
  nota: string
  registradoPor: string
}

interface Response {
  hitos: HitoCalculado[]
  pagos: PagoRow[]
  planPagos: HitoEditable[]
  planSource: 'proyecto' | 'cotizacion' | 'default'
  totales: { proyecto: number; recibido: number; pendiente: number; pctCobrado: number }
}

const METODOS: { id: string; label: string; icon: typeof Banknote }[] = [
  { id: 'transferencia', label: 'Transferencia', icon: Building },
  { id: 'deposito',      label: 'Depósito',      icon: Receipt },
  { id: 'cheque',        label: 'Cheque',        icon: Banknote },
  { id: 'efectivo',      label: 'Efectivo',      icon: DollarSign },
  { id: 'tarjeta',       label: 'Tarjeta',       icon: CreditCard },
]

export function PagosPanel({ proyectoId, isSuperAdmin }: { proyectoId: string; isSuperAdmin: boolean }) {
  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formHitoId, setFormHitoId] = useState('')
  const [formMonto, setFormMonto] = useState(0)
  const [formFecha, setFormFecha] = useState(new Date().toISOString().slice(0, 10))
  const [formMetodo, setFormMetodo] = useState('transferencia')
  const [formReferencia, setFormReferencia] = useState('')
  const [formNota, setFormNota] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  // Editor de plan de pagos
  const [showEditor, setShowEditor] = useState(false)
  const [editPlan, setEditPlan] = useState<HitoEditable[]>([])
  const [savingPlan, setSavingPlan] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/proyectos/${proyectoId}/pagos`)
      if (r.ok) setData(await r.json())
    } finally {
      setLoading(false)
    }
  }, [proyectoId])

  useEffect(() => { load() }, [load])

  function openForm(hitoId: string, hitoLabel: string, pendiente: number) {
    setFormHitoId(hitoId)
    setFormMonto(pendiente)
    setFormFecha(new Date().toISOString().slice(0, 10))
    setFormMetodo('transferencia')
    setFormReferencia('')
    setFormNota('')
    setShowForm(true)
    // Guardamos label por si lo necesitamos
    ;(window as unknown as { _hitoLabel?: string })._hitoLabel = hitoLabel
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!formHitoId || formMonto <= 0) return
    setSaving(true)
    try {
      const hitoLabel = (window as unknown as { _hitoLabel?: string })._hitoLabel ?? ''
      const r = await fetch(`/api/proyectos/${proyectoId}/pagos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hitoId: formHitoId, hitoLabel, monto: formMonto, fecha: formFecha,
          metodo: formMetodo, referencia: formReferencia, nota: formNota,
        }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        alert(err.error || 'No se pudo registrar el pago')
        return
      }
      setShowForm(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function ejecutarDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const r = await fetch(`/api/pagos/${deleteTarget}`, { method: 'DELETE' })
      if (r.ok) {
        setDeleteTarget(null)
        await load()
      } else {
        const err = await r.json().catch(() => ({}))
        alert(err.error || 'No se pudo eliminar')
      }
    } finally {
      setDeleting(false)
    }
  }

  // ── Editor de plan de pagos ──────────────────────────────────────────
  const sumaPct = editPlan.reduce((a, h) => a + (h.pct || 0), 0)
  const sumaCuadra = Math.abs(sumaPct - 100) < 0.01

  function updateHito(idx: number, patch: Partial<HitoEditable>) {
    setEditPlan(prev => prev.map((h, i) => i === idx ? { ...h, ...patch } : h))
  }
  function removeHito(idx: number) {
    setEditPlan(prev => prev.filter((_, i) => i !== idx))
  }
  function addHito() {
    const newId = `custom-${Date.now()}`
    setEditPlan(prev => [...prev, { id: newId, label: 'Nuevo hito', pct: 0, fijo: false }])
  }
  function distribuirParejo() {
    if (editPlan.length === 0) return
    const per = 100 / editPlan.length
    setEditPlan(prev => prev.map(h => ({ ...h, pct: Math.round(per * 100) / 100 })))
  }
  async function resetearAlDefault() {
    if (!confirm('¿Descartar el plan personalizado y volver al plan de la cotización original?')) return
    setSavingPlan(true)
    try {
      const r = await fetch(`/api/proyectos/${proyectoId}/plan-pagos`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planPagos: null }),
      })
      if (r.ok) { setShowEditor(false); await load() }
      else {
        const err = await r.json().catch(() => ({}))
        alert(err.error || 'Error al resetear')
      }
    } finally {
      setSavingPlan(false)
    }
  }
  async function guardarPlan() {
    if (!sumaCuadra) return
    setSavingPlan(true)
    try {
      const r = await fetch(`/api/proyectos/${proyectoId}/plan-pagos`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planPagos: editPlan }),
      })
      if (r.ok) { setShowEditor(false); await load() }
      else {
        const err = await r.json().catch(() => ({}))
        alert(err.error || 'Error al guardar el plan')
      }
    } finally {
      setSavingPlan(false)
    }
  }

  if (loading || !data) {
    return <div className="flex items-center gap-2 text-slate-500 text-sm py-6"><Loader2 className="w-4 h-4 animate-spin" /> Cargando pagos...</div>
  }

  const pctCobrado = data.totales.pctCobrado

  return (
    <div className="bg-[#0d1526] rounded-2xl border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-semibold text-white">Control de Pagos</h2>
          {data.planSource === 'proyecto' && (
            <span className="text-[10px] bg-violet-500/15 text-violet-300 px-2 py-0.5 rounded-full border border-violet-500/30">Plan personalizado</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isSuperAdmin && (
            <button onClick={() => { setEditPlan([...data.planPagos]); setShowEditor(true) }}
              className="flex items-center gap-1.5 text-xs bg-violet-600/80 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg transition-colors">
              <Settings2 className="w-3.5 h-3.5" /> Editar plan
            </button>
          )}
          <div className="text-right">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Cobrado</p>
            <p className="text-base font-bold text-emerald-400 tabular-nums">
              {formatQ(data.totales.recibido)} / {formatQ(data.totales.proyecto)}
            </p>
            <p className="text-[10px] text-slate-500">{pctCobrado.toFixed(0)}% · pendiente {formatQ(data.totales.pendiente)}</p>
          </div>
        </div>
      </div>

      {/* Barra de progreso global */}
      <div className="px-5 py-3 bg-[#0a1020]">
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all"
            style={{ width: `${Math.min(100, pctCobrado)}%` }} />
        </div>
      </div>

      {/* Tabla de hitos */}
      <div className="divide-y divide-white/5">
        {data.hitos.map(h => {
          const pct = h.montoEsperado > 0 ? (h.montoRecibido / h.montoEsperado) * 100 : 0
          const colors = {
            pagado:    { text: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle2, label: 'Pagado' },
            parcial:   { text: 'text-amber-400',   bg: 'bg-amber-500/10',   icon: Clock,        label: 'Parcial' },
            pendiente: { text: 'text-slate-400',   bg: 'bg-slate-500/10',   icon: Clock,        label: 'Pendiente' },
            excedido:  { text: 'text-blue-400',    bg: 'bg-blue-500/10',    icon: TrendingUp,   label: 'Excedido' },
          }[h.estado]
          const Icon = colors.icon
          return (
            <div key={h.id} className="p-4 sm:p-5">
              <div className="flex items-center gap-3 flex-wrap">
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0', colors.bg)}>
                  <Icon className={cn('w-4 h-4', colors.text)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white">{h.label}</p>
                  <p className="text-[11px] text-slate-500">
                    {h.pct}% del total · {formatQ(h.montoEsperado)}
                    {h.estado !== 'pendiente' && ` · ${pct.toFixed(0)}% cubierto`}
                  </p>
                </div>
                <div className="text-right">
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full', colors.bg, colors.text)}>
                    {colors.label}
                  </span>
                  <p className="text-sm font-bold text-white tabular-nums mt-1">
                    {formatQ(h.montoRecibido)}
                    {h.montoPendiente > 0 && <span className="text-slate-500 text-xs"> · faltan {formatQ(h.montoPendiente)}</span>}
                  </p>
                </div>
                {isSuperAdmin && h.montoPendiente > 0 && (
                  <button onClick={() => openForm(h.id, h.label, h.montoPendiente)}
                    className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Registrar
                  </button>
                )}
              </div>

              {/* Pagos individuales de este hito */}
              {h.pagos.length > 0 && (
                <div className="mt-3 ml-11 space-y-1.5 border-l border-white/5 pl-3">
                  {h.pagos.map(p => (
                    <div key={p.id} className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500">{p.fecha}</span>
                      <span className="text-slate-400 capitalize">{p.metodo}</span>
                      {p.referencia && <span className="text-slate-600">#{p.referencia}</span>}
                      <span className="text-white tabular-nums ml-auto">{formatQ(p.monto)}</span>
                      {isSuperAdmin && (
                        <button onClick={() => setDeleteTarget(p.id)}
                          className="text-slate-600 hover:text-red-400 p-1">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Empty state */}
      {data.hitos.length === 0 && (
        <div className="py-10 flex flex-col items-center text-slate-600">
          <AlertCircle className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-sm text-slate-500">Sin plan de pagos configurado en la cotización</p>
        </div>
      )}

      {/* Modal registrar pago */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !saving && setShowForm(false)}>
          <div className="bg-[#0d1526] rounded-2xl border border-white/10 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <form onSubmit={guardar}>
              <div className="px-6 py-4 border-b border-white/5">
                <h3 className="text-base font-bold text-white">Registrar pago</h3>
                <p className="text-xs text-slate-500 mt-0.5">Hito: {(window as unknown as { _hitoLabel?: string })._hitoLabel}</p>
              </div>
              <div className="px-6 py-5 space-y-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Monto recibido (Q)</label>
                  <input type="number" step="0.01" min={0} value={formMonto}
                    onChange={e => setFormMonto(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white font-bold tabular-nums outline-none focus:border-emerald-500/50" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Fecha</label>
                  <input type="date" value={formFecha} onChange={e => setFormFecha(e.target.value)}
                    style={{ colorScheme: 'dark' }}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Método</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {METODOS.map(m => {
                      const MIcon = m.icon
                      return (
                        <button key={m.id} type="button" onClick={() => setFormMetodo(m.id)}
                          className={cn('flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-[10px] border transition-colors',
                            formMetodo === m.id
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                              : 'bg-white/3 border-white/5 text-slate-400 hover:border-white/10')}>
                          <MIcon className="w-3.5 h-3.5" />
                          {m.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Referencia (# cheque, transferencia, etc.)</label>
                  <input value={formReferencia} onChange={e => setFormReferencia(e.target.value)}
                    placeholder="ej. 0012345"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Nota (opcional)</label>
                  <textarea value={formNota} onChange={e => setFormNota(e.target.value)} rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50 resize-none" />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-white/5 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)} disabled={saving}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-white/10 rounded-lg">Cancelar</button>
                <button type="submit" disabled={saving || formMonto <= 0}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg font-medium">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
                  Registrar pago
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal editor del plan de pagos */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !savingPlan && setShowEditor(false)}>
          <div className="bg-[#0d1526] rounded-2xl border border-white/10 w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Editar plan de pagos</h3>
                <p className="text-xs text-slate-500 mt-0.5">Ajustá porcentajes, agregá o quitá hitos. Suma total = 100%.</p>
              </div>
              <button onClick={() => setShowEditor(false)} disabled={savingPlan} className="text-slate-500 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-4 overflow-y-auto flex-1 space-y-2">
              {editPlan.map((h, idx) => (
                <div key={idx} className="bg-white/3 border border-white/5 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input value={h.label} onChange={e => updateHito(idx, { label: e.target.value })}
                      placeholder="Nombre del hito"
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white outline-none focus:border-violet-500/50" />
                    <button onClick={() => removeHito(idx)} disabled={h.fijo}
                      title={h.fijo ? 'Este hito no se puede quitar' : 'Quitar hito'}
                      className="text-slate-500 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" step="0.1" min={0} max={100}
                      value={h.pct}
                      onChange={e => updateHito(idx, { pct: parseFloat(e.target.value) || 0 })}
                      className="w-20 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white font-mono outline-none focus:border-violet-500/50" />
                    <span className="text-xs text-slate-500">%</span>
                    <input type="range" min={0} max={100} step="0.5"
                      value={h.pct}
                      onChange={e => updateHito(idx, { pct: parseFloat(e.target.value) })}
                      className="flex-1 accent-violet-500" />
                    <span className="text-[10px] text-slate-500 w-12 text-right">ID: {h.id.slice(0, 8)}</span>
                  </div>
                </div>
              ))}
              <button onClick={addHito}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-violet-300 hover:text-violet-200 border border-violet-500/30 hover:border-violet-500/50 border-dashed rounded-lg py-2 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Agregar hito
              </button>
            </div>

            <div className="px-6 py-3 border-t border-white/5 bg-[#0a1020]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400">Suma total:</span>
                <span className={cn('text-sm font-bold tabular-nums',
                  sumaCuadra ? 'text-emerald-400' : 'text-red-400')}>
                  {sumaPct.toFixed(1)}% / 100%
                </span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className={cn('h-full transition-all',
                  sumaCuadra ? 'bg-emerald-500' : sumaPct > 100 ? 'bg-red-500' : 'bg-amber-500')}
                  style={{ width: `${Math.min(100, sumaPct)}%` }} />
              </div>
              {!sumaCuadra && (
                <p className="text-[10px] text-red-400 mt-1">
                  {sumaPct < 100
                    ? `Falta ${(100 - sumaPct).toFixed(1)}% para completar`
                    : `Te pasaste por ${(sumaPct - 100).toFixed(1)}%`}
                </p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button type="button" onClick={distribuirParejo} disabled={savingPlan || editPlan.length === 0}
                  className="text-[11px] text-slate-400 hover:text-white border border-white/10 hover:border-white/20 rounded-md px-2.5 py-1">
                  Distribuir parejo
                </button>
                {data.planSource === 'proyecto' && (
                  <button type="button" onClick={resetearAlDefault} disabled={savingPlan}
                    title="Volver al plan de la cotización original"
                    className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 border border-amber-500/30 rounded-md px-2.5 py-1">
                    <RotateCcw className="w-3 h-3" /> Reset al original
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowEditor(false)} disabled={savingPlan}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-white/10 rounded-lg">Cancelar</button>
                <button type="button" onClick={guardarPlan} disabled={savingPlan || !sumaCuadra}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-medium">
                  {savingPlan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Guardar plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={ejecutarDelete}
        title="¿Eliminar este pago?"
        description="El pago pasa a papelera. Los cálculos de hitos se recalculan automáticamente."
        variant="destructive"
        confirmLabel="Sí, eliminar"
        loading={deleting}
      />
    </div>
  )
}
