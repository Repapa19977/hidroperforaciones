import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/inventario — lista reservas con filtros opcionales
//   ?estado=reservado|disponible|agotado
//   ?producto=bentonita|pipas|...
//   ?proyectoId=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const estado = searchParams.get('estado')
  const producto = searchParams.get('producto')
  const proyectoId = searchParams.get('proyectoId')

  const where: Record<string, string> = {}
  if (estado) where.estado = estado
  if (producto) where.producto = producto
  if (proyectoId) where.proyectoId = proyectoId

  const reservas = await prisma.inventarioReserva.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(reservas)
}

// POST /api/inventario — crear reserva manualmente (superadmin)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const reserva = await prisma.inventarioReserva.create({
    data: {
      proyectoId: body.proyectoId ?? null,
      proyectoCorrelativo: body.proyectoCorrelativo ?? '',
      producto: body.producto,
      cantidadOriginal: body.cantidadOriginal ?? 0,
      cantidadActual: body.cantidadActual ?? body.cantidadOriginal ?? 0,
      unidad: body.unidad ?? 'unidad',
      costoUnitario: body.costoUnitario ?? 0,
      precioVentaSugerido: body.precioVentaSugerido ?? 0,
      estado: body.estado ?? 'reservado',
      fechaCreacion: body.fechaCreacion ?? new Date().toISOString().slice(0, 10),
      nota: body.nota ?? '',
    },
  })
  return NextResponse.json(reserva, { status: 201 })
}
