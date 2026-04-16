import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { createHash } from 'crypto'
import { prisma } from '@/lib/db'

function sha256(s: string) {
  return createHash('sha256').update(s).digest('hex')
}

async function isSuperAdmin(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value
  if (!token) return false
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET!))
    return payload.role === 'superadmin'
  } catch { return false }
}

// PATCH — actualizar contraseña o activar/desactivar
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isSuperAdmin(request)) {
    return NextResponse.json({ error: 'Sin autorización' }, { status: 403 })
  }
  const { id } = await params
  const body = await request.json()
  const data: Record<string, unknown> = {}
  if (body.password)          data.passwordHash = sha256(body.password)
  if (body.activo !== undefined) data.activo = body.activo
  if (body.nombre)            data.nombre = body.nombre.trim()

  const usuario = await prisma.usuario.update({
    where: { id },
    data,
    select: { id: true, username: true, nombre: true, rol: true, activo: true },
  })
  return NextResponse.json(usuario)
}

// DELETE — eliminar usuario
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isSuperAdmin(request)) {
    return NextResponse.json({ error: 'Sin autorización' }, { status: 403 })
  }
  const { id } = await params
  await prisma.usuario.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
