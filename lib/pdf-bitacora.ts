// Genera PDFs de bitácora:
//  - generarPDFEntrada(proyecto, entrada)  → reporte diario para el cliente
//  - generarPDFExpediente(proyecto)         → expediente completo del proyecto
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── Colores ──────────────────────────────────────────────────────────────────
const NAVY   = '#1a3a6e'
const WHITE  = '#ffffff'
const GRAY50 = '#f9fafb'
const GRAY100= '#f3f4f6'
const GRAY300= '#d1d5db'
const GRAY500= '#6b7280'
const GRAY700= '#374151'
const GRAY800= '#1f2937'
const GREEN  = '#059669'
const AMBER  = '#d97706'
const RED    = '#dc2626'

function hex(h: string): [number, number, number] {
  return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]
}

// ── Logo ─────────────────────────────────────────────────────────────────────
async function logoBase64(): Promise<string | null> {
  try {
    const res = await fetch('/logo.png')
    if (!res.ok) return null
    const blob = await res.blob()
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror  = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

// ── Tipos compartidos ─────────────────────────────────────────────────────────
export interface EntradaBitacora {
  id: string
  fecha: string
  turno: string
  estado: string
  tipo: string
  perforacionDia: number
  ampliacion1Dia: number
  ampliacion2Dia: number
  rehabilitacionDia: number
  perforacionTotal: number
  ampliacion1Total: number
  ampliacion2Total: number
  rehabilitacionTotal: number
  horasPerforacion: number
  bentonitaSacos: number
  pipas: number
  horasLimpieza: number
  horasAforo: number
  diaAdverso: boolean
  notaInterna: string
  notaCliente: string
  // Nuevos (Excel DATOS BITACORA DIARIA)
  formacionGeologica?: string
  circulacionPct?: number
}

export interface ProyectoBitacora {
  id: string
  correlativo: string
  cliente: string
  empresa: string
  nombre: string
  tipo: string
  monto: number
  vendedor: string
  estado: string
  fechaInicio: string
  entradas: EntradaBitacora[]
  // Totales del proyecto desde la cotización (opcional)
  profundidadTotal?: number   // total de pies a perforar según cotización
  diasHabilesTotal?: number   // total de días hábiles estimados
  bentonitaPlan?: number      // sacos pagados por el cliente (70%)
  pipasPlan?: number          // pipas estimadas (días / 3)
}

// ── Encabezado de empresa ─────────────────────────────────────────────────────
function drawHeader(
  doc: jsPDF,
  logo: string | null,
  W: number,
  mg: number,
  y: number,
  subtitulo: string
): number {
  if (logo) {
    doc.addImage(logo, 'PNG', mg, y, 16, 16)
  } else {
    doc.setFillColor(...hex(NAVY))
    doc.roundedRect(mg, y, 14, 14, 1.5, 1.5, 'F')
    doc.setFont('helvetica','bold')
    doc.setFontSize(8); doc.setTextColor(WHITE)
    doc.text('HP', mg + 7, y + 9, { align: 'center' })
  }

  doc.setFont('helvetica','bold')
  doc.setFontSize(13)
  doc.setTextColor(...hex(NAVY))
  doc.text('HIDROPERFORACIONES, S.A.', mg + 19, y + 6)

  doc.setFont('helvetica','normal')
  doc.setFontSize(8)
  doc.setTextColor(...hex(GRAY500))
  doc.text('Guatemala · info@hidroperforaciones.com', mg + 19, y + 11)

  // subtítulo a la derecha
  doc.setFont('helvetica','bold')
  doc.setFontSize(10)
  doc.setTextColor(...hex(NAVY))
  doc.text(subtitulo, W - mg, y + 6, { align: 'right' })

  const lineY = y + 18
  doc.setDrawColor(...hex(NAVY))
  doc.setLineWidth(0.6)
  doc.line(mg, lineY, W - mg, lineY)
  return lineY + 5
}

// ── Barra de progreso ─────────────────────────────────────────────────────────
function drawProgressBar(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  pct: number,
  label: string
) {
  // fondo
  doc.setFillColor(...hex(GRAY100))
  doc.roundedRect(x, y, w, h, h/2, h/2, 'F')
  // relleno
  const fillW = Math.max(0, Math.min(1, pct)) * w
  if (fillW > 0) {
    const color = pct >= 1 ? GREEN : pct >= 0.6 ? NAVY : AMBER
    doc.setFillColor(...hex(color))
    doc.roundedRect(x, y, fillW, h, h/2, h/2, 'F')
  }
  // texto
  doc.setFont('helvetica','bold')
  doc.setFontSize(7)
  doc.setTextColor(...hex(GRAY700))
  doc.text(label, x + w + 3, y + h - 1)
}

// ══════════════════════════════════════════════════════════════════════════════
// PDF ENTRADA DIARIA — reporte para el cliente de un día específico
// ══════════════════════════════════════════════════════════════════════════════
export async function generarPDFEntrada(
  proyecto: ProyectoBitacora,
  entrada: EntradaBitacora,
  opts: { incluirConsumos?: boolean } = {},
): Promise<ArrayBuffer> {
  const incluirConsumos = opts.incluirConsumos ?? true
  const logo = await logoBase64()
  const doc  = new jsPDF({ format: 'letter', unit: 'mm', orientation: 'portrait' })
  const W = doc.internal.pageSize.getWidth()
  const mg = 14
  let y = mg

  // Encabezado
  y = drawHeader(doc, logo, W, mg, y, 'BITÁCORA DIARIA')

  // Datos del proyecto
  doc.setFillColor(...hex(GRAY50))
  doc.roundedRect(mg, y, W - mg*2, 22, 2, 2, 'F')

  doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...hex(NAVY))
  doc.text('PROYECTO', mg + 4, y + 7)
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...hex(GRAY700))
  doc.text(proyecto.nombre, mg + 28, y + 7)

  doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...hex(NAVY))
  doc.text('CLIENTE', mg + 4, y + 13)
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...hex(GRAY700))
  doc.text(proyecto.cliente + (proyecto.empresa ? ` — ${proyecto.empresa}` : ''), mg + 28, y + 13)

  doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...hex(NAVY))
  doc.text('CORRELATIVO', mg + 4, y + 19)
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...hex(GRAY700))
  doc.text(proyecto.correlativo, mg + 28, y + 19)

  // Fecha + turno en la derecha
  const turnoLabel = entrada.turno === 'dia' ? 'TURNO DIURNO' : 'TURNO NOCTURNO'
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...hex(NAVY))
  doc.text(entrada.fecha, W - mg - 4, y + 8, { align: 'right' })
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...hex(GRAY500))
  doc.text(turnoLabel, W - mg - 4, y + 14, { align: 'right' })
  if (entrada.diaAdverso) {
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...hex(AMBER))
    doc.text('⚠ DÍA ADVERSO', W - mg - 4, y + 19, { align: 'right' })
  }

  y += 27

  // ── Tabla de actividades del día ──────────────────────────────────────────
  const esPerf = proyecto.tipo === 'perforacion'

  if (esPerf) {
    // Acumulados hasta esta entrada (inclusive) — para mostrar "llevamos X/Y"
    const entradasHastaFecha = proyecto.entradas.filter(e => e.fecha <= entrada.fecha)
    const bentonitaAcum = entradasHastaFecha.reduce((s, e) => s + e.bentonitaSacos, 0)
    const pipasAcum     = entradasHastaFecha.reduce((s, e) => s + e.pipas, 0)

    const fmtPctAcum = (acum: number, plan: number | undefined) => {
      if (!plan || plan <= 0) return acum.toFixed(0)
      const pct = Math.min(100, (acum / plan) * 100)
      return `${acum.toFixed(0)} / ${plan} (${pct.toFixed(0)}%)`
    }

    // Tabla simplificada — solo lo que el Excel DATOS BITACORA DIARIA tiene
    const bodyRows: Array<[string, string, string]> = [
      ['Perforación (pies)', `${entrada.perforacionDia.toFixed(1)}`, `${entrada.perforacionTotal.toFixed(1)}`],
    ]
    if (incluirConsumos) {
      bodyRows.push(['Bentonita (sacos)', `${entrada.bentonitaSacos.toFixed(0)}`, fmtPctAcum(bentonitaAcum, proyecto.bentonitaPlan)])
      bodyRows.push(['Pipas de agua',     `${entrada.pipas.toFixed(0)}`,          fmtPctAcum(pipasAcum,    proyecto.pipasPlan)])
    }
    if (typeof entrada.circulacionPct === 'number' && entrada.circulacionPct > 0) {
      bodyRows.push(['Circulación',     `${entrada.circulacionPct}%`, ''])
    }
    if (entrada.formacionGeologica) {
      bodyRows.push(['Formación geológica', entrada.formacionGeologica, ''])
    }
    autoTable(doc, {
      startY: y,
      margin: { left: mg, right: mg },
      head: [['Actividad', 'Día', 'Acumulado']],
      body: bodyRows,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: hex(NAVY), textColor: hex(WHITE), fontStyle: 'bold', fontSize: 9 },
      alternateRowStyles: { fillColor: hex(GRAY50) },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { halign: 'center', cellWidth: 50 },
        2: { halign: 'center' },
      },
    })
  } else {
    // Limpieza — tabla mínima
    const bodyL: Array<[string, string]> = []
    if (incluirConsumos) {
      bodyL.push(['Pipas de agua',      `${entrada.pipas.toFixed(0)}`])
      bodyL.push(['Bentonita (sacos)',  `${entrada.bentonitaSacos.toFixed(0)}`])
    }
    if (entrada.formacionGeologica) {
      bodyL.push(['Formación geológica', entrada.formacionGeologica])
    }
    if (bodyL.length > 0) {
      autoTable(doc, {
        startY: y,
        margin: { left: mg, right: mg },
        head: [['Actividad', 'Cantidad']],
        body: bodyL,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: hex(NAVY), textColor: hex(WHITE), fontStyle: 'bold' },
        alternateRowStyles: { fillColor: hex(GRAY50) },
      })
    }
  }

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // ── Barra de progreso (solo perforación) ──────────────────────────────────
  if (esPerf) {
    const profundidad = proyecto.profundidadTotal ?? 0
    const diasTot    = proyecto.diasHabilesTotal ?? 0
    const piesRest   = profundidad > 0 ? Math.max(0, profundidad - entrada.perforacionTotal) : 0

    // Fila de métricas: pies restantes + día del proyecto
    if (profundidad > 0 || diasTot > 0) {
      doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...hex(NAVY))
      doc.text('Avance del proyecto', mg, y + 5)

      // Barra de progreso basada en profundidad total del proyecto
      const pct = profundidad > 0 ? Math.min(1, entrada.perforacionTotal / profundidad) : 0
      const label = profundidad > 0
        ? `${entrada.perforacionTotal.toFixed(0)} / ${profundidad} pies (${(pct * 100).toFixed(0)}%) · faltan ${piesRest.toFixed(0)} pies`
        : `${entrada.perforacionTotal.toFixed(0)} pies`
      drawProgressBar(doc, mg, y + 8, W - mg*2, 6, pct, label)
      y += 20

      // Día X de Y — contar los días distintos registrados en bitácora que ≤ esta fecha
      const fechasAntes = new Set(proyecto.entradas.filter(e => e.fecha <= entrada.fecha).map(e => e.fecha))
      const diaActual = fechasAntes.size
      if (diasTot > 0) {
        doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...hex(GRAY700))
        doc.text(`Día ${diaActual} de ${diasTot} días hábiles`, mg, y + 3)
        y += 10
      }
    } else if (entrada.perforacionTotal > 0) {
      // Fallback sin datos de cotización
      doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...hex(NAVY))
      doc.text('Avance de perforación', mg, y + 5)
      drawProgressBar(doc, mg, y + 8, W - mg*2 - 40, 6, 1, `${entrada.perforacionTotal.toFixed(1)} pies acumulados`)
      y += 20
    }
  }

  // ── Estado del día ────────────────────────────────────────────────────────
  if (entrada.estado) {
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...hex(NAVY))
    doc.text('Estado del día:', mg, y + 5)
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...hex(GRAY700))
    doc.text(entrada.estado, mg + 28, y + 5)
    y += 10
  }

  // ── Nota para el cliente ──────────────────────────────────────────────────
  if (entrada.notaCliente) {
    doc.setFillColor(...hex('#eff6ff'))
    const lines = doc.splitTextToSize(entrada.notaCliente, W - mg*2 - 8) as string[]
    const boxH = lines.length * 5 + 10
    doc.roundedRect(mg, y, W - mg*2, boxH, 2, 2, 'F')
    doc.setDrawColor(...hex('#bfdbfe'))
    doc.setLineWidth(0.3)
    doc.roundedRect(mg, y, W - mg*2, boxH, 2, 2, 'S')
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...hex(NAVY))
    doc.text('OBSERVACIONES PARA EL CLIENTE', mg + 4, y + 6)
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...hex(GRAY700))
    doc.text(lines, mg + 4, y + 12)
    y += boxH + 8
  }

  // ── Firma ─────────────────────────────────────────────────────────────────
  const sigY = Math.max(y + 15, 240)
  doc.setDrawColor(...hex(GRAY300)); doc.setLineWidth(0.3)
  doc.line(mg, sigY, mg + 60, sigY)
  doc.line(W - mg - 60, sigY, W - mg, sigY)
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...hex(GRAY500))
  doc.text('Responsable de campo', mg, sigY + 5)
  doc.text('Representante del cliente', W - mg - 60, sigY + 5)

  // ── Pie de página ─────────────────────────────────────────────────────────
  const pH = doc.internal.pageSize.getHeight()
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...hex(GRAY500))
  doc.text(`Bitácora generada por HidroCRM · ${new Date().toLocaleDateString('es-GT')}`, W/2, pH - 8, { align: 'center' })

  return doc.output('arraybuffer')
}

