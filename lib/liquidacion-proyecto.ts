import {
  calcularHorasAdversasCompleto,
  calcularPerforacion,
  defaultInputsPerforacion,
  type InputsPerforacion,
} from './calculator'
import { DEFAULT_CONFIG, DEFAULT_PRECIOS_LINEAS } from './config-store'
import { buildLineasPerf } from './pdf-cotizacion'
import { DEFAULT_PLAN_PAGOS, getLineaConfig, type LineaExtra, type QuotationData } from './quotation-store'

export type LiquidacionOrigen = 'fijo' | 'bitacora' | 'cotizacion' | 'extra'

export interface LiquidacionLinea {
  key: string
  nombre: string
  unidad: string
  cantidadCotizada: number
  cantidad: number
  precioUnitario: number
  total: number
  incluido: boolean
  obligatoria: boolean
  editableCantidad: boolean
  editablePrecio: boolean
  origen: LiquidacionOrigen
}

export interface LiquidacionResumen {
  totalLiquidacion: number
  totalPagosCliente: number
  saldoCliente: number
  totalGastosReales: number
  cajaActual: number
  margenEstimado: number
  montoCotizacion: number
  piesPerforados: number
  bentonitaSacos: number
  pipas: number
  horasLimpieza: number
  horasAforo: number
}

export interface BitacoraParaLiquidacion {
  fecha?: string
  turno?: string
  perforacionDia: number
  bentonitaSacos: number
  pipas: number
  horasPerforacion?: number
  horasLimpieza?: number
  horasAforo?: number
  diaAdverso?: boolean
}

export interface PagoParaLiquidacion {
  monto: number
}

export interface GastoParaLiquidacion {
  monto: number
}

export interface BalanceHitoPago {
  id: string
  label: string
  pct: number
  monto: number
  fijo: boolean
}

export interface BalanceVariable {
  key: string
  concepto: string
  unidad: string
  cotizada: number
  utilizada: number
  diferencia: number
  precioUnitario: number
  total: number
}

export interface BalanceHoraAdversa {
  fecha: string
  turno: string
  piesPerforados: number
  horasTurno: number
  horasProductivas: number
  horasAdversas: number
  precioHora: number
  total: number
  constante: number
}

export interface BalanceProyecto {
  montoCotizacion: number
  profundidadCotizada: number
  precioPieInicial: number
  precioPieActual: number
  totalContratoMasVariables: number
  totalPagosRecibidos: number
  trabajosEjecutados: number
  saldoContrato: number
  balancePagadoVsEjecutado: number
  totalVariables: number
  variables: BalanceVariable[]
  horasAdversas: {
    totalHoras: number
    total: number
    detalle: BalanceHoraAdversa[]
  }
  hitosPago: BalanceHitoPago[]
}

type LegacyInputsPerforacion = Partial<InputsPerforacion> & {
  numeroDeTubos?: number
  numeroDeFilteros?: number
  costoGravaTotalQ?: number
}

const LINEAS_OBLIGATORIAS = new Set(['traslado-equipo', 'instalacion-equipo'])
const LINEAS_BITACORA = new Set(['perforacion', 'bentonita', 'pipas-agua', 'limpieza-mecanica', 'prueba-bombeo'])

function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function cleanText(value: unknown, fallback = ''): string {
  return String(value ?? fallback).trim()
}

export function totalizarBitacora(entries: BitacoraParaLiquidacion[]) {
  return {
    piesPerforados: round2(entries.reduce((s, e) => s + num(e.perforacionDia), 0)),
    bentonitaSacos: round2(entries.reduce((s, e) => s + num(e.bentonitaSacos), 0)),
    pipas: round2(entries.reduce((s, e) => s + num(e.pipas), 0)),
    horasLimpieza: round2(entries.reduce((s, e) => s + num(e.horasLimpieza), 0)),
    horasAforo: round2(entries.reduce((s, e) => s + num(e.horasAforo), 0)),
  }
}

