// ============================================================
// MOTOR DE CÁLCULO — Hidroperforaciones
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
export const ISR = 0.05     // 5%  — ISR / retención
export const TOTAL_IMPUESTOS = IVA + ISR  // 19%

// ── TABLA DE BENTONITA (sacos/pie por diámetro de perforación) ───────────────
// Fuente: CONSUMO DE BENTONITA.xlsx — Hoja 3 verificada
// 7 7/8 / 9 7/8 / 12 1/4 / 14 1/2 → 0.224 | 17 1/2 → 0.233 | 20/22/24 → 0.42 | 26 → 0.700
const BENTONITA_TABLA: { maxDiam: number; sacosPorPie: number }[] = [
  { maxDiam: 14.5,  sacosPorPie: 0.224 },  // 7 7/8, 9 7/8, 12 1/4, 14 1/2
  { maxDiam: 17.5,  sacosPorPie: 0.233 },  // 17 1/2
  { maxDiam: 24,    sacosPorPie: 0.420 },  // 20, 22, 24
  { maxDiam: 99,    sacosPorPie: 0.700 },  // 26+
]

export function sacosDebentonita(diametroPulg: number, profundidadPies: number): number {
  const fila = BENTONITA_TABLA.find(t => diametroPulg <= t.maxDiam) ?? BENTONITA_TABLA[BENTONITA_TABLA.length - 1]
  return Math.ceil(fila.sacosPorPie * profundidadPies)
}

// ── CATÁLOGO DE TUBERÍA ────────────────────────────────────────────────────────
// Fuente: Hoja de datos de perforaciones — precios reales
export interface TuberiaSpec {
  tipo: 'lisa' | 'ranurada'
  diametro: number    // pulgadas (6, 8, 10, 12…)
  espesor: number     // pulgadas (0.188, 0.219, 0.250…)
  precio: number      // Q por tubo
}

export const CATALOGO_TUBERIA: TuberiaSpec[] = [
  // ── Lisa ──────────────────────────────────────────
  { tipo: 'lisa', diametro: 6,  espesor: 0.188, precio: 2200 },
  { tipo: 'lisa', diametro: 8,  espesor: 0.188, precio: 2200 },
  { tipo: 'lisa', diametro: 8,  espesor: 0.219, precio: 2400 },
  { tipo: 'lisa', diametro: 8,  espesor: 0.250, precio: 2600 },
  { tipo: 'lisa', diametro: 10, espesor: 0.250, precio: 4000 },
  { tipo: 'lisa', diametro: 12, espesor: 0.250, precio: 8000 },
  // ── Ranurada ──────────────────────────────────────
  { tipo: 'ranurada', diametro: 6,  espesor: 0.188, precio: 2200 },
  { tipo: 'ranurada', diametro: 8,  espesor: 0.188, precio: 2200 },
  { tipo: 'ranurada', diametro: 8,  espesor: 0.219, precio: 2900 },
  { tipo: 'ranurada', diametro: 8,  espesor: 0.250, precio: 3200 },
  { tipo: 'ranurada', diametro: 10, espesor: 0.250, precio: 5800 },
]

export function getPrecioTuberia(tipo: 'lisa' | 'ranurada', diametro: number, espesor: number): number {
  const t = CATALOGO_TUBERIA.find(
    t => t.tipo === tipo && t.diametro === diametro && Math.abs(t.espesor - espesor) < 0.001
  )
  return t?.precio ?? 0
}

/** Espesores disponibles en catálogo para un tipo y diámetro dado */
export function getEspesoresDisponibles(tipo: 'lisa' | 'ranurada', diametro: number): number[] {
  return CATALOGO_TUBERIA
    .filter(t => t.tipo === tipo && t.diametro === diametro)
    .map(t => t.espesor)
    .sort((a, b) => a - b)
}

/** Diámetros de tubería disponibles en catálogo */
export function getDiametrosTuberia(tipo: 'lisa' | 'ranurada'): number[] {
  return [...new Set(CATALOGO_TUBERIA.filter(t => t.tipo === tipo).map(t => t.diametro))].sort((a, b) => a - b)
}

// ── CATÁLOGO PRECIO/PIE POR DIÁMETRO DE PERFORACIÓN ─────────────────────────
// Fuente: hoja de costos y precios rubros cotización
// Representa el PRECIO DE VENTA SUGERIDO al cliente según el diámetro de broca
export const PRECIOS_POR_PIE_PERFORACION: Record<number, number> = {
  // 7.875 — no aparece en hoja, dejar que usuario ingrese
  9.875: 350,
  12.25: 400,
  14.5:  500,
  17.5:  600,
  // 18 — no aparece en hoja
  20:    700,
  22:    800,
  24:    900,  // hoja muestra "23" — equivalente a 24" en nuestro catálogo
  // 26 — no aparece en hoja
}

// ── CATÁLOGO DE PRECIOS DE BROCAS ─────────────────────────────────────────────
// Costo de compra de la broca según diámetro
export const PRECIOS_BROCAS: Record<number, number> = {
  7.875:  13000,
  9.875:  13000,
  12.25:  35000,
  14.5:   45000,
  17.5:   75000,
  18:     75000,
  20:     90000,
  22:     90000,
  24:    115000,
  26:    115000,
}

// ── CONVERSIÓN PULGADAS → MM ──────────────────────────────────────────────────
// Fuente: Hoja 3 — tabla de equivalencias técnicas
export const PERFORACION_MM: Record<number, number> = {
  7.875: 200.0,
  9.875: 250.8,
  12.25: 311.2,
  14.5:  368.3,
  17.5:  444.5,
  18:    457.2,
  20:    508.0,
  22:    558.8,
  24:    609.6,
  26:    660.4,
}

export const TUBERIA_MM: Record<number, number> = {
   6: 152.4,
   8: 209.2,
  10: 254.0,
  12: 304.8,
  14: 355.6,
  16: 406.4,
}

/** Factor volumen anular m³ por pie perforado — referencia para 12 1/4" broca + 8" tubería */
export const M3_POR_PIE_GRAVA = 0.01269953

