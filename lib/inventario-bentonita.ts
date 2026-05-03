import { prisma } from './db'
import { sacosDebentonita } from './calculator'

type BentonitaPlan = {
  sacosTotal: number
  sacosCliente: number
  sacosReserva: number
}

function toNumber(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function planBentonitaDesdeDatos(datos: string | null | undefined): BentonitaPlan | null {
  if (!datos) return null
  try {
    const d = JSON.parse(datos)
    const ip = d?.ip
    if (!ip) return null

    const diametro = toNumber(ip.diametro)
    const profundidad = toNumber(ip.profundidad)
    if (diametro <= 0 || profundidad <= 0) return null

    const pctEntregaRaw = toNumber(ip.pctEntregaBentonita, 0.70)
    const pctEntrega = Math.min(1, Math.max(0, pctEntregaRaw))
    const sacosTotal = sacosDebentonita(diametro, profundidad)
    const sacosCliente = Math.round(sacosTotal * pctEntrega)
    const sacosReserva = Math.max(0, sacosTotal - sacosCliente)

    return { sacosTotal, sacosCliente, sacosReserva }
  } catch {
    return null
  }
}

function deltaMovimientoNoBitacora(tipo: string, cantidad: number): number {
  const abs = Math.abs(cantidad)
  if (tipo === 'compra') return abs
  if (tipo === 'ajuste') return cantidad
  if (tipo === 'venta_externa' || tipo === 'liberacion_proyecto') return -abs
  return 0
}

/**
 * Recalcula la reserva de bentonita desde la fuente correcta:
 * - la cotizacion define el 70% cubierto por el cliente y el 30% reservado;
 * - la bitacora solo descuenta reserva cuando el consumo supera el 70%;
 * - ventas externas/ajustes/compras se conservan como movimientos separados.
 */
export async function reconciliarReservaBentonitaProyecto(proyectoId: string): Promise<void> {
  const proyecto = await prisma.proyecto.findUnique({
    where: { id: proyectoId },
    select: { id: true, correlativo: true, estado: true },
  })
  if (!proyecto) return

  const cotizacion = await prisma.cotizacion.findUnique({
    where: { correlativo: proyecto.correlativo },
    select: { datos: true },
  })
  const plan = planBentonitaDesdeDatos(cotizacion?.datos)
  if (!plan || plan.sacosReserva <= 0) return

  const reserva = await prisma.inventarioReserva.findFirst({
    where: { proyectoId, producto: 'bentonita' },
    orderBy: { createdAt: 'asc' },
  })
  if (!reserva) return

  const totalConsumido = await prisma.bitacoraEntry.aggregate({
    where: { proyectoId },
    _sum: { bentonitaSacos: true },
  })
  const consumoObra = totalConsumido._sum.bentonitaSacos ?? 0
  const consumoReserva = Math.max(0, consumoObra - plan.sacosCliente)

  const movimientos = await prisma.movimientoInventario.findMany({
    where: { reservaId: reserva.id },
  })
  const movimientosBitacora = movimientos.filter(m => m.tipo === 'consumo_bitacora')
  const consumoRegistrado = movimientosBitacora.reduce((s, m) => s + Math.abs(m.cantidad), 0)
  const netoOtros = movimientos
    .filter(m => m.tipo !== 'consumo_bitacora')
    .reduce((s, m) => s + deltaMovimientoNoBitacora(m.tipo, m.cantidad), 0)

  const cantidadActual = Math.max(0, reserva.cantidadOriginal + netoOtros - consumoReserva)
  const estadoRestaurado = proyecto.estado === 'completado' || proyecto.estado === 'cancelado' ? 'disponible' : 'reservado'
  const estado = cantidadActual === 0 ? 'agotado' : reserva.estado === 'agotado' ? estadoRestaurado : reserva.estado

  const requiereMovimiento = Math.abs(consumoRegistrado - consumoReserva) > 0.0001
  const requiereCantidad = Math.abs(reserva.cantidadActual - cantidadActual) > 0.0001
  const requiereEstado = reserva.estado !== estado

  if (!requiereMovimiento && !requiereCantidad && !requiereEstado) return

  await prisma.$transaction(async tx => {
    if (requiereMovimiento) {
      await tx.movimientoInventario.deleteMany({
        where: { reservaId: reserva.id, tipo: 'consumo_bitacora' },
      })
      if (consumoReserva > 0) {
        await tx.movimientoInventario.create({
          data: {
            reservaId: reserva.id,
            tipo: 'consumo_bitacora',
            cantidad: consumoReserva,
            precioUnit: reserva.costoUnitario,
            monto: consumoReserva * reserva.costoUnitario,
            nota: `Consumo de reserva por bitacora: ${consumoReserva} saco(s). Cliente cubre ${plan.sacosCliente} de ${plan.sacosTotal}.`,
          },
        })
      }
    }

    if (requiereCantidad || requiereEstado) {
      await tx.inventarioReserva.update({
        where: { id: reserva.id },
        data: { cantidadActual, estado },
      })
    }
  })
}
