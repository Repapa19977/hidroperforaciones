// POST /api/cotizaciones/[id]/restaurar — quita el soft delete (solo superadmin)
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSuperAdmin, getRequestInfo } from '@/lib/auth'
import { auditLog } from '@/lib/audit'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params

  const before = await prisma.cotizacion.findUnique({ where: { correlativo: id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!before.eliminadaEn) {
    return NextResponse.json({ error: 'La cotización no está eliminada' }, { status: 409 })
  }

  const row = await prisma.cotizacion.update({
    where: { correlativo: id },
    data: { eliminadaEn: null, eliminadaPor: null, motivoBorrado: null },
  })

  const info = getRequestInfo(request)
  await auditLog({
    user: auth.user, accion: 'restore', entidad: 'cotizacion', entidadId: id,
    antes: { eliminadaEn: before.eliminadaEn, motivoBorrado: before.motivoBorrado },
    despues: row,
    ip: info.ip, userAgent: info.userAgent,
  })

  return NextResponse.json({ ok: true, cotizacion: row })
}