/** Calcula m³ de grava requeridos — volumen anular dinámico + 20% extra (fórmula Excel Hoja 3)
 *  PI/4 × (D_perf² - D_tub²) × 0.3048 × profundidad × 1.20   (diámetros convertidos mm→m)
 *  El 20% extra cubre asentamiento y pérdidas durante instalación.
 */
/**
 * Cantidad de camiones de flete necesarios según volumen de grava.
 * Regla de negocio:
 *   - 0 m³              → 0 camiones
 *   - 1 a 2 m³          → 1 camión
 *   - 3 m³ en adelante  → 2 camiones (el 1ro lleva 2 m³, el 2do hasta 12 m³ = 14 m³ total)
 *   - Cada 12 m³ extra  → +1 camión adicional (capacidad 12 m³/camión)
 */
export function calcCamionesFlete(m3Grava: number): number {
  if (m3Grava <= 0) return 0
  if (m3Grava <= 2) return 1
  return 1 + Math.ceil((m3Grava - 2) / 12)
}

/** Precio por camión de flete de grava (Q). Default Q 6,000. */
export const PRECIO_POR_CAMION_FLETE = 6000

/** Porcentaje del costo de flete que es costo real (el 30% restante es reserva/margen). */
export const PCT_COSTO_REAL_FLETE = 0.70

export function calcGravaM3(diametroBroca: number, diametroTuberia: number, profundidad: number): number {
  const dPerf = (PERFORACION_MM[diametroBroca] ?? 0) / 1000   // mm → m
  const dTub  = (TUBERIA_MM[diametroTuberia]   ?? 0) / 1000   // mm → m
  if (dPerf === 0 || dTub === 0) return Math.ceil(M3_POR_PIE_GRAVA * profundidad)   // fallback
  return Math.ceil(Math.PI / 4 * (dPerf ** 2 - dTub ** 2) * 0.3048 * profundidad * 1.20)
}

// ── BROCAS / DIÁMETROS DE PERFORACIÓN ────────────────────────────────────────
// Tamaños reales usados en Guatemala (fuente: hoja de datos real)
const BROCAS_FRACCION: [number, string][] = [
  [7.875, '7 7/8'],
  [9.875, '9 7/8'],
  [12.25, '12 1/4'],
  [14.5,  '14 1/2'],
  [17.5,  '17 1/2'],
  [18,    '18'],
  [20,    '20'],
  [22,    '22'],
  [24,    '24'],
  [26,    '26'],
]

export const DIAMETROS_BROCA = BROCAS_FRACCION.map(([valor, frac]) => ({
  valor,
  label: `${frac} pulgadas`,
}))

/** Formatea diámetro de perforación como fracción (ej: 12.25 → "12 1/4 pulgadas") */
export function formatBroca(diametro: number): string {
  const frac = BROCAS_FRACCION.find(([d]) => Math.abs(d - diametro) < 0.01)
  return frac ? `${frac[1]} pulgadas` : `${diametro} pulgadas`
}

// ── HORAS ADVERSAS ────────────────────────────────────────────
// Fuente: CALCULO DE HORAS ADVERSAS.xlsx
export const RENDIMIENTO_MINIMO = 2.5  // pies/hora
export const VALOR_HORA_ADVERSA = 500  // Q/hora

export function calcularHorasAdversas(piesPerforadosEnTurno: number, horasTurno = 8): number {
  const horasProductivas = piesPerforadosEnTurno / RENDIMIENTO_MINIMO
  return Math.max(0, horasTurno - horasProductivas)
}

// ════════════════════════════════════════════════════════════
// AFORO DETALLADO — Prueba de bombeo
// Fuente: COSTO DE AFORO (1).xlsx
// ════════════════════════════════════════════════════════════

export interface InputsAforoDetallado {
  // Parámetros principales
  kilometros: number            // km al punto (ida)
  precioDiesel: number          // Q/galón
  horasAforo: number            // horas de prueba de bombeo
  // Consumos
  consumoCamionGen: number      // km/gal (camión con generador)
  consumoGrua: number           // km/gal (grúa de servicio)
  galHoraGenerador: number      // gal/hora (generador durante aforo)
  // Instalación
  costoInstalacion: number      // Q (tubería columna, motor, bomba, cable)
  costoMateriales: number       // Q (materiales de empalme)
  // Personal
  personalTotal: number         // total de personas en el aforo
  dias: number                  // días que dura el aforo
  tiempos: number               // tiempos (comidas) por día
  viaticoPorTiempo: number      // Q por tiempo
  nochesHospedaje: number       // noches
  hospedajeNoche: number        // Q por noche
  ayudantes: number             // cantidad de ayudantes
  salarioAyudante: number       // Q/mes ayudante
  tecnicos: number              // cantidad de técnicos
  salarioTecnico: number        // Q/mes técnico
  // Impuestos e imprevistos
  imprevistoPct: number         // 0.10 = 10%
  isrPct: number                // 0.05 = 5%
  ivaPct: number                // 0.12 = 12%
  // Precio venta total al cliente (de ahí se deriva Q/hora)
  precioVentaTotal: number      // Q
}

export interface ResultadosAforoDetallado {
  // Combustibles
  costoCamionGen: number
  costoGrua: number
  costoGenerador: number
  costoCombustible: number
  // Otros
  costoInstalacionTotal: number  // instalación + materiales
  costoViaticos: number
  costoHospedaje: number
  costoSalarios: number
  // Subtotales
  subtotal: number              // sin imprevisto, sin impuestos
  imprevisto: number            // Q (subtotal × imprevistoPct)
  costoAforo: number            // subtotal + imprevisto
  // Impuestos (se calculan sobre el precio de venta — regla Excel)
  iva: number                   // precioVenta × ivaPct
  isr: number                   // precioVenta × isrPct
  costoConImpuestos: number     // costoAforo + iva + isr
  // Venta y utilidad
  precioVentaTotal: number
  precioVentaHora: number       // precioVentaTotal / horasAforo
  utilidad: number              // precioVentaTotal - costoConImpuestos
  utilidadPct: number           // utilidad / precioVentaTotal × 100
  costoPorHora: number          // costoConImpuestos / horasAforo
}

