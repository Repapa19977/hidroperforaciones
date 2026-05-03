'use client'

// Módulo genérico de Cuentas (Pagar / Cobrar). El mismo UI se reusa entre
// /cuentas-por-pagar y /cuentas-por-cobrar cambiando únicamente props
// (título, labels, endpoint, campo "pagado" vs "cobrado").

import { useEffect, useMemo, useState } from 'react'
import {
  CreditCard, Plus, Search, AlertTriangle, CheckCircle, Clock3, Filter,
  RefreshCw, Trash2, Pencil, X, Save, DollarSign, FileText, Building,
} from 'lucide-react'
import { cn, formatQ } from '@/lib/utils'
import { KPICard } from '@/components/kpi-card'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { diasRestantes, estadoCuenta, type EstadoCuenta, IVA_RATE, ISR_RATE } from '@/lib/cuentas-utils'

function DeleteCuentaDialog({ cuenta, party, onCancel, onConfirm }: {
  cuenta: CuentaRow; party: string
  onCancel: () => void; onConfirm: (motivo: string) => void
}) {
  const [motivo, setMotivo] = useState('')
  return (
    <ConfirmDialog
      open={true}
      title="Eliminar cuenta"
      description={`¿Eliminar la cuenta de ${party} por ${formatQ(cuenta.total)}? Quedará en papelera.`}
      confirmLabel="Eliminar"
      variant="destructive"
      askReason={true}
      reason={motivo}
      onReasonChange={setMotivo}
      onConfirm={() => onConfirm(motivo)}
      onCancel={onCancel}
    />
  )
}

export interface CuentaRow {
  id: string
  // Para pagar: proveedor. Para cobrar: cliente/empresa.
  proveedor?: string
  cliente?: string
  empresa?: string
  nit: string
  descripcion: string
  monto: number
  aplicarIva: boolean
  aplicarIsr: boolean
  ivaMonto: number
  isrMonto: number
  total: number
  fechaEmision: string
  diasCredito: number
  fechaVencimiento: string
  pagado?: boolean
  cobrado?: boolean
  fechaPago?: string | null
  fechaCobro?: string | null
  metodoPago?: string
  metodoCobro?: string
  referenciaPago?: string
  referenciaCobro?: string
  nota: string
  createdAt: string
}

export interface CuentasModuleProps {
  // Configuración semántica
  variant: 'pagar' | 'cobrar'
  endpoint: string    // '/api/cuentas-pagar' o '/api/cuentas-cobrar'
  titulo: string      // "Cuentas por Pagar" / "Cuentas por Cobrar"
  subtitulo: string   // Descripción corta
}

const METODOS = ['transferencia', 'cheque', 'depósito', 'efectivo', 'tarjeta', 'otro']

type FiltroEstado = 'todos' | 'vigente' | 'por_vencer' | 'vencida' | 'cerrada'

