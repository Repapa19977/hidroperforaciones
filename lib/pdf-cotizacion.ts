// Genera PDF de una cotización replicando el formato oficial P5332 de Hidroperforaciones, S.A.
// Página 1: encabezado + datos cliente + plan de pagos + tabla de servicios + totales + cuentas bancarias
// Página 2: Condiciones Importantes (22 puntos legales)

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { QuotationData, HitoPago } from './quotation-store'
import { DEFAULT_PLAN_PAGOS, getLineaConfig } from './quotation-store'
import { calcularPerforacion, calcularLimpieza, defaultInputsPerforacion, defaultInputsLimpieza, IVA, ISR, formatBroca, pipasClienteCantidad, camionadasGrava } from './calculator'
import type { InputsPerforacion, InputsLimpieza } from './calculator'
import { DEFAULT_CONFIG, DEFAULT_PRECIOS_LINEAS, type AppConfig, type PreciosLineas, type CuentaBancaria } from './config-store'
import { COSTOS_BASE } from './costos-base'
import { numeroADolaresEnLetras, numeroAQuetzalesEnLetras } from './numero-a-letras'
import { resolverCondiciones } from './condiciones-perf'
import { formatFechaDDMMYYYY } from './date-format'
import { convertFromGTQ, formatCurrency, normalizeCurrency, normalizeExchangeRate } from './currency'

// ── Colores ──────────────────────────────────────────────────────────────────
const WHITE  = '#ffffff'