export function calcularAforoDetallado(inp: InputsAforoDetallado): ResultadosAforoDetallado {
  const kmIV = inp.kilometros * 2
  // Combustibles
  const galCamion = inp.consumoCamionGen > 0 ? kmIV / inp.consumoCamionGen : 0
  const galGrua = inp.consumoGrua > 0 ? kmIV / inp.consumoGrua : 0
  const galGen = inp.galHoraGenerador * inp.horasAforo
  const costoCamionGen = galCamion * inp.precioDiesel
  const costoGrua = galGrua * inp.precioDiesel
  const costoGenerador = galGen * inp.precioDiesel
  const costoCombustible = costoCamionGen + costoGrua + costoGenerador

  // Instalación
  const costoInstalacionTotal = inp.costoInstalacion + inp.costoMateriales

  // Viáticos: personal × días × tiempos × Q/tiempo
  const costoViaticos = inp.personalTotal * inp.dias * inp.tiempos * inp.viaticoPorTiempo

  // Hospedaje: personal × noches × Q/noche
  const costoHospedaje = inp.personalTotal * inp.nochesHospedaje * inp.hospedajeNoche

  // Salarios: por cargo × (salario/30) × días
  const costoSalarios =
    inp.ayudantes * (inp.salarioAyudante / 30) * inp.dias +
    inp.tecnicos  * (inp.salarioTecnico  / 30) * inp.dias

  // Subtotal
  const subtotal = costoCombustible + costoInstalacionTotal + costoViaticos + costoHospedaje + costoSalarios
  const imprevisto = subtotal * inp.imprevistoPct
  const costoAforo = subtotal + imprevisto

  // Impuestos sobre precio de venta (según Excel)
  const iva = inp.precioVentaTotal * inp.ivaPct
  const isr = inp.precioVentaTotal * inp.isrPct
  const costoConImpuestos = costoAforo + iva + isr

  const precioVentaHora = inp.horasAforo > 0 ? inp.precioVentaTotal / inp.horasAforo : 0
  const utilidad = inp.precioVentaTotal - costoConImpuestos
  const utilidadPct = inp.precioVentaTotal > 0 ? (utilidad / inp.precioVentaTotal) * 100 : 0
  const costoPorHora = inp.horasAforo > 0 ? costoConImpuestos / inp.horasAforo : 0

  return {
    costoCamionGen, costoGrua, costoGenerador, costoCombustible,
    costoInstalacionTotal, costoViaticos, costoHospedaje, costoSalarios,
    subtotal, imprevisto, costoAforo,
    iva, isr, costoConImpuestos,
    precioVentaTotal: inp.precioVentaTotal, precioVentaHora,
    utilidad, utilidadPct, costoPorHora,
  }
}

// Defaults del aforo detallado (basados en el Excel COSTO DE AFORO (1).xlsx)
export const defaultInputsAforoDetallado: InputsAforoDetallado = {
  kilometros: 100,
  precioDiesel: 28,
  horasAforo: 24,
  consumoCamionGen: 6,
  consumoGrua: 12,
  galHoraGenerador: 5,
  costoInstalacion: 600,
  costoMateriales: 1800,
  personalTotal: 3,
  dias: 3,
  tiempos: 3,
  viaticoPorTiempo: 25,
  nochesHospedaje: 3,
  hospedajeNoche: 100,
  ayudantes: 2,
  salarioAyudante: 4500,
  tecnicos: 1,
  salarioTecnico: 5000,
  imprevistoPct: 0.10,
  isrPct: 0.05,
  ivaPct: 0.12,
  precioVentaTotal: 23000,
}

// ════════════════════════════════════════════════════════════
// CALCULADORA PERFORACIÓN DE POZO
// ════════════════════════════════════════════════════════════

export interface InputsPerforacion {
  // ── Parámetros del pozo ──
  diametro: number           // diámetro de perforación / broca (ej: 12.25 = "12 1/4 pulgadas")
  diametroTuberia: number    // diámetro de tubería/casing (ej: 8, 10, 12)
  profundidad: number        // pies (ej: 800)
  precioPorPieVenta: number  // Q/pie al cliente (ej: 700-750)

  // ── Tubería (catálogo) ──
  tubosLisos: number         // unidades de tubería lisa  (~70% del total)
  tubosRanurados: number     // unidades de tubería ranurada (~30% del total)
  espesorLisa: number        // espesor tubería lisa en pulgadas (ej: 0.250)
  espesorRanurada: number    // espesor tubería ranurada en pulgadas
  tipoRanura: 'longitudinal' | 'canastilla' | 'continua'  // tipo de ranura
  slotContinua: number       // slot ranura continua: 10, 20, 30, 40, 50, 60, 70, 80

  // ── Servicios opcionales ──
  incluirRegistroElectrico: boolean  // cargo al cliente por registro eléctrico
  incluirSelloSanitario: boolean     // sello sanitario: Q7/pie de profundidad
  incluirExtraccionLodos: boolean    // extracción de lodos
  incluirSeguridad: boolean          // tubería/casing de seguridad
  incluirSanitario: boolean          // sanitario
  incluirLimpieza: boolean           // limpieza mecánica del pozo

  // ── Perforación ──
  rendimientoPorDia: number    // pies/día (default 20)
  diasExtra: number            // días adicionales de maquinaria
  costomaquinariaDia: number   // Q/día (default 4,000)
  costoDieselDia: number       // Q/día en obra (default 2,000)
  bonificacionPorPie: number   // Q/pie (default 13)

  // ── Personal ──
  personalPerforacion: number  // personas (default 3)
  salarioMensual: number       // Q/mes por persona (default 4,500)
  viaticosDia: number          // Q/día/persona (default 25)
  turnosDia: number            // tiempos/día (default 3)
  hospedajeNoche: number       // Q/noche (default 100)
  nochesHospedaje: number      // @deprecated — se reemplaza por nochesHospedajePorMes
  nochesHospedajePorMes: number  // noches de hotel por mes (default 5) — Excel reunión
  casaEquipoMensual: number    // Q/mes renta casa equipo perforación (default 2,250, editable)

