// Login para cliente_final. Separado del login admin para mayor claridad.
// Acepta email + password. Devuelve JWT con role='cliente_final' y contactoId.

import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { prisma } from '@/lib/db'
import { checkRateLimit, getClientIp, getRateLimitStatus, resetRateLimit } from '@/lib/rate-limit'
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
  const ipRateKey = `cliente-ip:${ip}`
  const userRateKey = `cliente-email:${email.toLowerCase()}`
  const ipCheck = getRateLimitStatus(ipRateKey, IP_LIMIT, WINDOW_MS)
  const userCheck = getRateLimitStatus(userRateKey, USER_LIMIT, WINDOW_MS)
  const rateLimitResponse = (
    nextIpCheck: { ok: boolean; resetAt: number },
    nextUserCheck: { ok: boolean; resetAt: number },
  ) => {
    if (nextIpCheck.ok && nextUserCheck.ok) return null
    const resetAt = Math.max(nextIpCheck.resetAt, nextUserCheck.resetAt)
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
    return NextResponse.json(
      { error: 'Demasiados intentos. Intentá más tarde.', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }
  const blockedResponse = rateLimitResponse(ipCheck, userCheck)
  if (blockedResponse) return blockedResponse
  const registerFailedLogin = () => {
    const nextIpCheck = checkRateLimit(ipRateKey, IP_LIMIT, WINDOW_MS)
    const nextUserCheck = checkRateLimit(userRateKey, USER_LIMIT, WINDOW_MS)
    return rateLimitResponse(nextIpCheck, nextUserCheck)
  }

  const usuario = await prisma.usuario.findFirst({
    where: { email: email.toLowerCase(), rol: 'cliente_final', activo: true },
  })

  const info = getRequestInfo(request)

  if (!usuario || !verifyPassword(password, usuario.passwordHash)) {
    const failedLimitResponse = registerFailedLogin()
    await auditLog({
      user: null, accion: 'login', entidad: 'cliente_final', entidadId: email,
      despues: { resultado: 'falla' }, ...info,
    })
    if (failedLimitResponse) return failedLimitResponse
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
  resetRateLimit(ipRateKey)
  resetRateLimit(userRateKey)

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
