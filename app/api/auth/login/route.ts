import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { prisma } from '@/lib/db'
import { loginSchema, formatZodError } from '@/lib/validators'
import { checkRateLimit, cleanupRateLimit, getClientIp, getRateLimitStatus, resetRateLimit } from '@/lib/rate-limit'
import { auditLog } from '@/lib/audit'
import { getRequestInfo, hashPassword, isLegacyPasswordHash, verifyPassword } from '@/lib/auth'
import { verifyTotp } from '@/lib/totp'

// Límites: 10 intentos por IP en 15 min + 5 intentos por username en 15 min.
const WINDOW_MS = 15 * 60 * 1000
const IP_LIMIT = 10
const USER_LIMIT = 5

export async function POST(request: NextRequest) {
  const raw = await request.json().catch(() => null)
  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(formatZodError(parsed.error), { status: 400 })
  }
  const { username, password } = parsed.data
  const totpCode = parsed.data.totpCode?.trim() || undefined

  // Rate limit por IP y por username - limpieza ocasional
  if (Math.random() < 0.05) cleanupRateLimit()
  const ip = getClientIp(request)
  const ipRateKey = `ip:${ip}`
  const userRateKey = `user:${username.toLowerCase()}`
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
      { error: 'Demasiados intentos. Intenta de nuevo más tarde.', retryAfter },
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

  let role: 'superadmin' | 'admin' | null = null
  let vendedor = ''
  let usuarioDb: { id: string; passwordHash: string } | null = null
  let twoFactorSecret: string | null = null

  // 1) Cuenta maestra superadmin del .env (siempre disponible)
  if (
    username === process.env.SUPERADMIN_USERNAME &&
    verifyPassword(password, process.env.SUPERADMIN_PASSWORD_HASH)
  ) {
    role     = 'superadmin'
    vendedor = process.env.SUPERADMIN_VENDEDOR ?? 'Super Admin'
    twoFactorSecret = process.env.SUPERADMIN_TOTP_SECRET || null
  }

  // 2) Usuarios creados en la DB
  if (!role) {
    const user = await prisma.usuario.findFirst({ where: { username, activo: true } })
    if (user && verifyPassword(password, user.passwordHash)) {
      role     = user.rol as 'admin' | 'superadmin'
      vendedor = user.nombre
      usuarioDb = { id: user.id, passwordHash: user.passwordHash }
      twoFactorSecret = user.twoFactorEnabled ? user.twoFactorSecret : null
    }
  }

  const info = getRequestInfo(request)

  if (!role) {
    const failedLimitResponse = registerFailedLogin()
    // Log intento fallido (útil para detectar ataques de fuerza bruta)
    await auditLog({
      user: null, accion: 'login', entidad: 'usuario', entidadId: username,
      despues: { resultado: 'falla', motivo: 'credenciales_incorrectas' },
      ...info,
    })
    if (failedLimitResponse) return failedLimitResponse
    return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 })
  }

  if (twoFactorSecret) {
    if (!totpCode) {
      return NextResponse.json({ ok: false, requiresTwoFactor: true, message: 'Código 2FA requerido' })
    }
    if (!verifyTotp(totpCode, twoFactorSecret)) {
      const failedLimitResponse = registerFailedLogin()
      await auditLog({
        user: { username, role: role as 'admin' | 'superadmin', vendedor },
        accion: 'login', entidad: 'usuario', entidadId: username,
        despues: { resultado: 'falla', motivo: 'codigo_2fa_incorrecto' },
        ...info,
      })
      if (failedLimitResponse) return failedLimitResponse
      return NextResponse.json({ error: 'Código de autenticación incorrecto' }, { status: 401 })
    }
  }
  // Actualizar ultimoAcceso (sin bloquear el login si falla)
  prisma.usuario.updateMany({
    where: { username, activo: true },
    data: { ultimoAcceso: new Date() },
  }).catch(() => {})

  // Migración transparente: si el usuario aún estaba en SHA-256, al login exitoso queda en scrypt.
  if (usuarioDb && isLegacyPasswordHash(usuarioDb.passwordHash)) {
    prisma.usuario.update({
      where: { id: usuarioDb.id },
      data: { passwordHash: hashPassword(password) },
    }).catch(() => {})
  }

  // Log login exitoso
  await auditLog({
    user: { username, role: role as 'admin' | 'superadmin' | 'cliente_final' | 'bot', vendedor },
    accion: 'login', entidad: 'usuario', entidadId: username,
    despues: { resultado: 'exito' },
    ...info,
  })
  resetRateLimit(ipRateKey)
  resetRateLimit(userRateKey)

  const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
  const token  = await new SignJWT({ sub: username, role, vendedor })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('8h')
    .setIssuedAt()
    .sign(secret)

  const res = NextResponse.json({ ok: true, role })

  res.cookies.set('auth_token', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 8,
    path:     '/',
  })

  const cookieOpts = {
    httpOnly: false,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge:   60 * 60 * 8,
    path:     '/',
  }

  res.cookies.set('user_role',     role,     cookieOpts)
  res.cookies.set('user_vendedor', vendedor, cookieOpts)

  return res
}

