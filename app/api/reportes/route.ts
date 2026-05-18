import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { parseFechaFlexible } from '@/lib/date-format'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function startOfDay(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
}

function endOfDay(d: Date): Date {
  const out = new Date(d)
  out.setHours(23, 59, 59, 999)
  return out
}

function parseRangeDate(value: string | null, edge: 'start' | 'end'): Date | null {
  if (!value) return null
  const raw = value.trim()
  if (!raw) return null

  if (raw.includes('T')) {
    const parsed = new Date(raw)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const parsed = parseFechaFlexible(raw)
  if (!parsed) return null
  return edge === 'start' ? startOfDay(parsed) : endOfDay(parsed)
}

function conversionPct(confirmadas: number, enviadas: number, canceladas: number): number {
  const base = confirmadas + enviadas + canceladas
  return base > 0 ? Math.round((confirmadas / base) * 100) : 0
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const vendedor = auth.user.role === 'superadmin'
    ? searchParams.get('vendedor')
    : auth.user.vendedor

  const fromDate = parseRangeDate(from, 'start')
  const toDate = parseRangeDate(to, 'end')

  const where: { vendedor?: string; eliminadaEn: null } = { eliminadaEn: null }
  if (vendedor && vendedor !== 'all') where.vendedor = vendedor

  const allRows = await prisma.cotizacion.findMany({ where, orderBy: { createdAt: 'desc' } })
  const rows = allRows
    .filter(row => {
      const fechaCotizacion = parseFechaFlexible(row.fecha) ?? row.createdAt
      if (fromDate && fechaCotizacion < fromDate) return false
      if (toDate && fechaCotizacion > toDate) return false
      return true
    })
    .sort((a, b) => {
      const fechaA = parseFechaFlexible(a.fecha)?.getTime() ?? a.createdAt.getTime()
      const fechaB = parseFechaFlexible(b.fecha)?.getTime() ?? b.createdAt.getTime()
      return fechaB - fechaA || b.createdAt.getTime() - a.createdAt.getTime()
    })

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
      conversionPct: conversionPct(confirmadas.length, enviadas.length, canceladas.length),
    }
  })

  const confirmadas = rows.filter(r => r.estado === 'confirmada')
  const enviadas = rows.filter(r => r.estado === 'enviada')
  const canceladas = rows.filter(r => r.estado === 'cancelada')
  const resumen = {
    total: rows.length,
    monto: rows.reduce((a, b) => a + b.monto, 0),
    confirmadas: confirmadas.length,
    confirmadoMonto: confirmadas.reduce((a, b) => a + b.monto, 0),
    canceladas: canceladas.length,
    enviadas: enviadas.length,
    borradores: rows.filter(r => r.estado === 'borrador').length,
    conversionPct: conversionPct(confirmadas.length, enviadas.length, canceladas.length),
    perforacion: rows.filter(r => r.tipo === 'perforacion').length,
    limpieza: rows.filter(r => r.tipo === 'limpieza').length,
    montoPerforacion: rows.filter(r => r.tipo === 'perforacion').reduce((a, b) => a + b.monto, 0),
    montoLimpieza: rows.filter(r => r.tipo === 'limpieza').reduce((a, b) => a + b.monto, 0),
  }

  return NextResponse.json({ resumen, porVendedor, cotizaciones: rows })
}
