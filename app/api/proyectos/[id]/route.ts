import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET — obtener proyecto con todas sus entradas
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const row = await prisma.proyecto.findUnique({
    where: { id },
    include: {
      entradas: {
        orderBy: [{ fecha: 'asc' }, { turno: 'asc' }],
      },
    },
  })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Buscar teléfono y email del cliente en Contacto
  const contacto = await prisma.contacto.findFirst({
    where: { nombre: row.cliente },
    select: { telefono: true, email: true },
  })

  return NextResponse.json({
    ...row,
    telefonoCliente: contacto?.telefono ?? '',
    emailCliente:    contacto?.email    ?? '',
  })
}

// PATCH — actualizar estado del proyecto
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()

  const row = await prisma.proyecto.update({
    where: { id },
    data: {
      ...(body.estado !== undefined ? { estado: body.estado } : {}),
      ...(body.nombre !== undefined ? { nombre: body.nombre } : {}),
    },
  })

  return NextResponse.json(row)
}

// DELETE — eliminar proyecto (y en cascada sus entradas)
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.proyecto.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
