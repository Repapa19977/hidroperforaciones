// Genera PDF de una cotización replicando el formato oficial P5332 de Hidroperforaciones, S.A.
// Página 1: encabezado + datos cliente + plan de pagos + tabla de servicios + totales + cuentas bancarias
// Página 2: Condiciones Importantes (22 puntos legales)

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { QuotationData, HitoPago } from './quotation-store'
import { getLineaConfig } from './quotation-store'
import { calcularPerforacion, calcularLimpieza, formatQ, IVA, ISR, formatBroca, pipasClienteCantidad, camionadasGrava } from './calculator'
import type { InputsPerforacion, InputsLimpieza } from './calculator'
import { DEFAULT_CONFIG, DEFAULT_PRECIOS_LINEAS, type AppConfig, type PreciosLineas, type CuentaBancaria } from './config-store'
import { COSTOS_BASE } from './costos-base'
import { numeroAQuetzalesEnLetras } from './numero-a-letras'
import { resolverCondiciones } from './condiciones-perf'

// ── Colores ──────────────────────────────────────────────────────────────────
const NAVY   = '#1a3a6e'
const GRAY50 = '#f9fafb'
const GRAY100= '#f3f4f6'
const GRAY200= '#e5e7eb'
const GRAY300= '#d1d5db'
const GRAY500= '#6b7280'
const GRAY600= '#4b5563'
const GRAY700= '#374151'
const GRAY800= '#1f2937'
const WHITE  = '#ffffff'

