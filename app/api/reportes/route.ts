import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const vendedor = searchParams.get('vendedor')

  const fromDate = from ? new Date(from) : null
  const toDate = to ? new Date(new Date(to).setHours(23, 59, 59, 999)) : null

  const where: { vendedor?: string; createdAt?: { gte?: Date; lte?: Date }; eliminadaEn: null } = { eliminadaEn: null }
  if (vendedor && vendedor !== 'all') where.vendedor = vendedor
  if (fromDate || toDate) {
    where.createdAt = {}
    if (fromDate) where.createdAt.gte = fromDate
    if (toDate) where.createdAt.lte = toDate
  }

  const rows = await prisma.cotizacion.findMany({ where, orderBy: { createdAt: 'desc' } })

  // Per-vendor stats
  const vendedores = [...new Set(rows.map(r => r.vendedor))].sort()
  const porVendedor = vendedores.map(v => {
    const vc = rows.filter(r => r.vendedor === v)
    const confirmadas = vc.filter(r => r.estado === 'confirmada')
    const canceladas  = vc.filter(r => r.estado === 'cancelada')
    const enviadas    = vc.filter(r => r.estado === 'enviada')
    const borradores  = vc.filter(r => r.estado === 'borrador')
    return {
      vendedor: v,
      total: vc.length,
      monto: vc.reduce((a, b) => a + b.monto, 0),
      confirmadas: confirmadas.length,
      confirmadoMonto: confirmadas.reduce((a, b) => a + b.monto, 0),
      enviadas: enviadas.length,
      borradores: borradores.length,
      canceladas: canceladas.length,
      conversionPct: vc.length > 0 ? Math.round((confirmadas.length / vc.length) * 100) : 0,
    }
  })

  const confirmadas = rows.filter(r => r.estado === 'confirmada')
  const resumen = {
    total: rows.length,
    monto: rows.reduce((a, b) => a + b.monto, 0),
    confirmadas: confirmadas.length,
    confirmadoMonto: confirmadas.reduce((a, b) => a + b.monto, 0),
    canceladas: rows.filter(r => r.estado === 'cancelada').length,
    enviadas: rows.filter(r => r.estado === 'enviada').length,
    borradores: rows.filter(r => r.estado === 'borrador').length,
    conversionPct: rows.length > 0 ? Math.round((confirmadas.length / rows.length) * 100) : 0,
    perforacion: rows.filter(r => r.tipo === 'perforacion').length,
    limpieza: rows.filter(r => r.tipo === 'limpieza').length,
    montoPerforacion: rows.filter(r => r.tipo === 'perforacion').reduce((a, b) => a + b.monto, 0),
    montoLimpieza: rows.filter(r => r.tipo === 'limpieza').reduce((a, b) => a + b.monto, 0),
  }

  return NextResponse.json({ resumen, porVendedor, cotizaciones: rows })
}
