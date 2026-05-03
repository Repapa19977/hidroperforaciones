'use client'

import { useCallback, useEffect, useState, use, Fragment } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Trash2, AlertCircle, RefreshCw, ClipboardList, TrendingUp,
  Wallet, CheckCircle, AlertTriangle, X, Save, Loader2, Package, ShoppingCart,
  ChevronDown,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Dot,
} from 'recharts'
import { cn, formatQ } from '@/lib/utils'
import { PagosPanel } from '@/components/pagos-panel'

interface PresupuestoRubro {
  key: string
  nombre: string
  cantidadPresupuestada: number
  unidad: string
  montoPresupuestado: number
}

interface Presupuesto {
  total: number
  rubros: PresupuestoRubro[]
  profundidad: number
  diasMaquinaria: number
}

interface EjecutadoRubro {
  key: string
  cantidadConsumida: number
  montoGastado: number
}

interface DiaAdverso {
  fecha: string
  piesPerforados: number
  horasProductivas: number
  horasAdversas: number
  cobro: number
}
interface Ejecutado {
  piesPerforadosTotal: number
  diasActivos: number
  diasInactivos: number
  horasAdversasTotal: number
  cobroHorasAdversas: number
  diasAdversosDetalle: DiaAdverso[]
  rubros: EjecutadoRubro[]
  total: number
}

interface GastoExtra {
  id: string
  fecha: string
  producto: string
  descripcion: string
  rubro: string
  costoUnitario: number
  valorUnitario: number
  cantidad: number
  unidad: string
  monto: number
  diasCredito: number
  fechaVencimiento: string
  pagado: boolean
  proveedor: string
  nota: string
  creadoPor: string
  createdAt: string
  // Legacy
  concepto?: string
  montoUnit?: number
}

