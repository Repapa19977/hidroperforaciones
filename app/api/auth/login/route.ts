import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import { createHash } from 'crypto'
import { prisma } from '@/lib/db'

function sha256(s: string) {
  return createHash('sha256').update(s).digest('hex')
}

export async function POST(request: NextRequest) {
  const { username, password } = await request.json()

  if (!username || !password) {
    return NextResponse.json({ error: 'Usuario y contraseña requeridos' }, { status: 400 })
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
