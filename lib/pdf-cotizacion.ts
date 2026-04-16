// Genera PDF de una cotización, replicando el template de /imprimir
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { QuotationData } from './quotation-store'
import { calcularPerforacion, calcularLimpieza, formatQ, IVA } from './calculator'
import type { InputsPerforacion, InputsLimpieza } from './calculator'
import { DEFAULT_PRECIOS_LINEAS, type PreciosLineas } from './config-store'

// ── Colores ──────────────────────────────────────────────────────────────────
const NAVY   = '#1a3a6e'
const GRAY50 = '#f9fafb'
const GRAY100= '#f3f4f6'
const GRAY200= '#e5e7eb'
const GRAY300= '#d1d5db'
const GRAY400= '#9ca3af'
const GRAY500= '#6b7280'
const GRAY700= '#374151'
const GRAY800= '#1f2937'
const AMBER50= '#fffbeb'
const AMBER700='#b45309'
const BLUE50 = '#eff6ff'
const BLUE200= '#bfdbfe'
const WHITE  = '#ffffff'

// ── Constructores de líneas ───────────────────────────────────────────────────
function buildLineasPerf(
  ip: InputsPerforacion,
  res: ReturnType<typeof calcularPerforacion>,
  pl: PreciosLineas = DEFAULT_PRECIOS_LINEAS
) {
  const rows = [
    { nombre: 'Traslado de equipo de perforación',            unidad: 'Global', cant: 1,                           precio: Math.round(res.costoTraslado * 0.7) },
    { nombre: 'Traslado de tubería y materiales',             unidad: 'Global', cant: 1,                           precio: Math.round(res.costoTraslado * 0.3) },
    { nombre: 'Instalación de equipo de perforación',         unidad: 'Global', cant: 1,                           precio: pl.instalacionEquipo },
    { nombre: `Perforación de pozo mecánico Ø ${ip.diametro}"`, unidad: 'ML',  cant: Math.round(ip.profundidad * 0.3048), precio: Math.round(ip.precioPorPieVenta * 3.28084) },
    { nombre: 'Entubado de pozo',                             unidad: 'ML',     cant: ip.numeroDeTubos,            precio: ip.costoPorTubo },
    { nombre: 'Filtro de pozo',                               unidad: 'ML',     cant: ip.numeroDeFilteros,         precio: ip.costoPorFiltro },
    { nombre: 'Pre-filtro de grava sílica',                   unidad: 'Global', cant: 1,                           precio: Math.round(res.costoGrava) },
    { nombre: 'Sello sanitario',                              unidad: 'Global', cant: 1,                           precio: Math.round(res.costoSelloSanitario) },
    { nombre: 'Cementación',                                  unidad: 'Global', cant: 1,                           precio: pl.cementacion },
    { nombre: 'Registro eléctrico',                           unidad: 'Global', cant: 1,                           precio: pl.registroElectrico },
    { nombre: 'Desarrollo y limpieza de pozo',                unidad: 'Global', cant: 1,                           precio: pl.desarrolloLimpieza },
    { nombre: 'Aforo de pozo',                                unidad: 'Global', cant: 1,                           precio: Math.round(res.costoAforo) },
    { nombre: 'Análisis físico-químico del agua',             unidad: 'Unidad', cant: 1,                           precio: pl.analisisFisicoQuimico },
    { nombre: 'Análisis bacteriológico del agua',             unidad: 'Unidad', cant: 1,                           precio: pl.analisisBacteriologico },
    { nombre: 'Informe final de pozo',                        unidad: 'Unidad', cant: 1,                           precio: pl.informeFinal },
    { nombre: 'Desinstalación y retiro de equipo',            unidad: 'Global', cant: 1,                           precio: pl.desinstalacion },
    { nombre: 'Suministro e instalación de bomba sumergible', unidad: 'Global', cant: 1,                           precio: ip.costoBomba },
    { nombre: 'Suministro e instalación de sarta de producción', unidad: 'Global', cant: 1,                        precio: pl.sartaProduccion },
    ...(ip.incluirLimpieza ? [{ nombre: 'Limpieza mecánica de pozo', unidad: 'Global', cant: 1, precio: Math.round(res.costoLimpieza * 1.3) }] : []),
  ]
  return rows.map(r => ({ ...r, total: r.cant * r.precio })).filter(r => r.total > 0)
}