// ══════════════════════════════════════════════════════════════════════════════
// PDF EXPEDIENTE COMPLETO
// ══════════════════════════════════════════════════════════════════════════════
export async function generarPDFExpediente(
  proyecto: ProyectoBitacora,
  opts: { incluirConsumos?: boolean } = {},
): Promise<ArrayBuffer> {
  const incluirConsumos = opts.incluirConsumos ?? true
  const logo = await logoBase64()
  const doc  = new jsPDF({ format: 'letter', unit: 'mm', orientation: 'portrait' })
  const W    = doc.internal.pageSize.getWidth()
  const H    = doc.internal.pageSize.getHeight()
  const mg   = 14

  const entradas = [...proyecto.entradas].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const esPerf   = proyecto.tipo === 'perforacion'

  // ── PORTADA ───────────────────────────────────────────────────────────────
  doc.setFillColor(...hex(NAVY))
  doc.rect(0, 0, W, 60, 'F')

  if (logo) {
    doc.addImage(logo, 'PNG', mg, 10, 25, 25)
  }

  doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.setTextColor(WHITE)
  doc.text('EXPEDIENTE DE PROYECTO', W/2, 25, { align: 'center' })
  doc.setFont('helvetica','normal'); doc.setFontSize(11); doc.setTextColor(...hex('#bfdbfe'))
  doc.text('HIDROPERFORACIONES, S.A.', W/2, 34, { align: 'center' })
  doc.setFontSize(9); doc.text('Guatemala', W/2, 40, { align: 'center' })

  let y = 75

  // Info del proyecto
  const infoRows = [
    ['Correlativo',    proyecto.correlativo],
    ['Proyecto',       proyecto.nombre],
    ['Cliente',        proyecto.cliente + (proyecto.empresa ? ` — ${proyecto.empresa}` : '')],
    ['Tipo',           esPerf ? 'Perforación de pozo' : 'Limpieza mecánica'],
    ['Responsable',    proyecto.vendedor],
    ['Fecha de inicio',proyecto.fechaInicio],
    ['Estado',         proyecto.estado.toUpperCase()],
    ['Total entradas', String(entradas.length)],
  ]

  autoTable(doc, {
    startY: y,
    margin: { left: mg, right: mg },
    head: [['Campo', 'Valor']],
    body: infoRows,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: hex(NAVY), textColor: hex(WHITE), fontStyle: 'bold' },
    alternateRowStyles: { fillColor: hex(GRAY50) },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
  })

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12

  // ── RESUMEN DE TOTALES ────────────────────────────────────────────────────
  const totalPerfDia    = entradas.reduce((s, e) => s + e.perforacionDia, 0)
  const totalAmp1       = entradas.reduce((s, e) => s + e.ampliacion1Dia, 0)
  const totalAmp2       = entradas.reduce((s, e) => s + e.ampliacion2Dia, 0)
  const totalRehab      = entradas.reduce((s, e) => s + e.rehabilitacionDia, 0)
  const totalBentonita  = entradas.reduce((s, e) => s + e.bentonitaSacos, 0)
  const totalPipas      = entradas.reduce((s, e) => s + e.pipas, 0)
  const totalHorasLimp  = entradas.reduce((s, e) => s + e.horasLimpieza, 0)
  const totalHorasAforo = entradas.reduce((s, e) => s + e.horasAforo, 0)
  const diasAdversos    = entradas.filter(e => e.diaAdverso).length
  const diasPerf        = entradas.filter(e => e.perforacionDia > 0).length
  const promPerf        = diasPerf > 0 ? totalPerfDia / diasPerf : 0
  const lastEntry       = entradas[entradas.length - 1]
  const perfAcum        = lastEntry?.perforacionTotal ?? 0

  doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...hex(NAVY))
  doc.text('RESUMEN GENERAL', mg, y)
  y += 5

  autoTable(doc, {
    startY: y,
    margin: { left: mg, right: mg },
    head: [['Indicador', 'Valor']],
    body: [
      ['Pies perforados (acumulado)', `${perfAcum.toFixed(1)}${proyecto.profundidadTotal ? ` / ${proyecto.profundidadTotal} (${Math.min(100, (perfAcum/proyecto.profundidadTotal)*100).toFixed(0)}%)` : ''}`],
      ['Promedio pies/día', `${promPerf.toFixed(1)}`],
      ...(incluirConsumos ? [
        ['Bentonita total', `${totalBentonita.toFixed(0)} sacos${proyecto.bentonitaPlan ? ` / ${proyecto.bentonitaPlan} (${Math.min(100, (totalBentonita/proyecto.bentonitaPlan)*100).toFixed(0)}%)` : ''}`],
        ['Pipas de agua total', `${totalPipas.toFixed(0)}${proyecto.pipasPlan ? ` / ${proyecto.pipasPlan} (${Math.min(100, (totalPipas/proyecto.pipasPlan)*100).toFixed(0)}%)` : ''}`],
      ] : []),
      ['Días totales', `${entradas.length}${proyecto.diasHabilesTotal ? ` de ${proyecto.diasHabilesTotal} días hábiles` : ''}`],
      ['Días activos (con perforación)', `${diasPerf}`],
      ['Días adversos', `${diasAdversos}`],
    ],
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: hex(NAVY), textColor: hex(WHITE), fontStyle: 'bold' },
    alternateRowStyles: { fillColor: hex(GRAY50) },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 }, 1: { halign: 'right' } },
  })

  // ── BITÁCORA COMPLETA (tabla) ─────────────────────────────────────────────
  doc.addPage()
  let y2 = mg

  y2 = drawHeader(doc, logo, W, mg, y2, 'BITÁCORA COMPLETA')

  doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...hex(NAVY))
  doc.text(`Proyecto: ${proyecto.correlativo} — ${proyecto.nombre}`, mg, y2 + 3)
  y2 += 10

  if (esPerf) {
    const headPerf = incluirConsumos
      ? ['Fecha','Turno','Perf.\ndía','Acum.','Amp1','Amp2','Rehab','H.Perf','Bentonita','Pipas','Adv.','Nota cliente']
      : ['Fecha','Turno','Perf.\ndía','Acum.','Amp1','Amp2','Rehab','H.Perf','Adv.','Nota cliente']
    autoTable(doc, {
      startY: y2,
      margin: { left: mg, right: mg },
      head: [headPerf],
      body: entradas.map(e => {
        const base = [
          e.fecha,
          e.turno === 'dia' ? 'D' : 'N',
          e.perforacionDia.toFixed(1),
          e.perforacionTotal.toFixed(1),
          e.ampliacion1Dia.toFixed(1),
          e.ampliacion2Dia.toFixed(1),
          e.rehabilitacionDia.toFixed(1),
          e.horasPerforacion.toFixed(1),
        ]
        const consumos = incluirConsumos ? [`${e.bentonitaSacos.toFixed(0)} s.`, String(e.pipas)] : []
        return [...base, ...consumos, e.diaAdverso ? '⚠' : '', e.notaCliente || '']
      }),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: hex(NAVY), textColor: hex(WHITE), fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: hex(GRAY50) },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { halign: 'center', cellWidth: 10 },
        2: { halign: 'center', cellWidth: 14 },
        3: { halign: 'center', cellWidth: 14 },
        4: { halign: 'center', cellWidth: 12 },
        5: { halign: 'center', cellWidth: 12 },
        6: { halign: 'center', cellWidth: 12 },
        7: { halign: 'center', cellWidth: 12 },
        8: { halign: 'center', cellWidth: 14 },
        9: { halign: 'center', cellWidth: 12 },
        10: { halign: 'center', cellWidth: 10 },
      },
      didParseCell: (data) => {
        if (data.column.index === 10 && data.cell.raw === '⚠') {
          data.cell.styles.textColor = hex(AMBER)
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })
  } else {
    autoTable(doc, {
      startY: y2,
      margin: { left: mg, right: mg },
      head: [['Fecha','Turno','H.Limpieza','H.Aforo','Pipas','Adverso','Nota cliente']],
      body: entradas.map(e => [
        e.fecha,
        e.turno === 'dia' ? 'Diurno' : 'Nocturno',
        e.horasLimpieza.toFixed(1),
        e.horasAforo.toFixed(1),
        String(e.pipas),
        e.diaAdverso ? 'Sí' : 'No',
        e.notaCliente || '',
      ]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: hex(NAVY), textColor: hex(WHITE), fontStyle: 'bold' },
      alternateRowStyles: { fillColor: hex(GRAY50) },
    })
  }

  // ── OBSERVACIONES Y NOTAS (todas las que tengan nota cliente) ─────────────
  const conNota = entradas.filter(e => e.notaCliente.trim())
  if (conNota.length > 0) {
    doc.addPage()
    let y3 = mg
    y3 = drawHeader(doc, logo, W, mg, y3, 'OBSERVACIONES')

    for (const e of conNota) {
      if (y3 > H - 40) { doc.addPage(); y3 = mg + 10 }

      doc.setFillColor(...hex('#eff6ff'))
      const lines = doc.splitTextToSize(e.notaCliente, W - mg*2 - 8) as string[]
      const boxH = lines.length * 5 + 14
      doc.roundedRect(mg, y3, W - mg*2, boxH, 2, 2, 'F')

      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...hex(NAVY))
      doc.text(e.fecha, mg + 4, y3 + 7)
      doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...hex(GRAY500))
      doc.text(e.turno === 'dia' ? 'Turno diurno' : 'Turno nocturno', mg + 4 + 22, y3 + 7)

      doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(...hex(GRAY700))
      doc.text(lines, mg + 4, y3 + 13)
      y3 += boxH + 5
    }
  }

  // ── Pie de página en todas las páginas ────────────────────────────────────
  const numPages = doc.getNumberOfPages()
  for (let i = 1; i <= numPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...hex(GRAY500))
    doc.text(
      `Expediente: ${proyecto.correlativo} · Página ${i} de ${numPages} · Generado ${new Date().toLocaleDateString('es-GT')}`,
      W/2, H - 8, { align: 'center' }
    )
  }

  return doc.output('arraybuffer')
}

// ── Helper: descargar en browser ──────────────────────────────────────────────
export function descargarPDF(bytes: ArrayBuffer, nombre: string) {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}
