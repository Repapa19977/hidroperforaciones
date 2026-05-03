// /api/cuentas-pagar — lista + creación (módulo contable independiente).
// Protegido por middleware proxy.ts (JWT requerido). Lectura/escritura abierta a
// admin y superadmin; el filtrado por rol se deja al frontend por ahora.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calcularTotales } from '@/lib/cuentas-utils'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** GET — lista cuentas por pagar (excluye soft-deleted). */
export async function GET() {
  const rows = await prisma.cuentaPorPagar.findMany({
    where: { eliminadoEn: null },
    orderBy: [{ pagado: 'asc' }, { fechaVencimiento: 'asc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json(rows)
}

/** POST — crear nueva cuenta por pagar. */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const proveedor   = String(body.proveedor ?? '').trim()
  const descripcion = String(body.descripcion ?? '').trim()
  const monto       = Number(body.monto ?? 0)

  if (!proveedor)    return NextResponse.json({ error: 'Proveedor requerido' }, { status: 400 })
  if (!descripcion)  return NextResponse.json({ error: 'Descripción requerida' }, { status: 400 })
  if (!(monto > 0))  return NextResponse.json({ error: 'Monto debe ser > 0' }, { status: 400 })

  const aplicarIva   = body.aplicarIva  !== undefined ? Boolean(body.aplicarIva)  : true
  const aplicarIsr   = body.aplicarIsr  !== undefined ? Boolean(body.aplicarIsr)  : false
  const diasCredito  = Math.max(0, Number(body.diasCredito ?? 0) | 0)
  const fechaEmision = String(body.fechaEmision ?? new Date().toISOString().slice(0, 10))

  const { ivaMonto, isrMonto, total, fechaVencimiento } = calcularTotales({
    monto, aplicarIva, aplicarIsr, diasCredito, fechaEmision,
  })

  const row = await prisma.cuentaPorPagar.create({
    data: {
      proveedor,
      nit:            String(body.nit ?? ''),
      descripcion,
      monto,
      aplicarIva,
      aplicarIsr,
      ivaMonto,
      isrMonto,
      total,
      fechaEmision,
      diasCredito,
      fechaVencimiento,
      nota:           String(body.nota ?? ''),
      creadoPor:      user?.username ?? '',
    },
  })

  return NextResponse.json(row, { status: 201 })
}