  // ── Traslado — estructura exacta de COSTO TRASLADO PERFORACION.xlsx ──
  // Vehículos: 4 pesados (5 km/gal) + 2 livianos (25 km/gal)
  // Roles: personalPerforacion + 3 pilotos regulares + 1 piloto tubería + 1 supervisor
  kilometros: number              // km al sitio una vía (ej: 120 → 240 ida/vuelta)
  precioDieselTraslado: number    // Q/galón (default 28)
  diasTraslado: number            // días traslado grupo regular (default 2)
  diasTrasladoTuberia: number     // días piloto camión tubería (default 3 — trabaja un día más)
  personalTraslado: number        // @deprecated — mantener por backward compat
  salarioSupervisor: number       // Q/mes supervisor (default 6,000 — diferente a personal perf)
  nochesPersonalTraslado: number  // noches personal perforación (default 1)
  nochesPilotosTraslado: number   // noches pilotos regulares y supervisor (default 2)
  imprevistoPctTraslado: number   // factor imprevisto traslado (default 0.20 = 20%)

  // ── Split Bentonita 70/30 — demo Fase A ──
  // Cliente ve solo un % de los sacos comprados (resto queda como reserva/inventario)
  pctEntregaBentonita: number  // 0.70 default = 70% al cliente; 30% reserva

  // ── Materiales ──
  precioBentonitaSaco: number  // Q/saco (default 303 — precio real, Hoja 3)
  costoGravaPorM3: number      // Q/m³ grava (default 375)
  costoGravaMaterial: number   // Q grava material — editable, default auto-formula
  costoFleteGrava: number      // Q flete de grava (default 12,000)
  costoAforoBase: number       // Q base aforo (subtotal antes de imprevisto), default 9,290
  horasAforo: number           // horas (default 24)
  imprevistoPctAforo: number   // % imprevisto aforo (default 0.10 = 10%)

  // ── Costos adicionales de campo ──
  costoPipasAgua: number       // Q pipas de agua (default 10,000)
  costoSoldador: number        // Q soldador en obra (default 5,600)
  costoTaponTuberia: number    // Q tapón de tubería (default 800)
  comprarBroca: boolean        // Si se compra broca nueva
  costoBroca: number           // Q por broca (default 27,500)

  // ── Costos de servicios opcionales ──
  costoExtraccionLodos: number // Q total extracción de lodos (default 32,000)
  costoSeguridad: number       // Q cargo seguridad (default 200)
  costoSanitario: number       // Q baños portátiles (default 800)

  // ── Comisión ──
  comisionVendedorPct: number  // % comisión (default 1%) — se calcula sobre ingresos NETOS (bruto × 0.81)

  // ── Imprevisto global del proyecto (rubro del Excel reunión) ──
  imprevistoGlobal: number     // Q fijo editable (default 20,000)

  // ── Markup sugerido sobre el precio/pie (Excel reunión: +40%) ──
  markupPrecioPorPiePct: number  // 0.40 = +40% (editable)

  // ── Limpieza mecánica interna (cuando incluirLimpieza=true) ──
  horasLimpiezaMecanica: number  // horas de limpieza interna (default 20, Excel)

  // ── Bomba (INFORMATIVO — NO se suma al costoTotalProyecto) ──
  // El Excel no incluye bomba en servicio de perforación. Campo conservado por backward compat.
  costoBomba: number           // Q (default 27,500) — solo informativo

  // ── Aforo detallado (opcional) — si existe, reemplaza costoAforoBase legacy ──
  // Fuente: COSTO DE AFORO (1).xlsx — fórmula completa con 18 sub-inputs editables
  aforoDetallado?: InputsAforoDetallado
}

export interface ResultadosPerforacion {
  // Básicos
  diametroBroca: number        // = inp.diametro (es la broca)
  profundidadMetros: number
  diasPerforacion: number
  totalDiasMaquinaria: number

  // Tubería
  precioTubLisa: number        // Q/tubo según catálogo
  precioTubRanurada: number    // Q/tubo según catálogo

  // Ingresos
  ingresosBrutos: number
  iva: number
  isr: number
  totalImpuestos: number
  ingresosNetos: number

  // Costos por componente
  // NOTA: costoMaquinaria se mantiene aquí pero NO se incluye en costoTotalProyecto.
  // Se considera "margen reservado" (rentabilidad maquinaria) según Excel Margenes.
  costoMaquinaria: number        // @see margenMaquinaria
  margenMaquinaria: number       // = costoMaquinaria (margen reservado, NO gasto)
  costoCasaEquipo: number        // rubro NUEVO — renta casa mensual × meses del proyecto
  mesesProyecto: number          // meses redondeados hacia arriba (Math.ceil(días / 30))
  imprevistoGlobal: number       // rubro NUEVO — Q fijo del proyecto (Excel reunión)
  markupPrecioPorPiePct: number  // % markup aplicado al precio sugerido
  costoDiesel: number
  costoSalarios: number
  costoViaticos: number
  costoHospedaje: number
  costoBonificaciones: number
  costoTraslado: number          // "una vía" = precio en cotización
  imprevistoTraslado: number     // 20% de imprevisto sobre subtotal traslado
  totalTrasladoIV: number        // total ida y vuelta (informativo)
  costoBentonita: number          // costo interno: sacosBentonita × precio (180 × Q303)
  sacosBentonita: number          // sacos TOTALES comprados (requeridos para el proyecto)
  sacosEntregaCliente: number     // sacos que se cobran al cliente (sacosBentonita × pctEntrega)
  sacosReserva: number            // sacos de reserva/inventario (sacosBentonita − sacosEntregaCliente)
  valorReservaBentonita: number   // valor costo de la reserva (sacosReserva × precioBentonitaSaco)
  m3Grava: number          // m³ estimados (fórmula 0.01269953 × profundidad)
  costoGrava: number       // material solamente
  costoFleteGrava: number  // flete de grava (cargo total al cliente)
  camionesFlete: number    // cantidad de camiones necesarios (1 hasta 2m³, +1 por cada 12m³ extra)
  costoFleteReal: number   // 70% del cargo — lo que realmente se paga
  reservaFlete: number     // 30% del cargo — margen reservado (solo superadmin)
  costoTuberia: number     // tubos lisos × precio
  costoFiltros: number     // tubos ranurados × precio
  costoAforo: number
  costoLimpieza: number
  costoComision: number
  costoBomba: number
  costoSelloSanitario: number
  costoPipasAgua: number
  costoSoldador: number
  costoTaponTuberia: number
  costoBrocaCompra: number  // Q27,500 si comprarBroca=true, else 0
  costoExtraccionLodosTotal: number
  costoSeguridadTotal: number
  costoSanitarioTotal: number