function buildLineasLimp(
  il: InputsLimpieza,
  res: ReturnType<typeof calcularLimpieza>,
  pl: PreciosLineas = DEFAULT_PRECIOS_LINEAS
) {
  return [
    { nombre: 'Traslado de equipo de limpieza',               unidad: 'Global', cant: 1,               precio: Math.round(res.costoTraslado * 1.2) },
    { nombre: 'Instalación de equipo de limpieza',            unidad: 'Global', cant: 1,               precio: pl.instalacionEquipo },
    { nombre: `Limpieza mecánica de pozo (${il.horasLimpieza} horas)`, unidad: 'Hora', cant: il.horasLimpieza, precio: il.precioVentaHora },
    { nombre: 'Químicos y aditivos de limpieza',              unidad: 'Global', cant: 1,               precio: Math.round(res.costoQuimicos * 1.5) },
    { nombre: 'Desarrollo y limpieza final de pozo',          unidad: 'Global', cant: 1,               precio: pl.desarrolloLimpiezaFinal },
    { nombre: 'Análisis físico-químico del agua',             unidad: 'Unidad', cant: 1,               precio: pl.analisisFisicoQuimico },
    { nombre: 'Desinstalación y retiro de equipo',            unidad: 'Global', cant: 1,               precio: pl.desinstalacion },
  ].map(r => ({ ...r, total: r.cant * r.precio }))
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

// ── Carga de logo como base64 ─────────────────────────────────────────────────
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

// ── Generador principal ───────────────────────────────────────────────────────
export async function generarPDF(data: QuotationData): Promise<Uint8Array> {
  const logoDataUrl = await cargarLogoBase64()

  const doc = new jsPDF({ format: 'letter', unit: 'mm', orientation: 'portrait' })
  const W  = doc.internal.pageSize.getWidth()   // 215.9 mm
  const H  = doc.internal.pageSize.getHeight()  // 279.4 mm
  const mg = 15
  const cW = W - 2 * mg

  let y = mg

  // ── ENCABEZADO ──────────────────────────────────────────────────────────────
  // Logo (real si disponible, fallback texto "HP")
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', mg, y, 14, 14)
  } else {
    doc.setFillColor(NAVY)
    doc.roundedRect(mg, y, 12, 12, 1.5, 1.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(WHITE)
    doc.text('HP', mg + 6, y + 7.5, { align: 'center' })
  }

  // Nombre de empresa
  doc.setTextColor(NAVY)
  doc.setFontSize(13)
  doc.text('HIDROPERFORACIONES', mg + 15, y + 5.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(GRAY500)
  doc.text('Soluciones en agua subterranea', mg + 15, y + 9.5)

  // Detalles de empresa
  y += 15
  doc.setFontSize(6.5)
  doc.setTextColor(GRAY500)
  for (const line of [
    'Guatemala, zona 10',
    'Edif. Centro Empresarial, Torre II, Of. 708-709',
    'NIT: 6697047-4  |  info@hidroperforaciones.com',
  ]) {
    doc.text(line, mg, y); y += 3.5
  }

  // Caja Correlativo (derecha)
  const bW = 58, bH = 18, bX = W - mg - bW
  doc.setFillColor(NAVY)
  doc.roundedRect(bX, mg, bW, bH, 2, 2, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.setTextColor('#c8d2e6')
  doc.text('COTIZACION', bX + bW / 2, mg + 5.5, { align: 'center' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(WHITE)
  doc.text(data.correlativo, bX + bW / 2, mg + 14, { align: 'center' })

  // Info fecha/vendedor (bajo la caja)
  let iy = mg + 21
  const infoItems: [string, string][] = [
    ['Fecha:',    data.fecha],
    ['Validez:',  `${data.validezDias} dias`],
    ['Vendedor:', data.vendedor],
    ['Tipo:',     data.tipo === 'perforacion' ? 'Perforacion de Pozo' : 'Limpieza Mecanica'],
  ]
  for (const [k, v] of infoItems) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(GRAY500)
    doc.text(k, bX + bW, iy, { align: 'right' })
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(GRAY800)
    doc.text(v, W - mg, iy, { align: 'right' })
    iy += 3.8
  }

  // Línea divisoria
  y = Math.max(y + 3, mg + 41)
  const [nr, ng, nb] = hexToRgb(NAVY)
  doc.setDrawColor(nr, ng, nb)
  doc.setLineWidth(0.5)
  doc.line(mg, y, W - mg, y)
  y += 6

  // ── DATOS CLIENTE / PROYECTO ─────────────────────────────────────────────────
  const hW = (cW - 5) / 2

  const clientRows: [string, string][] = [
    ['Cliente',   data.cliente  || '—'],
    ['Empresa',   data.empresa  || '—'],
    ['NIT / DPI', data.nit      || '—'],
  ]
  const clientH = clientRows.length * 4.5 + 9

  doc.setFillColor(GRAY100)
  doc.setDrawColor(GRAY300)
  doc.setLineWidth(0.2)
  doc.roundedRect(mg, y, hW, clientH, 1.5, 1.5, 'FD')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(NAVY)
  doc.text('DATOS DEL CLIENTE', mg + 3, y + 4.5)
  let cy = y + 8.5
  for (const [k, v] of clientRows) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(GRAY500)
    doc.text(`${k}:`, mg + 3, cy)
    doc.setFont('helvetica', 'bold'); doc.setTextColor(GRAY800)
    doc.text(v.slice(0, 30), mg + 24, cy)
    cy += 4.5
  }

  const projRows: [string, string][] = [
    ['Proyecto',  data.proyecto || '—'],
    ['Direccion', data.direccion || 'Por definir'],
    ['Duracion',  data.duracion || '—'],
  ]
  if (data.ip) {
    projRows.push(['Profundidad', `${data.ip.profundidad} pies (~${Math.round(data.ip.profundidad * 0.3048)}m)`])
    projRows.push(['Diametro',   `${data.ip.diametro}" (broca ${data.ip.diametro * 2}")`])
  }
  if (data.il) {
    projRows.push(['Horas', `${data.il.horasLimpieza} horas`])
    projRows.push(['Dias',  `${data.il.diasTrabajo} dias`])
  }
  const projH = Math.max(clientH, projRows.length * 4.5 + 9)
  const pX    = mg + hW + 5

  doc.setFillColor(GRAY100); doc.setDrawColor(GRAY300); doc.setLineWidth(0.2)
  doc.roundedRect(pX, y, hW, projH, 1.5, 1.5, 'FD')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(NAVY)
  doc.text('DATOS DEL PROYECTO', pX + 3, y + 4.5)
  let py = y + 8.5
  for (const [k, v] of projRows) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(GRAY500)
    doc.text(`${k}:`, pX + 3, py)
    doc.setFont('helvetica', 'bold'); doc.setTextColor(GRAY800)
    doc.text(v.slice(0, 27), pX + 25, py)
    py += 4.5
  }

  y += Math.max(clientH, projH) + 6

  // ── TABLA DE SERVICIOS ───────────────────────────────────────────────────────
  const pl      = { ...DEFAULT_PRECIOS_LINEAS, ...data.preciosLineas }
  const resPerf = data.ip ? calcularPerforacion(data.ip) : null
  const resLimp = data.il ? calcularLimpieza(data.il) : null
  const lineas  = data.tipo === 'perforacion' && data.ip && resPerf
    ? buildLineasPerf(data.ip, resPerf, pl)
    : data.il && resLimp
      ? buildLineasLimp(data.il, resLimp, pl)
      : []

  const subtotal = lineas.reduce((a, b) => a + b.total, 0)
  const iva      = subtotal * IVA
  const total    = subtotal + iva

  doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(NAVY)
  doc.text('DESCRIPCION DE SERVICIOS', mg, y)
  y += 3

  if (lineas.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: mg, right: mg },
      head: [['#', 'Descripcion', 'Unid.', 'Cant.', 'P. Unitario', 'Total']],
      body: lineas.map((l, i) => [
        String(i + 1),
        l.nombre,
        l.unidad,
        String(l.cant),
        formatQ(l.precio),
        formatQ(l.total),
      ]),
      headStyles: {
        fillColor: hexToRgb(NAVY),
        textColor: hexToRgb(WHITE),
        fontSize: 6.5,
        fontStyle: 'bold',
        cellPadding: 2,
      },
      bodyStyles: {
        fontSize: 7,
        textColor: hexToRgb(GRAY800),
        cellPadding: 2,
      },
      alternateRowStyles: {
        fillColor: hexToRgb(GRAY50),
      },
      columnStyles: {
        0: { cellWidth: 6,  halign: 'center', textColor: hexToRgb(GRAY400) },
        2: { cellWidth: 12, halign: 'center', textColor: hexToRgb(GRAY500) },
        3: { cellWidth: 10, halign: 'right'  },
        4: { cellWidth: 25, halign: 'right'  },
        5: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
      },
      styles: {
        lineWidth: 0.1,
        lineColor: hexToRgb(GRAY200),
      },
      theme: 'plain',
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2
  } else {
    // Sin líneas: mostrar monto directamente
    doc.setFillColor(GRAY100); doc.setDrawColor(GRAY300); doc.setLineWidth(0.2)
    doc.roundedRect(mg, y, cW, 10, 1.5, 1.5, 'FD')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(GRAY500)
    doc.text('Cotizacion sin detalle de servicios', mg + cW/2, y + 6.5, { align: 'center' })
    y += 14
  }

  // ── TOTALES ──────────────────────────────────────────────────────────────────
  const tW = 70, tX = W - mg - tW

  doc.setFillColor(GRAY50); doc.setDrawColor(GRAY300); doc.setLineWidth(0.2)
  doc.rect(tX, y, tW, 7, 'FD')
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(GRAY500)
  doc.text('Subtotal (sin IVA)', tX + 3, y + 4.8)
  doc.setFont('helvetica', 'bold'); doc.setTextColor(GRAY800)
  doc.text(formatQ(subtotal), W - mg - 2, y + 4.8, { align: 'right' })
  y += 7

  doc.setFillColor(AMBER50); doc.setDrawColor(GRAY300); doc.setLineWidth(0.2)
  doc.rect(tX, y, tW, 7, 'FD')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(AMBER700)
  doc.text('IVA (12%)', tX + 3, y + 4.8)
  doc.text(formatQ(iva), W - mg - 2, y + 4.8, { align: 'right' })
  y += 7

  doc.setFillColor(NAVY); doc.rect(tX, y, tW, 9, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(WHITE)
  doc.text('TOTAL', tX + 3, y + 6.2)
  doc.text(formatQ(total), W - mg - 2, y + 6.2, { align: 'right' })
  y += 13

  // ── NOTAS ────────────────────────────────────────────────────────────────────
  if (data.notas) {
    const nLines = doc.splitTextToSize(data.notas, cW - 8)
    const nH = nLines.length * 3.8 + 9
    if (y + nH > H - 50) { doc.addPage(); y = mg }
    doc.setFillColor(BLUE50); doc.setDrawColor(BLUE200); doc.setLineWidth(0.2)
    doc.roundedRect(mg, y, cW, nH, 1.5, 1.5, 'FD')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(NAVY)
    doc.text('NOTAS', mg + 3, y + 4.5)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(GRAY700)
    doc.text(nLines, mg + 3, y + 8.5)
    y += nH + 5
  }

  // ── TÉRMINOS Y CONDICIONES ───────────────────────────────────────────────────
  if (data.condiciones) {
    const cLines = doc.splitTextToSize(data.condiciones, cW - 8)
    const cH = cLines.length * 3.5 + 9
    if (y + cH > H - 50) { doc.addPage(); y = mg }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(NAVY)
    doc.text('TERMINOS Y CONDICIONES', mg, y)
    y += 4
    doc.setFillColor(GRAY50); doc.setDrawColor(GRAY300); doc.setLineWidth(0.2)
    doc.roundedRect(mg, y, cW, cH, 1.5, 1.5, 'FD')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(GRAY500)
    doc.text(cLines, mg + 3, y + 4.5)
    y += cH + 8
  }

  // ── FIRMAS ───────────────────────────────────────────────────────────────────
  if (y + 42 > H) { doc.addPage(); y = mg + 10 }
  const sW = (cW - 30) / 2

  const [gr, gg, gb] = hexToRgb(GRAY400)
  doc.setDrawColor(gr, gg, gb); doc.setLineWidth(0.3)

  // Izquierda (Hidroperforaciones)
  doc.line(mg, y + 22, mg + sW, y + 22)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(GRAY700)
  doc.text('Hidroperforaciones', mg + sW / 2, y + 27, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(GRAY500)
  doc.text(data.vendedor, mg + sW / 2, y + 31, { align: 'center' })
  doc.text('Vendedor / Representante', mg + sW / 2, y + 34.5, { align: 'center' })

  // Derecha (Cliente)
  const sX2 = W - mg - sW
  doc.line(sX2, y + 22, W - mg, y + 22)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(GRAY700)
  doc.text(data.cliente || 'Cliente', sX2 + sW / 2, y + 27, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(GRAY500)
  if (data.empresa) doc.text(data.empresa, sX2 + sW / 2, y + 31, { align: 'center' })
  doc.text('Aceptacion y firma', sX2 + sW / 2, y + 34.5, { align: 'center' })

  y += 42

  // ── FOOTER ───────────────────────────────────────────────────────────────────
  const [lr, lg, lb] = hexToRgb(GRAY200)
  doc.setDrawColor(lr, lg, lb); doc.setLineWidth(0.3)
  doc.line(mg, y, W - mg, y); y += 4
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(GRAY400)
  doc.text(
    'Hidroperforaciones  |  Guatemala, zona 10  |  NIT: 6697047-4  |  info@hidroperforaciones.com',
    W / 2, y, { align: 'center' }
  )
  y += 4
  doc.setTextColor(GRAY300)
  doc.text(
    `Cotizacion ${data.correlativo}  |  ${data.fecha}  |  Valida por ${data.validezDias} dias`,
    W / 2, y, { align: 'center' }
  )

  return new Uint8Array(doc.output('arraybuffer') as ArrayBuffer)
}

// ── Nombre de archivo limpio ─────────────────────────────────────────────────
export function sanitize(s: string): string {
  return s
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/[^a-zA-Z0-9_\-. ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 50)
}