export function CuentasModule({ variant, endpoint, titulo, subtitulo }: CuentasModuleProps) {
  const esPagar = variant === 'pagar'
  const partyLabel      = esPagar ? 'Proveedor' : 'Cliente'
  const partyKeyEnRow   : keyof CuentaRow = esPagar ? 'proveedor' : 'cliente'
  const cerradaLabel    = esPagar ? 'Pagado' : 'Cobrado'
  const marcarVerbo     = esPagar ? 'Pagar' : 'Cobrar'
  const estadoCerradaField  : keyof CuentaRow = esPagar ? 'pagado' : 'cobrado'
  const fechaCerradaField   : keyof CuentaRow = esPagar ? 'fechaPago' : 'fechaCobro'
  const metodoCerradaField  : keyof CuentaRow = esPagar ? 'metodoPago' : 'metodoCobro'

  const [rows, setRows] = useState<CuentaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState<FiltroEstado>('todos')
  const [form, setForm] = useState<Partial<CuentaRow> | null>(null)  // null = modal cerrado
  const [marcarCerrada, setMarcarCerrada] = useState<CuentaRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CuentaRow | null>(null)

  async function loadData() {
    setLoading(true)
    try {
      const r = await fetch(endpoint)
      setRows(r.ok ? await r.json() : [])
    } finally { setLoading(false) }
  }
  useEffect(() => { void loadData() }, [endpoint])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derivaciones para los KPIs ─────────────────────────────────────────────
  const now = new Date()
  const hoyKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`
  const hoy = useMemo(() => {
    const [year, month, day] = hoyKey.split('-').map(Number)
    return new Date(year, month, day)
  }, [hoyKey])
  const pendientes = rows.filter(r => !(r[estadoCerradaField] as boolean))
  const cerradas   = rows.filter(r =>  (r[estadoCerradaField] as boolean))
  const totalPendiente = pendientes.reduce((a, r) => a + r.total, 0)
  const vencidas = pendientes.filter(r => estadoCuenta(false, r.fechaVencimiento, hoy) === 'vencida')
  const porVencer = pendientes.filter(r => estadoCuenta(false, r.fechaVencimiento, hoy) === 'por_vencer')

  // ── Filtro y búsqueda ──────────────────────────────────────────────────────
  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      const estado: EstadoCuenta = (r[estadoCerradaField] as boolean)
        ? 'cerrada'
        : estadoCuenta(false, r.fechaVencimiento, hoy)
      if (filtro !== 'todos' && estado !== filtro) return false
      if (!q) return true
      const party = (r[partyKeyEnRow] as string | undefined) ?? ''
      return (
        party.toLowerCase().includes(q) ||
        r.descripcion.toLowerCase().includes(q) ||
        r.empresa?.toLowerCase().includes(q) ||
        r.nit?.toLowerCase().includes(q) ||
        r.nota?.toLowerCase().includes(q)
      )
    })
  }, [rows, filtro, search, estadoCerradaField, partyKeyEnRow, hoy])

  async function handleSave(payload: Partial<CuentaRow>) {
    if (payload.id) {
      const r = await fetch(`${endpoint}/${payload.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) { alert('Error al guardar'); return }
    } else {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: 'Error' }))
        alert(err.error ?? 'Error al crear')
        return
      }
    }
    setForm(null)
    void loadData()
  }

  async function handleMarcarCerrada(row: CuentaRow, metodo: string, referencia: string) {
    const campoCerrada = esPagar ? 'pagado' : 'cobrado'
    const campoMetodo  = esPagar ? 'metodoPago' : 'metodoCobro'
    const campoRef     = esPagar ? 'referenciaPago' : 'referenciaCobro'
    await fetch(`${endpoint}/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [campoCerrada]: true, [campoMetodo]: metodo, [campoRef]: referencia }),
    })
    setMarcarCerrada(null)
    void loadData()
  }

  async function handleDelete(row: CuentaRow, motivo: string) {
    const r = await fetch(`${endpoint}/${row.id}?motivo=${encodeURIComponent(motivo)}`, { method: 'DELETE' })
    if (!r.ok) { alert('Error al eliminar'); return }
    setDeleteTarget(null)
    void loadData()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col md:h-full bg-[#070d1a]">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-white/5 bg-[#0a1020] shrink-0">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <CreditCard className={cn('w-5 h-5', esPagar ? 'text-red-400' : 'text-emerald-400')} />
              {titulo}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{subtitulo}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void loadData()}
              className="flex items-center gap-1.5 border border-white/10 text-slate-300 hover:text-white hover:border-white/20 px-3 py-2 rounded-lg text-xs font-medium transition-all">
              <RefreshCw className="w-3.5 h-3.5" /> Actualizar
            </button>
            <button
              onClick={() => setForm({
                aplicarIva: true, aplicarIsr: false, diasCredito: 0,
                fechaEmision: new Date().toISOString().slice(0, 10),
              })}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-500/25">
              <Plus className="w-4 h-4" /> Nueva cuenta
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <KPICard
            icon={<DollarSign className={cn('w-4 h-4', esPagar ? 'text-red-400' : 'text-emerald-400')} />}
            label="Total pendiente" value={formatQ(totalPendiente)}
            sub={`${pendientes.length} cuenta(s)`}
            color={esPagar ? 'red' : 'emerald'}
          />
          <KPICard
            icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
            label="Vencidas" value={String(vencidas.length)}
            sub={formatQ(vencidas.reduce((a, r) => a + r.total, 0))}
            color={vencidas.length > 0 ? 'red' : 'slate'}
          />
          <KPICard
            icon={<Clock3 className="w-4 h-4 text-amber-400" />}
            label="Por vencer (7 días)" value={String(porVencer.length)}
            sub={formatQ(porVencer.reduce((a, r) => a + r.total, 0))}
            color={porVencer.length > 0 ? 'amber' : 'slate'}
          />
          <KPICard
            icon={<CheckCircle className="w-4 h-4 text-slate-400" />}
            label={`${cerradaLabel}s`} value={String(cerradas.length)}
            sub={formatQ(cerradas.reduce((a, r) => a + r.total, 0))}
            color="slate"
          />
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text" placeholder={`Buscar ${partyLabel.toLowerCase()}, descripción, NIT...`}
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50"
            />
          </div>
          {(['todos','vigente','por_vencer','vencida','cerrada'] as const).map(e => (
            <button key={e} onClick={() => setFiltro(e)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1',
                filtro === e ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5')}>
              <Filter className="w-3 h-3" />
              {e === 'todos' ? 'Todos' :
               e === 'vigente' ? 'Vigentes' :
               e === 'por_vencer' ? 'Por vencer' :
               e === 'vencida' ? 'Vencidas' : `${cerradaLabel}s`}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center gap-3 text-slate-500">
          <RefreshCw className="w-5 h-5 animate-spin" /> Cargando...
        </div>
      ) : filtradas.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-600 p-8">
          <FileText className="w-12 h-12 mb-4 opacity-30" />
          <p className="font-medium text-slate-500">
            {rows.length === 0 ? 'Aún no hay cuentas. Agrega la primera con "Nueva cuenta".' : 'Sin resultados para el filtro actual.'}
          </p>
        </div>
      ) : (
        <div className="flex-1 md:overflow-auto p-3 sm:p-4 space-y-2">
          {filtradas.map(r => {
            const cerrada = (r[estadoCerradaField] as boolean)
            const estado: EstadoCuenta = cerrada ? 'cerrada' : estadoCuenta(false, r.fechaVencimiento, hoy)
            const diasHastaVenc = diasRestantes(r.fechaVencimiento, hoy)
            const party = (r[partyKeyEnRow] as string | undefined) ?? ''

            return (
              <div key={r.id} className="bg-[#0d1526] rounded-xl border border-white/5 hover:border-white/10 p-4 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Building className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <p className="font-semibold text-slate-200 truncate">{party}</p>
                      {r.empresa && <span className="text-xs text-slate-500 truncate">({r.empresa})</span>}
                      {r.nit && <span className="text-[10px] text-slate-600">NIT {r.nit}</span>}
                      <EstadoBadge estado={estado} dias={diasHastaVenc} />
                    </div>
                    <p className="text-xs text-slate-400 mb-1">{r.descripcion}</p>
                    <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-500">
                      <span>Emisión: <b className="text-slate-400">{r.fechaEmision}</b></span>
                      <span>Crédito: <b className="text-slate-400">{r.diasCredito}d</b></span>
                      <span>Vence: <b className={cn(
                        estado === 'vencida' ? 'text-red-400' : estado === 'por_vencer' ? 'text-amber-400' : 'text-slate-400'
                      )}>{r.fechaVencimiento}</b></span>
                      {cerrada && r[fechaCerradaField] && (
                        <span>
                          {cerradaLabel.toLowerCase()}: <b className="text-emerald-400">{r[fechaCerradaField] as string}</b>
                          {r[metodoCerradaField] && <span className="ml-1">· {r[metodoCerradaField] as string}</span>}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-bold text-white tabular-nums">{formatQ(r.total)}</p>
                    <div className="text-[10px] text-slate-600 mt-0.5 flex items-center gap-2 justify-end">
                      <span>Sub. {formatQ(r.monto)}</span>
                      {r.aplicarIva && <span className="text-amber-400">+IVA {formatQ(r.ivaMonto)}</span>}
                      {r.aplicarIsr && <span className="text-violet-400">−ISR {formatQ(r.isrMonto)}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-white/5">
                  {!cerrada && (
                    <button
                      onClick={() => setMarcarCerrada(r)}
                      className="text-[11px] px-3 py-1.5 border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 rounded-md flex items-center gap-1.5 transition-colors"
                    >
                      <CheckCircle className="w-3 h-3" /> Marcar como {cerradaLabel.toLowerCase()}
                    </button>
                  )}
                  <button onClick={() => setForm(r)}
                    className="text-[11px] px-3 py-1.5 border border-white/10 text-slate-300 hover:text-white hover:border-white/20 rounded-md flex items-center gap-1.5 transition-colors">
                    <Pencil className="w-3 h-3" /> Editar
                  </button>
                  <button onClick={() => setDeleteTarget(r)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors" title="Eliminar">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal crear/editar */}
      {form && (
        <FormularioCuenta
          variant={variant}
          initial={form}
          onCancel={() => setForm(null)}
          onSave={handleSave}
        />
      )}

      {/* Modal marcar pagado/cobrado */}
      {marcarCerrada && (
        <MarcarCerradaModal
          row={marcarCerrada}
          verbo={marcarVerbo}
          onCancel={() => setMarcarCerrada(null)}
          onConfirm={(metodo, ref) => handleMarcarCerrada(marcarCerrada, metodo, ref)}
        />
      )}

      {/* Confirmar eliminación */}
      {deleteTarget && (
        <DeleteCuentaDialog
          cuenta={deleteTarget}
          party={(deleteTarget[partyKeyEnRow] as string) ?? ''}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={(motivo) => handleDelete(deleteTarget, motivo)}
        />
      )}
    </div>
  )
}

// ── Subcomponentes ──────────────────────────────────────────────────────────

function EstadoBadge({ estado, dias }: { estado: EstadoCuenta; dias: number }) {
  const config: Record<EstadoCuenta, { label: string; cls: string }> = {
    vigente:     { label: `Vigente (${dias}d)`,    cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
    por_vencer:  { label: `Por vencer (${dias}d)`, cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
    vencida:     { label: `Vencida (${Math.abs(dias)}d)`, cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
    cerrada:     { label: 'Cerrada',               cls: 'bg-slate-500/15 text-slate-400 border-white/10' },
  }
  const { label, cls } = config[estado]
  return <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-semibold', cls)}>{label}</span>
}

function FormularioCuenta({
  variant, initial, onCancel, onSave,
}: {
  variant: 'pagar' | 'cobrar'
  initial: Partial<CuentaRow>
  onCancel: () => void
  onSave: (payload: Partial<CuentaRow>) => void
}) {
  const esPagar = variant === 'pagar'
  const partyLabel = esPagar ? 'Proveedor' : 'Cliente'
  const partyKey   : keyof CuentaRow = esPagar ? 'proveedor' : 'cliente'

  const [form, setForm] = useState({
    proveedor:   initial.proveedor   ?? '',
    cliente:     initial.cliente     ?? '',
    empresa:     initial.empresa     ?? '',
    nit:         initial.nit         ?? '',
    descripcion: initial.descripcion ?? '',
    monto:       initial.monto       ?? 0,
    aplicarIva:  initial.aplicarIva  ?? true,
    aplicarIsr:  initial.aplicarIsr  ?? false,
    diasCredito: initial.diasCredito ?? 0,
    fechaEmision: initial.fechaEmision ?? new Date().toISOString().slice(0, 10),
    nota:        initial.nota        ?? '',
  })

  const esEdicion = !!initial.id

  // Preview de totales
  const ivaMonto = form.aplicarIva ? Math.round(Number(form.monto) * IVA_RATE) : 0
  const isrMonto = form.aplicarIsr ? Math.round(Number(form.monto) * ISR_RATE) : 0
  const total    = Number(form.monto) + ivaMonto - isrMonto

  function handleSubmit() {
    const payload: Partial<CuentaRow> = {
      ...(initial.id ? { id: initial.id } : {}),
      [partyKey]: esPagar ? form.proveedor.trim() : form.cliente.trim(),
      empresa:     form.empresa.trim(),
      nit:         form.nit.trim(),
      descripcion: form.descripcion.trim(),
      monto:       Number(form.monto),
      aplicarIva:  form.aplicarIva,
      aplicarIsr:  form.aplicarIsr,
      diasCredito: Number(form.diasCredito) | 0,
      fechaEmision: form.fechaEmision,
      nota:        form.nota,
    }
    onSave(payload)
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-[#0d1526] rounded-xl border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">
            {esEdicion ? 'Editar' : 'Nueva'} cuenta {esPagar ? 'por pagar' : 'por cobrar'}
          </h2>
          <button onClick={onCancel} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">{partyLabel} *</label>
              <input
                value={esPagar ? form.proveedor : form.cliente}
                onChange={e => setForm(f => esPagar ? { ...f, proveedor: e.target.value } : { ...f, cliente: e.target.value })}
                placeholder={esPagar ? 'Ej. Ferretería La Guatemalteca' : 'Ej. Constructora ABC'}
                className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Empresa / Razón social</label>
              <input
                value={form.empresa} onChange={e => setForm(f => ({ ...f, empresa: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">NIT</label>
              <input
                value={form.nit} onChange={e => setForm(f => ({ ...f, nit: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Fecha emisión *</label>
              <input
                type="date" value={form.fechaEmision}
                onChange={e => setForm(f => ({ ...f, fechaEmision: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Días de crédito</label>
              <input
                type="number" min={0} value={form.diasCredito}
                onChange={e => setForm(f => ({ ...f, diasCredito: parseInt(e.target.value) || 0 }))}
                className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none tabular-nums focus:border-blue-500/50"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-500 block mb-1">Descripción *</label>
            <textarea
              value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              rows={2}
              placeholder={esPagar ? 'Material comprado, servicio recibido, etc.' : 'Servicio brindado, producto vendido, etc.'}
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 resize-none"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-500 block mb-1">Monto (subtotal, sin IVA) *</label>
            <input
              type="number" step="0.01" min={0} value={form.monto || ''}
              onChange={e => setForm(f => ({ ...f, monto: parseFloat(e.target.value) || 0 }))}
              placeholder="0"
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-lg text-white outline-none tabular-nums focus:border-blue-500/50"
            />
          </div>

          {/* Toggles IVA / ISR + preview */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setForm(f => ({ ...f, aplicarIva: !f.aplicarIva }))}
              className={cn('text-xs px-3 py-1.5 rounded border transition-colors',
                form.aplicarIva
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                  : 'border-white/10 text-slate-500 hover:border-white/20')}>
              IVA 12% {form.aplicarIva ? '✓' : '—'}
            </button>
            <button
              onClick={() => setForm(f => ({ ...f, aplicarIsr: !f.aplicarIsr }))}
              className={cn('text-xs px-3 py-1.5 rounded border transition-colors',
                form.aplicarIsr
                  ? 'border-violet-500/40 bg-violet-500/15 text-violet-300'
                  : 'border-white/10 text-slate-500 hover:border-white/20')}>
              ISR 5% retención {form.aplicarIsr ? '✓' : '—'}
            </button>
          </div>

          <div className="bg-white/3 rounded-lg border border-white/5 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="tabular-nums text-slate-300">{formatQ(Number(form.monto) || 0)}</span></div>
            {form.aplicarIva && <div className="flex justify-between"><span className="text-amber-400">+ IVA (12%)</span><span className="tabular-nums text-amber-400">{formatQ(ivaMonto)}</span></div>}
            {form.aplicarIsr && <div className="flex justify-between"><span className="text-violet-400">− ISR (5%)</span><span className="tabular-nums text-violet-400">{formatQ(isrMonto)}</span></div>}
            <div className="flex justify-between pt-1 border-t border-white/5 font-bold"><span className="text-white">Total</span><span className="tabular-nums text-blue-400">{formatQ(total)}</span></div>
          </div>

          <div>
            <label className="text-[11px] text-slate-500 block mb-1">Nota (opcional)</label>
            <input
              value={form.nota} onChange={e => setForm(f => ({ ...f, nota: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-white/10 flex gap-2 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 border border-white/10 text-slate-300 hover:text-white rounded-lg text-sm transition-all">
            Cancelar
          </button>
          <button onClick={handleSubmit}
            disabled={
              (esPagar ? !form.proveedor.trim() : !form.cliente.trim()) ||
              !form.descripcion.trim() || Number(form.monto) <= 0
            }
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2">
            <Save className="w-4 h-4" /> {esEdicion ? 'Guardar cambios' : 'Crear cuenta'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MarcarCerradaModal({
  row, verbo, onCancel, onConfirm,
}: {
  row: CuentaRow
  verbo: string
  onCancel: () => void
  onConfirm: (metodo: string, referencia: string) => void
}) {
  const [metodo, setMetodo] = useState('transferencia')
  const [referencia, setReferencia] = useState('')

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-[#0d1526] rounded-xl border border-white/10 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-base font-bold text-white">Marcar como {verbo.toLowerCase()}</h2>
          <button onClick={onCancel} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="bg-white/3 rounded-lg border border-white/5 p-3">
            <p className="text-xs text-slate-500">Total a {verbo.toLowerCase()}</p>
            <p className="text-xl font-bold text-white tabular-nums">{formatQ(row.total)}</p>
          </div>
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">Método</label>
            <select value={metodo} onChange={e => setMetodo(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50">
              {METODOS.map(m => <option key={m} value={m} className="bg-[#0d1526]">{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-500 block mb-1">Referencia (# cheque, boleta...)</label>
            <input value={referencia} onChange={e => setReferencia(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-white/10 flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 border border-white/10 text-slate-300 hover:text-white rounded-lg text-sm">Cancelar</button>
          <button onClick={() => onConfirm(metodo, referencia)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}
