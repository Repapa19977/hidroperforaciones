import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { movimientoInventarioSchema, formatZodError } from '@/lib/validators'

// GET /api/inventario/movimientos — lista movimientos (puede filtrar por reservaId)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const reservaId = searchParams.get('reservaId')
  const where = reservaId ? { reservaId } : {}
  const movimientos = await prisma.movimientoInventario.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(movimientos)
}

// POST /api/inventario/movimientos — registrar movimiento (venta externa, ajuste, etc.)
// Actualiza la cantidadActual de la reserva asociada.
export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null)
  const parsed = movimientoInventarioSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(formatZodError(parsed.error), { status: 400 })
  }
  const { reservaId, tipo, cantidad, precioUnit, cliente, nota, usuario } = parsed.data

  // Verificar reserva y stock antes de crear el movimiento
  const reserva = await prisma.inventarioReserva.findUnique({ where: { id: reservaId } })
  if (!reserva) {
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
  }
  // Para salidas (venta externa, liberación) verificar stock disponible
  const esSalida = tipo === 'venta_externa' || tipo === 'liberacion_proyecto'
  if (esSalida && cantidad > reserva.cantidadActual) {
    return NextResponse.json({
      error: 'Stock insuficiente',
      disponible: reserva.cantidadActual,
      solicitado: cantidad,
    }, { status: 409 })
  }

  const monto = cantidad * precioUnit
  const mov = await prisma.movimientoInventario.create({
    data: { reservaId, tipo, cantidad, precioUnit, monto, cliente, nota, usuario },
  })

  // Ajuste de stock: restar en salidas, sumar en compras, ajuste usa cantidad como delta
  const delta = tipo === 'compra' ? cantidad : tipo === 'ajuste' ? cantidad : -cantidad
  const nuevaCantidad = Math.max(0, reserva.cantidadActual + delta)
  await prisma.inventarioReserva.update({
    where: { id: reservaId },
    data: {
      cantidadActual: nuevaCantidad,
      estado: nuevaCantidad === 0 ? 'agotado' : reserva.estado,
    },
  })

  return NextResponse.json(mov, { status: 201 })
}
