'use client'

import { useMemo, useState } from 'react'
import { X, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildLineasPerf } from '@/lib/pdf-cotizacion'
import type { InputsPerforacion } from '@/lib/calculator'
import { calcularPerforacion, IVA, ISR } from '@/lib/calculator'
import { COSTOS_BASE } from '@/lib/costos-base'
import type { PreciosLineas } from '@/lib/config-store'

/**
 * Mapea el key de la línea del PDF al key del catálogo COSTOS_BASE.
 * Retorna el costo unitario interno por key, si existe.
 */
function costoBasePorKey(key: string): number | null {
  const map: Record<string, string> = {
    'bentonita':          'bentonita',
    'grava-material':     'grava',
    'pipas-agua':         'pipasAgua',
    'transporte-grava':   'transporteGrava',
    'instalacion-grava':  'instalacionGrava',
    'colocacion-ademe':   'colocacionAdeme',
    'brocal':             'brocal',
    'sopleteado':         'sopleteado',
    'registro-electrico': 'registroElectrico',
    'sello-sanitario':    'selloSanitario',
    'analisis-combinado': 'analisisFQBact',
    'instalacion-equipo': 'instalacionEquipo',
    'prueba-bombeo':      'pruebaBombeo',
    'limpieza-mecanica':  'limpiezaMecanica',
  }
  const rubro = map[key]
  return rubro ? COSTOS_BASE[rubro]?.costoUnitario ?? null : null
}

const fmtQ = (n: number) =>
  'Q ' + (Number.isFinite(n) ? n : 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const FACTOR_IVA_ISR = 1 + IVA + ISR  // 1.17

// Input numérico editable — definido FUERA del componente padre para que React
// no lo desmonte en cada render (si estuviera dentro, cada render crearía una
// nueva función y el input perdería el foco mientras tipeas).
function NumCell({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value.toFixed(2) : '0.00'}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className="w-full min-w-[110px] bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-right tabular-nums text-white outline-none focus:border-blue-500/60 focus:bg-white/10"
      step="0.01"
    />
  )
}