  // Totales
  costoOperacionPerforacion: number  // costos internos (diésel+salarios+viáticos+casa+hospedaje+bonif+imprevisto)
  costoTotalProyecto: number         // operación + todos los materiales/servicios externos
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
  const diametroBroca = inp.diametro   // la broca ES el diámetro de perforación
  const profundidadMetros = Math.round(inp.profundidad * 0.3048)

  // Días
  const diasPerforacion = Math.ceil(inp.profundidad / inp.rendimientoPorDia)
  const totalDiasMaquinaria = diasPerforacion + inp.diasExtra

  // ── INGRESOS ──
  const ingresosBrutos = inp.precioPorPieVenta * inp.profundidad
  const iva = ingresosBrutos * IVA
  const isr = ingresosBrutos * ISR
  const totalImpuestos = iva + isr
  const ingresosNetos = ingresosBrutos - totalImpuestos

  // ── COSTOS ──
  const costoMaquinaria = totalDiasMaquinaria * inp.costomaquinariaDia
  const costoDiesel = totalDiasMaquinaria * inp.costoDieselDia
  const costoSalarios = inp.personalPerforacion * inp.salarioMensual * totalDiasMaquinaria / 30
  const costoViaticos = inp.personalPerforacion * inp.turnosDia * inp.viaticosDia * totalDiasMaquinaria

  // Meses del proyecto (30 días = 1 mes, 31 días = 2 meses…) para hospedaje y casa
  const mesesProyecto = Math.max(1, Math.ceil(totalDiasMaquinaria / 30))

  // Rubro NUEVO: casa equipo de perforación — renta mensual × meses
  const costoCasaEquipo = (inp.casaEquipoMensual ?? 2250) * mesesProyecto

  // Hospedaje por noche (aparte de la casa): noches promedio × meses × personas × Q/noche
  // (Excel reunión: ~5 noches/mes por persona a Q 100/noche)
  const nochesMes = inp.nochesHospedajePorMes ?? 5
  const costoHospedaje = inp.personalPerforacion * mesesProyecto * nochesMes * inp.hospedajeNoche

  const costoBonificaciones = inp.profundidad * inp.bonificacionPorPie

  // ── TRASLADO — fórmula exacta COSTO TRASLADO PERFORACION.xlsx ──────────────
  // Combustible: 4 pesados (5 km/gal) + 2 livianos (25 km/gal), ida y vuelta
  const kmIV = inp.kilometros * 2
  const galPesado  = kmIV / 5
  const galLiviano = kmIV / 25
  const combustibleTraslado = (galPesado * 4 + galLiviano * 2) * inp.precioDieselTraslado

  // Viáticos por rol (tiempos = días × turnosDia)
  const salDia    = inp.salarioMensual  / 30
  const salSupDia = inp.salarioSupervisor / 30
  const viatPerf    = inp.personalPerforacion * inp.diasTraslado        * inp.turnosDia * inp.viaticosDia
  const viatPilotos = 3                       * inp.diasTraslado        * inp.turnosDia * inp.viaticosDia  // 3 pilotos regulares
  const viatPilTub  = 1                       * inp.diasTrasladoTuberia * inp.turnosDia * inp.viaticosDia  // piloto camión tubería
  const viatSuper   = 1                       * inp.diasTraslado        * inp.turnosDia * inp.viaticosDia  // supervisor
  const viaticosTraslado = viatPerf + viatPilotos + viatPilTub + viatSuper

  // Salarios por rol
  const salPerf   = inp.personalPerforacion * salDia    * inp.diasTraslado
  const salPilos  = 3                       * salDia    * inp.diasTraslado        // 3 pilotos regulares
  const salPilTub = 1                       * salDia    * inp.diasTrasladoTuberia // piloto camión tubería
  const salSuper  = 1                       * salSupDia * inp.diasTraslado
  const salariosTraslado = salPerf + salPilos + salPilTub + salSuper

  // Hospedaje por rol (noches distintas según rol)
  const hospPerf    = inp.personalPerforacion * inp.nochesPersonalTraslado * inp.hospedajeNoche
  const hospPilotos = 3                       * inp.nochesPilotosTraslado  * inp.hospedajeNoche
  const hospPilTub  = 1                       * inp.diasTrasladoTuberia    * inp.hospedajeNoche
  const hospSuper   = 1                       * inp.nochesPilotosTraslado  * inp.hospedajeNoche
  const hospedajeTraslado = hospPerf + hospPilotos + hospPilTub + hospSuper

  const subtotalTraslado  = combustibleTraslado + viaticosTraslado + salariosTraslado + hospedajeTraslado
  const imprevistoTraslado = subtotalTraslado * inp.imprevistoPctTraslado
  const totalTrasladoIV   = subtotalTraslado + imprevistoTraslado
  const costoTraslado     = totalTrasladoIV / 2   // "una vía" = precio en cotización

  // Bentonita con split 70/30 (Fase A — demo)
  // Se compran TODOS los sacos (fórmula exacta), pero al cliente solo se le cobra un %.
  // La diferencia queda como "reserva" → va al inventario paralelo cuando el proyecto cierre.
  const sacosBentonita = sacosDebentonita(inp.diametro, inp.profundidad)
  const costoBentonita = sacosBentonita * inp.precioBentonitaSaco
  const pctEntrega = inp.pctEntregaBentonita ?? 0.70
  const sacosEntregaCliente = Math.round(sacosBentonita * pctEntrega)
  const sacosReserva = Math.max(0, sacosBentonita - sacosEntregaCliente)
  const valorReservaBentonita = sacosReserva * inp.precioBentonitaSaco

