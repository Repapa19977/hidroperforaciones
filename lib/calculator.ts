// ============================================================
// MOTOR DE CÁLCULO — Hiroderforaciones
// Basado en los Excel reales:
//   - PRECIO DE PIE PERFORADO.xlsx
//   - COSTO TRASLADO PERFORACION.xlsx
//   - CONSUMO DE BENTONITA.xlsx
//   - COSTO DE AFORO.xlsx
//   - LIMPIEZA MECANICA COSTO.xlsx
//   - COSTOS RUBROS COTIZACION.xlsx
//   - CALCULO UTILIDAD.xlsx
//   - CALCULO DE HORAS ADVERSAS.xlsx
// ============================================================

// ── IMPUESTOS ────────────────────────────────────────────────
export const IVA = 0.12     // 12% — IVA Guatemala
export const ISR = 0.07     // 7%  — ISR / retención (rango 5-7%, usamos 7% conservador)
export const TOTAL_IMPUESTOS = IVA + ISR  // 19%

// ── TABLA DE BENTONITA (sacos/pie por diámetro) ───────────────
// Fuente: CONSUMO DE BENTONITA.xlsx
const BENTONITA_TABLA: { maxDiam: number; sacosPorPie: number }[] = [
  { maxDiam: 12.25, sacosPorPie: 0.224 },
  { maxDiam: 14.5,  sacosPorPie: 0.224 },
  { maxDiam: 17.5,  sacosPorPie: 0.233 },
  { maxDiam: 20,    sacosPorPie: 0.420 },
  { maxDiam: 99,    sacosPorPie: 0.420 },
]

export function sacosDebentonita(diametroPulg: number, profundidadPies: number): number {
  const fila = BENTONITA_TABLA.find(t => diametroPulg <= t.maxDiam) ?? BENTONITA_TABLA[BENTONITA_TABLA.length - 1]
  return Math.ceil(fila.sacosPorPie * profundidadPies)
}

// ── HORAS ADVERSAS ────────────────────────────────────────────
// Fuente: CALCULO DE HORAS ADVERSAS.xlsx
// Cuando se perfora menos de 2.5 pies/hora se cobra hora adversa
export const RENDIMIENTO_MINIMO = 2.5  // pies/hora
export const VALOR_HORA_ADVERSA = 500  // Q/hora

export function calcularHorasAdversas(piesPerforadosEnTurno: number, horasTurno = 8): number {
  const horasProductivas = piesPerforadosEnTurno / RENDIMIENTO_MINIMO
  return Math.max(0, horasTurno - horasProductivas)
}

// ════════════════════════════════════════════════════════════
// CALCULADORA PERFORACIÓN DE POZO
// Fuentes: PRECIO DE PIE PERFORADO.xlsx + CALCULO UTILIDAD.xlsx
//          + COSTO TRASLADO PERFORACION.xlsx + COSTO DE AFORO.xlsx
// ════════════════════════════════════════════════════════════

export interface InputsPerforacion {
  // ── Parámetros del pozo ──
  diametro: number          // pulgadas (ej: 12)
  profundidad: number       // pies (ej: 750)
  numeroDeTubos: number     // unidades de tubería
  numeroDeFilteros: number  // unidades de filtro
  precioPorPieVenta: number // Q/pie al cliente (ej: 700-750)

  // ── Costos de tubería y filtros ──
  costoPorTubo: number      // Q por tubo
  costoPorFiltro: number    // Q por filtro

  // ── Perforación ──
  rendimientoPorDia: number    // pies/día (default 20)
  diasExtra: number            // días adicionales de maquinaria
  costomaquinariaDia: number   // Q/día (default 4,000)
  costoDieselDia: number       // Q/día en obra (default 2,000)
  bonificacionPorPie: number   // Q/pie (default 13)

  // ── Personal de perforación ──
  personalPerforacion: number  // personas (default 3)
  salarioMensual: number       // Q/mes por persona (default 4,500)
  viaticosDia: number          // Q/día/persona (default 25)
  turnosDia: number            // tiempos/día (default 3)
  hospedajeNoche: number       // Q/noche (default 100)
  nochesHospedaje: number      // noches totales (default 30)

  // ── Traslado (COSTO TRASLADO PERFORACION.xlsx) ──
  kilometros: number           // km al sitio (ej: 100)
  precioDieselTraslado: number // Q/galón (default 28)
  diasTraslado: number         // días de maniobra de traslado (default 2)
  personalTraslado: number     // personas en traslado (default 6+supervisor)

  // ── Bentonita ──
  precioBentonitaSaco: number  // Q/saco (default 157)

  // ── Grava ──
  costoGravaTotalQ: number     // Q total grava (default 9,000)

