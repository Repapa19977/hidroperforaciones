import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { createHash } from 'crypto'
import { prisma } from '@/lib/db'

function sha256(s: string) {
  return createHash('sha256').update(s).digest('hex')
}

async function getSuperAdminRole(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET!)
    )
    return payload.role === 'superadmin' ? payload : null
  } catch {
    return null
  }
}

// GET — listar todos los usuarios de la DB
export async function GET(request: NextRequest) {
  if (!await getSuperAdminRole(request)) {
    return NextResponse.json({ error: 'Sin autorización' }, { status: 403 })
  }

  const usuarios = await prisma.usuario.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, username: true, nombre: true, rol: true, activo: true,
      email: true, contactoId: true, ultimoAcceso: true, createdAt: true,
    },
  })

  // Para cliente_final, traer empresa del contacto asociado (más info útil)
  const contactoIds = usuarios.filter(u => u.contactoId).map(u => u.contactoId as string)
  const contactos = contactoIds.length > 0
    ? await prisma.contacto.findMany({
        where: { id: { in: contactoIds } },
        select: { id: true, empresa: true },
      })
    : []
  const contactoMap = new Map(contactos.map(c => [c.id, c.empresa]))

  return NextResponse.json(
    usuarios.map(u => ({
      ...u,
      empresaCliente: u.contactoId ? contactoMap.get(u.contactoId) ?? '' : '',
    })),
  )
}

// POST — crear nuevo usuario
export async function POST(request: NextRequest) {
  if (!await getSuperAdminRole(request)) {
    return NextResponse.json({ error: 'Sin autorización' }, { status: 403 })
  }

  const { username, nombre, password, rol } = await request.json()

  if (!username?.trim() || !nombre?.trim() || !password?.trim()) {
    return NextResponse.json({ error: 'Usuario, nombre y contraseña son requeridos' }, { status: 400 })
  }

  const existe = await prisma.usuario.findFirst({ where: { username } })
  if (existe) {
    return NextResponse.json({ error: 'Ese nombre de usuario ya está en uso' }, { status: 409 })
  }

  const usuario = await prisma.usuario.create({
    data: {
      username:     username.trim().toLowerCase(),
      nombre:       nombre.trim(),
      rol:          rol === 'superadmin' ? 'superadmin' : 'admin',
      passwordHash: sha256(password),
    },
    select: { id: true, username: true, nombre: true, rol: true, activo: true, createdAt: true },
  })

  return NextResponse.json(usuario, { status: 201 })
}