  // Grava — fórmula volumen anular dinámica + 20% extra (Hoja 3, verificado vs Excel)
  const m3Grava = calcGravaM3(inp.diametro, inp.diametroTuberia, inp.profundidad)
  const costoGrava = inp.costoGravaMaterial   // editable; usar botón Auto para re-calcular

  // Flete de grava — escalonado según m³. El cliente paga 100%, 70% es costo real, 30% reserva.
  const camionesFlete = calcCamionesFlete(m3Grava)
  const fleteAuto = camionesFlete * PRECIO_POR_CAMION_FLETE
  // Si el usuario lo editó manualmente (costoFleteGrava != fleteAuto), respetar override
  const costoFleteGrava = inp.costoFleteGrava > 0 ? inp.costoFleteGrava : fleteAuto
  const costoFleteReal = Math.round(costoFleteGrava * PCT_COSTO_REAL_FLETE)
  const reservaFlete = costoFleteGrava - costoFleteReal

  // Tubería — catálogo por diámetro y espesor
  const precioTubLisa     = getPrecioTuberia('lisa',     inp.diametroTuberia, inp.espesorLisa)
  const precioTubRanurada = getPrecioTuberia('ranurada', inp.diametroTuberia, inp.espesorRanurada)
  const costoTuberia = inp.tubosLisos     * precioTubLisa
  const costoFiltros = inp.tubosRanurados * precioTubRanurada

  // Sello sanitario: cap de concreto superficial (3-5 m de lechada) — costo fijo ~Q500
  const costoSelloSanitario = inp.incluirSelloSanitario ? 500 : 0

  // Aforo: si hay aforoDetallado se calcula con los 18 sub-inputs (Excel "COSTO DE AFORO (1)"),
  // sino se usa la fórmula legacy simple: base × (1 + imprev) × (1 + IVA + ISR)
  const costoAforo = inp.aforoDetallado
    ? calcularAforoDetallado({ ...inp.aforoDetallado, horasAforo: inp.horasAforo }).costoConImpuestos
    : inp.costoAforoBase * (1 + inp.imprevistoPctAforo) * (1 + IVA + ISR)

  // Limpieza mecánica interna — fórmula dinámica (Excel hoja "Limpieza mecanica")
  // 20h × Q331.79/h = Q6,635.71 en el ejemplo del Excel
  // Usa calcularLimpieza con defaults y retorna subtotalSinImprevistos (= lo que reporta Margenes)
  const costoLimpieza = inp.incluirLimpieza
    ? (() => {
        const horas = inp.horasLimpiezaMecanica ?? 20
        const r = calcularLimpieza({
          ...defaultInputsLimpieza,
          horasLimpieza: horas,
          horasDia: 10,
          diasTrabajo: Math.ceil(horas / 10),
        })
        return r.subtotalSinImprevistos
      })()
    : 0

  const costoBomba = inp.costoBomba  // informativo — NO se suma al total
  // Comisión: 1% sobre ingresos NETOS (bruto − IVA 12% − ISR 7% = bruto × 0.81)
  const costoComision = ingresosNetos * (inp.comisionVendedorPct / 100)

  // Costos adicionales de campo
  const costoPipasAgua    = inp.costoPipasAgua
  const costoSoldador     = inp.costoSoldador
  const costoTaponTuberia = inp.costoTaponTuberia
  const costoBrocaCompra  = inp.comprarBroca ? inp.costoBroca : 0

  // Servicios opcionales con costo propio (Hoja "Precio pie perforado")
  const costoExtraccionLodosTotal = inp.incluirExtraccionLodos ? inp.costoExtraccionLodos : 0
  const costoSeguridadTotal       = inp.incluirSeguridad       ? inp.costoSeguridad       : 0
  const costoSanitarioTotal       = inp.incluirSanitario       ? inp.costoSanitario       : 0

  // ── TOTAL ──
  // NOTAS IMPORTANTES:
  //   - costoMaquinaria NO se suma — el Excel lo trata como MARGEN (rentabilidad), no gasto.
  //     Se expone como resultado aparte (margenMaquinaria) para visibilidad financiera.
  //   - costoBomba NO se suma — el Excel no lo cuenta en servicio de perforación.
  // Imprevisto global fijo del proyecto (Excel reunión — rubro nuevo editable)
  const imprevistoGlobalMonto = inp.imprevistoGlobal ?? 20000

  // ── COSTO DE OPERACIÓN DE PERFORACIÓN (para calcular precio/pie) ──
  // Solo costos directos de la operación de perforación, NO materiales/servicios
  // que son líneas separadas en el PDF (bentonita, grava, tubería, aforo, etc.)
  // Fuente: Excel "PRECIO DE PIE PERFORADO reunion" — rubros que arman los Q 211,300
  const costoOperacionPerforacion =
    costoDiesel + costoSalarios + costoViaticos +
    costoCasaEquipo + costoHospedaje +
    costoBonificaciones + imprevistoGlobalMonto

  // Costo total del proyecto (para análisis de margen/utilidad — incluye TODO)
  const costoTotalProyecto =
    costoOperacionPerforacion + costoTraslado +
    costoBentonita + costoGrava + costoFleteReal + costoTuberia + costoFiltros +
    costoSelloSanitario + costoAforo + costoLimpieza + costoComision +
    costoPipasAgua + costoSoldador + costoTaponTuberia + costoBrocaCompra +
    costoExtraccionLodosTotal + costoSeguridadTotal + costoSanitarioTotal

  // ── MARGEN MAQUINARIA (rentabilidad reservada, Excel Margenes lo trata como ganancia) ──
  const margenMaquinaria = costoMaquinaria  // alias más claro para UI

