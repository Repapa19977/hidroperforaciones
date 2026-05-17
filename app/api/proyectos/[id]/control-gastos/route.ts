import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calcularPresupuestoPerforacion, agregarBitacora, calcularAvance, calcularEstadoPorRubro, type BitacoraEntryAgg } from '@/lib/control-gastos'
import { calcularCronograma } from '@/lib/dias-habiles'
import type { InputsPerforacion } from '@/lib/calculator'
import { DEFAULT_CONFIG, normalizeAppConfig, type AppConfig } from '@/lib/config-store'
import { requireSuperAdmin } from '@/lib/auth'
import { reconciliarReservaBentonitaProyecto } from '@/lib/inventario-bentonita'
import { inferRubroGasto, unidadSugeridaGasto } from '@/lib/control-gastos-catalog'

// GET /api/proyectos/[id]/control-gastos
// Devuelve: proyecto + presupuesto (desde cotización original) + ejecutado (bitácora agregada)
// + gastos extras + avance % físico y desviación vs presupuesto.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

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

  // Leer config global para los parámetros de horas adversas (fórmula del jefe).
  // La constante pies/hora se deriva dinámicamente: piesMinimoTurno / horasTurnoDefault.
  const cfgRow = await prisma.config.findUnique({ where: { id: 'singleton' } })
  let cfg: AppConfig = DEFAULT_CONFIG
  if (cfgRow?.datos) {
    try { cfg = normalizeAppConfig(JSON.parse(cfgRow.datos)) } catch { /* ignore */ }
  }
  const paramsAdversas = {
    horasTurno:       cfg.horasTurnoDefault ?? 8,
    piesMinimoTurno:  cfg.piesMinimoTurno   ?? 20,
    valorHoraAdversa: cfg.valorHoraAdversa  ?? 500,
  }

  const ejecutado = presupuesto ? agregarBitacora(bitacoraAgg, presupuesto, paramsAdversas) : null
  const avancePct = presupuesto ? calcularAvance(ejecutado?.piesPerforadosTotal ?? 0, presupuesto.profundidad) : 0

  // Gastos extras
  const gastosExtras = await prisma.gastoExtra.findMany({
    where: { proyectoId: id },
    orderBy: { fecha: 'desc' },
  })
  const totalExtras = gastosExtras.reduce((a, g) => a + g.monto, 0)

  // Corrige reservas antiguas/stale antes de mostrar inventario. La fuente real
  // es cotizacion + bitacora completa, no movimientos acumulados a mano.
  try {
    await reconciliarReservaBentonitaProyecto(id)
  } catch { /* no bloqueante */ }

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

  // En Control de Gastos el financiero real sale del Libro de Compras. La
  // bitacora alimenta avance/consumo operativo, pero no se suma para no duplicar
  // costos cuando tambien existe una compra registrada del mismo rubro.
  const totalEjecutadoMasExtras = totalExtras
  const desviacionQ = presupuesto ? totalExtras - presupuesto.total : 0

  // Estado por rubro: presupuesto vs comprado (control de gastos es INDEPENDIENTE
  // de la bitácora — aquí comparamos lo que Rodrigo registró haber comprado con
  // lo que dijo la cotización, no el consumo en obra).
  const estadoPorRubro = presupuesto
    ? calcularEstadoPorRubro(presupuesto, gastosExtras.map(g => ({
        rubro: g.rubro,
        cantidad: g.cantidad,
        costoUnitario: g.costoUnitario,
      })))
    : []

  // Cronograma: los días corren desde la PRIMERA entrada de bitácora (trigger)
  const entradasOrdenadas = [...proyecto.entradas].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const fechaPrimera = entradasOrdenadas.length > 0 ? entradasOrdenadas[0].fecha : null
  const cronograma = calcularCronograma(fechaPrimera, presupuesto?.diasMaquinaria ?? 0)
  const diasPlanTotal = presupuesto?.diasMaquinaria ?? 0
  const diasRegistradosBitacora = new Set(
    proyecto.entradas
      .filter(e =>
        e.estado !== 'inactivo' ||
        e.diaAdverso ||
        e.perforacionDia > 0 ||
        e.bentonitaSacos > 0 ||
        e.pipas > 0 ||
        e.horasPerforacion > 0
      )
      .map(e => e.fecha)
  ).size
  const diaActualDelProyecto = diasPlanTotal > 0
    ? Math.min(diasPlanTotal, Math.max(cronograma.diaActualDelProyecto, diasRegistradosBitacora))
    : diasRegistradosBitacora
  const diasRestantes = Math.max(0, diasPlanTotal - diaActualDelProyecto)

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
    consumoValorizadoBitacora: ejecutado?.total ?? 0,
    desviacionQ,
    estadoPorRubro,  // [{ key, nombre, unidad, cantidadPresupuestada, montoPresupuestado, cantidadComprada, montoComprado, faltante, estado: verde|amarillo|rojo }]
    avancePct,
    reservas,
    movimientos,
    valorReservado,
    ventasExternas,
    entradasBitacora: proyecto.entradas,  // lista completa para registro de avances
    paramsAdversas,
    cronograma: {
      fechaInicio:      cronograma.fechaInicio?.toISOString().slice(0, 10) ?? null,
      fechaFinEstimada: cronograma.fechaFinEstimada?.toISOString().slice(0, 10) ?? null,
      diaActualDelProyecto,
      diasRestantes,
      diasHabilesTotal: diasPlanTotal,
      diasRegistradosBitacora,
      triggerActivado: fechaPrimera !== null,
    },
  })
}

// POST /api/proyectos/[id]/control-gastos → registrar compra (libro de gastos)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await request.json()

  const str = (value: unknown) => typeof value === 'string' ? value.trim() : ''
  const producto = str(body.producto) || str(body.concepto)
  if (!producto) {
    return NextResponse.json({ error: 'Producto requerido' }, { status: 400 })
  }

  const cantidad       = Math.max(0, Number(body.cantidad ?? 1))
  const costoUnitario  = Math.max(0, Number(body.costoUnitario ?? body.montoUnit ?? 0))
  const valorUnitario  = Math.max(0, Number(body.valorUnitario ?? 0))
  const diasCredito    = Math.max(0, Math.trunc(Number(body.diasCredito ?? 0)))
  const fecha          = str(body.fecha) || new Date().toISOString().slice(0, 10)
  const rubro          = str(body.rubro) || inferRubroGasto(producto)
  const unidad         = str(body.unidad) || unidadSugeridaGasto(producto)

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
      producto,
      descripcion: str(body.descripcion),
      rubro,
      costoUnitario,
      valorUnitario,
      cantidad,
      unidad,
      monto:       cantidad * costoUnitario,
      diasCredito,
      fechaVencimiento,
      pagado:      diasCredito === 0 ? true : Boolean(body.pagado),
      proveedor:   str(body.proveedor),
      nota:        str(body.nota),
      creadoPor:   str(body.creadoPor),
      // Legacy
      concepto:    producto,
      montoUnit:   costoUnitario,
    },
  })

  return NextResponse.json(row)
}