interface DetalleProyecto {
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

interface Reserva {
  id: string
  producto: string
  cantidadOriginal: number
  cantidadActual: number
  unidad: string
  costoUnitario: number
  precioVentaSugerido: number
  estado: string
  fechaCreacion: string
  nota: string
}

interface Movimiento {
  id: string
  reservaId: string
  tipo: string
  cantidad: number
  precioUnit: number
  monto: number
  cliente: string
  nota: string
  createdAt: string
}

interface EntradaBitacora {
  id: string
  fecha: string
  turno: string
  estado: string
  perforacionDia: number
  perforacionTotal: number
  bentonitaSacos: number
  pipas: number
  diaAdverso: boolean
  notaCliente: string
  formacionGeologica: string
  circulacionPct: number
}

interface Cronograma {
  fechaInicio: string | null
  fechaFinEstimada: string | null
  diaActualDelProyecto: number
  diasRestantes: number
  diasHabilesTotal: number
  diasRegistradosBitacora?: number
  triggerActivado: boolean
}

interface EstadoRubro {
  key: string
  nombre: string
  unidad: string
  cantidadPresupuestada: number
  montoPresupuestado: number
  cantidadComprada: number
  montoComprado: number
  comprasCount: number
  faltante: number
  estado: 'verde' | 'amarillo' | 'rojo'
}

interface Data {
  proyecto: DetalleProyecto
  presupuesto: Presupuesto | null
  ejecutado: Ejecutado | null
  gastosExtras: GastoExtra[]
  totalExtras: number
  totalEjecutadoMasExtras: number
  consumoValorizadoBitacora?: number
  desviacionQ: number
  avancePct: number
  estadoPorRubro: EstadoRubro[]
  reservas: Reserva[]
  movimientos: Movimiento[]
  valorReservado: number
  ventasExternas: number
  entradasBitacora: EntradaBitacora[]
  paramsAdversas?: { horasTurno: number; piesMinimoTurno: number; valorHoraAdversa: number }
  cronograma: Cronograma
}

const RUBRO_OPTIONS = [
  { value: 'combustible', label: 'Combustible' },
  { value: 'mano-obra',   label: 'Mano de obra' },
  { value: 'material',    label: 'Material' },
  { value: 'otro',        label: 'Otro' },
]

export default function ControlGastosDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [rubroExpandido, setRubroExpandido] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    producto: '',
    descripcion: '',
    rubro: 'material',
    costoUnitario: 0,
    valorUnitario: 0,
    cantidad: 1,
    unidad: 'Unidad',
    diasCredito: 0,
    proveedor: '',
    pagado: false,
    nota: '',
  })
  // (Bitácora removida de Control de Gastos — vive en /proyectos/[id])
  // Modal venta externa (del 30% reservado)
  const [showVenta, setShowVenta] = useState<string | null>(null)  // reservaId
  const [ventaForm, setVentaForm] = useState({
    cantidad: 0,
    precioUnit: 0,
    cliente: '',
    nota: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/proyectos/${id}/control-gastos`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  async function handleGuardar() {
    if (!form.producto.trim()) return
    setSaving(true)
    try {
      await fetch(`/api/proyectos/${id}/control-gastos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, pagado: form.diasCredito === 0 ? true : form.pagado }),
      })
      setShowForm(false)
      setForm({
        fecha: new Date().toISOString().slice(0, 10), producto: '', descripcion: '',
        rubro: 'material', costoUnitario: 0, valorUnitario: 0, cantidad: 1, unidad: 'Unidad',
        diasCredito: 0, proveedor: '', pagado: false, nota: '',
      })
      await load()
    } finally { setSaving(false) }
  }

  async function handleEliminar(gastoId: string) {
    if (!confirm('¿Eliminar este gasto extra?')) return
    await fetch(`/api/proyectos/${id}/control-gastos/${gastoId}`, { method: 'DELETE' })
    await load()
  }

  // handleGuardarAvance eliminado — Registrar Avance ahora vive en /proyectos/[id]

  async function handleVentaExterna() {
    if (!showVenta || ventaForm.cantidad <= 0) return
    setSaving(true)
    try {
      await fetch('/api/inventario/movimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservaId: showVenta,
          tipo: 'venta_externa',
          cantidad: ventaForm.cantidad,
          precioUnit: ventaForm.precioUnit,
          cliente: ventaForm.cliente,
          nota: ventaForm.nota,
        }),
      })
      setShowVenta(null)
      setVentaForm({ cantidad: 0, precioUnit: 0, cliente: '', nota: '' })
      await load()
    } finally { setSaving(false) }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full gap-3 text-slate-500">
      <RefreshCw className="w-5 h-5 animate-spin" /><span className="text-sm">Cargando...</span>
    </div>
  }
  if (!data) {
    return <div className="flex flex-col items-center justify-center h-full text-slate-500">
      <AlertCircle className="w-12 h-12 mb-3" />
      <p className="font-medium">Proyecto no encontrado</p>
      <Link href="/gastos" className="mt-2 text-blue-400 hover:text-blue-300 text-sm underline">Volver</Link>
    </div>
  }

  const { proyecto, presupuesto, ejecutado, gastosExtras, totalExtras, totalEjecutadoMasExtras, desviacionQ, avancePct, estadoPorRubro, reservas, movimientos, valorReservado, ventasExternas, cronograma, paramsAdversas } = data
  const pctComprado = presupuesto && presupuesto.total > 0 ? (totalEjecutadoMasExtras / presupuesto.total) * 100 : 0
  const horasTurno = paramsAdversas?.horasTurno ?? 10
  const piesMinimoTurno = paramsAdversas?.piesMinimoTurno ?? 20
  const valorHoraAdversa = paramsAdversas?.valorHoraAdversa ?? 500
  const rendimientoMinimo = horasTurno > 0 ? piesMinimoTurno / horasTurno : 0

  // Presupuesto vs comprado viene directo del endpoint como estadoPorRubro.
  // La bitacora queda para avance fisico y consumos, no para inflar el financiero.

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link href="/gastos" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm">
          <ArrowLeft className="w-4 h-4" /> Control de Gastos
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/proyectos/${proyecto.id}`}
            className="flex items-center gap-2 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors">
            <ClipboardList className="w-3.5 h-3.5" /> Ver Bitácora
          </Link>
          <button onClick={() => { setForm(f => ({ ...f, rubro: 'otro', producto: '' })); setShowForm(true) }}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-3 py-2 rounded-lg text-xs font-medium shadow-lg shadow-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" /> Gasto imprevisto
          </button>
        </div>
      </div>

      {/* Info del proyecto */}
      <div className="bg-[#0d1526] rounded-2xl border border-white/5 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono text-[11px] text-blue-400">{proyecto.correlativo}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 capitalize">{proyecto.estado}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400">{proyecto.tipo === 'perforacion' ? 'Perforación' : 'Limpieza'}</span>
            </div>
            <h1 className="text-xl font-bold text-white">{proyecto.cliente}</h1>
            <p className="text-sm text-slate-400 mt-0.5">{proyecto.nombre}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Monto cotización</p>
            <p className="text-xl font-bold text-white tabular-nums">{formatQ(proyecto.monto)}</p>
          </div>
        </div>
      </div>

      {/* ── CONTROL DE PAGOS (movido desde Bitácora 2026-04-22) ────────────── */}
      <PagosPanel proyectoId={proyecto.id} isSuperAdmin={true} />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={<TrendingUp className="w-4 h-4 text-blue-400" />}
          label="Avance físico" value={`${avancePct.toFixed(1)}%`}
          sub={`${ejecutado?.piesPerforadosTotal ?? 0} / ${presupuesto?.profundidad ?? 0} pies`} color="blue" />
        <KPI icon={<Wallet className="w-4 h-4 text-violet-400" />}
          label="Comprado real" value={formatQ(totalEjecutadoMasExtras)}
          sub={presupuesto ? `${pctComprado.toFixed(0)}% del presupuesto` : '—'} color="violet" />
        <KPI icon={<ClipboardList className="w-4 h-4 text-amber-400" />}
          label="Compras" value={String(gastosExtras.length)}
          sub={`${formatQ(totalExtras)} registrado`} color="amber" />
        <KPI
          icon={desviacionQ > 0
            ? <AlertTriangle className="w-4 h-4 text-red-400" />
            : <CheckCircle className="w-4 h-4 text-emerald-400" />}
          label="Desviación" value={(desviacionQ > 0 ? '+' : '') + formatQ(desviacionQ)}
          sub={desviacionQ > 0 ? 'sobre presupuesto' : 'bajo presupuesto'}
          color={desviacionQ > 0 ? 'red' : 'emerald'} />
      </div>

      {/* Cronograma del proyecto (trigger = primera bitácora) */}
      {presupuesto && (
        <div className={cn('rounded-xl border p-4',
          cronograma.triggerActivado ? 'bg-blue-500/5 border-blue-500/20' : 'bg-amber-500/5 border-amber-500/25')}>
          {cronograma.triggerActivado ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Inicio del proyecto</p>
                <p className="text-sm font-semibold text-white">{cronograma.fechaInicio}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Fin estimado</p>
                <p className="text-sm font-semibold text-white">{cronograma.fechaFinEstimada}</p>
                <p className="text-[10px] text-slate-600">{cronograma.diasHabilesTotal} días hábiles</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Día del proyecto</p>
                <p className="text-sm font-bold text-blue-400 tabular-nums">{cronograma.diaActualDelProyecto} / {cronograma.diasHabilesTotal}</p>
                <p className="text-[10px] text-slate-600">incluye adversos registrados</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase">Días restantes</p>
                <p className={cn('text-sm font-bold tabular-nums',
                  cronograma.diasRestantes === 0 ? 'text-red-400'
                    : cronograma.diasRestantes <= 5 ? 'text-amber-400'
                    : 'text-emerald-400')}>
                  {cronograma.diasRestantes}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5" />
              El cronograma arranca cuando se registra la primera bitácora (trigger). Duración prevista: <b className="text-white">{cronograma.diasHabilesTotal} días hábiles</b> (excluyendo sáb/dom).
            </p>
          )}
        </div>
      )}

      {/* Barra de avance física */}
      {presupuesto && (
        <div className="bg-[#0d1526] rounded-xl border border-white/5 p-4">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-slate-400 font-medium">Avance físico del proyecto</span>
            <span className="text-blue-400 font-bold tabular-nums">{avancePct.toFixed(1)}%</span>
          </div>
          <div className="h-3 bg-white/5 rounded-full overflow-hidden">
            <div className={cn('h-full transition-all',
              avancePct >= 100 ? 'bg-emerald-500' : avancePct >= 50 ? 'bg-blue-500' : 'bg-blue-600/60')}
              style={{ width: `${Math.min(100, avancePct)}%` }} />
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1.5">
            <span>0</span>
            <span>{ejecutado?.piesPerforadosTotal ?? 0} pies perforados</span>
            <span>{presupuesto.profundidad} pies</span>
          </div>
        </div>
      )}

      {/* Horas adversas cobrables — se activan cuando el avance queda bajo el minimo configurado */}
      {ejecutado && ejecutado.horasAdversasTotal > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/25 rounded-xl p-4">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-300 mb-0.5">Horas adversas cobrables al cliente</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Días con menos de {piesMinimoTurno} pies. Según la configuración, estas horas son cobrables a Q {valorHoraAdversa.toLocaleString('es-GT')}/hora (rendimiento mínimo {rendimientoMinimo.toFixed(2)} pies/h en turno de {horasTurno}h).
              </p>
            </div>
          </div>

          {/* Totales */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3 pb-3 border-b border-amber-500/20">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Días adversos</p>
              <p className="text-lg font-bold text-amber-300 tabular-nums">{ejecutado.diasAdversosDetalle.length}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Horas totales</p>
              <p className="text-lg font-bold text-amber-300 tabular-nums">{ejecutado.horasAdversasTotal.toFixed(1)} h</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Cobro total</p>
              <p className="text-lg font-bold text-emerald-300 tabular-nums">Q {Math.round(ejecutado.cobroHorasAdversas).toLocaleString('es-GT')}</p>
            </div>
          </div>

          {/* Tabla con detalle por día */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-2 py-1.5 font-medium">Fecha</th>
                  <th className="text-right px-2 py-1.5 font-medium">Pies</th>
                  <th className="text-right px-2 py-1.5 font-medium">H. productivas</th>
                  <th className="text-right px-2 py-1.5 font-medium">H. adversas</th>
                  <th className="text-right px-2 py-1.5 font-medium">Cobro (Q)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-500/10">
                {ejecutado.diasAdversosDetalle.map((d, i) => (
                  <tr key={i} className="hover:bg-amber-500/5">
                    <td className="px-2 py-1.5 text-slate-300 tabular-nums">{d.fecha}</td>
                    <td className="px-2 py-1.5 text-right text-red-400 font-semibold tabular-nums">{d.piesPerforados.toFixed(1)}</td>
                    <td className="px-2 py-1.5 text-right text-slate-400 tabular-nums">{d.horasProductivas.toFixed(2)} h</td>
                    <td className="px-2 py-1.5 text-right text-amber-300 font-semibold tabular-nums">{d.horasAdversas.toFixed(2)} h</td>
                    <td className="px-2 py-1.5 text-right text-emerald-300 font-bold tabular-nums">Q {Math.round(d.cobro).toLocaleString('es-GT')}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-amber-500/30">
                  <td colSpan={3} className="px-2 py-2 text-right font-bold text-slate-300">TOTAL</td>
                  <td className="px-2 py-2 text-right text-amber-300 font-bold tabular-nums">{ejecutado.horasAdversasTotal.toFixed(2)} h</td>
                  <td className="px-2 py-2 text-right text-emerald-300 font-bold tabular-nums">Q {Math.round(ejecutado.cobroHorasAdversas).toLocaleString('es-GT')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Tabla: Presupuesto vs Comprado por rubro — interactiva.
          Semáforo en cantidades (instrucción Rodrigo 2026-04-22):
            🟢 verde:   faltante > 10 unidades (hay margen)
            🟡 amarillo: 0 ≤ faltante ≤ 10 (ojo, cerca del límite)
            🔴 rojo:    faltante < 0 (sobre-comprado) */}
      {presupuesto && (
        <div className="bg-[#0d1526] rounded-2xl border border-white/5 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/5 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">Presupuesto vs Comprado</h2>
            <span className="ml-auto text-[10px] text-slate-500">🟢 falta &gt;10 · 🟡 ≤10 · 🔴 sobre-comprado</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0a1020] text-[10px] text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Rubro</th>
                  <th className="text-right px-3 py-2 font-medium">Cot.</th>
                  <th className="text-right px-3 py-2 font-medium">Comprado</th>
                  <th className="text-right px-3 py-2 font-medium">Falta</th>
                  <th className="text-right px-3 py-2 font-medium">Q Presup.</th>
                  <th className="text-right px-3 py-2 font-medium">Q Comprado</th>
                  <th className="text-center px-3 py-2 font-medium">Estado</th>
                  <th className="text-center px-3 py-2 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {estadoPorRubro.map(r => {
                  const semaforo =
                    r.estado === 'rojo'     ? { dot: 'bg-red-500',    bg: 'bg-red-500/5',    textFaltante: 'text-red-400',    label: `+${Math.abs(r.faltante).toLocaleString('es-GT')}`, title: 'Sobre-comprado' } :
                    r.estado === 'amarillo' ? { dot: 'bg-amber-500',  bg: 'bg-amber-500/5',  textFaltante: 'text-amber-400',  label: `${r.faltante.toLocaleString('es-GT')}`,             title: 'Cerca del límite' } :
                                              { dot: 'bg-emerald-500',bg: '',                textFaltante: 'text-slate-400',  label: `${r.faltante.toLocaleString('es-GT')}`,             title: 'Con margen' }
                  const expandido = rubroExpandido === r.key
                  const comprasDeRubro = gastosExtras.filter(g => g.rubro === r.key)
                  const precioCotUnit = r.cantidadPresupuestada > 0 ? r.montoPresupuestado / r.cantidadPresupuestada : 0
                  return (
                    <Fragment key={r.key}>
                      <tr className={cn('hover:bg-white/2 cursor-pointer transition-colors',
                        r.estado !== 'verde' && semaforo.bg,
                        expandido && 'bg-white/5')}
                        onClick={() => setRubroExpandido(expandido ? null : r.key)}
                      >
                        <td className="px-4 py-2.5 text-slate-300">
                          <span className="flex items-center gap-1.5">
                            <ChevronDown className={cn('w-3.5 h-3.5 text-slate-600 transition-transform', expandido && 'rotate-180')} />
                            {r.nombre}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-500 tabular-nums">
                          {r.cantidadPresupuestada.toLocaleString('es-GT')} <span className="text-slate-600 text-[10px]">{r.unidad}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-300 tabular-nums">{r.cantidadComprada.toLocaleString('es-GT')}</td>
                        <td className={cn('px-3 py-2.5 text-right tabular-nums font-medium', semaforo.textFaltante)}>{semaforo.label}</td>
                        <td className="px-3 py-2.5 text-right text-slate-500 tabular-nums">{formatQ(r.montoPresupuestado)}</td>
                        <td className="px-3 py-2.5 text-right text-white font-medium tabular-nums">{formatQ(r.montoComprado)}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={cn('inline-block w-2.5 h-2.5 rounded-full', semaforo.dot)} title={semaforo.title} />
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={(ev) => {
                              ev.stopPropagation()
                              setForm(f => ({
                                ...f,
                                rubro: r.key,
                                producto: r.nombre,
                                unidad: r.unidad,
                                costoUnitario: precioCotUnit ? Math.round(precioCotUnit * 100) / 100 : 0,
                                cantidad: 1,
                              }))
                              setShowForm(true)
                            }}
                            title={`Agregar compra de ${r.nombre}`}
                            className="text-emerald-400 hover:text-emerald-300 p-1"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                      {expandido && (
                        <tr>
                          <td colSpan={8} className="p-0 bg-[#0a1020] border-y border-white/10">
                            <RubroExpand
                              rubro={r}
                              compras={comprasDeRubro}
                              precioCotUnit={precioCotUnit}
                              onAgregar={() => {
                                setForm(f => ({
                                  ...f,
                                  rubro: r.key,
                                  producto: r.nombre,
                                  unidad: r.unidad,
                                  costoUnitario: precioCotUnit ? Math.round(precioCotUnit * 100) / 100 : 0,
                                  cantidad: 1,
                                }))
                                setShowForm(true)
                              }}
                              onEliminar={handleEliminar}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-white/10 bg-white/3">
                  <td className="px-4 py-2.5 text-white font-bold">TOTAL</td>
                  <td colSpan={3} />
                  <td className="px-3 py-2.5 text-right text-white font-bold tabular-nums">{formatQ(presupuesto.total)}</td>
                  <td className="px-3 py-2.5 text-right text-white font-bold tabular-nums">
                    {formatQ(estadoPorRubro.reduce((a, r) => a + r.montoComprado, 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Tabla contable de compras */}
      {(() => {
        const hoy = new Date().toISOString().slice(0, 10)
        const enTresDias = (() => { const d = new Date(); d.setDate(d.getDate() + 3); return d.toISOString().slice(0, 10) })()
        const estaPagado = (g: GastoExtra) => g.pagado || g.diasCredito === 0
        const vencidos = gastosExtras.filter(g => !estaPagado(g) && g.fechaVencimiento && g.fechaVencimiento < hoy)
        const porVencer = gastosExtras.filter(g => !estaPagado(g) && g.fechaVencimiento >= hoy && g.fechaVencimiento <= enTresDias)
        const pendientesPago = gastosExtras.filter(g => !estaPagado(g) && g.diasCredito > 0)
        const totalPorPagar = pendientesPago.reduce((a, g) => a + g.monto, 0)
        return (
          <>
            {/* Alertas */}
            {(vencidos.length > 0 || porVencer.length > 0) && (
              <div className={cn('rounded-xl border p-3 flex items-start gap-2',
                vencidos.length > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30')}>
                <AlertTriangle className={cn('w-4 h-4 mt-0.5 shrink-0',
                  vencidos.length > 0 ? 'text-red-400' : 'text-amber-400')} />
                <div className="text-xs">
                  {vencidos.length > 0 && (
                    <p className="text-red-300">
                      <b>⚠ {vencidos.length} pago(s) VENCIDOS</b> — total {formatQ(vencidos.reduce((a, g) => a + g.monto, 0))}
                    </p>
                  )}
                  {porVencer.length > 0 && (
                    <p className={vencidos.length > 0 ? 'text-amber-300 mt-1' : 'text-amber-300'}>
                      {porVencer.length} pago(s) vencen en ≤ 3 días — {formatQ(porVencer.reduce((a, g) => a + g.monto, 0))}
                    </p>
                  )}
                </div>
              </div>
            )}

      <div className="bg-[#0d1526] rounded-2xl border border-white/5 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Libro de Compras</h2>
            <span className="text-[11px] text-slate-500">({gastosExtras.length})</span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-slate-500">
              Por pagar: <b className="text-amber-400 tabular-nums">{formatQ(totalPorPagar)}</b>
            </span>
            <button onClick={() => setShowForm(true)}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Registrar compra
            </button>
          </div>
        </div>
        {gastosExtras.length === 0 ? (
          <div className="py-10 flex flex-col items-center text-slate-600">
            <ClipboardList className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm text-slate-500">Sin compras registradas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0a1020] text-[10px] text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Fecha</th>
                  <th className="text-left px-3 py-2 font-medium">Producto</th>
                  <th className="text-left px-3 py-2 font-medium">Proveedor</th>
                  <th className="text-right px-2 py-2 font-medium">Cant.</th>
                  <th className="text-right px-2 py-2 font-medium">Costo u.</th>
                  <th className="text-right px-2 py-2 font-medium">Venta u.</th>
                  <th className="text-right px-2 py-2 font-medium">Total</th>
                  <th className="text-center px-2 py-2 font-medium">Crédito</th>
                  <th className="text-center px-2 py-2 font-medium">Vence</th>
                  <th className="text-center px-2 py-2 font-medium">Estado</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {gastosExtras.map(g => {
                  const pagadoVisual = estaPagado(g)
                  const esVencido = !pagadoVisual && g.fechaVencimiento && g.fechaVencimiento < hoy
                  const esPorVencer = !pagadoVisual && g.fechaVencimiento >= hoy && g.fechaVencimiento <= enTresDias
                  const producto = g.producto || g.concepto || ''
                  const costoU = g.costoUnitario || g.montoUnit || 0
                  return (
                    <tr key={g.id} className={cn('hover:bg-white/2',
                      esVencido && 'bg-red-500/5',
                      esPorVencer && !esVencido && 'bg-amber-500/5')}>
                      <td className="px-3 py-2 text-slate-500 text-xs tabular-nums whitespace-nowrap">{g.fecha}</td>
                      <td className="px-3 py-2 text-slate-200">
                        <p className="font-medium">{producto}</p>
                        {g.descripcion && <p className="text-[10px] text-slate-600 truncate max-w-[220px]">{g.descripcion}</p>}
                        <p className="text-[9px] text-slate-700 capitalize">{g.rubro}</p>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-400 max-w-[140px] truncate">{g.proveedor || '—'}</td>
                      <td className="px-2 py-2 text-right text-slate-400 tabular-nums text-xs">{g.cantidad} {g.unidad}</td>
                      <td className="px-2 py-2 text-right text-slate-300 tabular-nums">{formatQ(costoU)}</td>
                      <td className="px-2 py-2 text-right text-slate-500 tabular-nums text-xs">{g.valorUnitario > 0 ? formatQ(g.valorUnitario) : '—'}</td>
                      <td className="px-2 py-2 text-right text-white font-semibold tabular-nums">{formatQ(g.monto)}</td>
                      <td className="px-2 py-2 text-center text-xs text-slate-400">{g.diasCredito > 0 ? `${g.diasCredito}d` : 'Contado'}</td>
                      <td className={cn('px-2 py-2 text-center text-xs tabular-nums',
                        esVencido ? 'text-red-400 font-bold' : esPorVencer ? 'text-amber-400 font-semibold' : 'text-slate-500')}>
                        {g.fechaVencimiento || '—'}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {pagadoVisual
                          ? <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded">Pagado</span>
                          : esVencido
                            ? <span className="text-[10px] bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded">Vencido</span>
                            : esPorVencer
                              ? <span className="text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded">Por vencer</span>
                              : <span className="text-[10px] bg-slate-500/15 text-slate-400 px-1.5 py-0.5 rounded">Pendiente</span>}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button onClick={() => handleEliminar(g.id)} className="text-slate-500 hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-white/10 bg-white/3">
                  <td colSpan={6} className="px-3 py-2.5 text-white font-bold text-right">TOTAL COMPRAS</td>
                  <td className="px-2 py-2.5 text-right text-amber-400 font-bold tabular-nums">{formatQ(totalExtras)}</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
          </>
        )
      })()}

      {/* Split 70/30 — desglose claro de bentonita: comprado / cliente / mi reserva / consumido / disponible */}
      <SplitBentonitaWidget proyectoId={data.proyecto.id} />

      {/* Inventario del proyecto (reservas + movimientos) */}
      {reservas.length > 0 && (
        <div className="bg-[#0d1526] rounded-2xl border border-white/5 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/5 flex items-center gap-2">
            <Package className="w-4 h-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white">Inventario del proyecto</h2>
            <span className="text-[11px] text-slate-500 ml-auto">Reservado: <b className="text-violet-400">{formatQ(valorReservado)}</b> · Ventas externas: <b className="text-emerald-400">{formatQ(ventasExternas)}</b></span>
          </div>
          <div className="divide-y divide-white/5">
            {reservas.map(r => (
              <div key={r.id} className="px-5 py-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">{r.producto}</span>
                  <span className="text-sm font-semibold text-white tabular-nums">
                    {r.cantidadActual}<span className="text-slate-500"> / {r.cantidadOriginal}</span> {r.unidad}
                  </span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded capitalize',
                    r.estado === 'agotado' ? 'bg-red-500/15 text-red-400'
                      : r.estado === 'disponible' ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-amber-500/15 text-amber-400')}>
                    {r.estado}
                  </span>
                  <span className="text-xs text-slate-500 ml-auto tabular-nums">
                    Venta sugerida: <b className="text-slate-300">{formatQ(r.precioVentaSugerido)}/{r.unidad}</b>
                  </span>
                  {r.cantidadActual > 0 && (
                    <button onClick={() => {
                      setShowVenta(r.id)
                      setVentaForm({ cantidad: 0, precioUnit: r.precioVentaSugerido, cliente: '', nota: '' })
                    }}
                      className="text-[10px] border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:text-emerald-200 px-2 py-1 rounded flex items-center gap-1">
                      <ShoppingCart className="w-3 h-3" /> Venta externa
                    </button>
                  )}
                </div>
                {movimientos.filter(m => m.reservaId === r.id).length > 0 && (
                  <div className="mt-2 pl-2 border-l-2 border-white/5 space-y-1">
                    {movimientos.filter(m => m.reservaId === r.id).slice(0, 5).map(m => {
                      const esSalida = ['venta_externa', 'consumo_bitacora', 'liberacion_proyecto'].includes(m.tipo)
                      const cantidadAbs = Math.abs(m.cantidad)
                      return (
                      <div key={m.id} className="text-[11px] text-slate-500 flex items-center gap-2">
                        <span className={cn('text-[9px] uppercase px-1 rounded',
                          m.tipo === 'venta_externa' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400')}>
                          {m.tipo.replace('_', ' ')}
                        </span>
                        <span>{esSalida ? '-' : '+'}{cantidadAbs} {r.unidad}</span>
                        <span className="text-slate-600">·</span>
                        <span className="text-emerald-400 tabular-nums">{formatQ(Math.abs(m.monto))}</span>
                        {m.cliente && <span className="text-slate-600">· {m.cliente}</span>}
                        <span className="ml-auto text-slate-700">{new Date(m.createdAt).toLocaleDateString('es-GT')}</span>
                      </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sección "Registro de avances" removida: la bitácora tiene su propio módulo
          en /proyectos/[id]. Control de Gastos es independiente (solo finanzas). */}

      {/* Modal: venta externa del inventario */}
      {showVenta && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1526] rounded-2xl border border-white/10 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-400" /> Registrar Venta Externa
              </h3>
              <button onClick={() => setShowVenta(null)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {(() => {
                const r = reservas.find(x => x.id === showVenta)
                if (!r) return null
                return (
                  <p className="text-xs text-slate-400">
                    Disponible: <b className="text-white">{r.cantidadActual} {r.unidad}</b> de {r.producto}
                  </p>
                )
              })()}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase mb-1 block">Cantidad</label>
                  <input type="number" step="1" min={0} value={ventaForm.cantidad}
                    onChange={e => setVentaForm({ ...ventaForm, cantidad: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white tabular-nums" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase mb-1 block">Precio/unidad (Q)</label>
                  <input type="number" step="1" min={0} value={ventaForm.precioUnit}
                    onChange={e => setVentaForm({ ...ventaForm, precioUnit: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white tabular-nums" />
                </div>
              </div>
              <p className="text-[10px] text-slate-500">Total: <b className="text-emerald-400">{formatQ(ventaForm.cantidad * ventaForm.precioUnit)}</b></p>
              <div>
                <label className="text-[10px] text-slate-500 uppercase mb-1 block">Cliente</label>
                <input value={ventaForm.cliente} onChange={e => setVentaForm({ ...ventaForm, cliente: e.target.value })}
                  placeholder="Nombre del comprador"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase mb-1 block">Nota</label>
                <textarea value={ventaForm.nota} onChange={e => setVentaForm({ ...ventaForm, nota: e.target.value })} rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 resize-none" />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-white/5 flex items-center justify-end gap-2">
              <button onClick={() => setShowVenta(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-white/10 rounded-lg">
                Cancelar
              </button>
              <button onClick={handleVentaExterna} disabled={saving || ventaForm.cantidad <= 0}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Registrar venta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: nuevo gasto (libro contable) */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1526] rounded-2xl border border-white/10 w-full max-w-2xl shadow-2xl max-h-[92vh] overflow-auto">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 sticky top-0 bg-[#0d1526] z-10">
              <h3 className="text-sm font-semibold text-white">Registrar Compra</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[10px] text-slate-500 uppercase mb-1 block">Producto *</label>
                <input value={form.producto} onChange={e => setForm({ ...form, producto: e.target.value })}
                  placeholder="Ej: Bolsa bentonita 50kg"
                  className="w-full bg-white/5 border border-blue-500/30 rounded-lg px-3 py-2 text-base font-semibold text-white placeholder:text-slate-600 focus:border-blue-500/50 outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] text-slate-500 uppercase mb-1 block">Descripción</label>
                <input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })}
                  placeholder="Detalle opcional"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-blue-500/50 outline-none" />
              </div>

              <div>
                <label className="text-[10px] text-slate-500 uppercase mb-1 block">Fecha de compra</label>
                <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })}
                  style={{ colorScheme: 'dark' }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase mb-1 block">Rubro</label>
                {(() => {
                  // Si el rubro corresponde a un rubro del presupuesto → mostrar read-only
                  const rubroPresup = presupuesto?.rubros.find(rr => rr.key === form.rubro)
                  if (rubroPresup) {
                    return (
                      <div className="w-full bg-emerald-500/5 border border-emerald-500/30 rounded-lg px-3 py-2 text-sm text-emerald-300 flex items-center justify-between">
                        <span>{rubroPresup.nombre}</span>
                        <span className="text-[10px] text-slate-500">vinculado a cotización</span>
                      </div>
                    )
                  }
                  // Si no, es un gasto imprevisto — permitir elegir entre categorías libres
                  return (
                    <select value={form.rubro} onChange={e => setForm({ ...form, rubro: e.target.value })}
                      style={{ colorScheme: 'dark' }}
                      className="w-full bg-amber-500/5 border border-amber-500/30 rounded-lg px-3 py-2 text-sm text-amber-300 appearance-none">
                      {RUBRO_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-[#0d1526]">{o.label}</option>)}
                    </select>
                  )
                })()}
              </div>

              <div>
                <label className="text-[10px] text-slate-500 uppercase mb-1 block">Cantidad</label>
                <input type="number" step="0.01" min={0} value={form.cantidad} onChange={e => setForm({ ...form, cantidad: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white tabular-nums" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase mb-1 block">Unidad</label>
                <input value={form.unidad} onChange={e => setForm({ ...form, unidad: e.target.value })}
                  placeholder="Ej: Saco, Pipa, Global"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600" />
              </div>

              <div>
                <label className="text-[10px] text-slate-500 uppercase mb-1 block">Costo unitario (Q)</label>
                <input type="number" step="0.01" min={0} value={form.costoUnitario}
                  onChange={e => setForm({ ...form, costoUnitario: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white tabular-nums" />
                <p className="text-[10px] text-slate-500 mt-1">Lo que paga la empresa</p>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase mb-1 block">Valor unitario venta (Q)</label>
                <input type="number" step="0.01" min={0} value={form.valorUnitario}
                  onChange={e => setForm({ ...form, valorUnitario: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white tabular-nums" />
                <p className="text-[10px] text-slate-500 mt-1">Referencia precio al cliente</p>
              </div>

              <div className="sm:col-span-2 bg-white/3 rounded-lg border border-white/5 px-3 py-2.5 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Total compra</span>
                <span className="text-base font-bold text-white tabular-nums">{formatQ(form.cantidad * form.costoUnitario)}</span>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 uppercase mb-1 block">Días de crédito</label>
                <input type="number" step="1" min={0} value={form.diasCredito}
                  onChange={e => setForm({ ...form, diasCredito: parseInt(e.target.value) || 0 })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white tabular-nums" />
                <p className="text-[10px] text-slate-500 mt-1">0 = contado</p>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase mb-1 block">Proveedor</label>
                <input value={form.proveedor} onChange={e => setForm({ ...form, proveedor: e.target.value })}
                  placeholder="Nombre del proveedor"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600" />
              </div>

              {form.diasCredito > 0 && (
                <div className="sm:col-span-2 bg-amber-500/5 rounded-lg border border-amber-500/20 px-3 py-2 flex items-center gap-2 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-slate-300">Vence el <b className="text-amber-300">{(() => {
                    const d = new Date(form.fecha + 'T12:00:00')
                    d.setDate(d.getDate() + form.diasCredito)
                    return d.toISOString().slice(0, 10)
                  })()}</b></span>
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="text-[10px] text-slate-500 uppercase mb-1 block">Nota interna</label>
                <textarea value={form.nota} onChange={e => setForm({ ...form, nota: e.target.value })} rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 resize-none" />
              </div>

              <label className="sm:col-span-2 flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.diasCredito === 0 ? true : form.pagado}
                  disabled={form.diasCredito === 0}
                  onChange={e => setForm({ ...form, pagado: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 disabled:opacity-60" />
                <span className="text-xs text-slate-300">
                  {form.diasCredito === 0 ? 'Contado: se guarda como pagado' : 'Ya pagado al proveedor'}
                </span>
              </label>
            </div>
            <div className="px-5 py-3 border-t border-white/5 flex items-center justify-end gap-2 sticky bottom-0 bg-[#0d1526]">
              <button onClick={() => setShowForm(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-white/10 rounded-lg">
                Cancelar
              </button>
              <button onClick={handleGuardar} disabled={!form.producto.trim() || saving}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Guardar compra
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KPI({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub: string;
  color: 'blue' | 'violet' | 'emerald' | 'amber' | 'red'
}) {
  const cls = {
    blue:    'border-blue-500/15 bg-blue-500/5',
    violet:  'border-violet-500/15 bg-violet-500/5',
    emerald: 'border-emerald-500/15 bg-emerald-500/5',
    amber:   'border-amber-500/20 bg-amber-500/8',
    red:     'border-red-500/25 bg-red-500/10',
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

// ── Widget Split 70/30 — desglose visual claro de bentonita ─────────────────
// Muestra: comprado total / cliente / mi reserva / consumido / disponible
// Llama al endpoint /api/proyectos/[id]/inventario-status
interface InvStatus {
  bentonita: {
    comprado_total: number
    entregado_cliente: number
    mi_reserva_inicial: number
    consumido_obra: number
    ventas_externas: number
    disponible: number
    costo_unitario: number
    valor_disponible: number
    valor_reserva_inicial: number
    consumos_internos_registrados: number
  } | null
  pipas: {
    presupuestado: number
    comprado_total: number
    valor_comprado: number
    costo_promedio: number
    consumido_obra: number
    disponible: number
    valor_disponible: number
    compras_count: number
  }
}

function SplitBentonitaWidget({ proyectoId }: { proyectoId: string }) {
  const [data, setData] = useState<InvStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/proyectos/${proyectoId}/inventario-status`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [proyectoId])

  if (loading) return null
  if (!data) return null

  return (
    <div className="space-y-4">
      {data.bentonita && <BentonitaCard b={data.bentonita} />}
      {data.pipas && data.pipas.presupuestado > 0 && <PipasCard p={data.pipas} />}
    </div>
  )
}

