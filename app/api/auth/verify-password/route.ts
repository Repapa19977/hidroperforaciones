// POST /api/auth/verify-password
// Verifica que el superadmin logueado tipeó su password actual.
// Se usa antes de acciones destructivas (borrar usuario, cambiar rol, etc.).
// Devuelve 200 si coincide, 401 si no.

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { prisma } from '@/lib/db'
import { verifyPassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  let username: string
  let role: string
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET!))
    username = String(payload.sub ?? '')
    role     = String(payload.role ?? '')
  } catch {
    return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })
  }

  if (!username || role !== 'superadmin') {
    return NextResponse.json({ error: 'Sin autorización' }, { status: 403 })
  }

  const { password } = await request.json().catch(() => ({}))
  if (!password || typeof password !== 'string') {
    return NextResponse.json({ error: 'Contraseña requerida' }, { status: 400 })
  }

  // 1) Cuenta maestra del .env
  if (username === process.env.SUPERADMIN_USERNAME && verifyPassword(password, process.env.SUPERADMIN_PASSWORD_HASH)) {
    return NextResponse.json({ ok: true })
  }

  // 2) Usuario de la DB
  const user = await prisma.usuario.findFirst({ where: { username, activo: true } })
  if (user && verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: false, error: 'Contraseña incorrecta' }, { status: 401 })
}
