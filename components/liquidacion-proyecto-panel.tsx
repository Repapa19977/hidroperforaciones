'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calculator, FileDown, Lock, RefreshCw, Save, XCircle } from 'lucide-react'
import { cn, formatQ } from '@/lib/utils'
import { formatFechaDDMMYYYY } from '@/lib/date-format'
import { BalanceProyectoCard } from '@/components/balance-proyecto-card'
import { ProjectStatBox as StatBox } from '@/components/project-stat-box'
import type {
  BalanceProyecto,
  BalanceVariable,
  LiquidacionLinea,
  LiquidacionOrigen,
  LiquidacionResumen,
} from '@/lib/liquidacion-proyecto'

interface LiquidacionPayload {
  proyecto: {
    id: string
    correlativo: string
    cliente: string
    empresa: string
    nombre: string
    tipo: string
    monto: number
    estado: string
    vendedor: string
  }
  liquidacion: null | {
    id: string
    estado: 'borrador' | 'confirmada'
    fecha: string
    motivo: string
    confirmadoPor?: string
    confirmadoEn?: string
  }
  lineas: LiquidacionLinea[]
  resumen: LiquidacionResumen
  balance?: BalanceProyecto
  fuentes: {
    pagos: number
    gastos: number
    entradasBitacora: number
    tieneCotizacion: boolean
  }
}

function round2(n: number) {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100
}

function estadoSaldoLabel(saldo: number) {
  if (saldo > 0) return 'Cliente debe'
  if (saldo < 0) return 'A favor cliente'
  return 'Tablas'
}

function origenLabel(origen: LiquidacionOrigen) {
  const map: Record<LiquidacionOrigen, string> = {
    fijo: 'Fijo',
    bitacora: 'Bitacora',
    cotizacion: 'Cotizacion',
    extra: 'Extra',
  }
  return map[origen] ?? origen
}

function origenClass(origen: LiquidacionOrigen) {
  const map: Record<LiquidacionOrigen, string> = {
    fijo: 'border-blue-500/25 bg-blue-500/10 text-blue-300',
    bitacora: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
    cotizacion: 'border-slate-500/25 bg-slate-500/10 text-slate-300',
    extra: 'border-violet-500/25 bg-violet-500/10 text-violet-300',
  }
  return map[origen] ?? map.cotizacion
}

function normalizarLineas(lineas: LiquidacionLinea[]) {
  return lineas.map(l => {
    const incluido = l.obligatoria || l.incluido
    const cantidad = l.obligatoria ? 1 : Math.max(0, round2(Number(l.cantidad) || 0))
    const precioUnitario = Math.max(0, round2(Number(l.precioUnitario) || 0))
    return {
      ...l,
      incluido,
      cantidad,
      precioUnitario,
      total: round2((incluido ? cantidad : 0) * precioUnitario),
    }
  })
}

function recalcularVariableDesdeLinea(variable: BalanceVariable, linea?: LiquidacionLinea): BalanceVariable {
  if (!linea) return variable
  const cotizada = round2(Number(linea.cantidadCotizada) || 0)
  const utilizada = round2(Number(linea.cantidad) || 0)
  const precioUnitario = round2(Number(linea.precioUnitario) || 0)
  const diferencia = round2(utilizada - cotizada)
  return {
    ...variable,
    cotizada,
    utilizada,
    diferencia,
    precioUnitario,
    total: round2(diferencia * precioUnitario),
  }
}

function recalcularBalanceVisible(
  base: BalanceProyecto,
  resumen: LiquidacionResumen,
  lineas: LiquidacionLinea[],
): BalanceProyecto {
  const lineasNorm = normalizarLineas(lineas)
  const variables = base.variables.map(variable => {
    if (variable.key === 'bentonita') {
      return recalcularVariableDesdeLinea(variable, lineasNorm.find(linea => linea.key === 'bentonita'))
    }
    if (variable.key === 'pipas-agua') {
      return recalcularVariableDesdeLinea(variable, lineasNorm.find(linea => linea.key === 'pipas-agua'))
    }
    return variable
  })
  const totalVariables = round2(variables.reduce((sum, variable) => sum + variable.total, 0))
  const totalContratoMasVariables = round2(resumen.montoCotizacion + totalVariables)
  const profundidadCotizada = Number(base.profundidadCotizada) || 0

  return {
    ...base,
    montoCotizacion: resumen.montoCotizacion,
    totalPagosRecibidos: resumen.totalPagosCliente,
    trabajosEjecutados: resumen.totalLiquidacion,
    saldoContrato: round2(resumen.montoCotizacion - resumen.totalPagosCliente),
    balancePagadoVsEjecutado: round2(resumen.totalPagosCliente - resumen.totalLiquidacion),
    precioPieInicial: profundidadCotizada > 0 ? round2(resumen.montoCotizacion / profundidadCotizada) : 0,
    precioPieActual: profundidadCotizada > 0 ? round2(totalContratoMasVariables / profundidadCotizada) : 0,
    totalContratoMasVariables,
    totalVariables,
    variables,
  }
}

