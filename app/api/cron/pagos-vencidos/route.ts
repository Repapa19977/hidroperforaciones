// Cron: detecta pagos vencidos — hitos cuya fecha objetivo ya pasó pero que
// aún no tienen un pago registrado por el monto esperado.
// Diario 9:00 GT.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { emitWebhook } from '@/lib/mcp/webhook-emit'
import { assertCronAuth } from '@/lib/cron-auth'

export async function POST(request: NextRequest) {
  if (!assertCronAuth(request)) {
    return NextResponse.json({ error: 'Sin autorización' }, { status: 401 })
  }

  const hoyStr = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  // Proyectos activos con plan de pagos editable
  const proyectos = await prisma.proyecto.findMany({
    where: { eliminadoEn: null, estado: 'activo' },
    select: {
      id: true,
      correlativo: true,
      cliente: true,
      empresa: true,
      contactoId: true,
      vendedor: true,
      monto: true,
      planPagos: true,
    },
  })

  const alerts: Array<{
    proyecto: string
    cliente: string
    hito_id: string
    hito_label: string
    monto_esperado: number
    monto_cobrado: number
    saldo: number
    fecha_objetivo: string
    sent: boolean
  }> = []

  for (const proy of proyectos) {
    // Plan de hitos del proyecto. Si no hay override, no podemos chequear fechas objetivo
    // (el plan default no tiene fechas). Skipeamos los proyectos sin plan custom.
    let plan: Array<{ id: string; label: string; pct?: number; fijo?: number; fechaObjetivo?: string }> = []
    try {
      if (proy.planPagos) plan = JSON.parse(proy.planPagos)
    } catch { /* ignore */ }
    if (plan.length === 0) continue

    const pagos = await prisma.pago.findMany({
      where: { proyectoId: proy.id, eliminadoEn: null },
      select: { hitoId: true, monto: true },
    })
    const cobradoPorHito = new Map<string, number>()
    for (const p of pagos) {
      cobradoPorHito.set(p.hitoId, (cobradoPorHito.get(p.hitoId) ?? 0) + p.monto)
    }

    for (const h of plan) {
      if (!h.fechaObjetivo) continue
      if (h.fechaObjetivo >= hoyStr) continue // no vencido aún
      const esperado = h.fijo ?? (h.pct ?? 0) * proy.monto
      const cobrado = cobradoPorHito.get(h.id) ?? 0
      const saldo = esperado - cobrado
      if (saldo <= 0.01) continue // ya pagado completo

      const r = await emitWebhook('pago.vencido', {
        proyecto_id: proy.id,
        proyecto_correlativo: proy.correlativo,
        cliente: proy.cliente,
        empresa: proy.empresa,
        vendedor: proy.vendedor,
        hito_id: h.id,
        hito_label: h.label,
        monto_esperado: Math.round(esperado * 100) / 100,
        monto_cobrado: Math.round(cobrado * 100) / 100,
        saldo: Math.round(saldo * 100) / 100,
        fecha_objetivo: h.fechaObjetivo,
        dias_vencido: diffDias(hoyStr, h.fechaObjetivo),
      })
      alerts.push({
        proyecto: proy.correlativo,
        cliente: proy.cliente,
        hito_id: h.id,
        hito_label: h.label,
        monto_esperado: esperado,
        monto_cobrado: cobrado,
        saldo,
        fecha_objetivo: h.fechaObjetivo,
        sent: r.sent,
      })
    }
  }

  return NextResponse.json({
    checked_proyectos: proyectos.length,
    alerts: alerts.length,
    sent_ok: alerts.filter(a => a.sent).length,
    details: alerts,
  })
}

function diffDias(hoyStr: string, fechaStr: string): number {
  const hoy = new Date(hoyStr + 'T00:00:00Z').getTime()
  const fecha = new Date(fechaStr + 'T00:00:00Z').getTime()
  return Math.floor((hoy - fecha) / (1000 * 60 * 60 * 24))
}
