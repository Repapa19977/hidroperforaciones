// PATCH/DELETE de un ServiceToken. Solo superadmin.
// DELETE = revocar (marca activo=false) en vez de borrar, para conservar audit trail.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSuperAdmin, getRequestInfo } from '@/lib/auth'
import { auditLog } from '@/lib/audit'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (typeof body.activo === 'boolean') data.activo = body.activo
  if (Array.isArray(body.scopes)) data.scopes = JSON.stringify(body.scopes)
  if (typeof body.notas === 'string') data.notas = body.notas
  if (body.expiraEn === null) data.expiraEn = null
  else if (typeof body.expiraEn === 'string') data.expiraEn = new Date(body.expiraEn)

  const before = await prisma.serviceToken.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const row = await prisma.serviceToken.update({
    where: { id },
    data,
    select: {
      id: true, nombre: true, scopes: true, activo: true,
      ultimoUso: true, vecesUsado: true, creadoPor: true, notas: true,
      expiraEn: true, createdAt: true,
    },
  })

  const info = getRequestInfo(request)
  await auditLog({ user: auth.user, accion: 'update', entidad: 'servicetoken', entidadId: id, antes: before, despues: row, ...info })

  return NextResponse.json(row)
}

// DELETE — revoca el token (marca activo=false). Para HARD delete usar DELETE?hard=1
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const hard = new URL(request.url).searchParams.get('hard') === '1'

  const before = await prisma.serviceToken.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (hard) {
    await prisma.serviceToken.delete({ where: { id } })
  } else {
    await prisma.serviceToken.update({ where: { id }, data: { activo: false } })
  }

  const info = getRequestInfo(request)
  await auditLog({ user: auth.user, accion: hard ? 'delete' : 'update', entidad: 'servicetoken', entidadId: id, antes: before, despues: { revocado: !hard, eliminado: hard }, ...info })

  return NextResponse.json({ ok: true, hard })
}