  // ── Aforo (COSTO DE AFORO.xlsx) ──
  costoAforoBase: number       // Q base sin impuestos (default 7,931)
  horasAforo: number           // horas (default 24)

  // ── Comisión y extras ──
  comisionVendedorPct: number  // % comisión (default 1%)
  incluirLimpieza: boolean

  // ── Bomba ──
  costoBomba: number           // Q (default 27,500)
}

export interface ResultadosPerforacion {
  // Básicos
  diametroBroca: number
  profundidadMetros: number
  diasPerforacion: number
  totalDiasMaquinaria: number

  // Ingresos
  ingresosBrutos: number
  iva: number
  isr: number
  totalImpuestos: number
  ingresosNetos: number

  // Costos por componente
  costoMaquinaria: number
  costoDiesel: number
  costoSalarios: number
  costoViaticos: number
  costoHospedaje: number
  costoBonificaciones: number
  costoTraslado: number
  costoBentonita: number
  sacosBentonita: number
  costoGrava: number
  costoTuberia: number
  costoFiltros: number
  costoAforo: number
  costoLimpieza: number
  costoComision: number
  costoBomba: number
  costoSelloSanitario: number

  // Totales
  costoTotalProyecto: number
  gananciaBruta: number
  gananciaISR: number
  gananciaNeta: number
  margenPct: number

  // Precio por pie
  costoPorPie: number
  precioPorPieCalculado: number
}

export function calcularPerforacion(inp: InputsPerforacion): ResultadosPerforacion {
  // Básicos
  const diametroBroca = inp.diametro * 2
  const profundidadMetros = Math.round(inp.profundidad * 0.3048)

  // Días de perforación
  const diasPerforacion = Math.ceil(inp.profundidad / inp.rendimientoPorDia)
  const totalDiasMaquinaria = diasPerforacion + inp.diasExtra

  // ── INGRESOS ──
  const ingresosBrutos = inp.precioPorPieVenta * inp.profundidad
  const iva = ingresosBrutos * IVA
  const isr = ingresosBrutos * ISR
  const totalImpuestos = iva + isr
  const ingresosNetos = ingresosBrutos - totalImpuestos

  // ── COSTOS ──

  // Maquinaria (rentabilidad diaria)
  const costoMaquinaria = totalDiasMaquinaria * inp.costomaquinariaDia

  // Diésel en obra
  const costoDiesel = totalDiasMaquinaria * inp.costoDieselDia

  // Salarios (personal × salario × días / 30 días mes)
  const costoSalarios = inp.personalPerforacion * inp.salarioMensual * totalDiasMaquinaria / 30

  // Viáticos (personal × turnos × Q25/turno × días)
  const costoViaticos = inp.personalPerforacion * inp.turnosDia * inp.viaticosDia * totalDiasMaquinaria

  // Hospedaje
  const costoHospedaje = inp.nochesHospedaje * inp.hospedajeNoche

  // Bonificación por pie
  const costoBonificaciones = inp.profundidad * inp.bonificacionPorPie

  // Traslado (COSTO TRASLADO PERFORACION.xlsx)
  // 4 vehículos pesados (rinde 5 km/gal): perforadora, Mack, Mack tubería, pipa
  // 2 vehículos livianos (rinde 25 km/gal): carro apoyo, supervisor
  const galPesados  = (inp.kilometros / 5)  * 2  // ida + vuelta, por vehículo
  const galLivianos = (inp.kilometros / 25) * 2  // ida + vuelta, por vehículo
  const combustibleTraslado = (galPesados * 4 + galLivianos * 2) * inp.precioDieselTraslado
  const viaticosTraslado = inp.personalTraslado * inp.diasTraslado * inp.turnosDia * inp.viaticosDia
  const salariosTraslado = inp.personalTraslado * inp.salarioMensual * inp.diasTraslado / 30
  const hospedajeTraslado = inp.personalTraslado * 1 * inp.hospedajeNoche // 1 noche
  const costoTraslado = combustibleTraslado + viaticosTraslado + salariosTraslado + hospedajeTraslado

  // Bentonita
  const sacosBentonita = sacosDebentonita(inp.diametro, inp.profundidad)
  const costoBentonita = sacosBentonita * inp.precioBentonitaSaco

  // Grava
  const costoGrava = inp.costoGravaTotalQ

  // Tubería y filtros
  const costoTuberia = inp.numeroDeTubos * inp.costoPorTubo
  const costoFiltros = inp.numeroDeFilteros * inp.costoPorFiltro

  // Sello sanitario (Q7 × profundidad pies)
  const costoSelloSanitario = 7 * inp.profundidad

  // Aforo (con impuestos del aforo)
  const costoAforo = inp.costoAforoBase * (1 + IVA + 0.05)  // incluye IVA+ISR del aforo

  // Limpieza mecánica
  const costoLimpieza = inp.incluirLimpieza ? 9400 : 0  // Valor real del CALCULO UTILIDAD.xlsx

  // Bomba
  const costoBomba = inp.costoBomba

  // Comisión vendedor (% sobre ingresos brutos)
  const costoComision = ingresosBrutos * (inp.comisionVendedorPct / 100)

  // ── TOTAL ──
  const costoTotalProyecto =
    costoMaquinaria + costoDiesel + costoSalarios + costoViaticos +
    costoHospedaje + costoBonificaciones + costoTraslado +
    costoBentonita + costoGrava + costoTuberia + costoFiltros +
    costoSelloSanitario + costoAforo + costoLimpieza + costoBomba + costoComision

  const gananciaBruta = ingresosNetos - costoTotalProyecto
  const gananciaISR = gananciaBruta > 0 ? gananciaBruta * 0.25 : 0  // ISR sobre utilidades
  const gananciaNeta = gananciaBruta - gananciaISR
  const margenPct = ingresosNetos > 0 ? (gananciaNeta / ingresosNetos) * 100 : 0

  const costoPorPie = costoTotalProyecto / inp.profundidad
  const precioPorPieCalculado = costoPorPie * (1 + TOTAL_IMPUESTOS)

  return {
    diametroBroca, profundidadMetros, diasPerforacion, totalDiasMaquinaria,
    ingresosBrutos, iva, isr, totalImpuestos, ingresosNetos,
    costoMaquinaria, costoDiesel, costoSalarios, costoViaticos,
    costoHospedaje, costoBonificaciones, costoTraslado,
    costoBentonita, sacosBentonita, costoGrava,
    costoTuberia, costoFiltros, costoSelloSanitario,
    costoAforo, costoLimpieza, costoComision, costoBomba,
    costoTotalProyecto, gananciaBruta, gananciaISR, gananciaNeta, margenPct,
    costoPorPie, precioPorPieCalculado,
  }
}

