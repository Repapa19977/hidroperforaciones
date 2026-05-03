// Cron: detecta clientes activos (con proyecto activo o con oportunidad en negociación)
// que no han tenido movimiento registrado en X días. Emite para que el bot
// los contacte o recordar al vendedor. Semanal (lunes 8:00 GT).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { emitWebhook } from '@/lib/mcp/webhook-emit'
import { assertCronAuth } from '@/lib/cron-auth'

const DIAS_FRIO = 14

export async function POST(request: NextRequest) {
  if (!assertCronAuth(request)) {
    return NextResponse.json({ error: 'Sin autorización' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - DIAS_FRIO * 24 * 60 * 60 * 1000)

  // Oportunidades en pipeline (no won/lost) sin movimiento reciente
  const oportunidades = await prisma.oportunidad.findMany({
    where: {
      eliminadaEn: null,
      etapa: { in: ['qualified', 'proposition', 'negotiation'] },
      updatedAt: { lt: cutoff },
    },
    select: {
      id: true,
      correlativo: true,
      cliente: true,
      empresa: true,
      contactoId: true,
      vendedor: true,
      etapa: true,
      monto: true,
      updatedAt: true,
    },
    take: 100,
  })

  const alerts: Array<{ oportunidad: string; cliente: string; dias_frio: number; sent: boolean }> = []
  for (const o of oportunidades) {
    const diasFrio = Math.floor((Date.now() - o.updatedAt.getTime()) / (1000 * 60 * 60 * 24))
    const r = await emitWebhook('cliente.sin_seguimiento', {
      oportunidad_id: o.id,
      oportunidad_correlativo: o.correlativo,
      cliente: o.cliente,
      empresa: o.empresa,
      contacto_id: o.contactoId,
      vendedor: o.vendedor,
      etapa: o.etapa,
      monto: o.monto,
      dias_sin_movimiento: diasFrio,
      ultima_actualizacion: o.updatedAt.toISOString(),
    })
    alerts.push({
      oportunidad: o.correlativo,
      cliente: o.cliente,
      dias_frio: diasFrio,
      sent: r.sent,
    })
  }

  return NextResponse.json({
    cutoff_dias: DIAS_FRIO,
    alerts: alerts.length,
    sent_ok: alerts.filter(a => a.sent).length,
    details: alerts,
  })
}
