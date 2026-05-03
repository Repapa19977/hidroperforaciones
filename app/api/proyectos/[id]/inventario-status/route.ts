// Endpoint que devuelve el estado del inventario reservado del proyecto.
// Para cada producto con split 70/30 (bentonita por ahora):
//   - comprado_total:    sacos que se compraron en total (100%)
//   - entregado_cliente: sacos que el cliente ya pagó (70%)
//   - mi_reserva:        sacos que quedan de mi 30% (cantidadOriginal de InventarioReserva)
//   - consumido_obra:    sacos consumidos en bitácora del proyecto
//   - disponible:        cantidadActual de InventarioReserva (descontando ventas externas + consumos)
//   - valor_disponible:  disponible × costoUnitario
//   - ventas_externas:   suma de movimientos tipo "venta_externa"

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calcularPerforacion, pipasInternas, type InputsPerforacion } from '@/lib/calculator'
import { requireSuperAdmin } from '@/lib/auth'
import { reconciliarReservaBentonitaProyecto } from '@/lib/inventario-bentonita'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params

  const proyecto = await prisma.proyecto.findUnique({
    where: { id },
    include: { entradas: true },
  })
  if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  try {
    await reconciliarReservaBentonitaProyecto(id)
  } catch { /* no bloqueante */ }

  // Cotización origen — para sacar las cantidades planificadas
  const cotizacion = await prisma.cotizacion.findUnique({ where: { correlativo: proyecto.correlativo } })
  let plan: { sacosTotal: number; sacosCliente: number; sacosReserva: number } | null = null
  let pipasPlan = 0   // pipas estimadas según la cotización (internas totales)
  if (cotizacion?.datos) {
    try {
      const d = typeof cotizacion.datos === 'string' ? JSON.parse(cotizacion.datos) : cotizacion.datos
      const ip = d.ip as InputsPerforacion | undefined
      if (ip && proyecto.tipo !== 'limpieza') {
        const calc = calcularPerforacion(ip)
        plan = {
          sacosTotal: Math.round(calc.sacosBentonita),
          sacosCliente: Math.round(calc.sacosEntregaCliente),
          sacosReserva: Math.round(calc.sacosBentonita - calc.sacosEntregaCliente),
        }
        pipasPlan = pipasInternas(ip.profundidad, ip.rendimientoPorDia ?? 20)
      }
    } catch { /* ignore */ }
  }

  // Inventario reservado real (creado al confirmar la cotización)
  const reservas = await prisma.inventarioReserva.findMany({
    where: { proyectoId: id },
  })

  // Movimientos de las reservas (FK lógica, sin relation directa)
  const reservaIds = reservas.map(r => r.id)
  const movimientos = reservaIds.length > 0
    ? await prisma.movimientoInventario.findMany({
        where: { reservaId: { in: reservaIds } },
      })
    : []

  // Consumo en bitácora — para cada producto trackeable
  const consumoBentonita = proyecto.entradas.reduce((s, e) => s + (e.bentonitaSacos || 0), 0)
  const consumoPipas     = proyecto.entradas.reduce((s, e) => s + (e.pipas || 0), 0)

  // Bentonita: combinar plan + reserva + consumo
  const reservaBent = reservas.find(r => r.producto === 'bentonita')
  const movsBent = reservaBent ? movimientos.filter(m => m.reservaId === reservaBent.id) : []
  const ventasExternasBent = movsBent
    .filter(m => m.tipo === 'venta_externa')
    .reduce((s, m) => s + Math.abs(m.cantidad), 0)
  const consumosInternosBent = movsBent
    .filter(m => m.tipo === 'consumo_bitacora')
    .reduce((s, m) => s + Math.abs(m.cantidad), 0)

  const bentonita = plan ? {
    comprado_total:     plan.sacosTotal,
    entregado_cliente:  plan.sacosCliente,
    mi_reserva_inicial: plan.sacosReserva,
    consumido_obra:     consumoBentonita,
    ventas_externas:    ventasExternasBent,
    disponible:         reservaBent?.cantidadActual ?? plan.sacosReserva,
    costo_unitario:     reservaBent?.costoUnitario ?? 0,
    valor_disponible:   (reservaBent?.cantidadActual ?? plan.sacosReserva) * (reservaBent?.costoUnitario ?? 0),
    valor_reserva_inicial: plan.sacosReserva * (reservaBent?.costoUnitario ?? 0),
    consumos_internos_registrados: consumosInternosBent,
  } : null

  // ── PIPAS — tracking comprado vs usado (instrucción Rodrigo 2026-04-22) ──
  // Comprado: suma de GastoExtra con rubro='pipas-agua' (o 'pipas')
  // Usado:    suma de entradas.pipas (bitácora)
  // Disponible: comprado - usado
  const gastosPipas = await prisma.gastoExtra.findMany({
    where: {
      proyectoId: id,
      rubro: { in: ['pipas-agua', 'pipas'] },
    },
  })
  const pipasCompradas = gastosPipas.reduce((s, g) => s + g.cantidad, 0)
  const pipasValorComprado = gastosPipas.reduce((s, g) => s + g.cantidad * g.costoUnitario, 0)
  const pipasCostoPromedio = pipasCompradas > 0 ? pipasValorComprado / pipasCompradas : 0
  const pipasDisponibles = Math.max(0, pipasCompradas - consumoPipas)
  const pipasData = {
    presupuestado:    pipasPlan,               // lo que dijo la cotización
    comprado_total:   pipasCompradas,          // suma de compras registradas
    valor_comprado:   Math.round(pipasValorComprado),
    costo_promedio:   Math.round(pipasCostoPromedio * 100) / 100,
    consumido_obra:   consumoPipas,            // bitácora
    disponible:       pipasDisponibles,
    valor_disponible: Math.round(pipasDisponibles * pipasCostoPromedio),
    compras_count:    gastosPipas.length,
  }

  return NextResponse.json({
    proyecto: {
      id: proyecto.id,
      correlativo: proyecto.correlativo,
      tipo: proyecto.tipo,
    },
    bentonita,
    pipas: pipasData,
    reservas: reservas.map(r => ({
      id: r.id,
      producto: r.producto,
      cantidad_original: r.cantidadOriginal,
      cantidad_actual: r.cantidadActual,
      unidad: r.unidad,
      costo_unitario: r.costoUnitario,
      precio_venta_sugerido: r.precioVentaSugerido,
      estado: r.estado,
      nota: r.nota,
    })),
  })
}
