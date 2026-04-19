// POST /api/oportunidades/[id]/restaurar — restaurar oportunidad soft-deleted
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSuperAdmin, getRequestInfo } from '@/lib/auth'
import { auditLog } from '@/lib/audit'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const before = await prisma.oportunidad.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!before.eliminadaEn) return NextResponse.json({ error: 'No está eliminada' }, { status: 409 })

  const row = await prisma.oportunidad.update({
    where: { id },
    data: { eliminadaEn: null, eliminadaPor: null, motivoBorrado: null },
  })

  const info = getRequestInfo(request)
  await auditLog({ user: auth.user, accion: 'restore', entidad: 'oportunidad', entidadId: id, antes: { eliminadaEn: before.eliminadaEn }, despues: row, ...info })

  return NextResponse.json({ ok: true, oportunidad: row })
}
