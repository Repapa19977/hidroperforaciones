import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { createHash } from 'crypto'
import { prisma } from '@/lib/db'
import { loginSchema, formatZodError } from '@/lib/validators'
import { checkRateLimit, cleanupRateLimit, getClientIp } from '@/lib/rate-limit'

function sha256(s: string) {
  return createHash('sha256').update(s).digest('hex')
}

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

  // Rate limit por IP y por username — limpieza ocasional
  if (Math.random() < 0.05) cleanupRateLimit()
  const ip = getClientIp(request)
  const ipCheck = checkRateLimit(`ip:${ip}`, IP_LIMIT, WINDOW_MS)
  const userCheck = checkRateLimit(`user:${username.toLowerCase()}`, USER_LIMIT, WINDOW_MS)
  if (!ipCheck.ok || !userCheck.ok) {
    const resetAt = Math.max(ipCheck.resetAt, userCheck.resetAt)
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
    return NextResponse.json(
      { error: 'Demasiados intentos. Intenta de nuevo más tarde.', retryAfter },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  const hash = sha256(password)
  let role: 'superadmin' | 'admin' | null = null
  let vendedor = ''

  // 1) Cuenta maestra superadmin del .env (siempre disponible)
  if (
    username === process.env.SUPERADMIN_USERNAME &&
    hash     === process.env.SUPERADMIN_PASSWORD_HASH
  ) {
    role     = 'superadmin'
    vendedor = process.env.SUPERADMIN_VENDEDOR ?? 'Super Admin'
  }

  // 2) Usuarios creados en la DB
  if (!role) {
    const user = await prisma.usuario.findFirst({ where: { username, activo: true } })
    if (user && user.passwordHash === hash) {
      role     = user.rol as 'admin' | 'superadmin'
      vendedor = user.nombre
    }
  }

  if (!role) {
    return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 })
  }

  const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
  const token  = await new SignJWT({ sub: username, role })
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
