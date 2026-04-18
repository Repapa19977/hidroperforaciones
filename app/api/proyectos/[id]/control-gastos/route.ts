import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calcularPresupuestoPerforacion, agregarBitacora, calcularAvance, type BitacoraEntryAgg } from '@/lib/control-gastos'
import { calcularCronograma } from '@/lib/dias-habiles'
import type { InputsPerforacion } from '@/lib/calculator'

// GET /api/proyectos/[id]/control-gastos
// Devuelve: proyecto + presupuesto (desde cotización original) + ejecutado (bitácora agregada)
// + gastos extras + avance % físico y desviación vs presupuesto.
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const proyecto = await prisma.proyecto.findUnique({
    where: { id },
    include: { entradas: true },
  })
  if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  // Cotización original — para extraer presupuesto
  const cotizacion = await prisma.cotizacion.findUnique({
    where: { correlativo: proyecto.correlativo },
  })

  let ip: InputsPerforacion | null = null
  if (cotizacion?.datos) {
    try {
      const d = typeof cotizacion.datos === 'string' ? JSON.parse(cotizacion.datos) : cotizacion.datos
      if (d.ip) ip = d.ip as InputsPerforacion
    } catch { /* ignore */ }
  }

  const presupuesto = ip ? calcularPresupuestoPerforacion(ip) : null

  // Agregado de bitácora
  const bitacoraAgg: BitacoraEntryAgg[] = proyecto.entradas.map(e => ({
    perforacionDia: e.perforacionDia,
    bentonitaSacos: e.bentonitaSacos,
    pipas: e.pipas,
    diaAdverso: e.diaAdverso,
    estado: e.estado,
    fecha: e.fecha,
  }))

  const ejecutado = presupuesto ? agregarBitacora(bitacoraAgg, presupuesto) : null
  const avancePct = presupuesto ? calcularAvance(ejecutado?.piesPerforadosTotal ?? 0, presupuesto.profundidad) : 0

  // Gastos extras
  const gastosExtras = await prisma.gastoExtra.findMany({
    where: { proyectoId: id },
    orderBy: { fecha: 'desc' },
  })
  const totalExtras = gastosExtras.reduce((a, g) => a + g.monto, 0)

  // Inventario reservado del proyecto (bentonita split 70/30 y otros)
  const reservas = await prisma.inventarioReserva.findMany({
    where: { proyectoId: id },
    orderBy: { createdAt: 'desc' },
  })
  const reservaIds = reservas.map(r => r.id)
  const movimientos = reservaIds.length > 0
    ? await prisma.movimientoInventario.findMany({
        where: { reservaId: { in: reservaIds } },
        orderBy: { createdAt: 'desc' },
      })
    : []
  const valorReservado = reservas.reduce((a, r) => a + r.cantidadActual * r.costoUnitario, 0)
  const ventasExternas = movimientos
    .filter(m => m.tipo === 'venta_externa')
    .reduce((a, m) => a + m.monto, 0)

  const totalEjecutadoMasExtras = (ejecutado?.total ?? 0) + totalExtras
  const desviacionQ = presupuesto ? totalEjecutadoMasExtras - presupuesto.total : 0

  // Cronograma: los días corren desde la PRIMERA entrada de bitácora (trigger)
  const entradasOrdenadas = [...proyecto.entradas].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const fechaPrimera = entradasOrdenadas.length > 0 ? entradasOrdenadas[0].fecha : null
  const cronograma = calcularCronograma(fechaPrimera, presupuesto?.diasMaquinaria ?? 0)

  return NextResponse.json({
    proyecto: {
      id: proyecto.id,
      correlativo: proyecto.correlativo,
      cliente: proyecto.cliente,
      empresa: proyecto.empresa,
      nombre: proyecto.nombre,
      tipo: proyecto.tipo,
      estado: proyecto.estado,
      monto: proyecto.monto,
      vendedor: proyecto.vendedor,
      fechaInicio: proyecto.fechaInicio,
    },
    presupuesto,
    ejecutado,
    gastosExtras,
    totalExtras,
    totalEjecutadoMasExtras,
    desviacionQ,
    avancePct,
    reservas,
    movimientos,
    valorReservado,
    ventasExternas,
    entradasBitacora: proyecto.entradas,  // lista completa para registro de avances
    cronograma: {
      fechaInicio:      cronograma.fechaInicio?.toISOString().slice(0, 10) ?? null,
      fechaFinEstimada: cronograma.fechaFinEstimada?.toISOString().slice(0, 10) ?? null,
      diaActualDelProyecto: cronograma.diaActualDelProyecto,
      diasRestantes: cronograma.diasRestantes,
      diasHabilesTotal: presupuesto?.diasMaquinaria ?? 0,
      triggerActivado: fechaPrimera !== null,
    },
  })
}

// POST /api/proyectos/[id]/control-gastos → registrar compra (libro de gastos)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()

  const cantidad       = Number(body.cantidad ?? 1)
  const costoUnitario  = Number(body.costoUnitario ?? body.montoUnit ?? 0)
  const valorUnitario  = Number(body.valorUnitario ?? 0)
  const diasCredito    = Number(body.diasCredito ?? 0)
  const fecha          = body.fecha ?? new Date().toISOString().slice(0, 10)

  // Fecha de vencimiento = fecha + diasCredito (calendario, no hábiles)
  let fechaVencimiento = ''
  if (diasCredito > 0) {
    const d = new Date(fecha + 'T12:00:00')
    d.setDate(d.getDate() + diasCredito)
    fechaVencimiento = d.toISOString().slice(0, 10)
  }

  const row = await prisma.gastoExtra.create({
    data: {
      proyectoId: id,
      fecha,
      producto:    body.producto ?? body.concepto ?? '',
      descripcion: body.descripcion ?? '',
      rubro:       body.rubro ?? 'otro',
      costoUnitario,
      valorUnitario,
      cantidad,
      unidad:      body.unidad ?? 'Unidad',
      monto:       cantidad * costoUnitario,
      diasCredito,
      fechaVencimiento,
      pagado:      body.pagado ?? (diasCredito === 0),
      proveedor:   body.proveedor ?? '',
      nota:        body.nota ?? '',
      creadoPor:   body.creadoPor ?? '',
      // Legacy
      concepto:    body.producto ?? body.concepto ?? '',
      montoUnit:   costoUnitario,
    },
  })

  return NextResponse.json(row)
}
