import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSuperAdmin, getRequestInfo } from '@/lib/auth'
import { auditLog } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const before = await prisma.usuario.findUnique({
    where: { id },
    select: { id: true, username: true, twoFactorEnabled: true },
  })
  if (!before) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  const updated = await prisma.usuario.update({
    where: { id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorPendingSecret: null,
      twoFactorPendingAt: null,
      twoFactorConfirmedAt: null,
    },
    select: {
      id: true,
      username: true,
      nombre: true,
      rol: true,
      activo: true,
      email: true,
      contactoId: true,
      ultimoAcceso: true,
      createdAt: true,
      twoFactorEnabled: true,
      twoFactorConfirmedAt: true,
    },
  })

  await auditLog({
    user: auth.user,
    accion: 'update',
    entidad: 'usuario_2fa',
    entidadId: id,
    antes: before,
    despues: { username: before.username, estado: 'desactivado' },
    ...getRequestInfo(request),
  })

  return NextResponse.json(updated)
}