// ── Constructores de líneas — formato idéntico a Odoo ────────────────────────
export function buildLineasPerf(
  ip: InputsPerforacion,
  res: ReturnType<typeof calcularPerforacion>,
  pl: PreciosLineas = DEFAULT_PRECIOS_LINEAS,
  mostrarEspesor = false,
  descripcionSimple = false,
  preciosVentaOverride: Record<string, number> = {},
  opcionesVenta: Partial<Pick<AppConfig, 'pipaPrecioVentaUnitario' | 'camionadaGravaPrecioVentaUnitario' | 'capacidadCamionM3'>> = {},
) {
  const pipaPrecioVenta     = opcionesVenta.pipaPrecioVentaUnitario ?? DEFAULT_CONFIG.pipaPrecioVentaUnitario
  const camionadaPrecioVta  = opcionesVenta.camionadaGravaPrecioVentaUnitario ?? DEFAULT_CONFIG.camionadaGravaPrecioVentaUnitario
  const capacidadCamion     = opcionesVenta.capacidadCamionM3 ?? DEFAULT_CONFIG.capacidadCamionM3
  const pipasAlCliente      = pipasClienteCantidad(ip.profundidad, ip.rendimientoPorDia ?? 20)
  const camionadasAlCliente = camionadasGrava(res.m3Grava, capacidadCamion)
  const piesLisa       = ip.tubosLisos     * 20
  const piesRan        = ip.tubosRanurados * 20
  // Venta al cliente = costo × 1.30 (markup 30% sobre costo nuestro) — instrucción René 2026-04-20
  const MARKUP_TUBERIA = 1.30
  const precioLisaPie  = piesLisa > 0 ? Math.round((res.precioTubLisa     * MARKUP_TUBERIA) / 20) : 0
  const precioRanPie   = piesRan  > 0 ? Math.round((res.precioTubRanurada * MARKUP_TUBERIA) / 20) : 0
  const precioSacoBent = preciosVentaOverride['bentonita'] ?? COSTOS_BASE.bentonita.precioVentaUnitario
  const precioGravam3  = preciosVentaOverride['grava']     ?? COSTOS_BASE.grava.precioVentaUnitario

  const tipoRanura   = (ip as { tipoRanura?: string }).tipoRanura ?? 'longitudinal'
  const slotContinua = (ip as { slotContinua?: number }).slotContinua ?? 20
  const espStr = !descripcionSimple && mostrarEspesor
  const nomLisa = descripcionSimple
    ? `Tubería de revestimiento lisa ${ip.diametroTuberia} pulgadas`
    : `Tubería lisa${espStr ? ` espesor ${ip.espesorLisa} pulgadas,` : ''} ${ip.diametroTuberia} pulgadas de diámetro BPE ASTM, incluye flete, carga y descarga.`
  const nomRanurada = descripcionSimple
    ? `Tubería de revestimiento ranurada ${ip.diametroTuberia} pulgadas`
    : tipoRanura === 'canastilla'
      ? `Tubería ranurada tipo canastilla${espStr ? ` espesor ${ip.espesorRanurada} pulgadas,` : ''} ${ip.diametroTuberia} pulgadas de diámetro BPE ASTM, incluye flete, carga y descarga.`
      : tipoRanura === 'continua'
        ? `Tubería ranurada continua slot ${slotContinua}, ${ip.diametroTuberia} pulgadas de diámetro BPE ASTM, incluye flete, carga y descarga.`
        : `Tubería con ranura longitudinal${espStr ? ` espesor ${ip.espesorRanurada} pulgadas,` : ''} ${ip.diametroTuberia} pulgadas de diámetro BPE ASTM, incluye flete, carga y descarga.`

  const rows = [
    { key: 'traslado-equipo',
      nombre: 'Traslado del equipo de perforación al área de trabajo. Incluye traslado de maquina perforadora, camión grúa con barras de perforación e insumos de trabajo y traslado de personal.',
      unidad: 'Global', cant: 1, precio: Math.round(res.costoTraslado) },

    { key: 'instalacion-equipo',
      nombre: 'Montaje, desmontaje y nivelación del equipo de perforación en el punto seleccionado, excavación de pila para fluidos Bentoníticos, y excavación de corrida de lodos, descarga de herramienta para perforación.',
      unidad: 'Global', cant: 1, precio: pl.instalacionEquipo },

    // Rubro 3: se ajusta al final como RESIDUAL para que
    // subtotal + IVA + ISR = profundidad × ip.precioPorPieVenta
    { key: 'perforacion',
      nombre: `Perforación de pozo mecánico en ${formatBroca(ip.diametro)} de diámetro.`,
      unidad: 'Pie', cant: ip.profundidad, precio: 0 },

    { key: 'bentonita',
      nombre: 'Bentonita (sódica) para formación de pared, aditivos y polímeros para inhibir arcilla, nivelación de PH, viscosificador para extracción del corte y lubricador de herramienta y cualquier otro aditivo que sea necesario aplicar dependiendo de las condiciones geológicas.',
      unidad: 'Saco',
      cant: Math.round(res.sacosEntregaCliente),  // Fase A: cliente solo ve 70% (resto queda en reserva)
      precio: precioSacoBent },

    { key: 'pipas-agua',
      nombre: 'Pipas para abastecimiento de agua para perforación.',
      unidad: 'Pipa', cant: pipasAlCliente, precio: preciosVentaOverride['pipas-agua'] ?? pipaPrecioVenta },

    ...(ip.incluirRegistroElectrico ? [{ key: 'registro-electrico',
      nombre: 'Registro eléctrico para la detección de formaciones permeables.',
      unidad: 'Und', cant: 1, precio: pl.registroElectrico }] : []),

    { key: 'tuberia-lisa',
      nombre: nomLisa,
      unidad: 'Pie', cant: piesLisa, precio: precioLisaPie },

    { key: 'tuberia-ranurada',
      nombre: nomRanurada,
      unidad: 'Pie', cant: piesRan, precio: precioRanPie },

    { key: 'colocacion-ademe',
      nombre: 'Colocación de tubería (ADEME). Incluye combustible para entubar y maquina soldadora, colocación de topes, equipo de soldadura autógena y electrodo.',
      unidad: 'Pie', cant: ip.profundidad, precio: pl.colocacionTuberia },

    { key: 'grava-material',
      nombre: 'Grava o piedrín de calibre seleccionado para filtro.',
      unidad: 'MT3', cant: res.m3Grava, precio: precioGravam3 },

    { key: 'transporte-grava',
      nombre: 'Transporte de grava o piedrín al área de trabajo.',
      unidad: 'Camionada', cant: camionadasAlCliente, precio: preciosVentaOverride['transporte-grava'] ?? camionadaPrecioVta },

    { key: 'instalacion-grava',
      nombre: 'Instalación de grava o piedrín de calibre seleccionado para filtro.',
      unidad: 'MT3', cant: res.m3Grava, precio: pl.instalacionGrava },

    ...(ip.incluirSelloSanitario ? [{ key: 'sello-sanitario',
      nombre: 'Instalación de sello sanitario de concreto.',
      // Precio por pie × pies de sello (NO es la profundidad total del pozo).
      // Regla de 3 del jefe 2026-04-20: 20 pies = Q1,500 → Q75/pie. Rango típico 10-40 pies.
      unidad: 'Und', cant: 1, precio: Math.round(pl.selloSanitario * (ip.piesSelloSanitario ?? 20)) }] : []),

    { key: 'sopleteado',
      nombre: 'Sopleteado con compresor para acomodamiento de la grava y agitación del acuífero.',
      unidad: 'Hora', cant: 1, precio: pl.sopleteado },

    // Línea 14 y 15 separadas nuevamente (desecha la unificación previa)
    ...(ip.incluirLimpieza ? [{ key: 'limpieza-mecanica',
      nombre: 'Limpieza mecánica que incluye cubeteado, pistoneado y desarenado.',
      unidad: 'Hora', cant: 20, precio: pl.precioLimpiezaHora }] : []),

    ...(ip.incluirExtraccionLodos ? [{ key: 'extraccion-lodos',
      nombre: 'Desarrollo y limpieza. Extracción de lodos bentoníticos mediante bomba de émbolo.',
      unidad: 'Global', cant: 1, precio: pl.desarrolloLimpieza }] : []),

    // Línea unificada: traslado generador + prueba de bombeo (por hora).
    // Precio/hora se deriva de aforoDetallado.precioVentaTotal / horas; si no, usa pl.pruebaBombeo.
    { key: 'prueba-bombeo',
      nombre: 'Traslado de generador con camión grúa al punto de trabajo, generador eléctrico, suministro de tubería, cable eléctrico, bomba, motor e instalación. Prueba de bombeo, incluye combustible para generador, supervisión, monitoreo de prueba e informe final.',
      unidad: 'Hora',
      cant: ip.horasAforo,
      precio: ip.aforoDetallado
        ? Math.round((ip.aforoDetallado.precioVentaTotal / ip.horasAforo) * 100) / 100
        : pl.pruebaBombeo },

    { key: 'brocal',
      nombre: 'Brocal de concreto.',
      unidad: 'Und', cant: 1, precio: pl.brocal },

    { key: 'analisis-combinado',
      nombre: 'Análisis Físico - Químico y Bacteriológico del Agua.',
      unidad: 'Und', cant: 1, precio: pl.analisisCombinado },
  ]

  // Aplicar preciosVentaOverride a CUALQUIER rubro (menos rubro 3 que es residual).
  // Así cualquier cambio hecho desde el modal de comparativa se refleja en la cotización
  // y en el PDF automáticamente. Los rubros que ya tenían override inline (bentonita,
  // grava-material, pipas-agua, transporte-grava) siguen funcionando porque el override
  // ya se aplicó arriba — aquí solo cubrimos los que faltaban.
  const rowsConOverride = rows.map(r => {
    if (r.key === 'perforacion') return r  // el rubro 3 lo calcula el residual, no override
    const nuevoPrecio = preciosVentaOverride[r.key]
    return typeof nuevoPrecio === 'number' ? { ...r, precio: nuevoPrecio } : r
  })

  // Construir totales iniciales
  const built = rowsConOverride.map(r => ({ ...r, total: r.cant * r.precio }))

  // Rubro 3 residual: precio/pie = "con IVA e ISR incluidos". Divisor fijo 1.17.
  // Subtotal queda estable y los toggles IVA/ISR suman/restan al total final.
  const totalClienteObjetivo = ip.profundidad * ip.precioPorPieVenta
  const FACTOR_IMPUESTOS_COMPLETO = 1 + IVA + ISR  // 1.17 — fijo, no depende de toggles
  const subtotalObjetivo = totalClienteObjetivo / FACTOR_IMPUESTOS_COMPLETO
  const perfIdx = built.findIndex(l => l.key === 'perforacion')
  if (perfIdx >= 0 && ip.profundidad > 0) {
    const sumaOtros = built.reduce((acc, l, i) => i === perfIdx ? acc : acc + l.total, 0)
    const totalPerforacion = Math.max(0, subtotalObjetivo - sumaOtros)
    built[perfIdx] = {
      ...built[perfIdx],
      precio: Math.round((totalPerforacion / ip.profundidad) * 100) / 100,
      total: totalPerforacion,
    }
  }

  return built.filter(r => r.total > 0)
}