function normalizarPerforacion(ip: Partial<InputsPerforacion>): InputsPerforacion {
  const legacy = ip as LegacyInputsPerforacion
  const normalizada: InputsPerforacion = { ...defaultInputsPerforacion, ...ip }

  const esLegacy =
    typeof legacy.numeroDeTubos === 'number' ||
    typeof legacy.numeroDeFilteros === 'number' ||
    typeof legacy.tubosLisos !== 'number' ||
    typeof legacy.tubosRanurados !== 'number'

  if (esLegacy) {
    normalizada.tubosLisos = num(legacy.tubosLisos, num(legacy.numeroDeTubos, defaultInputsPerforacion.tubosLisos))
    normalizada.tubosRanurados = num(legacy.tubosRanurados, num(legacy.numeroDeFilteros, defaultInputsPerforacion.tubosRanurados))
    normalizada.costoGravaMaterial = num(
      legacy.costoGravaMaterial,
      num(legacy.costoGravaTotalQ, defaultInputsPerforacion.costoGravaMaterial),
    )
    normalizada.incluirRegistroElectrico = typeof legacy.incluirRegistroElectrico === 'boolean' ? legacy.incluirRegistroElectrico : false
    normalizada.incluirSelloSanitario = typeof legacy.incluirSelloSanitario === 'boolean' ? legacy.incluirSelloSanitario : false
    normalizada.incluirExtraccionLodos = typeof legacy.incluirExtraccionLodos === 'boolean' ? legacy.incluirExtraccionLodos : false
    normalizada.incluirSeguridad = typeof legacy.incluirSeguridad === 'boolean' ? legacy.incluirSeguridad : false
    normalizada.incluirSanitario = typeof legacy.incluirSanitario === 'boolean' ? legacy.incluirSanitario : false
    normalizada.aforoDetallado = legacy.aforoDetallado
  }

  return normalizada
}

