import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatFechaDDMMYYYY } from './date-format'
import type { LiquidacionLinea, LiquidacionResumen } from './liquidacion-proyecto'

type LiquidacionLineaPdf = Pick<LiquidacionLinea, 'key' | 'nombre' | 'unidad' | 'cantidad' | 'precioUnitario' | 'total' | 'incluido' | 'origen'>
type LiquidacionResumenPdf = Pick<
  LiquidacionResumen,
  | 'totalLiquidacion'
  | 'totalPagosCliente'
  | 'saldoCliente'
  | 'totalGastosReales'
  | 'cajaActual'
  | 'margenEstimado'
  | 'montoCotizacion'
  | 'piesPerforados'
  | 'bentonitaSacos'
  | 'pipas'
>

interface LiquidacionPdfData {
  proyecto: {
    correlativo: string
    cliente: string
    empresa: string
    nombre: string
    vendedor: string
    monto: number
  }
  liquidacion: {
    id?: string
    estado: string
    fecha: string
    motivo: string
    confirmadoPor?: string
    confirmadoEn?: string
  } | null
  lineas: LiquidacionLineaPdf[]
  resumen: LiquidacionResumenPdf
}

const NAVY = '#1a3a6e'
const GRAY = '#6b7280'
const DARK = '#1f2937'

function q(n: number): string {
  return `Q ${Math.round(Number(n) || 0).toLocaleString('es-GT')}`
}

function n2(n: number): string {
  return (Number(n) || 0).toLocaleString('es-GT', { maximumFractionDigits: 2 })
}

function saldoTexto(saldo: number): string {
  if (saldo > 0) return `Cliente debe ${q(saldo)}`
  if (saldo < 0) return `A favor del cliente ${q(Math.abs(saldo))}`
  return 'Saldo en tablas'
}

export async function generarPDFLiquidacion(data: LiquidacionPdfData): Promise<Uint8Array> {
  const doc = new jsPDF({ format: 'letter', unit: 'mm', orientation: 'portrait' })
  const W = doc.internal.pageSize.getWidth()
  const margin = 14
  const fecha = data.liquidacion?.fecha || new Date().toISOString().slice(0, 10)

  doc.setFillColor(NAVY)
  doc.rect(0, 0, W, 28, 'F')
  doc.setTextColor('#ffffff')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('HIDROPERFORACIONES, S.A.', margin, 12)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Liquidacion de trabajos ejecutados', margin, 20)

  doc.setTextColor(DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(`Proyecto ${data.proyecto.correlativo}`, margin, 38)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(GRAY)
  doc.text(`Fecha: ${formatFechaDDMMYYYY(fecha)}`, margin, 44)
  doc.text(`Cliente: ${data.proyecto.cliente}${data.proyecto.empresa ? ` / ${data.proyecto.empresa}` : ''}`, margin, 50)
  doc.text(`Proyecto: ${data.proyecto.nombre}`, margin, 56)
  doc.text(`Vendedor: ${data.proyecto.vendedor}`, margin, 62)
  if (data.liquidacion?.motivo) doc.text(`Motivo: ${data.liquidacion.motivo}`, margin, 68)

  autoTable(doc, {
    startY: data.liquidacion?.motivo ? 76 : 70,
    head: [['Descripcion', 'Unidad', 'Cantidad', 'Precio/U', 'Total']],
    body: data.lineas
      .filter(l => l.incluido)
      .map(l => [
        l.nombre,
        l.unidad,
        n2(l.cantidad),
        q(l.precioUnitario),
        q(l.total),
      ]),
    styles: { fontSize: 8, cellPadding: 2, lineColor: [229, 231, 235], lineWidth: 0.1 },
    headStyles: { fillColor: [26, 58, 110], textColor: 255, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 88 },
      1: { cellWidth: 22 },
      2: { halign: 'right', cellWidth: 22 },
      3: { halign: 'right', cellWidth: 28 },
      4: { halign: 'right', cellWidth: 28 },
    },
  })

  let cursorY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 160) + 8
  const pageH = doc.internal.pageSize.getHeight()
  const ensureSpace = (height: number) => {
    if (cursorY + height > pageH - 24) {
      doc.addPage()
      cursorY = 18
    }
  }

  ensureSpace(36)
  autoTable(doc, {
    startY: cursorY,
    theme: 'plain',
    margin: { left: W - margin - 78 },
    body: [
      ['Total liquidacion', q(data.resumen.totalLiquidacion)],
      ['Pagos recibidos', q(data.resumen.totalPagosCliente)],
      [saldoTexto(data.resumen.saldoCliente), q(Math.abs(data.resumen.saldoCliente))],
      ['Gastos reales', q(data.resumen.totalGastosReales)],
      ['Margen estimado', q(data.resumen.margenEstimado)],
    ],
    styles: { fontSize: 9, cellPadding: 1.8 },
    columnStyles: {
      0: { textColor: [75, 85, 99], cellWidth: 42 },
      1: { halign: 'right', fontStyle: 'bold', cellWidth: 36 },
    },
  })

  const footerY = doc.internal.pageSize.getHeight() - 16
  doc.setDrawColor('#e5e7eb')
  doc.line(margin, footerY - 5, W - margin, footerY - 5)
  doc.setFontSize(8)
  doc.setTextColor(GRAY)
  doc.text(`Avance: ${n2(data.resumen.piesPerforados)} pies · Bentonita: ${n2(data.resumen.bentonitaSacos)} sacos · Pipas: ${n2(data.resumen.pipas)}`, margin, footerY)
  doc.text('Documento generado desde HidroCRM', W - margin, footerY, { align: 'right' })

  return new Uint8Array(doc.output('arraybuffer'))
}

export function descargarPDFLiquidacion(bytes: Uint8Array, filename: string) {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  const blob = new Blob([buffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