function buildLineasLimp(
  il: InputsLimpieza,
  res: ReturnType<typeof calcularLimpieza>,
  preciosVentaOverride: Record<string, number> = {},
) {
  const subtipo = il.servicioSubtipo ?? 'basico'
  const usaServicioBasico = subtipo === 'basico' || subtipo === 'completo'
  const usaAforo = subtipo === 'aforo' || subtipo === 'completo'
  const rows: Array<{ key: string; nombre: string; unidad: string; cant: number; precio: number; total: number }> = []
  const precioDe = (key: string, fallback: number) => {
    const override = preciosVentaOverride[key]
    return typeof override === 'number' && Number.isFinite(override) ? Math.max(0, override) : Math.max(0, fallback)
  }

  if (usaServicioBasico) {
    rows.push({
      key: 'traslado-limp',
      nombre: `Traslado de maquinaria al lugar del servicio (${res.kmIdaVuelta.toFixed(1)} km / ${il.servicioTrasladoKmGalon ?? 20} km gal)`,
      unidad: 'Global',
      cant: 1,
      precio: precioDe('traslado-limp', res.precioVentaTrasladoServicio),
      total: 0,
    })
  }

  const diametroServicio = il.diametroTuberiaServicio && il.diametroTuberiaServicio !== 'Ninguna'
    ? `, diametro ${il.diametroTuberiaServicio}`
    : ''
  const tubosExtraccion = res.servicioTuberiaModo === 'instalacion' ? 0 : res.cantidadTuberiaServicio
  const tubosInstalacion = res.servicioTuberiaModo === 'extraccion' ? 0 : res.cantidadTuberiaServicio

  if (usaServicioBasico) {
    rows.push({
      key: 'extraccion-tuberia-servicio',
      nombre: `Extraccion de tuberia de HG de columna y equipo sumergible: bomba, motor y cable${diametroServicio}`,
      unidad: 'Tubo',
      cant: tubosExtraccion,
      precio: precioDe('extraccion-tuberia-servicio', res.precioVentaTuboExtraccionUnitario),
      total: 0,
    })
  }

  if (usaServicioBasico) {
    rows.push({
      key: 'instalacion-tuberia-servicio',
      nombre: `Instalacion de tuberia de HG de columna y equipo sumergible: bomba, motor y cable${diametroServicio}`,
      unidad: 'Tubo',
      cant: tubosInstalacion,
      precio: precioDe('instalacion-tuberia-servicio', res.precioVentaTuboInstalacionUnitario),
      total: 0,
    })
  }

  if (usaServicioBasico) {
    rows.push({
      key: 'quimicos-limp',
      nombre: 'Caneca de quimico calera para limpieza de incrustacion y eliminacion de ferrobacteria',
      unidad: 'Caneca',
      cant: res.canecasQuimicosServicio,
      precio: precioDe('quimicos-limp', res.precioVentaQuimicoCaneca),
      total: 0,
    })
  }

  if (usaServicioBasico) {
    rows.push({
      key: 'limpieza-horas',
      nombre: `Limpieza mecanica que incluye cubeteado, cepillado y pistoneado (${il.horasLimpieza} horas)`,
      unidad: 'Hora',
      cant: Math.max(0, il.horasLimpieza),
      precio: precioDe('limpieza-horas', il.precioVentaHora),
      total: 0,
    })
  }

  if (usaServicioBasico) {
    rows.push({
      key: 'tecnico-chequeo-servicio',
      nombre: 'Tecnico para chequeo de equipo sumergible, medicion de parametros, limpieza de panel de control, instalacion, arranque y pruebas',
      unidad: 'Global',
      cant: 1,
      precio: precioDe('tecnico-chequeo-servicio', il.precioTecnicoChequeoServicio ?? 0),
      total: 0,
    })
  }

  if (usaServicioBasico) {
    rows.push({
      key: 'material-instalacion-servicio',
      nombre: 'Material de instalacion y mano de obra',
      unidad: 'Global',
      cant: 1,
      precio: precioDe('material-instalacion-servicio', il.precioMaterialInstalacionServicio ?? 0),
      total: 0,
    })
  }

  if (usaServicioBasico) {
    rows.push({
      key: 'inspeccion-camara',
      nombre: 'Camareo: introduccion de sonda con camara para evaluar el pozo y tuberia de ADEME. Incluye quimico clasificador',
      unidad: 'Global',
      cant: 1,
      precio: precioDe('inspeccion-camara', il.inspeccionCamara ? res.precioVentaCamara : 0),
      total: 0,
    })
  }

  if (usaServicioBasico) {
    rows.push({
      key: 'medicion-nivel-agua',
      nombre: 'Medicion de nivel del agua por sonda en linea piezometrica o linea de aire',
      unidad: 'Global',
      cant: 1,
      precio: precioDe('medicion-nivel-agua', il.precioMedicionNivelServicio ?? 0),
      total: 0,
    })
  }

  if (usaServicioBasico) {
    rows.push({
      key: 'analisis-agua-servicio',
      nombre: 'Analisis fisico-quimico y bacteriologico del agua',
      unidad: 'Unidad',
      cant: 1,
      precio: precioDe('analisis-agua-servicio', il.precioAnalisisAguaServicio ?? 0),
      total: 0,
    })
  }

  if (usaAforo) {
    const horas = il.horasAforo ?? 0
    rows.push(
      { key: 'aforo-personal-servicio', nombre: 'Personal', unidad: 'Global', cant: 1, precio: precioDe('aforo-personal-servicio', 0), total: 0 },
      { key: 'aforo-traslado-generador', nombre: 'Traslado de generador', unidad: 'Global', cant: 1, precio: precioDe('aforo-traslado-generador', 0), total: 0 },
      { key: 'aforo-regreso-generador', nombre: 'Regreso del generador', unidad: 'Global', cant: 1, precio: precioDe('aforo-regreso-generador', 0), total: 0 },
      { key: 'aforo-instalacion-tuberia', nombre: 'Instalacion de tuberia de columna para aforo', unidad: 'Global', cant: 1, precio: precioDe('aforo-instalacion-tuberia', 0), total: 0 },
      { key: 'aforo-horas-servicio', nombre: `Horas de aforo (${horas} horas)`, unidad: 'Global', cant: 1, precio: precioDe('aforo-horas-servicio', il.precioVentaAforoTotal ?? 23000), total: 0 },
      { key: 'aforo-generador-servicio', nombre: 'Generador', unidad: 'Global', cant: 1, precio: precioDe('aforo-generador-servicio', 0), total: 0 },
      { key: 'aforo-desinstalacion-tuberia', nombre: 'Desinstalacion de tuberia de columna para aforo', unidad: 'Global', cant: 1, precio: precioDe('aforo-desinstalacion-tuberia', 0), total: 0 },
    )
  }

  return rows.map(r => ({ ...r, total: r.cant * r.precio }))
}