export function ComparativaCostosModal({
  ip,
  pl,
  preciosVentaOverride = {},
  costosOverrideInicial = {},
  onClose,
  onApply,
}: {
  ip: InputsPerforacion
  pl: PreciosLineas
  preciosVentaOverride?: Record<string, number>
  costosOverrideInicial?: Record<string, number>
  onClose: () => void
  onApply?: (overrides: { venta: Record<string, number>; costo: Record<string, number> }) => void
}) {
  const res = useMemo(() => calcularPerforacion(ip), [ip])

  // Líneas base de la cotización (ya incluye cálculo residual de perforación)
  const lineasBase = useMemo(
    () => buildLineasPerf(ip, res, pl, false, false, preciosVentaOverride),
    [ip, res, pl, preciosVentaOverride]
  )

  // Overrides locales del modal: el usuario puede tocar costo o venta por rubro
  const [costoOv, setCostoOv]   = useState<Record<string, number>>(costosOverrideInicial)
  const [ventaOv, setVentaOv]   = useState<Record<string, number>>({})

  // Costo unitario estimado por cada rubro (fallback si no hay override)
  function estimarCostoU(key: string, precioVentaU: number, totalVenta: number, cant: number): number {
    const base = costoBasePorKey(key)
    if (base !== null) return base

    // Tubería: venta/u = costo × 1.30 → costo = venta/u / 1.30
    if (key === 'tuberia-lisa' || key === 'tuberia-ranurada') {
      return Math.round((precioVentaU / 1.30) * 100) / 100
    }

    // Traslado del equipo: el "costo" interno ya está en res.costoTraslado (una vía)
    if (key === 'traslado-equipo' && cant > 0) return res.costoTraslado / cant

    // Perforación residual: costo operativo / pies
    if (key === 'perforacion' && ip.profundidad > 0) {
      const opCost = res.costoDiesel + res.costoSalarios + res.costoViaticos + res.costoHospedaje + res.costoBonificaciones
      return opCost / ip.profundidad
    }

    // Rubros sin costo base conocido: asumimos 100% margen (costo = 0)
    void totalVenta
    return 0
  }

  // Construir filas con overrides aplicados y rubro 3 residual recalculado si cambió algún venta/u
  const filas = useMemo(() => {
    // Paso 1: aplicar overrides de venta
    const raw = lineasBase.map(l => {
      const precioVentaFinal = ventaOv[l.key] ?? l.precio
      return {
        key:   l.key,
        nombre: l.nombre,
        unidad: l.unidad,
        cant:   l.cant,
        precioVenta:  precioVentaFinal,
        totalVenta:   l.cant * precioVentaFinal,
      }
    })

    // Paso 2: recalcular rubro "perforacion" residual para mantener total pactado.
    // Solo si el user NO tocó manualmente el precio de perforación.
    const totalObjetivoCliente = ip.profundidad * ip.precioPorPieVenta
    const subtotalObjetivo = totalObjetivoCliente / FACTOR_IVA_ISR
    const perfIdx = raw.findIndex(l => l.key === 'perforacion')
    let deltaPerforacion = 0
    const perfOverrideManual = ventaOv['perforacion'] !== undefined

    if (perfIdx >= 0 && ip.profundidad > 0 && !perfOverrideManual) {
      const sumaOtros = raw.reduce((acc, l, i) => i === perfIdx ? acc : acc + l.totalVenta, 0)
      const totalPerforacionNuevo = Math.max(0, subtotalObjetivo - sumaOtros)
      const totalPerforacionAnterior = lineasBase[perfIdx]?.total ?? 0
      deltaPerforacion = totalPerforacionNuevo - totalPerforacionAnterior
      raw[perfIdx] = {
        ...raw[perfIdx],
        precioVenta: Math.round((totalPerforacionNuevo / ip.profundidad) * 100) / 100,
        totalVenta: totalPerforacionNuevo,
      }
    }

    // Paso 3: agregar costos (fallback a estimación si no hay override)
    const conCostos = raw.map(l => {
      const costoEstimado = estimarCostoU(l.key, l.precioVenta, l.totalVenta, l.cant)
      const costoU = costoOv[l.key] ?? costoEstimado
      const totalCosto = costoU * l.cant
      const margenQ = l.totalVenta - totalCosto
      const margenPct = totalCosto > 0 ? (margenQ / totalCosto) * 100 : (l.totalVenta > 0 ? 100 : 0)
      return { ...l, costoU, totalCosto, margenQ, margenPct }
    })

    return { filas: conCostos, deltaPerforacion, totalPerforacionAnteriorQ: lineasBase[perfIdx]?.total ?? 0, perfOverrideManual }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineasBase, ventaOv, costoOv, ip, res])

  const totalCosto = filas.filas.reduce((a, l) => a + l.totalCosto, 0)
  const totalVenta = filas.filas.reduce((a, l) => a + l.totalVenta, 0)
  const margenGlobalQ = totalVenta - totalCosto
  const margenGlobalPct = totalCosto > 0 ? (margenGlobalQ / totalCosto) * 100 : 0

  const deltaPct = filas.totalPerforacionAnteriorQ > 0
    ? (filas.deltaPerforacion / filas.totalPerforacionAnteriorQ) * 100
    : 0

  function colorMargen(pct: number) {
    if (pct < 10)  return 'text-red-400'
    if (pct < 30)  return 'text-amber-400'
    return 'text-emerald-400'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0d1526] border border-white/10 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              💰 Comparativa de costos · {ip.profundidad} pies
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Edita costo/u o venta/u por rubro. Cambiar un precio venta ajusta el renglón 3 (Perforación) automáticamente.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1 -mr-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Delta de perforación — solo si cambió */}
        {Math.abs(filas.deltaPerforacion) > 1 && (
          <div className={cn(
            'mx-5 mt-3 px-3 py-2.5 rounded-lg border text-xs flex items-center gap-2',
            filas.deltaPerforacion > 0
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          )}>
            {filas.deltaPerforacion > 0
              ? <TrendingUp className="w-4 h-4" />
              : <TrendingDown className="w-4 h-4" />}
            <span>
              Renglón 3 (Perforación) ajustado: <b>{filas.deltaPerforacion > 0 ? '+' : ''}{fmtQ(filas.deltaPerforacion)}</b>
              {' '}({deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)}%)
            </span>
          </div>
        )}

        {/* Tabla */}
        <div className="overflow-auto flex-1 px-5 py-4">
          <table className="w-full text-xs border-separate" style={{ borderSpacing: 0, minWidth: 960 }}>
            <colgroup>
              <col style={{ width: '26%', minWidth: 240 }} />
              <col style={{ width: '8%',  minWidth: 70  }} />
              <col style={{ width: '10%', minWidth: 120 }} />
              <col style={{ width: '11%', minWidth: 100 }} />
              <col style={{ width: '10%', minWidth: 120 }} />
              <col style={{ width: '11%', minWidth: 110 }} />
              <col style={{ width: '12%', minWidth: 110 }} />
              <col style={{ width: '8%',  minWidth: 70  }} />
            </colgroup>
            <thead className="sticky top-0 bg-[#0d1526] z-10">
              <tr className="text-slate-500">
                <th className="text-left py-2.5 pr-3 font-medium border-b border-white/10">Rubro</th>
                <th className="text-right py-2.5 px-2 font-medium border-b border-white/10">Cant.</th>
                <th className="text-right py-2.5 px-2 font-medium border-b border-white/10">Costo/u</th>
                <th className="text-right py-2.5 px-2 font-medium border-b border-white/10">Total Costo</th>
                <th className="text-right py-2.5 px-2 font-medium border-b border-white/10">Venta/u</th>
                <th className="text-right py-2.5 px-2 font-medium border-b border-white/10">Total Venta</th>
                <th className="text-right py-2.5 px-2 font-medium border-b border-white/10">Margen Q</th>
                <th className="text-right py-2.5 pl-2 font-medium border-b border-white/10">Margen %</th>
              </tr>
            </thead>
            <tbody>
              {filas.filas.map((l, i) => {
                const esPerforacion = l.key === 'perforacion'
                return (
                  <tr key={l.key} className={cn(esPerforacion && 'bg-amber-500/5')}>
                    <td className="py-2.5 pr-3 align-top border-b border-white/5">
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] text-slate-600 font-mono pt-0.5 shrink-0">{i + 1}</span>
                        <div className="min-w-0">
                          <div className="text-slate-200 leading-snug break-words" title={l.nombre}>
                            {esPerforacion && <span className="text-amber-400 mr-1">⚠</span>}
                            {l.nombre.split('.')[0]}
                          </div>
                          <div className="text-[10px] text-slate-600 font-mono mt-0.5">{l.key} · {l.unidad}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right py-2.5 px-2 text-slate-400 tabular-nums align-top border-b border-white/5">{l.cant.toLocaleString('es-GT')}</td>
                    <td className="py-2 px-2 align-top border-b border-white/5">
                      <NumCell value={l.costoU} onChange={v => setCostoOv(prev => ({ ...prev, [l.key]: v }))} />
                    </td>
                    <td className="text-right py-2.5 px-2 text-slate-300 tabular-nums align-top border-b border-white/5">{fmtQ(l.totalCosto)}</td>
                    <td className="py-2 px-2 align-top border-b border-white/5">
                      <NumCell value={l.precioVenta} onChange={v => setVentaOv(prev => ({ ...prev, [l.key]: v }))} />
                      {esPerforacion && !filas.perfOverrideManual && (
                        <div className="text-[9px] text-amber-400/70 italic text-right mt-0.5">residual auto</div>
                      )}
                      {esPerforacion && filas.perfOverrideManual && (
                        <div className="text-[9px] text-blue-400/80 italic text-right mt-0.5 flex items-center justify-end gap-1">
                          manual
                          <button
                            onClick={() => setVentaOv(prev => { const n = { ...prev }; delete n['perforacion']; return n })}
                            className="underline hover:text-blue-300"
                            title="Volver a residual automático"
                          >
                            reset
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="text-right py-2.5 px-2 text-slate-100 font-semibold tabular-nums align-top border-b border-white/5">{fmtQ(l.totalVenta)}</td>
                    <td className={cn('text-right py-2.5 px-2 tabular-nums font-medium align-top border-b border-white/5', colorMargen(l.margenPct))}>{fmtQ(l.margenQ)}</td>
                    <td className={cn('text-right py-2.5 pl-2 tabular-nums font-bold align-top border-b border-white/5', colorMargen(l.margenPct))}>{l.margenPct.toFixed(0)}%</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="sticky bottom-0 bg-[#0d1526]">
              <tr className="text-sm">
                <td className="pt-3 pr-3 font-bold text-white border-t-2 border-white/20">TOTALES</td>
                <td className="border-t-2 border-white/20" />
                <td className="border-t-2 border-white/20" />
                <td className="text-right pt-3 px-2 font-bold text-white tabular-nums border-t-2 border-white/20">{fmtQ(totalCosto)}</td>
                <td className="border-t-2 border-white/20" />
                <td className="text-right pt-3 px-2 font-bold text-white tabular-nums border-t-2 border-white/20">{fmtQ(totalVenta)}</td>
                <td className={cn('text-right pt-3 px-2 font-bold tabular-nums border-t-2 border-white/20', colorMargen(margenGlobalPct))}>{fmtQ(margenGlobalQ)}</td>
                <td className={cn('text-right pt-3 pl-2 font-bold tabular-nums border-t-2 border-white/20', colorMargen(margenGlobalPct))}>{margenGlobalPct.toFixed(0)}%</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-white/10 bg-[#0b1220] rounded-b-2xl shrink-0 flex-wrap">
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Margen ≥ 30%</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> 10–30%</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> &lt; 10%</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose}
              className="px-3 py-2 border border-white/10 text-slate-300 hover:text-white hover:border-white/20 rounded-lg text-sm font-medium transition-all">
              Descartar y cerrar
            </button>
            {onApply && (
              <button
                onClick={() => {
                  onApply({ venta: ventaOv, costo: costoOv })
                  onClose()
                }}
                disabled={Object.keys(ventaOv).length === 0 && Object.keys(costoOv).length === 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-all">
                Guardar en esta cotización
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
