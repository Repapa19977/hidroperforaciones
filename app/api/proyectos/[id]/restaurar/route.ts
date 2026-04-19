// POST /api/proyectos/[id]/restaurar — restaurar proyecto soft-deleted
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSuperAdmin, getRequestInfo } from '@/lib/auth'
import { auditLog } from '@/lib/audit'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const before = await prisma.proyecto.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!before.eliminadoEn) return NextResponse.json({ error: 'No está eliminado' }, { status: 409 })

  const row = await prisma.proyecto.update({
    where: { id },
    data: { eliminadoEn: null, eliminadoPor: null, motivoBorrado: null },
  })

  const info = getRequestInfo(request)
  await auditLog({ user: auth.user, accion: 'restore', entidad: 'proyecto', entidadId: id, antes: { eliminadoEn: before.eliminadoEn }, despues: row, ...info })

  return NextResponse.json({ ok: true, proyecto: row })
}