  const gananciaBruta = ingresosNetos - costoTotalProyecto
  const gananciaISR   = 0  // ISR retención ya descontado en ingresosNetos; ISR corporativo anual es fuera de proyecto
  const gananciaNeta  = gananciaBruta
  const margenPct     = ingresosNetos > 0 ? (gananciaNeta / ingresosNetos) * 100 : 0

  // Precio/pie: usa SOLO costo de operación (no materiales) — fórmula Excel reunión
  // Ej: operación 211,300 / 1100 pies = 192.09 × 1.19 × 1.55 = Q 354.31/pie
  const costoPorPie = costoOperacionPerforacion / inp.profundidad
  const markupPct = inp.markupPrecioPorPiePct ?? 0.55
  const precioPorPieCalculado = costoPorPie * (1 + TOTAL_IMPUESTOS) * (1 + markupPct)

  return {
    diametroBroca, profundidadMetros, diasPerforacion, totalDiasMaquinaria,
    precioTubLisa, precioTubRanurada,
    ingresosBrutos, iva, isr, totalImpuestos, ingresosNetos,
    costoMaquinaria, margenMaquinaria, costoCasaEquipo, mesesProyecto,
    imprevistoGlobal: imprevistoGlobalMonto, markupPrecioPorPiePct: markupPct,
    costoDiesel, costoSalarios, costoViaticos,
    costoHospedaje, costoBonificaciones, costoTraslado, imprevistoTraslado, totalTrasladoIV,
    costoBentonita, sacosBentonita, sacosEntregaCliente, sacosReserva, valorReservaBentonita,
    m3Grava, costoGrava, costoFleteGrava, camionesFlete, costoFleteReal, reservaFlete,
    costoTuberia, costoFiltros, costoSelloSanitario,
    costoAforo, costoLimpieza, costoComision, costoBomba,
    costoPipasAgua, costoSoldador, costoTaponTuberia, costoBrocaCompra,
    costoExtraccionLodosTotal, costoSeguridadTotal, costoSanitarioTotal,
    costoOperacionPerforacion, costoTotalProyecto,
    gananciaBruta, gananciaISR, gananciaNeta, margenPct,
    costoPorPie, precioPorPieCalculado,
  }
}

// ════════════════════════════════════════════════════════════
// CALCULADORA LIMPIEZA MECÁNICA
// ════════════════════════════════════════════════════════════

export interface InputsLimpieza {
  horasLimpieza: number         // horas de limpieza (default 40)
  horasDia: number              // horas por día (default 10)
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
  imprevistoPctLimpieza: number // % imprevisto (default 0.10 = 10%)
  markupQuimicos?: number       // multiplicador costo → venta al cliente (default 1.5 = 50% markup)
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
  imprevisto10pct: number        // total imprevistos en Q
  imprevistoPorHora: number      // imprevistos por hora (totalGasto × 10% / horasDia)
  costoNetoHora: number          // costoPorHora + imprevistoPorHora
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
  // Estructura de días: 1 traslado + diasTrabajo + 1 regreso
  const diasTotales = 1 + inp.diasTrabajo + 1

  // ── COMBUSTIBLE ──────────────────────────────────────────────────────────────
  // Traslado (Hoja: 7 km/gal, 240 km → 34.29 gal × Q41 = Q1,405.71)
  const GAL_KM_LIMP = 7
  const galTraslado = (inp.kilometros * 2) / GAL_KM_LIMP
  const costoTraslado = galTraslado * inp.precioDiesel

  // Operativo (Hoja: 1.5 gal/hora × 20h × Q41 = Q1,230)
  const GAL_HORA_TRABAJO = 1.5
  const costoDieselTrabajo = GAL_HORA_TRABAJO * inp.horasLimpieza * inp.precioDiesel

  // ── OTROS COSTOS ─────────────────────────────────────────────────────────────
  const costoQuimicos  = inp.precioQuimicoCaneca * inp.canecasQuimicos
  const costoPersonal  = inp.personal * inp.salarioMensual * diasTotales / 30
  const costoViaticos  = inp.personal * diasTotales * 3 * inp.viaticosDiarios
  // Hospedaje: noches = díasTotales - 1 (Excel "LIMPIEZA MECANICA COSTO (3)": 2 pers × 5 noches × Q100 = Q1,000)
  const costoHospedaje = inp.personal * Math.max(0, diasTotales - 1) * inp.hospedajeDiario

  const subtotalSinImprevistos = costoTraslado + costoDieselTrabajo + costoQuimicos +
    costoPersonal + costoViaticos + costoHospedaje

  // ── IMPREVISTOS — fórmula exacta Hoja LIMPIEZA MECÁNICA ─────────────────────
  // El Excel aplica imprevistos sobre el total y divide por horasDia:
  //   imprevistoPorHora = totalGasto × 10% / horasDia
  //   (ej: Q6,635.71 × 0.10 / 10 = Q66.36/hora)
  const imprevistoPorHora  = subtotalSinImprevistos * inp.imprevistoPctLimpieza / inp.horasDia
  const imprevisto10pct    = imprevistoPorHora * inp.horasLimpieza  // total imprevistos
  const costoTotalProyecto = subtotalSinImprevistos + imprevisto10pct

  // ── POR HORA ─────────────────────────────────────────────────────────────────
  const costoPorHora  = subtotalSinImprevistos / inp.horasLimpieza
  const costoNetoHora = costoPorHora + imprevistoPorHora  // = Q398.14 con datos Excel

  // ── VENTA ─────────────────────────────────────────────────────────────────────
  const precioVentaTotal    = inp.precioVentaHora * inp.horasLimpieza
  const ivaSobreVenta       = precioVentaTotal * IVA
  const isrSobreVenta       = precioVentaTotal * 0.05  // ISR limpieza = 5%
  const precioNetoVendedor  = precioVentaTotal - ivaSobreVenta - isrSobreVenta

  const utilidadPorHora = (precioNetoVendedor - costoTotalProyecto) / inp.horasLimpieza
  const gananciaNeta    = precioNetoVendedor - costoTotalProyecto
  const margenPct       = precioVentaTotal > 0 ? (gananciaNeta / precioVentaTotal) * 100 : 0