function BentonitaCard({ b }: { b: NonNullable<InvStatus['bentonita']> }) {
  const pctUsado = b.comprado_total > 0
    ? Math.min(100, Math.round((b.consumido_obra / b.comprado_total) * 100))
    : 0
  return (
    <div className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-2xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-amber-500/15 flex items-center gap-2 flex-wrap">
        <span className="text-lg">🧪</span>
        <h2 className="text-sm font-semibold text-white">Bentonita · Compradas vs Usadas</h2>
        <span className="text-[10px] text-slate-500 ml-auto">Split 70/30 · cliente ve 70%, 30% tu reserva</span>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
          <SplitChip label="Plan total" value={b.comprado_total}    unit="sacos" color="slate"   />
          <SplitChip label="Cliente paga (70%)" value={b.entregado_cliente} unit="sacos" color="blue"    />
          <SplitChip label="Usadas en obra"     value={b.consumido_obra}    unit={`sacos · ${pctUsado}%`} color="orange"  />
          <SplitChip label="Reserva disponible"   value={b.disponible}        unit="sacos" color="emerald" accent />
        </div>
        <div className="border-t border-amber-500/10 pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Mi reserva (30%)</p>
            <p className="text-sm font-bold text-amber-300 tabular-nums">{b.mi_reserva_inicial} sacos</p>
            <p className="text-[10px] text-slate-600">valor Q{Math.round(b.valor_reserva_inicial).toLocaleString('es-GT')} · costo Q{Math.round(b.costo_unitario)}/saco</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Valor disponible</p>
            <p className="text-sm font-bold text-emerald-300 tabular-nums">{`Q ${Math.round(b.valor_disponible).toLocaleString('es-GT')}`}</p>
            <p className="text-[10px] text-slate-600">{b.disponible} sacos × Q{Math.round(b.costo_unitario)}/saco</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Ventas externas</p>
            <p className="text-sm font-bold text-violet-300 tabular-nums">{b.ventas_externas} sacos</p>
            <p className="text-[10px] text-slate-600">del 30% reservado vendido a externos</p>
          </div>
        </div>
        <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
          💡 Al cliente se le cobra el 70% (Q535.71/saco) pero compras el 100%. La reserva solo baja cuando la bitácora supera los sacos cubiertos por el cliente; si no, sigue disponible para venta externa o para otro proyecto.
        </p>
      </div>
    </div>
  )
}