// ════════════════════════════════════════════════════════════
// CALCULADORA LIMPIEZA MECÁNICA
// Fuente: LIMPIEZA MECANICA COSTO.xlsx
// ════════════════════════════════════════════════════════════

export interface InputsLimpieza {
  horasLimpieza: number         // horas de limpieza (default 40)
  horasDia: number              // horas por día de trabajo (default 10)
  precioVentaHora: number       // Q/hora al cliente (default 375)
  kilometros: number            // km al sitio (default 100)
  precioDiesel: number          // Q/galón (default 41)
  personal: number              // personas (default 2)
  diasTrabajo: number           // días de trabajo (default 4)
  viaticosDiarios: number       // Q/día/persona (default 25)
  hospedajeDiario: number       // Q/noche/persona (default 100)
  salarioMensual: number        // Q/mes (default 4,500)
  precioQuimicoCaneca: number   // Q/caneca (default 700)
  canecasQuimicos: number       // canecas (default 2)
}

export interface ResultadosLimpieza {
  diasTotales: number
  costoTraslado: number
  costoDieselTrabajo: number
  costoQuimicos: number
  costoPersonal: number
  costoViaticos: number
  costoHospedaje: number
  subtotalSinImprevistos: number
  imprevisto10pct: number
  costoTotalProyecto: number
  costoPorHora: number
  precioVentaTotal: number
  ivaSobreVenta: number
  isrSobreVenta: number
  precioNetoVendedor: number
  utilidadPorHora: number
  gananciaNeta: number
  margenPct: number
}

