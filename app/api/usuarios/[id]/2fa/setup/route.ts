import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { prisma } from '@/lib/db'
import { requireSuperAdmin, getRequestInfo } from '@/lib/auth'
import { auditLog } from '@/lib/audit'
import { encryptTotpSecret, generateTotpSecret, totpUri } from '@/lib/totp'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const usuario = await prisma.usuario.findUnique({
    where: { id },
    select: { id: true, username: true, nombre: true, rol: true, twoFactorEnabled: true },
  })
  if (!usuario) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  if (usuario.rol === 'cliente_final') {
    return NextResponse.json({ error: '2FA aplica solo a usuarios internos' }, { status: 400 })
  }

  const secret = generateTotpSecret()
  const encrypted = encryptTotpSecret(secret)
  const uri = totpUri({ account: usuario.username, secret })
  const qrDataUrl = await QRCode.toDataURL(uri, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 220,
    color: { dark: '#0f172a', light: '#ffffff' },
  })

  await prisma.usuario.update({
    where: { id },
    data: {
      twoFactorPendingSecret: encrypted,
      twoFactorPendingAt: new Date(),
    },
  })

  await auditLog({
    user: auth.user,
    accion: 'update',
    entidad: 'usuario_2fa',
    entidadId: id,
    despues: { username: usuario.username, estado: 'setup_iniciado' },
    ...getRequestInfo(request),
  })

  return NextResponse.json({
    usuario: { id: usuario.id, username: usuario.username, nombre: usuario.nombre, twoFactorEnabled: usuario.twoFactorEnabled },
    secret,
    otpauthUrl: uri,
    qrDataUrl,
    expiresInMinutes: 15,
  })
}