// ── Constructores de líneas — formato idéntico a Odoo ────────────────────────
function buildLineasPerf(
  ip: InputsPerforacion,
  res: ReturnType<typeof calcularPerforacion>,
  pl: PreciosLineas = DEFAULT_PRECIOS_LINEAS,
  mostrarEspesor = false,
  descripcionSimple = false,
  preciosVentaOverride: Record<string, number> = {},
  aplicarIva = true,
  aplicarIsr = false,
  opcionesVenta: Partial<Pick<AppConfig, 'pipaPrecioVentaUnitario' | 'camionadaGravaPrecioVentaUnitario' | 'capacidadCamionM3'>> = {},
) {
  const pipaPrecioVenta     = opcionesVenta.pipaPrecioVentaUnitario ?? DEFAULT_CONFIG.pipaPrecioVentaUnitario
  const camionadaPrecioVta  = opcionesVenta.camionadaGravaPrecioVentaUnitario ?? DEFAULT_CONFIG.camionadaGravaPrecioVentaUnitario
  const capacidadCamion     = opcionesVenta.capacidadCamionM3 ?? DEFAULT_CONFIG.capacidadCamionM3
  const pipasAlCliente      = pipasClienteCantidad(ip.profundidad, ip.rendimientoPorDia ?? 20)
  const camionadasAlCliente = camionadasGrava(res.m3Grava, capacidadCamion)
  const piesLisa       = ip.tubosLisos     * 20
  const piesRan        = ip.tubosRanurados * 20
  const precioLisaPie  = piesLisa > 0 ? Math.round(res.precioTubLisa     / 20) : 0
  const precioRanPie   = piesRan  > 0 ? Math.round(res.precioTubRanurada / 20) : 0
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
      unidad: 'Und', cant: 1, precio: pl.selloSanitario }] : []),

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
  // Construir totales iniciales
  const built = rows.map(r => ({ ...r, total: r.cant * r.precio }))

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
  pl: PreciosLineas = DEFAULT_PRECIOS_LINEAS
) {
  return [
    { key: 'traslado-limp',    nombre: 'Traslado de equipo de limpieza',               unidad: 'Global', cant: 1,               precio: Math.round(res.costoTraslado * 1.2) },
    { key: 'instalacion-limp', nombre: 'Instalación de equipo de limpieza',            unidad: 'Global', cant: 1,               precio: pl.instalacionEquipo },
    { key: 'limpieza-horas',   nombre: `Limpieza mecánica de pozo (${il.horasLimpieza} horas)`, unidad: 'Hora', cant: il.horasLimpieza, precio: il.precioVentaHora },
    { key: 'quimicos-limp',    nombre: 'Químicos y aditivos de limpieza',              unidad: 'Global', cant: 1,               precio: Math.round(res.costoQuimicos * (il.markupQuimicos ?? 1.5)) },
    { key: 'desarro-limp',     nombre: 'Desarrollo y limpieza final de pozo',          unidad: 'Global', cant: 1,               precio: pl.desarrolloLimpiezaFinal },
    { key: 'analisis-limp',    nombre: 'Análisis físico-químico del agua',             unidad: 'Unidad', cant: 1,               precio: pl.analisisFisicoQuimico },
    { key: 'desinstal-limp',   nombre: 'Desinstalación y retiro de equipo',            unidad: 'Global', cant: 1,               precio: pl.desinstalacion },
  ].map(r => ({ ...r, total: r.cant * r.precio }))
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

async function cargarLogoBase64(): Promise<string | null> {
  try {
    const res = await fetch('/logo.png')
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

// ── Header profesional con banda navy + logo prominente + badge correlativo ──
function dibujarHeader(
  doc: jsPDF, W: number, mg: number, logoDataUrl: string | null,
  correlativo: string, fecha: string, paginaActual: number, paginasTotal: number
) {
  // ── Banda navy superior de ancho total ──────────────────────────────────────
  const bandaH = 5
  doc.setFillColor(hexToRgb(NAVY)[0], hexToRgb(NAVY)[1], hexToRgb(NAVY)[2])
  doc.rect(0, 0, W, bandaH, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(WHITE)
  doc.text('HIDROPERFORACIONES, S.A.', mg, 3.5)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5)
  doc.setTextColor('#bfd4ff')
  doc.text('PERFORACIÓN DE POZOS MECÁNICOS', W - mg, 3.5, { align: 'right' })

  // ── Sección principal del header ────────────────────────────────────────────
  const headerY = bandaH + 3

  // Logo grande a la izquierda
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', mg, headerY, 28, 22)
    } catch {
      // Fallback navy block
      doc.setFillColor(hexToRgb(NAVY)[0], hexToRgb(NAVY)[1], hexToRgb(NAVY)[2])
      doc.roundedRect(mg, headerY, 28, 20, 2, 2, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(WHITE)
      doc.text('HIDRO', mg + 14, headerY + 10, { align: 'center' })
      doc.setFontSize(6)
      doc.text('PERFORACIONES', mg + 14, headerY + 15, { align: 'center' })
    }
  } else {
    doc.setFillColor(hexToRgb(NAVY)[0], hexToRgb(NAVY)[1], hexToRgb(NAVY)[2])
    doc.roundedRect(mg, headerY, 28, 20, 2, 2, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(WHITE)
    doc.text('HIDRO', mg + 14, headerY + 10, { align: 'center' })
    doc.setFontSize(6)
    doc.text('PERFORACIONES', mg + 14, headerY + 15, { align: 'center' })
  }

  // Info empresa al centro-izquierda
  const xInfo = mg + 32
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(NAVY)
  doc.text('Oficinas Corporativas', xInfo, headerY + 3)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(GRAY600)
  doc.text('5ta. Av. 15-45 zona 10  ·  Edif. Centro Empresarial T-II, Of. 708-709', xInfo, headerY + 6)
  doc.text('Guatemala, C.A. 01010  ·  PBX: (502) 2259-2626', xInfo, headerY + 9)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(NAVY)
  doc.text('Oficinas Operativas', xInfo, headerY + 13)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(GRAY600)
  doc.text('KM 22.5 Carretera a El Salvador, Guatemala', xInfo, headerY + 16)
  doc.text('www.hidroperforaciones.com', xInfo, headerY + 19)

  // Badge del correlativo a la derecha
  const badgeW = 52, badgeH = 22
  const badgeX = W - mg - badgeW, badgeY = headerY
  doc.setFillColor(hexToRgb(NAVY)[0], hexToRgb(NAVY)[1], hexToRgb(NAVY)[2])
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2.5, 2.5, 'F')
  // Accent bar amarilla sutil
  doc.setFillColor(212, 160, 75)
  doc.rect(badgeX, badgeY, badgeW, 1.5, 'F')
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor('#c8d2e6')
  doc.text('PRESUPUESTO No.', badgeX + badgeW / 2, badgeY + 6, { align: 'center' })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(WHITE)
  doc.text(correlativo, badgeX + badgeW / 2, badgeY + 13, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor('#c8d2e6')
  doc.text(`FECHA:  ${fecha}`, badgeX + badgeW / 2, badgeY + 18.5, { align: 'center' })

  // Línea separadora navy (más delgada, elegante)
  doc.setDrawColor(hexToRgb(NAVY)[0], hexToRgb(NAVY)[1], hexToRgb(NAVY)[2])
  doc.setLineWidth(0.5)
  doc.line(mg, headerY + 26, W - mg, headerY + 26)
  // Indicador de página
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(GRAY500)
  doc.text(`Página ${paginaActual} de ${paginasTotal}`, W - mg, headerY + 29, { align: 'right' })

  return headerY + 32  // y siguiente
}

// ── Footer profesional con card del asesor + banda navy ──────────────────────
function dibujarFooter(
  doc: jsPDF, W: number, H: number, mg: number,
  vendedor: string, emailVendedor: string, telVendedor: string, logoDataUrl: string | null
) {
  // Banda navy al pie (ancho completo)
  const bandaH = 7
  const bandaY = H - bandaH
  doc.setFillColor(hexToRgb(NAVY)[0], hexToRgb(NAVY)[1], hexToRgb(NAVY)[2])
  doc.rect(0, bandaY, W, bandaH, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(WHITE)
  doc.text('HIDROPERFORACIONES, S.A.', mg, bandaY + 3.2)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor('#bfd4ff')
  doc.text('Perforación de pozos · Pruebas de bombeo · Registro eléctrico · Estudios hidrogeológicos', W / 2, bandaY + 3.2, { align: 'center' })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(WHITE)
  doc.text('www.hidroperforaciones.com', W - mg, bandaY + 3.2, { align: 'right' })

  // Zona de asesor sobre la banda navy (card blanca con borde)
  const cardH = 15
  const cardY = bandaY - cardH - 2
  // Línea separadora sutil
  doc.setDrawColor(hexToRgb(GRAY200)[0], hexToRgb(GRAY200)[1], hexToRgb(GRAY200)[2])
  doc.setLineWidth(0.3)
  doc.line(mg, cardY, W - mg, cardY)

  // Izquierda: datos del asesor
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(NAVY)
  doc.text('ASESOR DE VENTA', mg, cardY + 4)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(GRAY800)
  doc.text(vendedor, mg, cardY + 8)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(GRAY600)
  doc.text(emailVendedor, mg, cardY + 11.5)
  doc.text(`TEL: ${telVendedor}`, mg, cardY + 14)

  // Logo pequeño a la derecha (si existe)
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', W - mg - 16, cardY + 1, 16, 12)
    } catch { /* fallback silencioso */ }
  }
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
  const mg = 15
  const CONTENT_TOP    = 43   // espacio reservado al header profesional (banda + logo + info + badge + línea)
  const CONTENT_BOTTOM = H - 25    // espacio reservado al footer

  // ── Preparar líneas y totales ─────────────────────────────────────────────────
  const pl = { ...DEFAULT_PRECIOS_LINEAS, ...data.preciosLineas }
  const lineasActivas = data.lineasActivas ?? {}
  const lineasConfig  = data.lineasConfig  ?? {}
  const preciosVentaOverride = data.preciosVentaOverride ?? {}
  const mostrarEspesor = data.mostrarEspesor ?? false
  const descripcionSimple = data.descripcionSimple ?? false
  const resPerf = data.ip ? calcularPerforacion(data.ip) : null
  const resLimp = data.il ? calcularLimpieza(data.il) : null

  // Impuestos aplicables (necesarios para el residual del rubro 3 en buildLineasPerf)
  const aplicarIvaForBuild = data.aplicarIva ?? true
  const aplicarIsrForBuild = data.aplicarIsr ?? false

  type LineaBase = { key: string; nombre: string; unidad: string; cant: number; precio: number; total: number }
  type LineaFinal = LineaBase & { esExtra?: boolean; extraMostrar?: boolean; extraCobrar?: boolean }

  const opcionesVenta = {
    pipaPrecioVentaUnitario: data.pipaPrecioVentaUnitario,
    camionadaGravaPrecioVentaUnitario: data.camionadaGravaPrecioVentaUnitario,
    capacidadCamionM3: data.capacidadCamionM3,
  }
  const lineasBase: LineaBase[] = data.tipo === 'perforacion' && data.ip && resPerf
    ? buildLineasPerf(data.ip, resPerf, pl, mostrarEspesor, descripcionSimple, preciosVentaOverride, aplicarIvaForBuild, aplicarIsrForBuild, opcionesVenta)
    : data.il && resLimp
      ? buildLineasLimp(data.il, resLimp, pl)
      : []

  // Líneas extras (custom) agregadas por el usuario — se suman al final de la tabla
  // Se excluyen items vacíos (sin nombre, sin cantidad o sin precio) para no ensuciar el PDF
  const extras: LineaFinal[] = (data.lineasExtras ?? [])
    .filter(e =>
      e.cantidad > 0 &&
      e.precioVentaUnitario > 0 &&
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
  const iva = aplicarIva ? Math.round(subtotal * IVA) : 0
  const isr = aplicarIsr ? Math.round(subtotal * ISR) : 0
  const total = subtotal + iva + isr

  // Valor por pie del pie del PDF = total / profundidad (por construcción del residual
  // total del PDF = profundidad × ip.precioPorPieVenta, entonces esto = precio/pie manual)
  const valorPorPie = data.ip && data.ip.profundidad > 0 ? Math.round(total / data.ip.profundidad) : 0
  const totalEnLetras = numeroAQuetzalesEnLetras(total)

  // Condiciones legales de perforación: 18 del catálogo (con overrides) + extras del usuario.
  const condicionesPerf = data.tipo === 'perforacion'
    ? resolverCondiciones(data.condicionesPerfOverride, data.condicionesPerfExtras)
    : []

  // Para limpieza usamos el string libre (de momento; se convertirá a catálogo en Fase L)
  const condicionesLimpText = data.tipo === 'limpieza'
    ? (data.condicionesLimp ?? data.condiciones ?? '')
    : ''

  const emailVendedor = `rdominguez@hidroperforaciones.com`
  const telVendedor   = `55999998`

  // ═══════════════════════════════════════════════════════════════════════════
  // PÁGINA 1: datos cliente, condiciones pago, tabla, totales
  // (El header y footer se dibujan al final en todas las páginas)
  // ═══════════════════════════════════════════════════════════════════════════
  let y = CONTENT_TOP

  // ── Datos cliente superiores (3 filas full-width) ───────────────────────────
  //   SEÑORES / DIRECCIÓN / ATENCIÓN A + NIT + TELÉFONOS (layout PDF oficial)
  const rowCliente = 5.2

  // Fila 1: SEÑORES
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(GRAY800)
  doc.text('SEÑORES:', mg, y + 3.7)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(GRAY700)
  doc.text((data.empresa || data.cliente || '').toUpperCase().slice(0, 95), mg + 22, y + 3.7)
  y += rowCliente

  // Fila 2: DIRECCIÓN
  doc.setFont('helvetica', 'bold'); doc.setTextColor(GRAY800)
  doc.text('DIRECCIÓN:', mg, y + 3.7)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(GRAY700)
  const dirLines = doc.splitTextToSize(data.direccion || 'Ciudad', W - 2 * mg - 22)
  doc.text(dirLines[0] || '', mg + 22, y + 3.7)
  y += rowCliente

  // Fila 3: ATENCIÓN A | NIT | TELÉFONOS (3 campos en 3 columnas virtuales)
  doc.setFont('helvetica', 'bold'); doc.setTextColor(GRAY800)
  doc.text('ATENCIÓN A:', mg, y + 3.7)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(GRAY700)
  doc.text(String(data.cliente || '').slice(0, 28), mg + 26, y + 3.7)

  const xNit = mg + 92
  doc.setFont('helvetica', 'bold'); doc.setTextColor(GRAY800)
  doc.text('NIT:', xNit, y + 3.7)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(GRAY700)
  doc.text(String(data.nit || '').slice(0, 16), xNit + 9, y + 3.7)

  const xTel = mg + 132
  doc.setFont('helvetica', 'bold'); doc.setTextColor(GRAY800)
  doc.text('TELÉFONOS:', xTel, y + 3.7)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(GRAY700)
  doc.text(String(data.telefono || '').slice(0, 20), xTel + 19, y + 3.7)
  y += rowCliente + 1.5

  // ── 2 columnas: Proyecto izquierda + Condiciones de Pago derecha ────────────
  const colAncho = (W - 2 * mg - 5) / 2
  const xIzq = mg
  const xDer = mg + colAncho + 5
  const yDatosIni = y

  // Izquierda: campos del proyecto (label + valor con wrap si es largo)
  const camposProyecto: [string, string][] = [
    ['Proyecto:',             data.proyecto || '—'],
    ['Dirección:',            data.direccion || '—'],
    ['Validez de la Oferta:', `${data.validezDias} días`],
    ['Tiempo de Entrega:',    data.duracion || '—'],
  ]
  if (data.ip?.profundidad) camposProyecto.push(['Profundidad:', `${data.ip.profundidad} (PIES)`])

  let yL = yDatosIni
  for (const [k, v] of camposProyecto) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(GRAY800)
    doc.text(k, xIzq, yL + 3.7)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(GRAY700)
    const valLines = doc.splitTextToSize(String(v), colAncho - 32)
    doc.text(valLines.slice(0, 2), xIzq + 32, yL + 3.7)  // máximo 2 líneas
    yL += Math.max(rowCliente, Math.min(valLines.length, 2) * 3.5 + 1.5)
  }

  // Derecha: tabla CONDICIONES DE PAGO (zebra + total destacado)
  const hitos: HitoPago[] = (data.planPagos && data.planPagos.length > 0)
    ? data.planPagos
    : [
        { id: 'anticipo',   label: 'Anticipo',                   pct: 60, fijo: false },
        { id: 'mitad-perf', label: 'Al 50% de perforación',      pct: 20, fijo: false },
        { id: 'entubar',    label: 'Antes de entubar',           pct: 15, fijo: false },
        { id: 'prueba',     label: 'Antes de prueba de bombeo',  pct: 5,  fijo: false },
      ]
  const hitosActivos = hitos.filter(h => h.pct > 0)
  const rowH = 5.8
  const headerH = 6.5
  const chX = xDer
  const chW = colAncho
  const pctX   = chX + chW * 0.70
  const montoX = chX + chW - 2.5
  const yHdr = yDatosIni

  doc.setFillColor(hexToRgb(NAVY)[0], hexToRgb(NAVY)[1], hexToRgb(NAVY)[2])
  doc.rect(chX, yHdr, chW, headerH, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(WHITE)
  doc.text('CONDICIONES DE PAGO', chX + chW / 2, yHdr + 4.5, { align: 'center' })

  let yRow = yHdr + headerH
  hitosActivos.forEach((h, i) => {
    const monto = Math.round(total * h.pct / 100)
    if (i % 2 === 0) {
      doc.setFillColor(hexToRgb(GRAY50)[0], hexToRgb(GRAY50)[1], hexToRgb(GRAY50)[2])
      doc.rect(chX, yRow, chW, rowH, 'F')
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(GRAY700)
    const labelMax = 28
    const label = h.label.length > labelMax ? h.label.slice(0, labelMax - 1) + '…' : h.label
    doc.text(label, chX + 2.5, yRow + 4)
    doc.setFont('helvetica', 'bold'); doc.setTextColor(GRAY800)
    const pctTxt = h.pct % 1 === 0 ? `${h.pct}%` : `${h.pct.toFixed(1)}%`
    doc.text(pctTxt, pctX, yRow + 4, { align: 'right' })
    doc.text(formatQ(monto), montoX, yRow + 4, { align: 'right' })
    yRow += rowH
  })
  // TOTAL destacado en navy
  const totalPct = hitosActivos.reduce((a, b) => a + b.pct, 0)
  yRow += 0.5
  doc.setFillColor(hexToRgb(NAVY)[0], hexToRgb(NAVY)[1], hexToRgb(NAVY)[2])
  doc.rect(chX, yRow, chW, rowH, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(WHITE)
  doc.text('TOTAL', chX + 2.5, yRow + 4)
  doc.text(`${totalPct}%`, pctX, yRow + 4, { align: 'right' })
  doc.text(formatQ(total), montoX, yRow + 4, { align: 'right' })
  const yPagoFin = yRow + rowH

  y = Math.max(yL, yPagoFin) + 5

  // ── Título sección "Detalle de Presupuesto" con banda navy refinada ─────────
  const tituloH = 6.5
  doc.setFillColor(hexToRgb(NAVY)[0], hexToRgb(NAVY)[1], hexToRgb(NAVY)[2])
  doc.rect(mg, y, W - 2 * mg, tituloH, 'F')
  // Accent bar amarilla lateral izquierda
  doc.setFillColor(212, 160, 75)
  doc.rect(mg, y, 3, tituloH, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(WHITE)
  doc.text('DETALLE DE PRESUPUESTO', mg + 8, y + 4.5)
  y += tituloH + 0.5

  // ── Tabla de líneas con header navy y filas zebra ──────────────────────────
  // IMPORTANTE: margin.top=CONTENT_TOP y margin.bottom garantizan que cuando la
  // tabla cree una nueva página, respete el espacio del header y footer que se
  // dibujan al final.
  if (lineas.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: mg, right: mg, top: CONTENT_TOP, bottom: 27 },
      head: [['#', 'DESCRIPCIÓN', 'UND', 'CANT.', 'P. UNITARIO', 'SUBTOTAL']],
      body: lineas.map((l, i) => [
        String(i + 1),
        l.nombre,
        l.unidad,
        l.cant.toFixed(l.cant % 1 === 0 ? 0 : 1),
        formatQ(l.precio),
        formatQ(l.total),
      ]),
      headStyles: {
        fillColor: hexToRgb(NAVY),
        textColor: hexToRgb(WHITE),
        fontSize: 7,
        fontStyle: 'bold',
        cellPadding: 2.2,
        halign: 'center',
        lineWidth: 0,
      },
      bodyStyles: {
        fontSize: 7.2,
        textColor: hexToRgb(GRAY800),
        cellPadding: 2,
        lineWidth: 0.1,
        lineColor: hexToRgb(GRAY200),
      },
      alternateRowStyles: { fillColor: hexToRgb(GRAY50) },
      columnStyles: {
        0: { cellWidth: 8,  halign: 'center', textColor: hexToRgb(NAVY), fontStyle: 'bold' },
        2: { cellWidth: 14, halign: 'center', textColor: hexToRgb(GRAY500), fontSize: 6.8 },
        3: { cellWidth: 14, halign: 'right'  },
        4: { cellWidth: 24, halign: 'right'  },
        5: { cellWidth: 26, halign: 'right', fontStyle: 'bold', textColor: hexToRgb(NAVY) },
      },
      styles: { lineWidth: 0.1, lineColor: hexToRgb(GRAY200) },
      theme: 'plain',
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2
  }

  // Helper inline: asegura que haya `alto` mm disponibles. Si no, salta a nueva página.
  const necesitaEspacio = (alto: number) => {
    if (y + alto > CONTENT_BOTTOM) {
      doc.addPage()
      y = CONTENT_TOP
    }
  }

  // ── Desglose opcional (Subtotal / IVA / ISR) + Fila "En letras: ... | TOTAL" ──
  if (mostrarDesgloseImpuestos) {
    const filasDesglose: Array<[string, number]> = [['Subtotal (sin impuestos)', subtotal]]
    if (aplicarIva) filasDesglose.push([`IVA (${Math.round(IVA*100)}%)`, iva])
    if (aplicarIsr) filasDesglose.push([`ISR (${Math.round(ISR*100)}%)`, isr])
    const altoDesglose = filasDesglose.length * 5 + 2
    necesitaEspacio(altoDesglose + 10)
    const tW = 75, tX = W - mg - tW
    filasDesglose.forEach(([label, valor], i) => {
      doc.setFillColor(hexToRgb(i % 2 === 0 ? GRAY50 : GRAY100)[0], hexToRgb(i % 2 === 0 ? GRAY50 : GRAY100)[1], hexToRgb(i % 2 === 0 ? GRAY50 : GRAY100)[2])
      doc.rect(tX, y, tW, 5, 'F')
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(GRAY700)
      doc.text(label, tX + 2, y + 3.5)
      doc.setFont('helvetica', 'bold'); doc.setTextColor(GRAY800)
      doc.text(formatQ(valor), tX + tW - 2, y + 3.5, { align: 'right' })
      y += 5
    })
    y += 1
  } else {
    necesitaEspacio(10)
  }

  // ── Card TOTAL elegante — navy gradient, dos columnas (letras | monto) ────
  const totalBoxH = 14
  necesitaEspacio(totalBoxH + 3)
  const totalBoxW = W - 2 * mg
  const colTxtW = totalBoxW * 0.63  // columna del texto "en letras"
  // Fondo navy
  doc.setFillColor(hexToRgb(NAVY)[0], hexToRgb(NAVY)[1], hexToRgb(NAVY)[2])
  doc.roundedRect(mg, y, totalBoxW, totalBoxH, 2, 2, 'F')
  // Accent bar amarilla superior izquierda
  doc.setFillColor(212, 160, 75)
  doc.rect(mg, y, colTxtW, 1, 'F')
  // Divider vertical sutil entre columnas
  doc.setDrawColor(45, 74, 122)
  doc.setLineWidth(0.3)
  doc.line(mg + colTxtW, y + 2, mg + colTxtW, y + totalBoxH - 2)

  // Columna izquierda: "en letras"
  doc.setFont('helvetica', 'normal'); doc.setFontSize(5.8); doc.setTextColor('#a3b8d9')
  doc.text('MONTO EN LETRAS', mg + 4, y + 4.5)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(WHITE)
  const letrasEnvueltas = doc.splitTextToSize(totalEnLetras, colTxtW - 8)
  doc.text(letrasEnvueltas.slice(0, 2), mg + 4, y + 8)

  // Columna derecha: TOTAL grande
  doc.setFont('helvetica', 'normal'); doc.setFontSize(5.8); doc.setTextColor('#a3b8d9')
  doc.text('TOTAL A PAGAR', mg + colTxtW + 4, y + 4.5)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(WHITE)
  doc.text(formatQ(total), W - mg - 4, y + 11, { align: 'right' })
  y += totalBoxH + 3

  // ── Valor por pie + nota de IVA — card sutil con accent navy ───────────────
  if (data.tipo === 'perforacion' && valorPorPie > 0) {
    const notaH = 14
    necesitaEspacio(notaH + 2)
    doc.setFillColor(hexToRgb(GRAY50)[0], hexToRgb(GRAY50)[1], hexToRgb(GRAY50)[2])
    doc.roundedRect(mg, y, W - 2 * mg, notaH, 1.5, 1.5, 'F')
    // Accent bar izquierdo navy
    doc.setFillColor(hexToRgb(NAVY)[0], hexToRgb(NAVY)[1], hexToRgb(NAVY)[2])
    doc.rect(mg, y, 2.5, notaH, 'F')

    const xCard = mg + 6
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(NAVY)
    doc.text('VALOR POR PIE', xCard, y + 4.3)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(GRAY800)
    doc.text(formatQ(valorPorPie), xCard + 28, y + 5.3)

    // Nota: cambia según toggles de IVA
    const notaIva = mostrarDesgloseImpuestos
      ? (aplicarIva ? '"Precio con IVA desglosado"' : '"Precios sin IVA"')
      : (aplicarIva ? '"El precio ya incluye IVA"' : '"Precios sin IVA"')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(GRAY600)
    const notaLarga = `${notaIva}  ·  Para cualquier pago, favor emitir cheque "No Negociable" a nombre de "Hidroperforaciones, S.A."`
    const notaLineas = doc.splitTextToSize(notaLarga, W - 2 * mg - 12)
    doc.text(notaLineas.slice(0, 2), xCard, y + 10)

    y += notaH + 2
  }

  // ── Observaciones (card amber sutil con accent lateral) ────────────────────
  if (data.notas && data.notas.trim()) {
    const obsLineas = doc.splitTextToSize(data.notas, W - 2 * mg - 12)
    const obsAlto = obsLineas.length * 3.5 + 9
    necesitaEspacio(obsAlto + 2)
    doc.setFillColor(255, 251, 235)  // amber50
    doc.roundedRect(mg, y, W - 2 * mg, obsAlto, 1.5, 1.5, 'F')
    doc.setFillColor(212, 160, 75)   // amber accent
    doc.rect(mg, y, 2.5, obsAlto, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(180, 83, 9)
    doc.text('OBSERVACIONES', mg + 6, y + 4.5)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(GRAY700)
    doc.text(obsLineas, mg + 6, y + 8)
    y += obsAlto + 2
  }

  // ── Cuentas bancarias — tabla centrada con estilo ─────────────────────────
  const cuentas = cuentasBancarias ?? []
  if (cuentas.length > 0) {
    const headerCtaH = 6.5
    const filaCtaH = 5.5
    const cuentasAlto = headerCtaH + cuentas.length * filaCtaH + 4
    necesitaEspacio(cuentasAlto + 4)

    // Ancho más compacto que la página, centrado
    const ctaW = Math.min(W - 2 * mg, 165)
    const ctaX = (W - ctaW) / 2

    // Header navy con título
    doc.setFillColor(hexToRgb(NAVY)[0], hexToRgb(NAVY)[1], hexToRgb(NAVY)[2])
    doc.rect(ctaX, y, ctaW, headerCtaH, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(WHITE)
    doc.text('CUENTAS BANCARIAS — HIDROPERFORACIONES, S.A.', ctaX + ctaW / 2, y + 4.3, { align: 'center' })
    y += headerCtaH

    // Columnas: Banco | Tipo | No. de cuenta
    const bancoX = ctaX + 4
    const tipoX  = ctaX + ctaW * 0.38
    const numX   = ctaX + ctaW - 4

    cuentas.forEach((c, i) => {
      if (i % 2 === 0) {
        doc.setFillColor(hexToRgb(GRAY50)[0], hexToRgb(GRAY50)[1], hexToRgb(GRAY50)[2])
        doc.rect(ctaX, y, ctaW, filaCtaH, 'F')
      } else {
        doc.setFillColor(hexToRgb(GRAY100)[0], hexToRgb(GRAY100)[1], hexToRgb(GRAY100)[2])
        doc.rect(ctaX, y, ctaW, filaCtaH, 'F')
      }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.2); doc.setTextColor(NAVY)
      doc.text(c.banco, bancoX, y + 3.8)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(GRAY600)
      doc.text(c.tipo, tipoX, y + 3.8)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.3); doc.setTextColor(GRAY800)
      doc.text(`No. ${c.numero}`, numX, y + 3.8, { align: 'right' })
      y += filaCtaH
    })

    // Borde inferior de la tabla
    doc.setDrawColor(hexToRgb(GRAY300)[0], hexToRgb(GRAY300)[1], hexToRgb(GRAY300)[2])
    doc.setLineWidth(0.2)
    doc.rect(ctaX, y - cuentas.length * filaCtaH, ctaW, cuentas.length * filaCtaH)
    y += 3
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PÁGINA 2+: CONDICIONES IMPORTANTES (paginación dinámica — tantas como haga falta)
  // En esta(s) página(s) NO se dibuja footer para liberar espacio vertical y meter los 18 puntos en 1 hoja.
  // ═══════════════════════════════════════════════════════════════════════════
  const paginaInicioCondiciones = doc.getNumberOfPages() + 1
  doc.addPage()
  let y2 = CONTENT_TOP
  // Sin footer en condiciones → extendemos el área útil ~15mm hacia abajo
  const CONDICIONES_BOTTOM = H - 10

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(GRAY800)
  doc.text('CONDICIONES IMPORTANTES', W / 2, y2 + 2, { align: 'center' })
  y2 += 6.5

  const lineHeight = 2.8

  if (data.tipo === 'perforacion') {
    // Una sola columna, sin títulos (el cuerpo legal ya incluye el encabezado).
    // Fuente 6pt con gaps cómodos (sin footer en esta página hay espacio sobrado).
    const badgeSize = 4.5
    const fontBody = 6
    const lineHeightCompact = 2.35  // más aire entre líneas para que no se monten
    const gapEntreCondiciones = 1.8 // separación clara entre puntos

    const xTexto = mg + badgeSize + 2
    const anchoTexto = W - 2 * mg - badgeSize - 2

    condicionesPerf.forEach((cond, idx) => {
      const numeracion = `${idx + 1}`
      doc.setFont('helvetica', 'normal'); doc.setFontSize(fontBody)
      const bodyLines = doc.splitTextToSize(cond.texto, anchoTexto)
      const bloqueH = Math.max(badgeSize, bodyLines.length * lineHeightCompact) + gapEntreCondiciones

      // Si no cabe, nueva página sin footer también
      if (y2 + bloqueH > CONDICIONES_BOTTOM) {
        doc.addPage()
        y2 = CONTENT_TOP + 6.5
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(GRAY800)
        doc.text('CONDICIONES IMPORTANTES (continuación)', W / 2, CONTENT_TOP + 2, { align: 'center' })
      }

      // Badge navy con número
      doc.setFillColor(hexToRgb(NAVY)[0], hexToRgb(NAVY)[1], hexToRgb(NAVY)[2])
      doc.roundedRect(mg, y2, badgeSize, badgeSize, 0.8, 0.8, 'F')
      doc.setFont('helvetica', 'bold'); doc.setFontSize(numeracion.length > 1 ? 5.5 : 6.5); doc.setTextColor(WHITE)
      doc.text(numeracion, mg + badgeSize / 2, y2 + badgeSize * 0.73, { align: 'center' })

      // Cuerpo (el texto legal ya empieza con su encabezado natural)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(fontBody); doc.setTextColor(GRAY700)
      doc.text(bodyLines, xTexto, y2 + 3)
      y2 += Math.max(badgeSize, bodyLines.length * lineHeightCompact) + gapEntreCondiciones
    })
  } else {
    // LIMPIEZA: texto libre por párrafos (comportamiento anterior)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(GRAY700)
    const parrafos = condicionesLimpText.split(/\n\n+/).filter(p => p.trim())
    for (const parr of parrafos) {
      const lineasTexto = doc.splitTextToSize(parr.trim(), W - 2 * mg)
      const bloqueH = lineasTexto.length * lineHeight
      if (y2 + bloqueH > CONTENT_BOTTOM) {
        doc.addPage()
        y2 = CONTENT_TOP
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(GRAY800)
        doc.text('CONDICIONES IMPORTANTES (continuación)', W / 2, y2 + 2, { align: 'center' })
        y2 += 6.5
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(GRAY700)
      }
      doc.text(lineasTexto, mg, y2 + 2)
      y2 += bloqueH + 1.4
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Dibujar HEADER en todas las páginas + FOOTER solo en páginas ANTERIORES a condiciones.
  // Las páginas de condiciones NO llevan footer (libera espacio para las 18 cláusulas).
  // ═══════════════════════════════════════════════════════════════════════════
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    dibujarHeader(doc, W, mg, logoDataUrl, data.correlativo, data.fecha, p, totalPages)
    if (p < paginaInicioCondiciones) {
      dibujarFooter(doc, W, H, mg, data.vendedor || 'Gerencia Hidroperforaciones', emailVendedor, telVendedor, logoDataUrl)
    }
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