export function calcularLimpieza(inp: InputsLimpieza): ResultadosLimpieza {
  const diasTotales = 1 + inp.diasTrabajo + 1  // traslado + trabajo + regreso = 6 días

  // Traslado (km → consumo diésel)
  const GAL_KM = 7  // galones/km maquinaria servicio (LIMPIEZA MECANICA)
  const galTraslado = inp.kilometros / GAL_KM
  const costoTraslado = galTraslado * inp.precioDiesel * 2  // ida + vuelta

  // Diésel en trabajo: 1.5 gal/hora
  const GAL_HORA_TRABAJO = 1.5
  const costoDieselTrabajo = GAL_HORA_TRABAJO * inp.horasLimpieza * inp.precioDiesel

  // Químicos
  const costoQuimicos = inp.precioQuimicoCaneca * inp.canecasQuimicos

  // Salarios
  const costoPersonal = inp.personal * inp.salarioMensual * diasTotales / 30

  // Viáticos (personal × días × 3 turnos × Q25/turno)
  const costoViaticos = inp.personal * diasTotales * 3 * inp.viaticosDiarios

  // Hospedaje (días - 1 noches)
  const costoHospedaje = inp.personal * (diasTotales - 1) * inp.hospedajeDiario

  const subtotalSinImprevistos = costoTraslado + costoDieselTrabajo + costoQuimicos +
    costoPersonal + costoViaticos + costoHospedaje

  const imprevisto10pct = subtotalSinImprevistos * 0.10
  const costoTotalProyecto = subtotalSinImprevistos + imprevisto10pct

  const costoPorHora = costoTotalProyecto / inp.horasLimpieza

  // Precio de venta
  const precioVentaTotal = inp.precioVentaHora * inp.horasLimpieza
  const ivaSobreVenta = precioVentaTotal * IVA
  const isrSobreVenta = precioVentaTotal * 0.05
  const precioNetoVendedor = precioVentaTotal - ivaSobreVenta - isrSobreVenta

  const utilidadPorHora = (precioNetoVendedor - costoTotalProyecto) / inp.horasLimpieza
  const gananciaNeta = precioNetoVendedor - costoTotalProyecto
  const margenPct = precioVentaTotal > 0 ? (gananciaNeta / precioVentaTotal) * 100 : 0

  return {
    diasTotales, costoTraslado, costoDieselTrabajo, costoQuimicos,
    costoPersonal, costoViaticos, costoHospedaje,
    subtotalSinImprevistos, imprevisto10pct, costoTotalProyecto,
    costoPorHora, precioVentaTotal, ivaSobreVenta, isrSobreVenta,
    precioNetoVendedor, utilidadPorHora, gananciaNeta, margenPct,
  }
}

// ── HORAS ADVERSAS (cotización por separado) ────────────────────────────────
export interface InputsHorasAdversas {
  piesEnTurno: number
  horasTurno: number  // default 8
}

export function calcularHorasAdversasCompleto(inp: InputsHorasAdversas) {
  const horasProductivas = inp.piesEnTurno / RENDIMIENTO_MINIMO
  const horasAdversas = Math.max(0, inp.horasTurno - horasProductivas)
  const cobro = horasAdversas * VALOR_HORA_ADVERSA
  return { horasProductivas, horasAdversas, cobro }
}

// ── DEFAULTS basados en los Excel reales ────────────────────────────────────
export const defaultInputsPerforacion: InputsPerforacion = {
  diametro: 12,
  profundidad: 750,
  numeroDeTubos: 30,
  numeroDeFilteros: 8,
  precioPorPieVenta: 700,
  costoPorTubo: 2567,          // Q77,000 / 30 tubos (CALCULO UTILIDAD)
  costoPorFiltro: 950,
  rendimientoPorDia: 20,       // pies/día (PRECIO DE PIE PERFORADO)
  diasExtra: 3,
  costomaquinariaDia: 4000,    // Q/día (PRECIO DE PIE PERFORADO)
  costoDieselDia: 2000,        // Q/día (PRECIO DE PIE PERFORADO)
  bonificacionPorPie: 13,      // Q/pie (PRECIO DE PIE PERFORADO)
  personalPerforacion: 3,
  salarioMensual: 4500,
  viaticosDia: 25,
  turnosDia: 3,
  hospedajeNoche: 100,
  nochesHospedaje: 30,
  kilometros: 100,
  precioDieselTraslado: 28,
  diasTraslado: 2,
  personalTraslado: 7,         // 3 perforacion + 3 pilotos + 1 supervisor
  precioBentonitaSaco: 157,    // Q/saco (CALCULO UTILIDAD)
  costoGravaTotalQ: 9000,      // (CALCULO UTILIDAD)
  costoAforoBase: 7931,        // (COSTO DE AFORO)
  horasAforo: 24,
  comisionVendedorPct: 1,      // 1% (CALCULO UTILIDAD)
  incluirLimpieza: true,
  costoBomba: 27500,
}

export const defaultInputsLimpieza: InputsLimpieza = {
  horasLimpieza: 40,
  horasDia: 10,
  precioVentaHora: 375,
  kilometros: 100,
  precioDiesel: 41,
  personal: 2,
  diasTrabajo: 4,
  viaticosDiarios: 25,
  hospedajeDiario: 100,
  salarioMensual: 4500,
  precioQuimicoCaneca: 700,
  canecasQuimicos: 2,
}

// ── UTILIDADES ────────────────────────────────────────────────────────────────
export const formatQ = (n: number) =>
  'Q ' + Math.round(n).toLocaleString('es-GT', { minimumFractionDigits: 0 })

export const formatQDecimal = (n: number) =>
  'Q ' + n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
