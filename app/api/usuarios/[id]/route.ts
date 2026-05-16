import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { auditLog } from '@/lib/audit'
import { getRequestInfo, hashPassword, requireSuperAdmin, validarPassword } from '@/lib/auth'
import { resolverCargoVendedor } from '@/lib/vendedores'

export const dynamic = 'force-dynamic'

const usuarioSafeSelect = {
  id: true,
  username: true,
  nombre: true,
  cargo: true,
  rol: true,
  activo: true,
  email: true,
  contactoId: true,
  ultimoAcceso: true,
  twoFactorEnabled: true,
  twoFactorConfirmedAt: true,
} as const

function normalizarEmail(email: unknown): string {
  if (typeof email !== 'string') return ''
  return email.trim().toLowerCase()
}

function emailValido(email: string): boolean {
  return !email || /^[^\s@]+@hidroperforaciones\.com$/i.test(email)
}

async function contarSuperAdminsActivos(excludeId?: string): Promise<number> {
  return await prisma.usuario.count({
    where: {
      rol: 'superadmin',
      activo: true,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  })
}

// PATCH - actualizar nombre, password, activo y/o rol con safeguards
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await request.json()
  const target = await prisma.usuario.findUnique({ where: { id }, select: usuarioSafeSelect })
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  const data: Record<string, unknown> = {}

  if (body.password) {
    const err = validarPassword(body.password)
    if (err) return NextResponse.json({ error: err }, { status: 400 })
    data.passwordHash = hashPassword(body.password)
  }

  if (typeof body.nombre === 'string' && body.nombre.trim()) {
    data.nombre = body.nombre.trim()
  }

  if (typeof body.cargo === 'string') {
    data.cargo = resolverCargoVendedor(
      typeof data.nombre === 'string' ? data.nombre : target.nombre,
      body.cargo,
      typeof data.rol === 'string' ? data.rol : target.rol,
    )
  }

  if (typeof body.email === 'string') {
    const email = normalizarEmail(body.email)
    if (!emailValido(email)) {
      return NextResponse.json({ error: 'El correo del asesor debe ser @hidroperforaciones.com' }, { status: 400 })
    }
    data.email = email
  }

  if (body.rol && (body.rol === 'admin' || body.rol === 'superadmin')) {
    if (target.username === auth.user.username && body.rol === 'admin') {
      return NextResponse.json({
        error: 'No puedes quitarte el rol de superadmin a ti mismo. Pídeselo a otro superadmin.',
      }, { status: 400 })
    }
    if (target.rol === 'superadmin' && body.rol === 'admin' && target.activo) {
      const restantes = await contarSuperAdminsActivos(target.id)
      if (restantes === 0) {
        return NextResponse.json({
          error: 'No puedes degradar al último superadmin activo. Crea otro superadmin primero.',
        }, { status: 400 })
      }
    }
    data.rol = body.rol
  }

  if (body.activo === false && target.rol === 'superadmin' && target.activo) {
    const restantes = await contarSuperAdminsActivos(target.id)
    if (restantes === 0) {
      return NextResponse.json({
        error: 'No puedes desactivar al último superadmin activo.',
      }, { status: 400 })
    }
  }
  if (typeof body.activo === 'boolean') data.activo = body.activo

  if (body.activo === false && target.username === auth.user.username) {
    return NextResponse.json({
      error: 'No puedes desactivarte a ti mismo.',
    }, { status: 400 })
  }

  const usuario = await prisma.usuario.update({
    where: { id },
    data,
    select: usuarioSafeSelect,
  })

  await auditLog({
    user: auth.user,
    accion: 'update',
    entidad: 'usuario',
    entidadId: id,
    antes: target,
    despues: { ...usuario, passwordChanged: Boolean(body.password) },
    ...getRequestInfo(request),
  })

  return NextResponse.json(usuario)
}

// DELETE - soft delete (activo=false) con safeguards
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const target = await prisma.usuario.findUnique({ where: { id }, select: usuarioSafeSelect })
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  if (target.username === auth.user.username) {
    return NextResponse.json({ error: 'No puedes eliminarte a ti mismo.' }, { status: 400 })
  }

  if (target.rol === 'superadmin' && target.activo) {
    const restantes = await contarSuperAdminsActivos(target.id)
    if (restantes === 0) {
      return NextResponse.json({
        error: 'No puedes eliminar al último superadmin activo. Crea otro primero.',
      }, { status: 400 })
    }
  }

  const usuario = await prisma.usuario.update({
    where: { id },
    data: { activo: false },
    select: usuarioSafeSelect,
  })

  await auditLog({
    user: auth.user,
    accion: 'delete',
    entidad: 'usuario',
    entidadId: id,
    antes: target,
    despues: usuario,
    ...getRequestInfo(request),
  })

  return NextResponse.json({ ok: true, soft: true })
}
