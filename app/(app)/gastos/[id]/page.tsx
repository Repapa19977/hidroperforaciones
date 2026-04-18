'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Trash2, AlertCircle, RefreshCw, ClipboardList, TrendingUp,
  Wallet, CheckCircle, AlertTriangle, X, Save, Loader2, Package, ShoppingCart,
  CalendarPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
  triggerActivado: boolean
}

interface Data {
  proyecto: DetalleProyecto
  presupuesto: Presupuesto | null
  ejecutado: Ejecutado | null
  gastosExtras: GastoExtra[]
  totalExtras: number
  totalEjecutadoMasExtras: number
  desviacionQ: number
  avancePct: number
  reservas: Reserva[]
  movimientos: Movimiento[]
  valorReservado: number
  ventasExternas: number
  entradasBitacora: EntradaBitacora[]
  cronograma: Cronograma
}

const formatQ = (n: number) => `Q ${Math.round(n).toLocaleString('es-GT')}`

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
  // Modal registrar avance (crea entrada de bitácora)
  const [showAvance, setShowAvance] = useState(false)
  const [avanceForm, setAvanceForm] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    turno: 'dia',
    estado: 'activo',
    perforacionDia: 0,
    bentonitaSacos: 0,
    pipas: 0,
    formacionGeologica: '',
    circulacionPct: 0,
    diaAdverso: false,
    notaCliente: '',
  })
  // Modal venta externa (del 30% reservado)
  const [showVenta, setShowVenta] = useState<string | null>(null)  // reservaId
  const [ventaForm, setVentaForm] = useState({
    cantidad: 0,
    precioUnit: 0,
    cliente: '',
    nota: '',
  })

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(`/api/proyectos/${id}/control-gastos`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [id])

  async function handleGuardar() {
    if (!form.producto.trim()) return
    setSaving(true)
    try {
      await fetch(`/api/proyectos/${id}/control-gastos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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

  async function handleGuardarAvance() {
    if (avanceForm.perforacionDia <= 0 && avanceForm.estado === 'activo') return
    setSaving(true)
    try {
      // Auto-marcar adverso si < 20 pies en día activo
      const diaAdverso = avanceForm.estado === 'activo' && avanceForm.perforacionDia < 20 && avanceForm.perforacionDia > 0
      await fetch(`/api/proyectos/${id}/bitacora`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...avanceForm,
          diaAdverso: avanceForm.diaAdverso || diaAdverso,
        }),
      })
      setShowAvance(false)
      setAvanceForm({
        fecha: new Date().toISOString().slice(0, 10), turno: 'dia', estado: 'activo',
        perforacionDia: 0, bentonitaSacos: 0, pipas: 0,
        formacionGeologica: '', circulacionPct: 0,
        diaAdverso: false, notaCliente: '',
      })
      await load()
    } finally { setSaving(false) }
  }

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

  const { proyecto, presupuesto, ejecutado, gastosExtras, totalExtras, totalEjecutadoMasExtras, desviacionQ, avancePct, reservas, movimientos, valorReservado, ventasExternas, entradasBitacora, cronograma } = data
  const pctEjecutado = presupuesto && presupuesto.total > 0 ? (totalEjecutadoMasExtras / presupuesto.total) * 100 : 0

  // Join rubros presupuesto+ejecutado por key
  const rubrosJoinedMap = new Map<string, { p: PresupuestoRubro; e: EjecutadoRubro | null }>()
  presupuesto?.rubros.forEach(p => { rubrosJoinedMap.set(p.key, { p, e: null }) })
  ejecutado?.rubros.forEach(e => {
    const entry = rubrosJoinedMap.get(e.key)
    if (entry) entry.e = e
  })
  const rubrosJoined = Array.from(rubrosJoinedMap.values())

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
          <button onClick={() => setShowAvance(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-xs font-medium shadow-lg shadow-emerald-500/20">
            <CalendarPlus className="w-3.5 h-3.5" /> Registrar Avance
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-xs font-medium shadow-lg shadow-blue-500/20">
            <Plus className="w-3.5 h-3.5" /> Gasto Extra
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

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={<TrendingUp className="w-4 h-4 text-blue-400" />}
          label="Avance físico" value={`${avancePct.toFixed(1)}%`}
          sub={`${ejecutado?.piesPerforadosTotal ?? 0} / ${presupuesto?.profundidad ?? 0} pies`} color="blue" />
        <KPI icon={<Wallet className="w-4 h-4 text-violet-400" />}
          label="Ejecutado" value={formatQ(totalEjecutadoMasExtras)}
          sub={presupuesto ? `${pctEjecutado.toFixed(0)}% del presupuesto` : '—'} color="violet" />
        <KPI icon={<ClipboardList className="w-4 h-4 text-amber-400" />}
          label="Gastos extras" value={formatQ(totalExtras)}
          sub={`${gastosExtras.length} registrado(s)`} color="amber" />
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

      {/* Horas adversas cobrables — se activan solo cuando perforación < 20 pies/día */}
      {ejecutado && ejecutado.horasAdversasTotal > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/25 rounded-xl p-4">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-300 mb-0.5">Horas adversas cobrables al cliente</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Días con menos de 20 pies. Según la cotización, estas horas son cobrables a Q 500/hora (rendimiento mínimo 2.5 pies/h en turno de 8h).
              </p>
            </div>
          </div>

          {/* Totales */}
          <div className="grid grid-cols-3 gap-3 mb-3 pb-3 border-b border-amber-500/20">
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

      {/* Tabla: Presupuesto vs Ejecutado por rubro */}
      {presupuesto && (
        <div className="bg-[#0d1526] rounded-2xl border border-white/5 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/5 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">Presupuesto vs Ejecutado</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0a1020] text-[10px] text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Rubro</th>
                  <th className="text-right px-3 py-2 font-medium">Presup.</th>
                  <th className="text-right px-3 py-2 font-medium">Ejec.</th>
                  <th className="text-right px-3 py-2 font-medium">Q Presup.</th>
                  <th className="text-right px-3 py-2 font-medium">Q Ejec.</th>
                  <th className="text-right px-3 py-2 font-medium">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rubrosJoined.map(({ p, e }) => {
                  const pct = p.montoPresupuestado > 0 ? ((e?.montoGastado ?? 0) / p.montoPresupuestado) * 100 : 0
                  const color = pct >= 100 ? 'text-red-400' : pct >= 90 ? 'text-amber-400' : pct > 0 ? 'text-emerald-400' : 'text-slate-500'
                  return (
                    <tr key={p.key} className="hover:bg-white/2">
                      <td className="px-4 py-2.5 text-slate-300">{p.nombre}</td>
                      <td className="px-3 py-2.5 text-right text-slate-500 tabular-nums">{p.cantidadPresupuestada.toLocaleString('es-GT')} {p.unidad}</td>
                      <td className="px-3 py-2.5 text-right text-slate-300 tabular-nums">{(e?.cantidadConsumida ?? 0).toLocaleString('es-GT')}</td>
                      <td className="px-3 py-2.5 text-right text-slate-500 tabular-nums">{formatQ(p.montoPresupuestado)}</td>
                      <td className="px-3 py-2.5 text-right text-white font-medium tabular-nums">{formatQ(e?.montoGastado ?? 0)}</td>
                      <td className={cn('px-3 py-2.5 text-right font-bold tabular-nums', color)}>{pct.toFixed(0)}%</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-white/10 bg-white/3">
                  <td className="px-4 py-2.5 text-white font-bold">TOTAL</td>
                  <td colSpan={2} />
                  <td className="px-3 py-2.5 text-right text-white font-bold tabular-nums">{formatQ(presupuesto.total)}</td>
                  <td className="px-3 py-2.5 text-right text-white font-bold tabular-nums">{formatQ((ejecutado?.total ?? 0))}</td>
                  <td className="px-3 py-2.5 text-right text-blue-400 font-bold tabular-nums">
                    {presupuesto.total > 0 ? (((ejecutado?.total ?? 0) / presupuesto.total) * 100).toFixed(0) : 0}%
                  </td>
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
        const vencidos = gastosExtras.filter(g => !g.pagado && g.fechaVencimiento && g.fechaVencimiento < hoy)
        const porVencer = gastosExtras.filter(g => !g.pagado && g.fechaVencimiento >= hoy && g.fechaVencimiento <= enTresDias)
        const pendientesPago = gastosExtras.filter(g => !g.pagado && g.diasCredito > 0)
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
                  const esVencido = !g.pagado && g.fechaVencimiento && g.fechaVencimiento < hoy
                  const esPorVencer = !g.pagado && g.fechaVencimiento >= hoy && g.fechaVencimiento <= enTresDias
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
                        {g.pagado
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
                    {movimientos.filter(m => m.reservaId === r.id).slice(0, 5).map(m => (
                      <div key={m.id} className="text-[11px] text-slate-500 flex items-center gap-2">
                        <span className={cn('text-[9px] uppercase px-1 rounded',
                          m.tipo === 'venta_externa' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400')}>
                          {m.tipo.replace('_', ' ')}
                        </span>
                        <span>−{m.cantidad} {r.unidad}</span>
                        <span className="text-slate-600">·</span>
                        <span className="text-emerald-400 tabular-nums">{formatQ(m.monto)}</span>
                        {m.cliente && <span className="text-slate-600">· {m.cliente}</span>}
                        <span className="ml-auto text-slate-700">{new Date(m.createdAt).toLocaleDateString('es-GT')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Registro de avances (entradas de bitácora) */}
      {entradasBitacora.length > 0 && (
        <div className="bg-[#0d1526] rounded-2xl border border-white/5 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/5 flex items-center gap-2">
            <CalendarPlus className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">Registro de avances ({entradasBitacora.length})</h2>
            <Link href={`/proyectos/${proyecto.id}`} className="ml-auto text-xs text-blue-400 hover:text-blue-300">Ver bitácora completa →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0a1020] text-[10px] text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Fecha</th>
                  <th className="text-right px-3 py-2 font-medium">Pies día</th>
                  <th className="text-right px-3 py-2 font-medium">Bentonita</th>
                  <th className="text-right px-3 py-2 font-medium">Pipas</th>
                  <th className="text-left px-3 py-2 font-medium">Formación</th>
                  <th className="text-right px-3 py-2 font-medium">Circ. %</th>
                  <th className="text-left px-3 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {entradasBitacora.slice(0, 10).map(e => (
                  <tr key={e.id} className="hover:bg-white/2">
                    <td className="px-4 py-2 text-slate-400 text-xs">{e.fecha}</td>
                    <td className={cn('px-3 py-2 text-right font-semibold tabular-nums',
                      e.perforacionDia === 0 ? 'text-slate-600'
                        : e.perforacionDia < 20 ? 'text-red-400'
                        : e.perforacionDia === 20 ? 'text-amber-400'
                        : 'text-emerald-400')}>
                      {e.perforacionDia > 0 ? e.perforacionDia.toFixed(1) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-300 tabular-nums">{e.bentonitaSacos > 0 ? e.bentonitaSacos : '—'}</td>
                    <td className="px-3 py-2 text-right text-slate-300 tabular-nums">{e.pipas > 0 ? e.pipas : '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-500 max-w-[220px] truncate" title={e.formacionGeologica}>
                      {e.formacionGeologica || '—'}
                    </td>
                    <td className={cn('px-3 py-2 text-right font-semibold tabular-nums text-xs',
                      e.circulacionPct >= 70 ? 'text-emerald-400'
                        : e.circulacionPct >= 40 ? 'text-amber-400'
                        : e.circulacionPct > 0 ? 'text-red-400'
                        : 'text-slate-600')}>
                      {e.circulacionPct > 0 ? `${e.circulacionPct}%` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {e.diaAdverso
                        ? <span className="text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded">adverso</span>
                        : <span className="text-[10px] text-slate-500">activo</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: registrar avance (crea entrada de bitácora) */}
      {showAvance && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d1526] rounded-2xl border border-white/10 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <CalendarPlus className="w-4 h-4 text-emerald-400" /> Registrar Avance del Día
              </h3>
              <button onClick={() => setShowAvance(false)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 uppercase mb-1 block">Fecha</label>
                  <input type="date" value={avanceForm.fecha} onChange={e => setAvanceForm({ ...avanceForm, fecha: e.target.value })}
                    style={{ colorScheme: 'dark' }}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase mb-1 block">Turno</label>
                  <select value={avanceForm.turno} onChange={e => setAvanceForm({ ...avanceForm, turno: e.target.value })}
                    style={{ colorScheme: 'dark' }}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white appearance-none">
                    <option value="dia" className="bg-[#0d1526]">Diurno</option>
                    <option value="noche" className="bg-[#0d1526]">Nocturno</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setAvanceForm({ ...avanceForm, estado: 'activo', diaAdverso: false })}
                  className={cn('px-3 py-2 rounded-lg text-xs font-medium border transition-colors',
                    avanceForm.estado === 'activo'
                      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
                      : 'border-white/10 text-slate-400')}>
                  Día Activo
                </button>
                <button
                  onClick={() => setAvanceForm({ ...avanceForm, estado: 'inactivo', diaAdverso: false, perforacionDia: 0 })}
                  className={cn('px-3 py-2 rounded-lg text-xs font-medium border transition-colors',
                    avanceForm.estado === 'inactivo'
                      ? 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                      : 'border-white/10 text-slate-400')}>
                  Día Inactivo
                </button>
              </div>
              {avanceForm.estado === 'activo' && (
                <>
                  {/* 1. Pies perforados del día (semáforo: <20 rojo, =20 amarillo, >20 verde) */}
                  <div>
                    {(() => {
                      const p = avanceForm.perforacionDia
                      const color = p === 0 ? { border: 'border-blue-500/30', bg: 'bg-white/5', text: 'text-white', chip: '', label: '' }
                        : p < 20 ? { border: 'border-red-500/60', bg: 'bg-red-500/10', text: 'text-red-300', chip: 'bg-red-500/20 text-red-300', label: '🔴 Adverso' }
                        : p === 20 ? { border: 'border-amber-500/60', bg: 'bg-amber-500/10', text: 'text-amber-200', chip: 'bg-amber-500/20 text-amber-300', label: '🟡 Mínimo exacto' }
                        : { border: 'border-emerald-500/60', bg: 'bg-emerald-500/10', text: 'text-emerald-200', chip: 'bg-emerald-500/20 text-emerald-300', label: '🟢 Día normal' }
                      return <>
                        <label className="text-[10px] text-slate-500 uppercase mb-1 flex items-center justify-between">
                          <span>1. Pies perforados hoy</span>
                          {color.label && <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-medium normal-case', color.chip)}>{color.label}</span>}
                        </label>
                        <input type="number" step="1" min={0} value={avanceForm.perforacionDia}
                          onChange={e => setAvanceForm({ ...avanceForm, perforacionDia: parseFloat(e.target.value) || 0 })}
                          className={cn('w-full rounded-lg px-3 py-2 text-base font-semibold tabular-nums border transition-colors',
                            color.bg, color.border, color.text)} />
                      </>
                    })()}
                  </div>

                  {/* 2 y 3. Consumos del día */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase mb-1 block">2. Bolsas bentonita</label>
                      <input type="number" step="1" min={0} value={avanceForm.bentonitaSacos}
                        onChange={e => setAvanceForm({ ...avanceForm, bentonitaSacos: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white tabular-nums" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase mb-1 block">3. Pipas de agua</label>
                      <input type="number" step="1" min={0} value={avanceForm.pipas}
                        onChange={e => setAvanceForm({ ...avanceForm, pipas: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white tabular-nums" />
                    </div>
                  </div>

                  {/* 4. Formación geológica */}
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase mb-1 block">4. Formación geológica</label>
                    <textarea value={avanceForm.formacionGeologica}
                      onChange={e => setAvanceForm({ ...avanceForm, formacionGeologica: e.target.value })}
                      rows={2}
                      placeholder="Ej: arcilla reactiva 30-45 m, roca caliza 45-60 m"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 resize-none" />
                  </div>

                  {/* 5. % Circulación */}
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase mb-1 block">5. % Circulación</label>
                    <div className="flex items-center gap-2">
                      <select value={avanceForm.circulacionPct}
                        onChange={e => setAvanceForm({ ...avanceForm, circulacionPct: parseInt(e.target.value) || 0 })}
                        style={{ colorScheme: 'dark' }}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white appearance-none cursor-pointer">
                        {[0,10,20,30,40,50,60,70,80,90,100].map(v => (
                          <option key={v} value={v} className="bg-[#0d1526]">{v}%</option>
                        ))}
                      </select>
                      <span className={cn('text-sm font-bold tabular-nums min-w-[50px] text-right',
                        avanceForm.circulacionPct >= 70 ? 'text-emerald-400'
                          : avanceForm.circulacionPct >= 40 ? 'text-amber-400'
                          : 'text-red-400')}>
                        {avanceForm.circulacionPct}%
                      </span>
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className="text-[10px] text-slate-500 uppercase mb-1 block">Nota para el cliente (opcional)</label>
                <textarea value={avanceForm.notaCliente} onChange={e => setAvanceForm({ ...avanceForm, notaCliente: e.target.value })} rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 resize-none" />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-white/5 flex items-center justify-end gap-2">
              <button onClick={() => setShowAvance(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white border border-white/10 rounded-lg">
                Cancelar
              </button>
              <button onClick={handleGuardarAvance} disabled={saving}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Guardar avance
              </button>
            </div>
          </div>
        </div>
      )}

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
                <select value={form.rubro} onChange={e => setForm({ ...form, rubro: e.target.value })}
                  style={{ colorScheme: 'dark' }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white appearance-none">
                  {RUBRO_OPTIONS.map(o => <option key={o.value} value={o.value} className="bg-[#0d1526]">{o.label}</option>)}
                </select>
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
                <input type="checkbox" checked={form.pagado} onChange={e => setForm({ ...form, pagado: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500" />
                <span className="text-xs text-slate-300">Ya pagado al proveedor</span>
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
