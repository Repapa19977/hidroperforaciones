import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSuperAdmin, getRequestInfo } from '@/lib/auth'
import { auditLog } from '@/lib/audit'
import { verifyTotp } from '@/lib/totp'

export const dynamic = 'force-dynamic'

const SETUP_TTL_MS = 15 * 60 * 1000

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await request.json().catch(() => null)
  const code = String(body?.code ?? '').trim()
  if (!code) return NextResponse.json({ error: 'Código requerido' }, { status: 400 })

  const usuario = await prisma.usuario.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      nombre: true,
      twoFactorPendingSecret: true,
      twoFactorPendingAt: true,
    },
  })
  if (!usuario) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  if (!usuario.twoFactorPendingSecret || !usuario.twoFactorPendingAt) {
    return NextResponse.json({ error: 'Primero generá el QR de 2FA' }, { status: 400 })
  }
  if (Date.now() - usuario.twoFactorPendingAt.getTime() > SETUP_TTL_MS) {
    return NextResponse.json({ error: 'El QR venció. Generá uno nuevo.' }, { status: 400 })
  }
  if (!verifyTotp(code, usuario.twoFactorPendingSecret)) {
    return NextResponse.json({ error: 'Código incorrecto' }, { status: 401 })
  }

  const updated = await prisma.usuario.update({
    where: { id },
    data: {
      twoFactorEnabled: true,
      twoFactorSecret: usuario.twoFactorPendingSecret,
      twoFactorPendingSecret: null,
      twoFactorPendingAt: null,
      twoFactorConfirmedAt: new Date(),
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
    despues: { username: usuario.username, estado: 'activado' },
    ...getRequestInfo(request),
  })

  return NextResponse.json(updated)
}