  return {
    diasTotales, costoTraslado, costoDieselTrabajo, costoQuimicos,
    costoPersonal, costoViaticos, costoHospedaje,
    subtotalSinImprevistos, imprevisto10pct, imprevistoPorHora, costoNetoHora,
    costoTotalProyecto, costoPorHora, precioVentaTotal, ivaSobreVenta, isrSobreVenta,
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
  // Pozo
  diametro: 12.25,           // "12 1/4 pulgadas" — diámetro de perforación
  diametroTuberia: 8,        // tubería 8 pulgadas
  profundidad: 800,
  precioPorPieVenta: 750,

  // Tubería 70/30 (40 tubos total)
  tubosLisos: 28,            // 70% × 40
  tubosRanurados: 12,        // 30% × 40
  espesorLisa: 0.250,        // 8 × 0.250 = Q2,600/tubo
  espesorRanurada: 0.250,    // 8 × 0.250 = Q3,200/tubo
  tipoRanura: 'longitudinal',
  slotContinua: 20,

  // Servicios
  incluirRegistroElectrico: true,
  incluirSelloSanitario: true,
  incluirExtraccionLodos: false,
  incluirSeguridad: false,
  incluirSanitario: false,
  incluirLimpieza: true,

  // Operación (Excel reunión: maquinaria=0, diesel=2300, bonif=15)
  rendimientoPorDia: 20,
  diasExtra: 10,
  costomaquinariaDia: 0,      // Excel reunión: Q 0 (editable — margen reservado)
  costoDieselDia: 2300,       // Excel reunión: Q2,300/día diésel en perforación
  bonificacionPorPie: 15,     // Excel reunión: Q15/pie
  personalPerforacion: 3,
  salarioMensual: 4500,
  viaticosDia: 25,
  turnosDia: 3,
  hospedajeNoche: 100,          // Q100/noche (hotel, aparte de la casa mensual)
  nochesHospedaje: 30,          // @deprecated — reemplazado por nochesHospedajePorMes
  nochesHospedajePorMes: 5,     // noches de hotel estimadas por mes (Excel reunión)
  casaEquipoMensual: 2250,      // Q/mes renta casa donde se queda el equipo (nuevo rubro)

  // Traslado — valores reales del Excel COSTO TRASLADO PERFORACION.xlsx
  kilometros: 120,
  precioDieselTraslado: 28,
  diasTraslado: 2,
  diasTrasladoTuberia: 3,          // piloto camión tubería: 1 día extra
  personalTraslado: 7,             // @deprecated — no usado en fórmula
  salarioSupervisor: 6000,         // Q6,000/mes (diferente al personal de perforación)
  nochesPersonalTraslado: 1,       // 1 noche para personal de perforación
  nochesPilotosTraslado: 2,        // 2 noches para pilotos regulares y supervisor
  imprevistoPctTraslado: 0.20,     // 20% de imprevisto sobre subtotal traslado

  // Split bentonita 70/30 — Fase A demo
  pctEntregaBentonita: 0.70,     // 70% al cliente / 30% reserva para inventario

  // Materiales
  precioBentonitaSaco: 303,      // Q303/saco — precio real (Hoja 3)
  costoGravaPorM3: 375,          // Q375/m³ — tasa grava (Hoja 3)
  costoGravaMaterial: 4875,      // grava material — ver botón Auto en UI
  costoFleteGrava: 0,            // auto-calcula por m³ (12m³/camión, Q6,000/camión). 0 = auto; >0 = override manual.
  costoAforoBase: 9290,        // subtotal real (Hoja AFORO.xlsx verificada)
  horasAforo: 24,
  imprevistoPctAforo: 0.10,   // 10% imprevistos sobre subtotal aforo

  // Costos adicionales de campo
  costoPipasAgua: 10000,
  costoSoldador: 5600,
  costoTaponTuberia: 800,
  comprarBroca: false,
  costoBroca: 27500,

  // Servicios opcionales con costo (Hoja "Precio pie perforado")
  costoExtraccionLodos: 32000, // Q20,000 base + Q12,000 adicional = Q32,000
  costoSeguridad: 200,         // cargo de seguridad
  costoSanitario: 800,         // baños portátiles

  // Comisión / Limpieza / Bomba / Imprevistos / Markup
  comisionVendedorPct: 1,
  horasLimpiezaMecanica: 20,  // horas de limpieza interna (Excel ejemplo: 20h)
  costoBomba: 27500,          // informativo — NO suma al costoTotalProyecto
  imprevistoGlobal: 20000,    // Excel reunión: Q 20,000 rubro fijo (editable)
  markupPrecioPorPiePct: 0.55, // Excel "PRECIO DE PIE PERFORADO reunion": +55% sobre precio neto/pie

  // Aforo detallado (Excel "COSTO DE AFORO (1)") — activo por default
  aforoDetallado: defaultInputsAforoDetallado,
}

export const defaultInputsLimpieza: InputsLimpieza = {
  horasLimpieza: 40,           // horas total de trabajo
  horasDia: 10,                // horas por día → diasTrabajo = 40/10 = 4
  precioVentaHora: 375,        // Excel LIMPIEZA MECANICA COSTO (3): Q375/h
  kilometros: 100,             // Excel (3): 100 km al sitio
  precioDiesel: 41,
  personal: 2,
  diasTrabajo: 4,              // diasTotales = 1+4+1 = 6 para proyecto de 40h
  viaticosDiarios: 25,
  hospedajeDiario: 100,
  salarioMensual: 4500,
  precioQuimicoCaneca: 700,
  canecasQuimicos: 2,
  imprevistoPctLimpieza: 0.10, // 10% imprevistos (Hoja verificada)
  markupQuimicos: 1.5,         // 50% markup sobre costo — editable en Configuración
}

// ── UTILIDADES ────────────────────────────────────────────────────────────────
export const formatQ = (n: number) =>
  'Q ' + Math.round(n).toLocaleString('es-GT', { minimumFractionDigits: 0 })

export const formatQDecimal = (n: number) =>
  'Q ' + n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