function PipasCard({ p }: { p: InvStatus['pipas'] }) {
  const pctUsado = p.comprado_total > 0
    ? Math.min(100, Math.round((p.consumido_obra / p.comprado_total) * 100))
    : 0
  const faltanteVsPresup = p.presupuestado - p.comprado_total
  const alertaCompra = p.comprado_total > p.presupuestado   // compré de más que lo presupuestado
  return (
    <div className="bg-gradient-to-br from-cyan-500/5 to-blue-500/5 border border-cyan-500/20 rounded-2xl overflow-hidden">
      <div className="px-5 py-3.5 border-b border-cyan-500/15 flex items-center gap-2 flex-wrap">
        <span className="text-lg">💧</span>
        <h2 className="text-sm font-semibold text-white">Pipas de agua · Compradas vs Usadas</h2>
        <span className="text-[10px] text-slate-500 ml-auto">Tracking físico de pipas del proyecto</span>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
          <SplitChip label="Presup. cotización" value={p.presupuestado}  unit="pipas" color="slate"   />
          <SplitChip label={alertaCompra ? '⚠ Comprado total' : 'Comprado total'}
                     value={p.comprado_total}   unit={p.compras_count > 0 ? `en ${p.compras_count} compra(s)` : 'pipas'}
                     color={alertaCompra ? 'orange' : 'blue'}    accent={alertaCompra} />
          <SplitChip label="Usadas en obra"     value={p.consumido_obra} unit={`pipas · ${pctUsado}%`} color="orange"  />
          <SplitChip label="Disponible ahora"   value={p.disponible}     unit="pipas" color="emerald" accent />
        </div>
        <div className="border-t border-cyan-500/10 pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Total gastado en pipas</p>
            <p className="text-sm font-bold text-cyan-300 tabular-nums">{`Q ${p.valor_comprado.toLocaleString('es-GT')}`}</p>
            <p className="text-[10px] text-slate-600">costo promedio Q{p.costo_promedio.toFixed(2)}/pipa</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Valor disponible</p>
            <p className="text-sm font-bold text-emerald-300 tabular-nums">{`Q ${p.valor_disponible.toLocaleString('es-GT')}`}</p>
            <p className="text-[10px] text-slate-600">{p.disponible} pipas × Q{p.costo_promedio.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Vs cotización</p>
            <p className={cn('text-sm font-bold tabular-nums',
              faltanteVsPresup > 0  ? 'text-blue-300' :
              faltanteVsPresup === 0 ? 'text-emerald-300' :
                                       'text-amber-300')}>
              {faltanteVsPresup > 0 ? `faltan ${faltanteVsPresup}` :
               faltanteVsPresup === 0 ? '✓ justo' :
               `+${Math.abs(faltanteVsPresup)} de más`}
            </p>
            <p className="text-[10px] text-slate-600">presup {p.presupuestado} · comprado {p.comprado_total}</p>
          </div>
        </div>
        <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
          💡 Registra compras de pipas con el botón [+] del rubro &quot;Pipas de agua&quot; en la tabla Presupuesto vs Comprado.
          El consumo real lo descuenta la bitácora automáticamente.
        </p>
      </div>
    </div>
  )
}

function SplitChip({
  label, value, unit, color, accent,
}: {
  label: string
  value: number
  unit: string
  color: 'slate' | 'blue' | 'amber' | 'orange' | 'emerald'
  accent?: boolean
}) {
  const cls = {
    slate:   'border-slate-500/30  bg-slate-500/5  text-slate-300',
    blue:    'border-blue-500/30   bg-blue-500/5   text-blue-300',
    amber:   'border-amber-500/40  bg-amber-500/10 text-amber-300',
    orange:  'border-orange-500/40 bg-orange-500/10 text-orange-300',
    emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  }[color]
  return (
    <div className={cn('rounded-xl border p-2.5 flex flex-col items-center justify-center text-center', cls, accent && 'ring-1 ring-current/30')}>
      <p className="text-[9px] uppercase tracking-wider opacity-70 mb-0.5 leading-tight">{label}</p>
      <p className="text-lg font-black tabular-nums leading-none">{value.toLocaleString('es-GT')}</p>
      <p className="text-[9px] opacity-60 mt-0.5">{unit}</p>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// RubroExpand — panel desplegable por rubro con:
// · Resumen comparativo (precio cot · promedio comprado · total gastado)
// · Gráfica de línea (precios de compras vs referencia cotización)
// · Tabla de compras con variación % vs cotización
// · Botón para agregar nueva compra
// ══════════════════════════════════════════════════════════════════════════
function RubroExpand({ rubro, compras, precioCotUnit, onAgregar, onEliminar }: {
  rubro: EstadoRubro
  compras: GastoExtra[]
  precioCotUnit: number
  onAgregar: () => void
  onEliminar: (id: string) => void
}) {
  const comprasOrdenadas = [...compras].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const cantTotal  = comprasOrdenadas.reduce((a, c) => a + c.cantidad, 0)
  const montoTotal = comprasOrdenadas.reduce((a, c) => a + c.cantidad * c.costoUnitario, 0)
  const promedio   = cantTotal > 0 ? montoTotal / cantTotal : 0
  const deltaPromedioQ   = promedio - precioCotUnit
  const deltaPromedioPct = precioCotUnit > 0 ? (deltaPromedioQ / precioCotUnit) * 100 : 0

  const chartData = comprasOrdenadas.map(c => ({
    fecha: c.fecha.slice(5),  // MM-DD
    precio: Math.round(c.costoUnitario * 100) / 100,
  }))

  const colorDelta = deltaPromedioQ > 0 ? 'text-amber-400' : deltaPromedioQ < 0 ? 'text-emerald-400' : 'text-slate-400'

  return (
    <div className="p-4 space-y-4">
      {/* Resumen arriba */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2.5">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Costo cotización</p>
          <p className="text-lg font-bold text-blue-300 tabular-nums">Q {precioCotUnit.toFixed(2)}</p>
          <p className="text-[10px] text-slate-600">por {rubro.unidad} (referencia)</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/3 px-3 py-2.5">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Promedio comprado</p>
          <p className="text-lg font-bold text-white tabular-nums">Q {promedio.toFixed(2)}</p>
          <p className={cn('text-[10px] font-medium', colorDelta)}>
            {deltaPromedioQ === 0 ? '— igual a cot.' :
              (deltaPromedioQ > 0 ? '⚠ +' : '✓ ') + `Q ${deltaPromedioQ.toFixed(2)} (${deltaPromedioQ > 0 ? '+' : ''}${deltaPromedioPct.toFixed(1)}%)`}
          </p>
        </div>
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2.5">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total gastado</p>
          <p className="text-lg font-bold text-violet-300 tabular-nums">Q {Math.round(montoTotal).toLocaleString('es-GT')}</p>
          <p className="text-[10px] text-slate-600">{cantTotal.toLocaleString('es-GT')} {rubro.unidad} · {comprasOrdenadas.length} compra(s)</p>
        </div>
      </div>

      {/* Gráfica comparativa */}
      {chartData.length > 0 && (
        <div className="rounded-lg border border-white/10 bg-white/2 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-300">Variación de precio por compra</p>
            <span className="text-[10px] text-slate-500">línea azul = costo cotización Q{precioCotUnit.toFixed(2)}</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <XAxis dataKey="fecha" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#0f1829', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, fontSize: 12, color: '#e2e8f0' }}
                formatter={(v) => [`Q ${Number(v ?? 0).toFixed(2)}`, 'precio']}
              />
              <ReferenceLine y={precioCotUnit} stroke="#3b82f6" strokeDasharray="4 4" label={{ value: `Cot Q${precioCotUnit.toFixed(0)}`, fill: '#60a5fa', fontSize: 10, position: 'right' }} />
              <Line
                type="monotone"
                dataKey="precio"
                stroke="#a78bfa"
                strokeWidth={2}
                dot={(props: { cx?: number; cy?: number; payload?: { precio: number } }) => {
                  const { cx, cy, payload } = props
                  const p = payload?.precio ?? 0
                  const fill = p > precioCotUnit ? '#f59e0b' : p < precioCotUnit ? '#10b981' : '#a78bfa'
                  return <Dot key={`${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={fill} stroke={fill} />
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabla historial */}
      <div className="rounded-lg border border-white/10 overflow-hidden">
        <div className="px-3 py-2 border-b border-white/5 bg-white/3 flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-300">Historial de compras</p>
          <button onClick={onAgregar}
            className="flex items-center gap-1 text-[11px] bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 px-2 py-1 rounded-md transition-colors">
            <Plus className="w-3 h-3" /> Agregar compra
          </button>
        </div>
        {comprasOrdenadas.length === 0 ? (
          <p className="px-3 py-4 text-xs text-slate-500 text-center">Sin compras registradas para este rubro</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-[#0a1020] text-[10px] text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-1.5 font-medium">Fecha</th>
                <th className="text-right px-2 py-1.5 font-medium">Cant</th>
                <th className="text-right px-2 py-1.5 font-medium">Precio/u</th>
                <th className="text-right px-2 py-1.5 font-medium">Total</th>
                <th className="text-right px-2 py-1.5 font-medium">Δ vs cot.</th>
                <th className="text-left px-3 py-1.5 font-medium">Proveedor</th>
                <th className="text-center px-2 py-1.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {comprasOrdenadas.map(c => {
                const variacionQ = c.costoUnitario - precioCotUnit
                const variacionPct = precioCotUnit > 0 ? (variacionQ / precioCotUnit) * 100 : 0
                const cls = Math.abs(variacionPct) < 1 ? 'text-slate-400' : variacionQ > 0 ? 'text-amber-400' : 'text-emerald-400'
                const icon = Math.abs(variacionPct) < 1 ? '—' : variacionQ > 0 ? '⚠' : '✓'
                return (
                  <tr key={c.id} className="hover:bg-white/2">
                    <td className="px-3 py-1.5 text-slate-400">{c.fecha}</td>
                    <td className="px-2 py-1.5 text-right text-slate-300 tabular-nums">{c.cantidad}</td>
                    <td className="px-2 py-1.5 text-right text-white tabular-nums font-medium">Q {c.costoUnitario.toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-right text-slate-300 tabular-nums">Q {Math.round(c.cantidad * c.costoUnitario).toLocaleString('es-GT')}</td>
                    <td className={cn('px-2 py-1.5 text-right tabular-nums', cls)}>
                      {icon} {variacionQ === 0 ? 'igual' : `${variacionQ > 0 ? '+' : ''}${variacionPct.toFixed(1)}%`}
                    </td>
                    <td className="px-3 py-1.5 text-slate-400 text-[11px] truncate max-w-[120px]">{c.proveedor || '—'}</td>
                    <td className="px-2 py-1.5 text-center">
                      <button onClick={() => onEliminar(c.id)} title="Eliminar compra"
                        className="text-slate-600 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
