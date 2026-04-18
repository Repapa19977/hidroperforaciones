import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// PATCH /api/inventario/[id] — actualizar reserva (cantidad, estado, nota, etc.)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const data: Record<string, string | number> = {}
  if (body.cantidadActual !== undefined) data.cantidadActual = body.cantidadActual
  if (body.cantidadOriginal !== undefined) data.cantidadOriginal = body.cantidadOriginal
  if (body.estado !== undefined) data.estado = body.estado
  if (body.fechaLiberacion !== undefined) data.fechaLiberacion = body.fechaLiberacion
  if (body.costoUnitario !== undefined) data.costoUnitario = body.costoUnitario
  if (body.precioVentaSugerido !== undefined) data.precioVentaSugerido = body.precioVentaSugerido
  if (body.nota !== undefined) data.nota = body.nota

  const reserva = await prisma.inventarioReserva.update({ where: { id }, data })
  return NextResponse.json(reserva)
}

// DELETE /api/inventario/[id] — eliminar reserva (casos excepcionales)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Eliminar movimientos asociados primero
  await prisma.movimientoInventario.deleteMany({ where: { reservaId: id } })
  await prisma.inventarioReserva.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
