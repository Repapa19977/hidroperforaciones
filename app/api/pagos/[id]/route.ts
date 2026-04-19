// PATCH/DELETE de un pago individual. Solo superadmin.
// DELETE es soft (pasa a papelera). Restaurar via /api/pagos/[id]/restaurar.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSuperAdmin, getRequestInfo } from '@/lib/auth'
import { auditLog } from '@/lib/audit'
import { z } from 'zod'

const pagoPatchSchema = z.object({
  hitoId: z.string().min(1).max(50).optional(),
  hitoLabel: z.string().max(200).optional(),
  monto: z.number().positive().optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  metodo: z.enum(['cheque', 'transferencia', 'deposito', 'efectivo', 'tarjeta']).optional(),
  referencia: z.string().max(200).optional(),
  nota: z.string().max(1000).optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const raw = await request.json().catch(() => null)
  const parsed = pagoPatchSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({
      error: 'Datos inválidos',
      detalles: parsed.error.issues.map(i => ({ campo: i.path.join('.'), mensaje: i.message })),
    }, { status: 400 })
  }

  const before = await prisma.pago.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const pago = await prisma.pago.update({ where: { id }, data: parsed.data })

  const info = getRequestInfo(request)
  await auditLog({ user: auth.user, accion: 'update', entidad: 'pago', entidadId: id, antes: before, despues: pago, ...info })

  return NextResponse.json(pago)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const motivo = new URL(request.url).searchParams.get('motivo') ?? ''

  const before = await prisma.pago.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (before.eliminadoEn) return NextResponse.json({ error: 'Ya estaba eliminado' }, { status: 409 })

  const pago = await prisma.pago.update({
    where: { id },
    data: { eliminadoEn: new Date(), eliminadoPor: auth.user.username, motivoBorrado: motivo || null },
  })

  const info = getRequestInfo(request)
  await auditLog({ user: auth.user, accion: 'delete', entidad: 'pago', entidadId: id, antes: before, despues: pago, ...info })

  return NextResponse.json({ ok: true, soft: true })
}
