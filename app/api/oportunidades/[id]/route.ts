import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET — obtener oportunidad por id
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const row = await prisma.oportunidad.findUnique({ where: { id } })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}

// PATCH — actualizar etapa y/u otros campos
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()

  // Solo actualizar los campos que vienen en el body
  const updateData: Record<string, unknown> = {}
  const allowed = [
    'etapa', 'cliente', 'empresa', 'monto', 'vendedor',
    'tipo', 'profundidad', 'proyecto', 'diasSinActividad',
    'fecha', 'avatar',
  ]
  for (const key of allowed) {
    if (body[key] !== undefined) updateData[key] = body[key]
  }

  const row = await prisma.oportunidad.update({ where: { id }, data: updateData })
  return NextResponse.json(row)
}

// DELETE — eliminar oportunidad
export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.oportunidad.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
