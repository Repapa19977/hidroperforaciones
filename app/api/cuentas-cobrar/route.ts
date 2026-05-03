// /api/cuentas-cobrar — lista + creación.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calcularTotales } from '@/lib/cuentas-utils'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const rows = await prisma.cuentaPorCobrar.findMany({
    where: { eliminadoEn: null },
    orderBy: [{ cobrado: 'asc' }, { fechaVencimiento: 'asc' }, { createdAt: 'desc' }],
  })
  return NextResponse.json(rows)
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request)
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const cliente     = String(body.cliente ?? '').trim()
  const descripcion = String(body.descripcion ?? '').trim()
  const monto       = Number(body.monto ?? 0)

  if (!cliente)      return NextResponse.json({ error: 'Cliente requerido' }, { status: 400 })
  if (!descripcion)  return NextResponse.json({ error: 'Descripción requerida' }, { status: 400 })
  if (!(monto > 0))  return NextResponse.json({ error: 'Monto debe ser > 0' }, { status: 400 })

  const aplicarIva   = body.aplicarIva  !== undefined ? Boolean(body.aplicarIva)  : true
  const aplicarIsr   = body.aplicarIsr  !== undefined ? Boolean(body.aplicarIsr)  : false
  const diasCredito  = Math.max(0, Number(body.diasCredito ?? 0) | 0)
  const fechaEmision = String(body.fechaEmision ?? new Date().toISOString().slice(0, 10))

  const { ivaMonto, isrMonto, total, fechaVencimiento } = calcularTotales({
    monto, aplicarIva, aplicarIsr, diasCredito, fechaEmision,
  })

  const row = await prisma.cuentaPorCobrar.create({
    data: {
      cliente,
      empresa:     String(body.empresa ?? ''),
      nit:         String(body.nit ?? ''),
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
      nota:        String(body.nota ?? ''),
      creadoPor:   user?.username ?? '',
    },
  })
  return NextResponse.json(row, { status: 201 })
}