export function LiquidacionProyectoPanel({
  proyectoId,
  onProyectoUpdated,
}: {
  proyectoId: string
  onProyectoUpdated?: () => void
}) {
  const [data, setData] = useState<LiquidacionPayload | null>(null)
  const [lineas, setLineas] = useState<LiquidacionLinea[]>([])
  const [motivo, setMotivo] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  const confirmado = data?.liquidacion?.estado === 'confirmada'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/liquidacion`)
      const payload = res.ok ? await res.json() as LiquidacionPayload : null
      if (payload) {
        setData(payload)
        setLineas(normalizarLineas(payload.lineas ?? []))
        setMotivo(payload.liquidacion?.motivo ?? '')
        setFecha(payload.liquidacion?.fecha || new Date().toISOString().slice(0, 10))
      }
    } finally {
      setLoading(false)
    }
  }, [proyectoId])

  useEffect(() => { void load() }, [load])

  const resumen = useMemo(() => {
    if (!data) return null
    const lineasNorm = normalizarLineas(lineas)
    const totalLiquidacion = round2(lineasNorm.reduce((s, l) => s + (l.incluido ? l.total : 0), 0))
    const totalPagosCliente = data.resumen.totalPagosCliente
    const totalGastosReales = data.resumen.totalGastosReales
    return {
      ...data.resumen,
      totalLiquidacion,
      totalPagosCliente,
      saldoCliente: round2(totalLiquidacion - totalPagosCliente),
      totalGastosReales,
      cajaActual: round2(totalPagosCliente - totalGastosReales),
      margenEstimado: round2(totalLiquidacion - totalGastosReales),
    }
  }, [data, lineas])

  const balance = useMemo(() => {
    if (!data?.balance || !resumen) return null
    return recalcularBalanceVisible(data.balance, resumen, lineas)
  }, [data?.balance, resumen, lineas])

  function patchLinea(index: number, patch: Partial<LiquidacionLinea>) {
    setLineas(prev => normalizarLineas(prev.map((l, i) => i === index ? { ...l, ...patch } : l)))
  }

  async function saveDraft() {
    setSaving(true)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/liquidacion`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, motivo, lineas: normalizarLineas(lineas) }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        alert(payload?.error ?? 'No se pudo guardar la liquidacion.')
        return
      }
      setData(payload)
      setLineas(normalizarLineas(payload.lineas ?? []))
    } finally {
      setSaving(false)
    }
  }

  async function confirmarCancelacion() {
    if (!data) return
    if (!confirm('Confirmar cancelacion del proyecto y congelar esta liquidacion?')) return
    setSaving(true)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/liquidacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, motivo, lineas: normalizarLineas(lineas) }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        alert(payload?.error ?? 'No se pudo confirmar la cancelacion.')
        return
      }
      setData(payload)
      setLineas(normalizarLineas(payload.lineas ?? []))
      onProyectoUpdated?.()
    } finally {
      setSaving(false)
    }
  }

  async function descargarPdf() {
    if (!data || !resumen) return
    setPdfLoading(true)
    try {
      const { generarPDFLiquidacion, descargarPDFLiquidacion } = await import('@/lib/pdf-liquidacion')
      const bytes = await generarPDFLiquidacion({
        ...data,
        lineas: normalizarLineas(lineas),
        resumen,
        liquidacion: {
          id: data.liquidacion?.id ?? '',
          estado: data.liquidacion?.estado ?? 'borrador',
          fecha,
          motivo,
          confirmadoPor: data.liquidacion?.confirmadoPor,
          confirmadoEn: data.liquidacion?.confirmadoEn,
        },
      })
      descargarPDFLiquidacion(bytes, `Liquidacion_${data.proyecto.correlativo}.pdf`)
    } finally {
      setPdfLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-[#0d1526] rounded-xl border border-white/5 p-5 text-slate-500 text-sm flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" /> Cargando liquidacion...
      </div>
    )
  }

  if (!data || !resumen) return null

  const saldoTone = resumen.saldoCliente > 0 ? 'amber' : resumen.saldoCliente < 0 ? 'red' : 'emerald'
  const pendienteContrato = Math.max(0, resumen.montoCotizacion - resumen.totalLiquidacion)
  const pctLiquidado = resumen.montoCotizacion > 0 ? (resumen.totalLiquidacion / resumen.montoCotizacion) * 100 : 0

  return (
    <div className="space-y-5">
      {balance && <BalanceProyectoCard balance={balance} onReload={load} />}

      <div className="bg-[#0d1526] rounded-xl border border-red-500/15 overflow-hidden">
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <Calculator className="w-4 h-4 text-red-300" />
          </div>
          <div>
            <p className="text-xs font-semibold text-red-300 uppercase tracking-wider">Cancelacion del proyecto</p>
            <p className="text-[11px] text-slate-600">
              Punteado para liquidar solamente si el proyecto se cancela
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {confirmado && (
            <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border border-red-500/25 bg-red-500/10 text-red-300">
              <Lock className="w-3 h-3" /> Confirmada
            </span>
          )}
          <button onClick={descargarPdf} disabled={pdfLoading}
            className="inline-flex items-center gap-1.5 border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 px-3 py-2 rounded-lg text-xs transition-colors disabled:opacity-50">
            {pdfLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            PDF
          </button>
          {!confirmado && (
            <>
              <button onClick={saveDraft} disabled={saving}
                className="inline-flex items-center gap-1.5 border border-white/10 text-slate-200 hover:border-white/20 px-3 py-2 rounded-lg text-xs transition-colors disabled:opacity-50">
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Guardar
              </button>
              <button onClick={confirmarCancelacion} disabled={saving}
                className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                Confirmar cancelacion
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <StatBox label="Cobro cancelacion" value={formatQ(resumen.totalLiquidacion)} sub="segun punteado" tone="blue" />
          <StatBox label="Pagado cliente" value={formatQ(resumen.totalPagosCliente)} tone="emerald" />
          <StatBox label={estadoSaldoLabel(resumen.saldoCliente)} value={formatQ(Math.abs(resumen.saldoCliente))} tone={saldoTone} />
          <StatBox label="Comprado real" value={formatQ(resumen.totalGastosReales)} sub="libro de compras" tone="red" />
          <StatBox label="Caja actual" value={formatQ(resumen.cajaActual)} tone={resumen.cajaActual >= 0 ? 'emerald' : 'red'} />
          <StatBox label="Margen estimado" value={formatQ(resumen.margenEstimado)} tone={resumen.margenEstimado >= 0 ? 'emerald' : 'red'} />
        </div>

        <div className="rounded-xl border border-blue-500/15 bg-blue-500/5 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div>
              <p className="text-xs font-semibold text-blue-300 uppercase tracking-wider">Resumen para cancelacion</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Calcula cuanto se deberia cobrar solamente si el proyecto se cancela hoy.
              </p>
            </div>
            <span className="text-[11px] text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded-lg px-2.5 py-1">
              {pctLiquidado.toFixed(1)}% del contrato incluido
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="rounded-lg border border-white/5 bg-[#0a1020] p-3">
              <p className="text-slate-500 mb-1">Contrato original</p>
              <p className="text-base font-bold text-slate-100 tabular-nums">{formatQ(resumen.montoCotizacion)}</p>
              <p className="text-[10px] text-slate-600 mt-1">total de la cotizacion confirmada</p>
            </div>
            <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-3">
              <p className="text-slate-500 mb-1">Lo que se va comprando</p>
              <p className="text-base font-bold text-emerald-300 tabular-nums">{formatQ(resumen.totalGastosReales)}</p>
              <p className="text-[10px] text-slate-600 mt-1">gastos reales registrados</p>
            </div>
            <div className="rounded-lg border border-blue-500/15 bg-blue-500/5 p-3">
              <p className="text-slate-500 mb-1">Cobro por cancelacion</p>
              <p className="text-base font-bold text-blue-300 tabular-nums">{formatQ(resumen.totalLiquidacion)}</p>
              <p className="text-[10px] text-slate-600 mt-1">fijos + bitacora + renglones marcados</p>
            </div>
            <div className="rounded-lg border border-amber-500/15 bg-amber-500/5 p-3">
              <p className="text-slate-500 mb-1">No ejecutado del contrato</p>
              <p className="text-base font-bold text-amber-300 tabular-nums">{formatQ(pendienteContrato)}</p>
              <p className="text-[10px] text-slate-600 mt-1">referencia contra el total contratado</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-3">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} disabled={confirmado}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500/50 disabled:opacity-50" />
            {fecha && <p className="text-[10px] text-slate-600 mt-1">{formatFechaDDMMYYYY(fecha)}</p>}
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wide block mb-1">Motivo</label>
            <input value={motivo} onChange={e => setMotivo(e.target.value)} disabled={confirmado}
              placeholder="Motivo de cancelacion"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-blue-500/50 disabled:opacity-50" />
          </div>
        </div>

        <div className="overflow-x-auto border border-white/5 rounded-xl">
          <table className="w-full text-xs min-w-[920px]">
            <thead className="bg-[#0a1020] border-b border-white/5 text-slate-500">
              <tr>
                <th className="text-left px-3 py-3 font-medium w-10">Cobrar</th>
                <th className="text-left px-3 py-3 font-medium">Concepto</th>
                <th className="text-left px-3 py-3 font-medium w-28">Origen</th>
                <th className="text-right px-3 py-3 font-medium w-24">Cotizada</th>
                <th className="text-right px-3 py-3 font-medium w-28">A cobrar</th>
                <th className="text-left px-3 py-3 font-medium w-24">Unidad</th>
                <th className="text-right px-3 py-3 font-medium w-32">Precio/U</th>
                <th className="text-right px-3 py-3 font-medium w-32">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {lineas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-600">
                    No hay punteado disponible para este proyecto.
                  </td>
                </tr>
              ) : lineas.map((l, idx) => (
                <tr key={`${l.key}-${idx}`} className={cn(!l.incluido && 'opacity-55')}>
                  <td className="px-3 py-2 align-top">
                    <input type="checkbox" checked={l.incluido} disabled={confirmado || l.obligatoria}
                      onChange={e => patchLinea(idx, { incluido: e.target.checked })}
                      className="w-4 h-4 accent-red-500" />
                  </td>
                  <td className="px-3 py-2 align-top">
                    <p className="text-slate-200 leading-snug">{l.nombre}</p>
                    {l.obligatoria && <p className="text-[10px] text-blue-400 mt-1">Obligatorio</p>}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className={cn('inline-flex px-2 py-1 rounded-md border text-[10px]', origenClass(l.origen))}>
                      {origenLabel(l.origen)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-500 tabular-nums align-top">{l.cantidadCotizada}</td>
                  <td className="px-3 py-2 align-top">
                    <input type="number" min={0} step="any" value={l.cantidad}
                      disabled={confirmado || !l.editableCantidad}
                      onChange={e => patchLinea(idx, { cantidad: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-right text-slate-200 tabular-nums outline-none focus:border-blue-500/50 disabled:opacity-50" />
                  </td>
                  <td className="px-3 py-2 text-slate-400 align-top">{l.unidad}</td>
                  <td className="px-3 py-2 align-top">
                    <input type="number" min={0} step="any" value={l.precioUnitario}
                      disabled={confirmado || !l.editablePrecio}
                      onChange={e => patchLinea(idx, { precioUnitario: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-right text-slate-200 tabular-nums outline-none focus:border-blue-500/50 disabled:opacity-50" />
                  </td>
                  <td className="px-3 py-2 text-right text-white font-semibold tabular-nums align-top">
                    {formatQ(l.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="flex justify-between py-1 border-b border-white/5">
            <span className="text-slate-500">Pies bitacora</span>
            <span className="text-slate-300 font-semibold">{resumen.piesPerforados}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-white/5">
            <span className="text-slate-500">Bentonita</span>
            <span className="text-slate-300 font-semibold">{resumen.bentonitaSacos}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-white/5">
            <span className="text-slate-500">Pipas</span>
            <span className="text-slate-300 font-semibold">{resumen.pipas}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-white/5">
            <span className="text-slate-500">Monto contrato</span>
            <span className="text-slate-300 font-semibold">{formatQ(resumen.montoCotizacion)}</span>
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}
