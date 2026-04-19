import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSuperAdmin, getCurrentUser, getRequestInfo } from '@/lib/auth'
import { auditLog } from '@/lib/audit'

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

// DELETE — soft delete (superadmin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const motivo = new URL(request.url).searchParams.get('motivo') ?? ''

  const before = await prisma.oportunidad.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (before.eliminadaEn) return NextResponse.json({ error: 'Ya estaba eliminada' }, { status: 409 })

  const row = await prisma.oportunidad.update({
    where: { id },
    data: { eliminadaEn: new Date(), eliminadaPor: auth.user.username, motivoBorrado: motivo || null },
  })

  const info = getRequestInfo(request)
  await auditLog({ user: auth.user, accion: 'delete', entidad: 'oportunidad', entidadId: id, antes: before, despues: row, ...info })

  return NextResponse.json({ ok: true, soft: true })
}
