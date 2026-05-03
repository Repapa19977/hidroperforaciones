// /api/dashboard/cuentas — resumen agregado para los widgets del dashboard.
// Devuelve totales y conteos de Cuentas por Pagar y Cuentas por Cobrar.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { estadoCuenta } from '@/lib/cuentas-utils'
import { requireSuperAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const [porPagar, porCobrar] = await Promise.all([
    prisma.cuentaPorPagar.findMany({ where: { eliminadoEn: null } }),
    prisma.cuentaPorCobrar.findMany({ where: { eliminadoEn: null } }),
  ])

  const hoy = new Date()

  const pagar = {
    totalPendiente:  porPagar.filter(c => !c.pagado).reduce((a, c) => a + c.total, 0),
    countPendientes: porPagar.filter(c => !c.pagado).length,
    countVencidas:   porPagar.filter(c => !c.pagado && estadoCuenta(false, c.fechaVencimiento, hoy) === 'vencida').length,
    montoVencidas:   porPagar.filter(c => !c.pagado && estadoCuenta(false, c.fechaVencimiento, hoy) === 'vencida').reduce((a, c) => a + c.total, 0),
    countPorVencer:  porPagar.filter(c => !c.pagado && estadoCuenta(false, c.fechaVencimiento, hoy) === 'por_vencer').length,
  }

  const cobrar = {
    totalPendiente:  porCobrar.filter(c => !c.cobrado).reduce((a, c) => a + c.total, 0),
    countPendientes: porCobrar.filter(c => !c.cobrado).length,
    countVencidas:   porCobrar.filter(c => !c.cobrado && estadoCuenta(false, c.fechaVencimiento, hoy) === 'vencida').length,
    montoVencidas:   porCobrar.filter(c => !c.cobrado && estadoCuenta(false, c.fechaVencimiento, hoy) === 'vencida').reduce((a, c) => a + c.total, 0),
    countPorVencer:  porCobrar.filter(c => !c.cobrado && estadoCuenta(false, c.fechaVencimiento, hoy) === 'por_vencer').length,
  }

  return NextResponse.json({ pagar, cobrar })
}
