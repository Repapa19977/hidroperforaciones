// Editar el plan de pagos del proyecto. Solo superadmin.
// Valida que la suma de % sea exactamente 100.
// Si se pasa `planPagos: null`, borra el override y vuelve al plan de la cotización.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSuperAdmin, getRequestInfo } from '@/lib/auth'
import { auditLog } from '@/lib/audit'
import { z } from 'zod'

const hitoSchema = z.object({
  id: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  pct: z.number().min(0).max(100),
  fijo: z.boolean().optional().default(false),
})

const bodySchema = z.object({
  planPagos: z.array(hitoSchema).min(1).nullable(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const raw = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({
      error: 'Datos inválidos',
      detalles: parsed.error.issues.map(i => ({ campo: i.path.join('.'), mensaje: i.message })),
    }, { status: 400 })
  }
  const { planPagos } = parsed.data

  // Si no es null, validar suma = 100
  if (planPagos) {
    const suma = planPagos.reduce((a, h) => a + h.pct, 0)
    if (Math.abs(suma - 100) > 0.01) {
      return NextResponse.json({
        error: `La suma de porcentajes debe ser 100% (actual: ${suma.toFixed(1)}%)`,
      }, { status: 400 })
    }
    // Validar ids únicos
    const ids = planPagos.map(h => h.id)
    if (new Set(ids).size !== ids.length) {
      return NextResponse.json({ error: 'Los IDs de los hitos deben ser únicos' }, { status: 400 })
    }
  }

  const before = await prisma.proyecto.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const proyecto = await prisma.proyecto.update({
    where: { id },
    data: { planPagos: planPagos ? JSON.stringify(planPagos) : null },
  })

  const info = getRequestInfo(request)
  await auditLog({
    user: auth.user, accion: 'update', entidad: 'proyecto', entidadId: id,
    antes: { planPagos: before.planPagos }, despues: { planPagos: proyecto.planPagos },
    ...info,
  })

  return NextResponse.json({ ok: true, planPagos: planPagos })
}