function parseDatosCotizacion(datos: string | null | undefined): Partial<QuotationData> {
  if (!datos) return {}
  try {
    const parsed = JSON.parse(datos)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function cantidadDesdeBitacora(key: string, bitacora: ReturnType<typeof totalizarBitacora>): number {
  if (key === 'perforacion') return bitacora.piesPerforados
  if (key === 'bentonita') return bitacora.bentonitaSacos
  if (key === 'pipas-agua') return bitacora.pipas
  if (key === 'limpieza-mecanica') return bitacora.horasLimpieza
  if (key === 'prueba-bombeo') return bitacora.horasAforo
  return 0
}

export function construirLineasLiquidacion(params: {
  cotizacionDatos: string | null | undefined
  bitacora: BitacoraParaLiquidacion[]
}): LiquidacionLinea[] {
  const data = parseDatosCotizacion(params.cotizacionDatos)
  if (data.tipo !== 'perforacion' || !data.ip) return []

  const ip = normalizarPerforacion(data.ip)
  const res = calcularPerforacion(ip)
  const pl = { ...DEFAULT_PRECIOS_LINEAS, ...(data.preciosLineas ?? {}) }
  const preciosVentaOverride = data.preciosVentaOverride ?? {}
  const lineasConfig = data.lineasConfig ?? {}
  const lineasActivas = data.lineasActivas ?? {}
  const bitacora = totalizarBitacora(params.bitacora)

  const lineasBase = buildLineasPerf(
    ip,
    res,
    pl,
    data.mostrarEspesor ?? false,
    data.descripcionSimple ?? false,
    preciosVentaOverride,
    {
      pipaPrecioVentaUnitario: data.pipaPrecioVentaUnitario ?? DEFAULT_CONFIG.pipaPrecioVentaUnitario,
      camionadaGravaPrecioVentaUnitario: data.camionadaGravaPrecioVentaUnitario ?? DEFAULT_CONFIG.camionadaGravaPrecioVentaUnitario,
      capacidadCamionM3: data.capacidadCamionM3 ?? DEFAULT_CONFIG.capacidadCamionM3,
    },
  )

  const base = lineasBase
    .filter(l => getLineaConfig(l.key, lineasConfig, lineasActivas).cobrar)
    .map<LiquidacionLinea>(l => {
      const obligatoria = LINEAS_OBLIGATORIAS.has(l.key)
      const usaBitacora = LINEAS_BITACORA.has(l.key)
      const cantidad = obligatoria ? 1 : usaBitacora ? cantidadDesdeBitacora(l.key, bitacora) : 0
      const incluido = obligatoria || cantidad > 0
      const precioUnitario = round2(num(l.precio))
      return {
        key: l.key,
        nombre: cleanText(l.nombre),
        unidad: cleanText(l.unidad, 'Unidad'),
        cantidadCotizada: round2(num(l.cant)),
        cantidad: round2(cantidad),
        precioUnitario,
        total: round2((incluido ? cantidad : 0) * precioUnitario),
        incluido,
        obligatoria,
        editableCantidad: !obligatoria,
        editablePrecio: true,
        origen: obligatoria ? 'fijo' : usaBitacora ? 'bitacora' : 'cotizacion',
      }
    })

  const extras = ((data.lineasExtras ?? []) as LineaExtra[])
    .filter(e =>
      e.cobrar !== false &&
      num(e.cantidad) > 0 &&
      num(e.precioVentaUnitario) > 0 &&
      cleanText(e.nombre).length > 0
    )
    .map<LiquidacionLinea>(e => {
      const desc = cleanText(e.descripcion)
      const nombre = desc ? `${e.nombre}. ${desc}` : e.nombre
      const precioUnitario = round2(num(e.precioVentaUnitario))
      return {
        key: e.id,
        nombre: cleanText(nombre),
        unidad: cleanText(e.unidad, 'Unidad'),
        cantidadCotizada: round2(num(e.cantidad)),
        cantidad: 0,
        precioUnitario,
        total: 0,
        incluido: false,
        obligatoria: false,
        editableCantidad: true,
        editablePrecio: true,
        origen: 'extra',
      }
    })

  return [...base, ...extras]
}

export function normalizarLineasLiquidacion(lineas: LiquidacionLinea[]): LiquidacionLinea[] {
  return (Array.isArray(lineas) ? lineas : []).map((linea, index) => {
    const key = cleanText(linea.key, `linea-${index}`)
    const obligatoria = Boolean(linea.obligatoria) || LINEAS_OBLIGATORIAS.has(key)
    const incluido = obligatoria || Boolean(linea.incluido)
    const cantidad = obligatoria ? 1 : Math.max(0, round2(num(linea.cantidad)))
    const precioUnitario = Math.max(0, round2(num(linea.precioUnitario)))
    return {
      key,
      nombre: cleanText(linea.nombre, 'Concepto'),
      unidad: cleanText(linea.unidad, 'Unidad'),
      cantidadCotizada: Math.max(0, round2(num(linea.cantidadCotizada))),
      cantidad,
      precioUnitario,
      total: round2((incluido ? cantidad : 0) * precioUnitario),
      incluido,
      obligatoria,
      editableCantidad: !obligatoria && linea.editableCantidad !== false,
      editablePrecio: linea.editablePrecio !== false,
      origen: linea.origen ?? (obligatoria ? 'fijo' : 'cotizacion'),
    }
  })
}

export function calcularResumenLiquidacion(params: {
  lineas: LiquidacionLinea[]
  pagos: PagoParaLiquidacion[]
  gastos: GastoParaLiquidacion[]
  montoCotizacion: number
  bitacora: BitacoraParaLiquidacion[]
}): LiquidacionResumen {
  const lineas = normalizarLineasLiquidacion(params.lineas)
  const totalLiquidacion = round2(lineas.reduce((s, l) => s + (l.incluido ? l.total : 0), 0))
  const totalPagosCliente = round2(params.pagos.reduce((s, p) => s + num(p.monto), 0))
  const totalGastosReales = round2(params.gastos.reduce((s, g) => s + num(g.monto), 0))
  const bitacora = totalizarBitacora(params.bitacora)

  return {
    totalLiquidacion,
    totalPagosCliente,
    saldoCliente: round2(totalLiquidacion - totalPagosCliente),
    totalGastosReales,
    cajaActual: round2(totalPagosCliente - totalGastosReales),
    margenEstimado: round2(totalLiquidacion - totalGastosReales),
    montoCotizacion: round2(num(params.montoCotizacion)),
    ...bitacora,
  }
}

function variableDesdeLinea(
  linea: LiquidacionLinea | undefined,
  fallback: Pick<BalanceVariable, 'key' | 'concepto' | 'unidad'>,
): BalanceVariable {
  const cotizada = round2(num(linea?.cantidadCotizada))
  const utilizada = round2(num(linea?.cantidad))
  const precioUnitario = round2(num(linea?.precioUnitario))
  const diferencia = round2(utilizada - cotizada)
  return {
    ...fallback,
    cotizada,
    utilizada,
    diferencia,
    precioUnitario,
    total: round2(diferencia * precioUnitario),
  }
}

function calcularDetalleHorasAdversas(bitacora: BitacoraParaLiquidacion[]) {
  const piesMinimoTurno = 20
  const precioHora = 500
  const detalle: BalanceHoraAdversa[] = []

  for (const entry of bitacora) {
    const piesPerforados = round2(num(entry.perforacionDia))
    const marcadoAdverso = Boolean(entry.diaAdverso)
    if (!(marcadoAdverso || piesPerforados > 0) || piesPerforados >= piesMinimoTurno) continue

    const horasRegistradas = num(entry.horasPerforacion)
    const horasTurno = horasRegistradas > 0 ? horasRegistradas : entry.turno === 'noche' ? 12 : 8
    const resultado = calcularHorasAdversasCompleto({
      piesEnTurno: piesPerforados,
      horasTurno,
      piesMinimoTurno,
      valorHoraAdversa: precioHora,
    })

    if (resultado.horasAdversas <= 0) continue

    detalle.push({
      fecha: cleanText(entry.fecha),
      turno: cleanText(entry.turno, 'dia'),
      piesPerforados,
      horasTurno: round2(horasTurno),
      horasProductivas: round2(resultado.horasProductivas),
      horasAdversas: round2(resultado.horasAdversas),
      precioHora,
      total: round2(resultado.cobro),
      constante: round2(resultado.constante),
    })
  }

  const totalHoras = round2(detalle.reduce((sum, item) => sum + item.horasAdversas, 0))
  const total = round2(detalle.reduce((sum, item) => sum + item.total, 0))
  return { totalHoras, total, detalle }
}

export function calcularBalanceProyecto(params: {
  cotizacionDatos: string | null | undefined
  montoCotizacion: number
  pagos: PagoParaLiquidacion[]
  bitacora: BitacoraParaLiquidacion[]
  lineas: LiquidacionLinea[]
}): BalanceProyecto {
  const data = parseDatosCotizacion(params.cotizacionDatos)
  const montoCotizacion = round2(num(params.montoCotizacion))
  const lineas = normalizarLineasLiquidacion(params.lineas)
  const totalPagosRecibidos = round2(params.pagos.reduce((sum, pago) => sum + num(pago.monto), 0))
  const trabajosEjecutados = round2(lineas.reduce((sum, linea) => sum + (linea.incluido ? linea.total : 0), 0))

  const ip = data.tipo === 'perforacion' && data.ip ? normalizarPerforacion(data.ip) : null
  const profundidadCotizada = round2(num(ip?.profundidad))
  const precioPieInicial = profundidadCotizada > 0 ? round2(montoCotizacion / profundidadCotizada) : 0

  const bentonita = variableDesdeLinea(
    lineas.find(linea => linea.key === 'bentonita'),
    { key: 'bentonita', concepto: 'Bentonita', unidad: 'Saco' },
  )
  const pipas = variableDesdeLinea(
    lineas.find(linea => linea.key === 'pipas-agua'),
    { key: 'pipas-agua', concepto: 'Pipas de agua', unidad: 'Pipa' },
  )
  const horasAdversas = calcularDetalleHorasAdversas(params.bitacora)
  const horasAdversasVariable: BalanceVariable = {
    key: 'horas-adversas',
    concepto: 'Horas adversas',
    unidad: 'Hora',
    cotizada: 0,
    utilizada: horasAdversas.totalHoras,
    diferencia: horasAdversas.totalHoras,
    precioUnitario: 500,
    total: horasAdversas.total,
  }

  const variables = [bentonita, pipas, horasAdversasVariable]
  const totalVariables = round2(variables.reduce((sum, variable) => sum + variable.total, 0))
  const totalContratoMasVariables = round2(montoCotizacion + totalVariables)

  const plan = (Array.isArray(data.planPagos) && data.planPagos.length > 0 ? data.planPagos : DEFAULT_PLAN_PAGOS)
    .filter(hito => hito.visible !== false)
  const hitosPago = plan.map((hito, index) => ({
    id: cleanText(hito.id, `hito-${index}`),
    label: cleanText(hito.label, `Pago ${index + 1}`),
    pct: round2(num(hito.pct)),
    monto: round2(montoCotizacion * num(hito.pct) / 100),
    fijo: Boolean(hito.fijo),
  }))

  return {
    montoCotizacion,
    profundidadCotizada,
    precioPieInicial,
    precioPieActual: profundidadCotizada > 0 ? round2(totalContratoMasVariables / profundidadCotizada) : 0,
    totalContratoMasVariables,
    totalPagosRecibidos,
    trabajosEjecutados,
    saldoContrato: round2(montoCotizacion - totalPagosRecibidos),
    balancePagadoVsEjecutado: round2(totalPagosRecibidos - trabajosEjecutados),
    totalVariables,
    variables,
    horasAdversas,
    hitosPago,
  }
}

export function parseLineasGuardadas(raw: string | null | undefined): LiquidacionLinea[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return normalizarLineasLiquidacion(Array.isArray(parsed) ? parsed : [])
  } catch {
    return []
  }
}
