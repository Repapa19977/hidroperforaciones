// Crea o regenera el acceso del cliente al portal.
// Solo superadmin. Devuelve el password raw UNA sola vez (el hash queda en DB).
// Si el contacto ya tiene un Usuario cliente_final, regenera el password.

import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { prisma } from '@/lib/db'
import { requireSuperAdmin, getRequestInfo } from '@/lib/auth'
import { auditLog } from '@/lib/audit'

function sha256(s: string) { return createHash('sha256').update(s).digest('hex') }

// Genera username limpio desde el nombre del contacto
function slugUsername(nombre: string, id: string): string {
  const base = nombre
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // quita acentos
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 20)
  const suffix = id.slice(-4)  // sufijo del id para evitar colisiones
  return `${base || 'cliente'}.${suffix}`
}

// Genera una contraseña legible (4 palabras + 2 dígitos)
function generarPasswordAmigable(): string {
  // Palabras cortas sin ambigüedad (sin i/l/o/0 para evitar confusión)
  const palabras = ['azul','rojo','verde','amarillo','nube','sol','luna','agua','cielo','mar','tierra','rio','pozo','bomba','tubo','valle','cerro','ruta','camino','casa']
  const w1 = palabras[Math.floor(Math.random() * palabras.length)]
  const w2 = palabras[Math.floor(Math.random() * palabras.length)]
  const n = String(Math.floor(Math.random() * 90) + 10)  // 10-99
  return `${w1}-${w2}-${n}`
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response
  const { id } = await params

  const contacto = await prisma.contacto.findUnique({ where: { id } })
  if (!contacto) return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 })

  const usuario = await prisma.usuario.findFirst({
    where: { contactoId: id, rol: 'cliente_final' },
    select: { id: true, username: true, email: true, activo: true, ultimoAcceso: true, createdAt: true },
  })

  return NextResponse.json({
    contacto: { id: contacto.id, nombre: contacto.nombre, email: contacto.email },
    usuario,
  })
}

// POST — crear o regenerar. Body: { email? (default del contacto), regenerar? }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const { email: emailOverride, regenerar } = body as { email?: string; regenerar?: boolean }

  const contacto = await prisma.contacto.findUnique({ where: { id } })
  if (!contacto) return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 })
  if (contacto.eliminadoEn) return NextResponse.json({ error: 'Contacto eliminado' }, { status: 409 })

  const email = (emailOverride || contacto.email || '').trim()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'El contacto necesita email válido para crear acceso al portal. Editá el contacto primero.' }, { status: 400 })
  }

  const password = generarPasswordAmigable()
  const passwordHash = sha256(password)

  const existing = await prisma.usuario.findFirst({
    where: { contactoId: id, rol: 'cliente_final' },
  })

  let usuario: { id: string; username: string; email: string; activo: boolean }
  let accion: 'create' | 'regenerate'

  if (existing) {
    if (!regenerar) {
      return NextResponse.json({
        error: 'Este contacto ya tiene acceso al portal. Para regenerar el password, pasá { regenerar: true }.',
        usuario: { id: existing.id, username: existing.username, email: existing.email, activo: existing.activo },
      }, { status: 409 })
    }
    const updated = await prisma.usuario.update({
      where: { id: existing.id },
      data: { passwordHash, email, activo: true },
      select: { id: true, username: true, email: true, activo: true },
    })
    usuario = updated
    accion = 'regenerate'
  } else {
    // Asegurar username único (muy improbable que colisione pero por si acaso)
    let username = slugUsername(contacto.nombre, id)
    const exists = await prisma.usuario.findUnique({ where: { username } })
    if (exists) username = `${username}.${randomBytes(2).toString('hex')}`

    const created = await prisma.usuario.create({
      data: {
        username,
        nombre: contacto.nombre,
        rol: 'cliente_final',
        passwordHash,
        email,
        contactoId: id,
      },
      select: { id: true, username: true, email: true, activo: true },
    })
    usuario = created
    accion = 'create'
  }

  const info = getRequestInfo(request)
  await auditLog({
    user: auth.user, accion, entidad: 'usuario', entidadId: usuario.id,
    despues: { contactoId: id, email, rol: 'cliente_final' }, ...info,
  })

  // Devolver el password RAW una sola vez
  return NextResponse.json({
    ok: true,
    accion,
    usuario,
    passwordRaw: password,
    loginUrl: `${new URL(request.url).origin}/cliente/login`,
    aviso: 'Guardá el password ahora — no se puede recuperar después (solo regenerar).',
  }, { status: 201 })
}

// DELETE — desactivar el acceso (no borra, solo deactivates)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const existing = await prisma.usuario.findFirst({
    where: { contactoId: id, rol: 'cliente_final' },
  })
  if (!existing) return NextResponse.json({ error: 'Este contacto no tiene acceso al portal' }, { status: 404 })

  await prisma.usuario.update({ where: { id: existing.id }, data: { activo: false } })

  const info = getRequestInfo(request)
  await auditLog({
    user: auth.user, accion: 'disable', entidad: 'usuario', entidadId: existing.id,
    despues: { activo: false }, ...info,
  })

  return NextResponse.json({ ok: true, disabled: true })
}
