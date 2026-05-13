import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auditLog } from '@/lib/audit'
import { getRequestInfo, hashPassword, requireSuperAdmin, validarPassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function normalizarEmail(email: unknown): string {
  if (typeof email !== 'string') return ''
  return email.trim().toLowerCase()
}

function emailValido(email: string): boolean {
  return !email || /^[^\s@]+@hidroperforaciones\.com$/i.test(email)
}

// GET - listar todos los usuarios de la DB
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const usuarios = await prisma.usuario.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, username: true, nombre: true, rol: true, activo: true,
      email: true, contactoId: true, ultimoAcceso: true, createdAt: true,
      twoFactorEnabled: true, twoFactorConfirmedAt: true,
    },
  })

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

// POST - crear nuevo usuario
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { username, nombre, password, rol, email } = await request.json()
  const emailNormalizado = normalizarEmail(email)

  if (!username?.trim() || !nombre?.trim() || !password?.trim()) {
    return NextResponse.json({ error: 'Usuario, nombre y contraseña son requeridos' }, { status: 400 })
  }
  if (!emailValido(emailNormalizado)) {
    return NextResponse.json({ error: 'El correo del asesor debe ser @hidroperforaciones.com' }, { status: 400 })
  }

  const errPw = validarPassword(password)
  if (errPw) return NextResponse.json({ error: errPw }, { status: 400 })

  const usernameNormalizado = username.trim().toLowerCase()
  const existe = await prisma.usuario.findFirst({ where: { username: usernameNormalizado } })
  if (existe) {
    return NextResponse.json({ error: 'Ese nombre de usuario ya está en uso' }, { status: 409 })
  }

  const usuario = await prisma.usuario.create({
    data: {
      username: usernameNormalizado,
      nombre: nombre.trim(),
      rol: rol === 'superadmin' ? 'superadmin' : 'admin',
      email: emailNormalizado,
      passwordHash: hashPassword(password),
    },
    select: {
      id: true, username: true, nombre: true, rol: true, activo: true,
      email: true, contactoId: true, ultimoAcceso: true, createdAt: true,
      twoFactorEnabled: true, twoFactorConfirmedAt: true,
    },
  })

  await auditLog({
    user: auth.user,
    accion: 'create',
    entidad: 'usuario',
    entidadId: usuario.id,
    despues: usuario,
    ...getRequestInfo(request),
  })

  return NextResponse.json(usuario, { status: 201 })
}