// ── Helpers ───────────────────────────────────────────────────────────────────
type LegacyInputsPerforacion = Partial<InputsPerforacion> & {
  numeroDeTubos?: number
  numeroDeFilteros?: number
  costoGravaTotalQ?: number
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function normalizarPerforacion(ip: InputsPerforacion): InputsPerforacion {
  const legacy = ip as LegacyInputsPerforacion
  const esLegacy =
    typeof legacy.numeroDeTubos === 'number' ||
    typeof legacy.numeroDeFilteros === 'number' ||
    typeof legacy.tubosLisos !== 'number' ||
    typeof legacy.tubosRanurados !== 'number'

  const normalizada: InputsPerforacion = { ...defaultInputsPerforacion, ...ip }

  if (esLegacy) {
    normalizada.tubosLisos = num(legacy.tubosLisos, num(legacy.numeroDeTubos, defaultInputsPerforacion.tubosLisos))
    normalizada.tubosRanurados = num(legacy.tubosRanurados, num(legacy.numeroDeFilteros, defaultInputsPerforacion.tubosRanurados))
    normalizada.costoGravaMaterial = num(legacy.costoGravaMaterial, num(legacy.costoGravaTotalQ, defaultInputsPerforacion.costoGravaMaterial))
    normalizada.incluirRegistroElectrico = typeof legacy.incluirRegistroElectrico === 'boolean' ? legacy.incluirRegistroElectrico : false
    normalizada.incluirSelloSanitario = typeof legacy.incluirSelloSanitario === 'boolean' ? legacy.incluirSelloSanitario : false
    normalizada.incluirExtraccionLodos = typeof legacy.incluirExtraccionLodos === 'boolean' ? legacy.incluirExtraccionLodos : false
    normalizada.incluirSeguridad = typeof legacy.incluirSeguridad === 'boolean' ? legacy.incluirSeguridad : false
    normalizada.incluirSanitario = typeof legacy.incluirSanitario === 'boolean' ? legacy.incluirSanitario : false
    normalizada.aforoDetallado = legacy.aforoDetallado
  }

  return normalizada
}

function normalizarLimpieza(il: InputsLimpieza): InputsLimpieza {
  return { ...defaultInputsLimpieza, ...il }
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

function repararMojibake(texto: string): string {
  if (!/[ÃÂ]/.test(texto)) return texto
  try {
    const bytes = new Uint8Array(Array.from(texto, ch => ch.charCodeAt(0) & 0xff))
    const reparado = new TextDecoder('utf-8').decode(bytes)
    return reparado.includes('\uFFFD') ? texto : reparado
  } catch {
    return texto
  }
}

function textoSeguroPdf(texto: string): string {
  return repararMojibake(texto)
    .normalize('NFC')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\u00f7/g, '/')
}

async function cargarLogoBase64(): Promise<string | null> {
  for (const ruta of ['/pdf-assets/logo.png', '/logo.png']) {
    try {
      const res = await fetch(ruta)
      if (!res.ok) continue
      const blob = await res.blob()
      const dataUrl = await new Promise<string | null>(resolve => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(blob)
      })
      if (dataUrl) return dataUrl
    } catch { /* fallback a la siguiente ruta */ }
  }
  return null
}

// Convierte "Banco Industrial" → "banco-industrial", "BAC Credomatic" → "bac-credomatic".
// Solo letras ASCII, números y guiones.
function slugifyBanco(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'y')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Carga el PNG de un logo de banco desde /public/banks/<slug>.png.
// Devuelve { dataUrl, width, height } o null si no existe.
async function cargarLogoBanco(banco: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  const slug = slugifyBanco(banco)
  for (const ruta of [`/pdf-assets/banks/${slug}.png`, `/banks/${slug}.png`]) {
    try {
      const res = await fetch(ruta)
      if (!res.ok) continue
      const blob = await res.blob()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('read fail'))
        reader.readAsDataURL(blob)
      })
      // Obtener dimensiones reales para mantener aspect ratio
      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        const img = new Image()
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
        img.onerror = () => resolve({ w: 100, h: 60 })
        img.src = dataUrl
      })
      return { dataUrl, w: dims.w, h: dims.h }
    } catch { /* fallback a la siguiente ruta */ }
  }
  return null
}

