// Login para cliente_final. Separado del login admin para mayor claridad.
// Acepta email + password. Devuelve JWT con role='cliente_final' y contactoId.

import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { prisma } from '@/lib/db'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { auditLog } from '@/lib/audit'
import { getRequestInfo, hashPassword, isLegacyPasswordHash, verifyPassword } from '@/lib/auth'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email().min(1).max(200).trim(),
  password: z.string().min(1).max(200),
})

const WINDOW_MS = 15 * 60 * 1000
const IP_LIMIT = 10
const USER_LIMIT = 5

export async function POST(request: NextRequest) {
  const raw = await request.json().catch(() => null)
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 })
  }
  const { email, password } = parsed.data

  // Rate limit
  const ip = getClientIp(request)
  const ipCheck = checkRateLimit(`cliente-ip:${ip}`, IP_LIMIT, WINDOW_MS)
  const userCheck = checkRateLimit(`cliente-email:${email.toLowerCase()}`, USER_LIMIT, WINDOW_MS)
  if (!ipCheck.ok || !userCheck.ok) {
    const resetAt = Math.max(ipCheck.resetAt, userCheck.resetAt)
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
    return NextResponse.json(
      { error: 'Demasiados intentos. Intentá más tarde.', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  const usuario = await prisma.usuario.findFirst({
    where: { email: email.toLowerCase(), rol: 'cliente_final', activo: true },
  })

  const info = getRequestInfo(request)

  if (!usuario || !verifyPassword(password, usuario.passwordHash)) {
    await auditLog({
      user: null, accion: 'login', entidad: 'cliente_final', entidadId: email,
      despues: { resultado: 'falla' }, ...info,
    })
    return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 })
  }

  if (!usuario.contactoId) {
    return NextResponse.json({ error: 'Acceso mal configurado — contactá al administrador' }, { status: 500 })
  }

  // Actualizar ultimoAcceso
  prisma.usuario.update({
    where: { id: usuario.id }, data: { ultimoAcceso: new Date() },
  }).catch(() => {})

  if (isLegacyPasswordHash(usuario.passwordHash)) {
    prisma.usuario.update({
      where: { id: usuario.id },
      data: { passwordHash: hashPassword(password) },
    }).catch(() => {})
  }

  await auditLog({
    user: { username: usuario.username, role: 'cliente_final', contactoId: usuario.contactoId },
    accion: 'login', entidad: 'cliente_final', entidadId: usuario.id,
    despues: { resultado: 'exito' }, ...info,
  })

  const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
  const token = await new SignJWT({
    sub: usuario.username,
    role: 'cliente_final',
    contactoId: usuario.contactoId,
    nombre: usuario.nombre,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('8h')
    .setIssuedAt()
    .sign(secret)

  const res = NextResponse.json({
    ok: true,
    usuario: { nombre: usuario.nombre, email: usuario.email },
  })

  res.cookies.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8,
    path: '/',
  })
  // Cookies legibles por JS (usadas por el sidebar/UI)
  const cookieOpts = {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 8,
    path: '/',
  }
  res.cookies.set('user_role', 'cliente_final', cookieOpts)
  res.cookies.set('user_vendedor', usuario.nombre, cookieOpts)

  return res
}
