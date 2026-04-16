import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET — obtener cotización con datos completos (para re-abrir/imprimir)
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const row = await prisma.cotizacion.findUnique({ where: { correlativo: id } })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}

// PATCH — cambiar estado (y auto-crear Proyecto al confirmar)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const { estado, usuario } = body as { estado: string; usuario?: string }

  const before = await prisma.cotizacion.findUnique({ where: { correlativo: id } })

  const row = await prisma.cotizacion.update({
    where: { correlativo: id },
    data: { estado },
  })

  // Log change history
  if (before && before.estado !== estado) {
    await prisma.cotizacionHistorial.create({
      data: {
        correlativo: id,
        campo: 'estado',
        valorAntes: before.estado,
        valorDespues: estado,
        usuario: usuario ?? '',
      },
    })
  }

  // Auto-crear Proyecto cuando se confirma la cotización
  if (estado === 'confirmada') {
    const existing = await prisma.proyecto.findUnique({ where: { correlativo: id } })
    if (!existing) {
      const today = new Date().toISOString().slice(0, 10)
      await prisma.proyecto.create({
        data: {
          correlativo: id,
          cotizacionId: row.id,
          cliente: row.cliente,
          empresa: row.empresa,
          nombre: row.proyecto,
          tipo: row.tipo,
          monto: row.monto,
          vendedor: row.vendedor,
          fechaInicio: today,
        },
      })
    }
  }

  return NextResponse.json(row)
}

// DELETE — eliminar
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  await prisma.cotizacion.delete({ where: { correlativo: id } })
  return NextResponse.json({ ok: true })
}