// ── Generador principal ───────────────────────────────────────────────────────
// Estrategia: el contenido se dibuja primero (paginación dinámica, puede ser 2, 3 o más páginas).
// Al final se recorre cada página y se estampa header + footer con el total de páginas correcto.
export async function generarPDF(
  data: QuotationData,
  cuentasBancarias?: CuentaBancaria[]
): Promise<Uint8Array> {
  const logoDataUrl = await cargarLogoBase64()

  const doc = new jsPDF({ format: 'letter', unit: 'mm', orientation: 'portrait' })
  const W  = doc.internal.pageSize.getWidth()
  const H  = doc.internal.pageSize.getHeight()
  const mg = 14

  // ── Preparar líneas y totales ─────────────────────────────────────────────────
  const pl = { ...DEFAULT_PRECIOS_LINEAS, ...data.preciosLineas }
  const lineasActivas = data.lineasActivas ?? {}
  const lineasConfig  = data.lineasConfig  ?? {}
  const preciosVentaOverride = data.preciosVentaOverride ?? {}
  const mostrarEspesor = data.mostrarEspesor ?? false
  const descripcionSimple = data.descripcionSimple ?? false
  const ip = data.ip ? normalizarPerforacion(data.ip) : null
  const il = data.il ? normalizarLimpieza(data.il) : null
  const resPerf = ip ? calcularPerforacion(ip) : null
  const resLimp = il ? calcularLimpieza(il) : null

  type LineaBase = { key: string; nombre: string; unidad: string; cant: number; precio: number; total: number }
  type LineaFinal = LineaBase & { esExtra?: boolean; extraMostrar?: boolean; extraCobrar?: boolean }

  const opcionesVenta = {
    pipaPrecioVentaUnitario: data.pipaPrecioVentaUnitario,
    camionadaGravaPrecioVentaUnitario: data.camionadaGravaPrecioVentaUnitario,
    capacidadCamionM3: data.capacidadCamionM3,
  }
  const lineasBase: LineaBase[] = data.tipo === 'perforacion' && ip && resPerf
    ? buildLineasPerf(ip, resPerf, pl, mostrarEspesor, descripcionSimple, preciosVentaOverride, opcionesVenta)
    : il && resLimp
      ? buildLineasLimp(il, resLimp, preciosVentaOverride)
      : []

  // Líneas extras (custom) agregadas por el usuario — se suman al final de la tabla
  // Se excluyen items vacíos (sin nombre, sin cantidad o sin precio) para no ensuciar el PDF
  const extras: LineaFinal[] = (data.lineasExtras ?? [])
    .filter(e =>
      e.cantidad > 0 &&
      (e.nombre || '').trim().length > 0
    )
    .map(e => {
      // Nombre visible = título. Descripción concatenada con punto + espacio para contexto al cliente
      const desc = (e.descripcion ?? '').trim()
      const nombreCompleto = desc ? `${e.nombre}. ${desc}` : e.nombre
      return {
        key: e.id,
        nombre: nombreCompleto,
        unidad: e.unidad || 'Unidad',
        cant: e.cantidad,
        precio: e.precioVentaUnitario,
        total: e.cantidad * e.precioVentaUnitario,
        esExtra: true,
        extraMostrar: e.mostrar,
        extraCobrar: e.cobrar,
      }
    })

  const todasLineas: LineaFinal[] = [...lineasBase, ...extras]

  const esVisible = (l: LineaFinal) =>
    l.esExtra ? (l.extraMostrar ?? true) : getLineaConfig(l.key, lineasConfig, lineasActivas).mostrar
  const esCobrada = (l: LineaFinal) =>
    l.esExtra ? (l.extraCobrar ?? true) : getLineaConfig(l.key, lineasConfig, lineasActivas).cobrar

  const lineas = todasLineas.filter(esVisible)
  const subtotal = todasLineas.filter(esCobrada).reduce((a, b) => a + b.total, 0)

  // Toggles de impuestos — controlados por el usuario en la cotización
  const aplicarIva = data.aplicarIva ?? true   // default: incluye IVA 12%
  const aplicarIsr = data.aplicarIsr ?? false  // default: no suma ISR
  const mostrarDesgloseImpuestos = data.mostrarDesgloseImpuestos ?? false
  // Descuento especial — resta al subtotal antes de calcular impuestos
  const aplicarDescuento = data.aplicarDescuento ?? false
  const descuentoMonto   = Math.max(0, Number(data.descuentoMonto ?? 0))
  const descuentoQ       = aplicarDescuento ? Math.min(subtotal, descuentoMonto) : 0
  const baseGravable     = subtotal - descuentoQ
  const iva = aplicarIva ? Math.round(baseGravable * IVA) : 0
  const isr = aplicarIsr ? Math.round(baseGravable * ISR) : 0
  const totalCalculado = baseGravable + iva + isr
  const totalGuardado = typeof data.montoGuardado === 'number' && Number.isFinite(data.montoGuardado) && data.montoGuardado > 0
    ? data.montoGuardado
    : null
  const total = totalGuardado ?? totalCalculado
  const monedaCotizacion = normalizeCurrency(data.monedaCotizacion)
  const tipoCambioCotizacion = normalizeExchangeRate(data.tipoCambioUsd)
  const formatMonto = (montoQ: number) => formatCurrency(montoQ, monedaCotizacion, tipoCambioCotizacion)

  // Valor por pie del pie del PDF = total / profundidad (por construcción del residual
  // total del PDF = profundidad × ip.precioPorPieVenta, entonces esto = precio/pie manual)
  const valorPorPie = ip && ip.profundidad > 0 ? Math.round(total / ip.profundidad) : 0
  const totalVista = convertFromGTQ(total, monedaCotizacion, tipoCambioCotizacion)
  const totalEnLetras = monedaCotizacion === 'USD'
    ? numeroADolaresEnLetras(totalVista)
    : numeroAQuetzalesEnLetras(total)

  // Condiciones legales de perforación: 18 del catálogo (con overrides) + extras del usuario.
  const condicionesPerf = data.tipo === 'perforacion'
    ? resolverCondiciones(data.condicionesPerfOverride, data.condicionesPerfExtras)
    : []

  // Para limpieza usamos el string libre (de momento; se convertirá a catálogo en Fase L)
  const condicionesLimpText = data.tipo === 'limpieza'
    ? (data.condicionesLimp ?? data.condiciones ?? '')
    : ''

  const emailVendedor = `ventas@hidroperforaciones.com`
  const telVendedor   = `55999998`
  const fechaCotizacion = formatFechaDDMMYYYY(data.fecha)

  const mostrarNotaCheque = data.mostrarNotaCheque ?? false
  const cuentas = cuentasBancarias ?? []
  const logosBancos = await Promise.all(cuentas.map(c => cargarLogoBanco(c.banco)))
  const hitos: HitoPago[] = (data.planPagos && data.planPagos.length > 0)
    ? data.planPagos
    : DEFAULT_PLAN_PAGOS
  const hitosActivos = hitos.filter(h => h.visible !== false && h.pct > 0)

  const rgb = (hex: string) => hexToRgb(hex)
  const setFill = (hex: string) => doc.setFillColor(...rgb(hex))
  const setDraw = (hex: string) => doc.setDrawColor(...rgb(hex))
  const setText = (hex: string) => doc.setTextColor(hex)
  const limpiar = (value: unknown) => textoSeguroPdf(String(value ?? ''))
  const pageTop = 34
  const footerBottom = 22

  function headerV2(page: number, totalPages: number) {
    setFill('#173765')
    doc.rect(0, 0, W, 4, 'F')
    const headerY = 7.5

    if (logoDataUrl) {
      try { drawImageContain(logoDataUrl, mg, headerY - 1, 21, 13, 1) } catch { /* noop */ }
    }

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.6); setText('#173765')
    doc.text('HIDROPERFORACIONES, S.A.', mg + 26, headerY + 2)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.8); setText('#64748b')
    doc.text('Perforacion de pozos mecanicos | Guatemala, C.A. | PBX: (502) 2259-2626', mg + 26, headerY + 5.5)
    doc.text('www.hidroperforaciones.com', mg + 26, headerY + 8.8)

    const badgeW = 40
    const badgeH = 14
    const badgeX = W - mg - badgeW
    const badgeY = headerY - 1
    setFill(WHITE); setDraw('#d9e2ef'); doc.setLineWidth(0.2)
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.3, 1.3, 'FD')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5); setText('#64748b')
    doc.text('PRESUPUESTO', badgeX + 3, badgeY + 3.8)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.2); setText('#173765')
    doc.text(data.correlativo, badgeX + 3, badgeY + 8.2)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5); setText('#64748b')
    doc.text(fechaCotizacion, badgeX + 3, badgeY + 11.8)

    setDraw('#d9e2ef')
    doc.line(mg, 25.5, W - mg, 25.5)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5); setText('#64748b')
    doc.text(`Pagina ${page} de ${totalPages}`, W - mg, 28.7, { align: 'right' })
  }

  function footerV2() {
    const yFooter = H - 20
    setDraw('#d9e2ef')
    doc.line(mg, yFooter, W - mg, yFooter)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(5.8); setText('#173765')
    doc.text('ASESOR DE VENTA', mg, yFooter + 3.8)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); setText('#1f2937')
    doc.text(data.vendedor || 'Gerencia Hidroperforaciones', mg, yFooter + 7)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.7); setText('#64748b')
    doc.text(`${emailVendedor} | Tel. ${telVendedor}`, mg, yFooter + 11)
    setFill('#173765')
    doc.rect(0, H - 4.5, W, 4.5, 'F')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.2); setText('#c8d9f3')
    doc.text('Hidroperforaciones, S.A. | Perforacion de pozos | Pruebas de bombeo | Registro electrico', W / 2, H - 1.7, { align: 'center' })
  }

  function sectionTitle(txt: string, yPos: number) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.8); setText('#173765')
    doc.text(txt, mg, yPos)
    setFill('#d4a04b')
    doc.rect(mg, yPos + 1.7, 15, 0.65, 'F')
  }

  function drawImageContain(dataUrl: string, boxX: number, boxY: number, boxW: number, boxH: number, ratio: number) {
    const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1
    let imageW = boxW
    let imageH = imageW / safeRatio
    if (imageH > boxH) {
      imageH = boxH
      imageW = imageH * safeRatio
    }
    const imageX = boxX + (boxW - imageW) / 2
    const imageY = boxY + (boxH - imageH) / 2
    doc.addImage(dataUrl, 'PNG', imageX, imageY, imageW, imageH)
  }

  function drawQuoteInfo(yPos: number) {
    sectionTitle('DATOS DE LA COTIZACION', yPos)
    yPos += 3.5
    const boxH = 31
    setFill('#f7f9fc'); setDraw('#d9e2ef'); doc.setLineWidth(0.2)
    doc.roundedRect(mg, yPos, W - 2 * mg, boxH, 2, 2, 'FD')

    const gap = 8
    const colW = (W - 2 * mg - gap - 8) / 2
    const x1 = mg + 4
    const x2 = x1 + colW + gap
    const left: Array<[string, string]> = [
      ['SENORES', limpiar(data.empresa || data.cliente)],
      ['ATENCION A', limpiar(data.cliente)],
      ['NIT', limpiar(data.nit || '')],
      ['TELEFONO', limpiar(data.telefono || '')],
    ]
    const right: Array<[string, string]> = [
      ['PROYECTO', limpiar(data.proyecto || '')],
      ['DIRECCION', limpiar(data.direccion || '')],
      ['VALIDEZ', `${data.validezDias || 15} dias`],
      ['TIEMPO', limpiar(data.duracion || '')],
      ['PROFUNDIDAD', ip?.profundidad ? `${ip.profundidad} pies` : ''],
    ]

    let rowY = yPos + 5
    for (const [label, value] of left) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(5); setText('#64748b')
      doc.text(label, x1, rowY)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); setText('#1f2937')
      doc.text(value.slice(0, 42), x1 + 23, rowY)
      rowY += 6
    }

    rowY = yPos + 5
    for (const [label, value] of right) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(5); setText('#64748b')
      doc.text(label, x2, rowY)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(5.7); setText('#1f2937')
      const lines = doc.splitTextToSize(value, colW - 27)
      doc.text(lines.slice(0, label === 'PROYECTO' ? 2 : 1), x2 + 27, rowY)
      rowY += label === 'PROYECTO' ? 9.5 : 5.2
    }

    return yPos + boxH + 5
  }

  function drawTotalCard(yPos: number) {
    const cardH = 15
    const cardW = W - 2 * mg
    const textColW = cardW * 0.63
    setFill('#173765')
    doc.roundedRect(mg, yPos, cardW, cardH, 2, 2, 'F')
    setFill('#d4a04b')
    doc.rect(mg, yPos, textColW, 1, 'F')
    doc.setDrawColor(45, 74, 122)
    doc.setLineWidth(0.3)
    doc.line(mg + textColW, yPos + 2, mg + textColW, yPos + cardH - 2)

    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); setText('#bfd4ff')
    doc.text('MONTO EN LETRAS', mg + 4, yPos + 4.7)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); setText(WHITE)
    doc.text(doc.splitTextToSize(limpiar(totalEnLetras), textColW - 8).slice(0, 2), mg + 4, yPos + 8.2)

    const totalLabelX = mg + textColW + 4
    doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); setText('#bfd4ff')
    doc.text(monedaCotizacion === 'USD' ? 'TOTAL A PAGAR (USD)' : 'TOTAL A PAGAR', totalLabelX, yPos + 4.7)

    // Depende del botón visual "mostrar/no mostrar" el desglose en el PDF.
    const etiqueta = monedaCotizacion === 'USD'
      ? `TC Q ${tipoCambioCotizacion.toFixed(2)}`
      : (mostrarDesgloseImpuestos ? 'Precio con IVA' : 'Precio sin IVA')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(5.2)
    const etiquetaW = doc.getTextWidth(etiqueta) + 5
    const etiquetaX = totalLabelX
    doc.setFillColor(255, 251, 235)
    doc.roundedRect(etiquetaX, yPos + 6.2, etiquetaW, 4.6, 1, 1, 'F')
    doc.setTextColor(180, 83, 9)
    doc.text(etiqueta, etiquetaX + 2.5, yPos + 9.5)

    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); setText(WHITE)
    doc.text(formatMonto(total), W - mg - 4, yPos + 10.8, { align: 'right' })
    return yPos + cardH
  }

  function drawMiniPago(yPos: number) {
    if (data.tipo !== 'perforacion' || valorPorPie <= 0) return yPos
    const boxH = mostrarNotaCheque ? 18 : 9.5
    const boxW = 78
    const boxX = mg
    setFill('#eef5ff'); setDraw('#bfd4ff'); doc.setLineWidth(0.2)
    doc.roundedRect(boxX, yPos, boxW, boxH, 1.5, 1.5, 'FD')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(5.3); setText('#64748b')
    doc.text('INFORMACION DE PAGO', boxX + 4, yPos + 3.4)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.4); setText('#173765')
    doc.text('Valor por pie perforado:', boxX + 4, yPos + 7.1)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); setText('#1f2937')
    doc.text(formatMonto(valorPorPie), boxX + boxW - 4, yPos + 7.1, { align: 'right' })

    if (mostrarNotaCheque) {
      const notaIva = aplicarIva ? 'El precio ya incluye IVA' : 'Precios sin IVA'
      doc.setFont('helvetica', 'normal'); doc.setFontSize(5.8); setText('#64748b')
      const nota = `${notaIva}. Pago por Cheque No Negociable, deposito o transferencia a nombre de Hidroperforaciones, S.A.`
      doc.text(doc.splitTextToSize(nota, boxW - 8).slice(0, 2), boxX + 4, yPos + 11.1)
    }

    return yPos + boxH
  }

  function drawPage1() {
    let yPos = pageTop
    yPos = drawQuoteInfo(yPos)
    sectionTitle('DETALLE DE PRESUPUESTO', yPos)
    yPos += 4

    if (lineas.length > 0) {
      autoTable(doc, {
        startY: yPos,
        margin: { left: mg, right: mg, top: 32, bottom: footerBottom },
        head: [['#', 'DESCRIPCION', 'UND', 'CANT.', 'P. UNITARIO', 'SUBTOTAL']],
        body: lineas.map((l, i) => [
          String(i + 1),
          limpiar(l.nombre),
          limpiar(l.unidad),
          String(Number(l.cant).toFixed(Number(l.cant) % 1 === 0 ? 0 : 1)),
          formatMonto(l.precio),
          formatMonto(l.total),
        ]),
        theme: 'plain',
        styles: { overflow: 'linebreak', lineColor: rgb('#d9e2ef'), lineWidth: 0.08 },
        headStyles: { fillColor: rgb('#173765'), textColor: rgb(WHITE), fontSize: 7.5, fontStyle: 'bold', cellPadding: 1.75 },
        bodyStyles: { fontSize: 7.1, textColor: rgb('#1f2937'), cellPadding: { top: 1.35, right: 1, bottom: 1.35, left: 1 } },
        alternateRowStyles: { fillColor: rgb('#fbfcfe') },
        columnStyles: {
          0: { cellWidth: 7, halign: 'center', textColor: rgb('#173765'), fontStyle: 'bold' },
          1: { cellWidth: 97 },
          2: { cellWidth: 13, halign: 'center', textColor: rgb('#64748b'), fontSize: 6.2 },
          3: { cellWidth: 13, halign: 'right' },
          4: { cellWidth: 23, halign: 'right' },
          5: { cellWidth: 25, halign: 'right', fontStyle: 'bold', textColor: rgb('#173765') },
        },
        didParseCell: d => {
          if (d.section === 'body' && d.column.index === 1) d.cell.styles.fontSize = 6.65
        },
      })
      yPos = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? yPos) + 3
    }

    if (yPos + 29 > H - footerBottom) {
      doc.addPage()
      yPos = pageTop
    }
    const totalFin = drawTotalCard(yPos)
    drawMiniPago(totalFin + 2.2)
  }

  function drawPage2() {
    let yPos = 37
    sectionTitle('CONDICIONES DE PAGO', yPos)
    yPos += 4

    autoTable(doc, {
      startY: yPos,
      margin: { left: mg, right: mg, top: 32, bottom: footerBottom },
      head: [['HITO', '%', 'MONTO']],
      body: [
        ...hitosActivos.map(h => [limpiar(h.label), `${h.pct}%`, formatMonto(Math.round(total * h.pct / 100))]),
        ['TOTAL', `${hitosActivos.reduce((a, b) => a + b.pct, 0)}%`, formatMonto(total)],
      ],
      theme: 'grid',
      headStyles: { fillColor: rgb('#173765'), textColor: rgb(WHITE), fontSize: 7, fontStyle: 'bold', cellPadding: 2 },
      bodyStyles: { fontSize: 7.5, cellPadding: 2.2, lineColor: rgb('#d9e2ef'), lineWidth: 0.15 },
      columnStyles: { 1: { halign: 'right', cellWidth: 26 }, 2: { halign: 'right', cellWidth: 42, fontStyle: 'bold' } },
      didParseCell: d => {
        if (d.section === 'body' && d.row.index === hitosActivos.length) {
          d.cell.styles.fillColor = rgb('#173765')
          d.cell.styles.textColor = rgb(WHITE)
          d.cell.styles.fontStyle = 'bold'
        }
      },
    })

    yPos = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? yPos) + 11
    sectionTitle('CUENTAS BANCARIAS', yPos)
    yPos += 5

    const cardGap = 5
    const cardW = (W - 2 * mg - cardGap) / 2
    const cardH = 22
    cuentas.slice(0, 4).forEach((c, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const cardX = mg + col * (cardW + cardGap)
      const cardY = yPos + row * (cardH + 5)
      setFill(i % 2 === 0 ? '#fbfcfe' : '#f7f9fc')
      setDraw('#d9e2ef')
      doc.setLineWidth(0.25)
      doc.roundedRect(cardX, cardY, cardW, cardH, 2, 2, 'FD')
      setFill('#173765')
      doc.rect(cardX, cardY, 2, cardH, 'F')

      const logo = logosBancos[i]
      const logoBoxX = cardX + 5
      const logoBoxY = cardY + 5
      const logoBoxW = 22
      const logoBoxH = 12
      if (logo) {
        try { drawImageContain(logo.dataUrl, logoBoxX, logoBoxY, logoBoxW, logoBoxH, logo.w / logo.h) } catch { /* noop */ }
      }

      const textX = cardX + 31
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.4); setText('#173765')
      doc.text(limpiar(c.banco), textX, cardY + 7)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(5.9); setText('#64748b')
      doc.text(limpiar(c.tipo), textX, cardY + 11)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.2); setText('#1f2937')
      doc.text(`No. ${limpiar(c.numero)}`, textX, cardY + 16.5)
    })
  }

  function drawConditionsPage() {
    let yPos = 36
    const condicionesCount = data.tipo === 'perforacion' ? condicionesPerf.length : 0
    sectionTitle(condicionesCount > 0 ? `CONDICIONES IMPORTANTES (${condicionesCount})` : 'CONDICIONES IMPORTANTES', yPos)
    yPos += 5

    if (data.tipo === 'perforacion') {
      const rows = condicionesPerf.map((c, i) => [String(i + 1), limpiar(c.texto)])
      const tableBottom = 8
      const numberW = 8
      const textW = W - 2 * mg - numberW
      const candidates = [4.65, 4.45, 4.25, 4.05, 3.85, 3.65]
      let chosen = candidates[candidates.length - 1]
      for (const fontSize of candidates) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(fontSize)
        const estimated = rows.reduce((sum, row) => {
          const linesCount = doc.splitTextToSize(row[1], textW - 2).length
          return sum + Math.max(3, linesCount * fontSize * 0.38 + 1.1)
        }, 0)
        if (estimated <= H - tableBottom - yPos) { chosen = fontSize; break }
      }

      autoTable(doc, {
        startY: yPos,
        margin: { left: mg, right: mg, top: 32, bottom: tableBottom },
        body: rows.map(row => [row[0], doc.splitTextToSize(row[1], textW - 2).join('\n')]),
        theme: 'plain',
        styles: {
          font: 'helvetica',
          fontSize: chosen,
          cellPadding: { top: 0.35, right: 0.8, bottom: 0.42, left: 0.7 },
          overflow: 'linebreak',
          lineWidth: 0,
          textColor: rgb('#1f2937'),
          valign: 'top',
        },
        columnStyles: {
          0: { cellWidth: numberW, halign: 'right', fontStyle: 'bold', textColor: rgb('#173765'), fontSize: chosen + 0.25 },
          1: { cellWidth: textW },
        },
      })
      return
    }

    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); setText('#374151')
    const parrafos = condicionesLimpText.split(/\n\n+/).filter(p => p.trim())
    for (const parrafo of parrafos) {
      const lines = doc.splitTextToSize(limpiar(parrafo.trim()), W - 2 * mg)
      doc.text(lines, mg, yPos + 2)
      yPos += lines.length * 2.8 + 1.4
    }
  }

  drawPage1()
  doc.addPage()
  drawPage2()
  doc.addPage()
  const paginaInicioCondiciones = doc.getNumberOfPages()
  drawConditionsPage()

  const totalPages = doc.getNumberOfPages()
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page)
    headerV2(page, totalPages)
    if (page < paginaInicioCondiciones) footerV2()
  }
  return new Uint8Array(doc.output('arraybuffer') as ArrayBuffer)
}

// ── Nombre de archivo limpio ─────────────────────────────────────────────────
export function sanitize(s: string): string {
  return s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_\-. ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 50)
}

