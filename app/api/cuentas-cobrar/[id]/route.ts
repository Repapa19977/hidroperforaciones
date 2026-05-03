// /api/cuentas-cobrar/[id] — GET / PATCH / DELETE (soft).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calcularTotales } from '@/lib/cuentas-utils'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const row = await prisma.cuentaPorCobrar.findUnique({ where: { id } })
  if (!row || row.eliminadoEn) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(row)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(request)
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const existing = await prisma.cuentaPorCobrar.findUnique({ where: { id } })
  if (!existing || existing.eliminadoEn) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const patch: Record<string, unknown> = {}
  if (typeof body.cliente === 'string')      patch.cliente     = body.cliente.trim()
  if (typeof body.empresa === 'string')      patch.empresa     = body.empresa
  if (typeof body.nit === 'string')           patch.nit         = body.nit
  if (typeof body.descripcion === 'string')   patch.descripcion = body.descripcion
  if (typeof body.nota === 'string')          patch.nota        = body.nota

  const afectaFiscal = ['monto','aplicarIva','aplicarIsr','diasCredito','fechaEmision']
    .some(k => body[k] !== undefined)

  if (afectaFiscal) {
    const monto        = Number(body.monto ?? existing.monto)
    const aplicarIva   = body.aplicarIva  !== undefined ? Boolean(body.aplicarIva)  : existing.aplicarIva
    const aplicarIsr   = body.aplicarIsr  !== undefined ? Boolean(body.aplicarIsr)  : existing.aplicarIsr
    const diasCredito  = body.diasCredito !== undefined ? Math.max(0, Number(body.diasCredito) | 0) : existing.diasCredito
    const fechaEmision = String(body.fechaEmision ?? existing.fechaEmision)
    const calc = calcularTotales({ monto, aplicarIva, aplicarIsr, diasCredito, fechaEmision })
    patch.monto            = monto
    patch.aplicarIva       = aplicarIva
    patch.aplicarIsr       = aplicarIsr
    patch.diasCredito      = diasCredito
    patch.fechaEmision     = fechaEmision
    patch.ivaMonto         = calc.ivaMonto
    patch.isrMonto         = calc.isrMonto
    patch.total            = calc.total
    patch.fechaVencimiento = calc.fechaVencimiento
  }

  if (body.cobrado !== undefined) {
    patch.cobrado = Boolean(body.cobrado)
    if (body.cobrado) {
      patch.fechaCobro      = String(body.fechaCobro ?? new Date().toISOString().slice(0, 10))
      patch.metodoCobro     = String(body.metodoCobro ?? existing.metodoCobro ?? '')
      patch.referenciaCobro = String(body.referenciaCobro ?? existing.referenciaCobro ?? '')
    } else {
      patch.fechaCobro = null
    }
  } else {
    if (typeof body.fechaCobro === 'string')      patch.fechaCobro      = body.fechaCobro
    if (typeof body.metodoCobro === 'string')     patch.metodoCobro     = body.metodoCobro
    if (typeof body.referenciaCobro === 'string') patch.referenciaCobro = body.referenciaCobro
  }

  const row = await prisma.cuentaPorCobrar.update({ where: { id }, data: patch })
  void user
  return NextResponse.json(row)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(request)
  const url = new URL(request.url)
  const motivo = url.searchParams.get('motivo') ?? ''

  const existing = await prisma.cuentaPorCobrar.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (existing.eliminadoEn) return NextResponse.json({ ok: true, alreadyDeleted: true })

  await prisma.cuentaPorCobrar.update({
    where: { id },
    data: {
      eliminadoEn:   new Date(),
      eliminadoPor:  user?.username ?? '',
      motivoBorrado: motivo,
    },
  })
  return NextResponse.json({ ok: true })
}
