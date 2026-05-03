// Cron: detecta proyectos activos sin entrada de bitácora HOY.
// Se ejecuta 2x/día: 12:00 y 18:00 GT. Por cada proyecto sin actualizar,
// emite webhook `bitacora.sin_actualizar` al bot para que recuerde al foreman.
//
// Invocación desde crontab del VPS:
//   0 12 * * * curl -X POST -H "X-Cron-Secret: xxx" https://hidrocrm.com/api/cron/bitacora-check
//   0 18 * * * curl -X POST -H "X-Cron-Secret: xxx" https://hidrocrm.com/api/cron/bitacora-check

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { emitWebhook } from '@/lib/mcp/webhook-emit'
import { assertCronAuth } from '@/lib/cron-auth'

export async function POST(request: NextRequest) {
  if (!assertCronAuth(request)) {
    return NextResponse.json({ error: 'Sin autorización' }, { status: 401 })
  }

  const hoy = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  // Proyectos activos
  const activos = await prisma.proyecto.findMany({
    where: { eliminadoEn: null, estado: 'activo' },
    select: {
      id: true,
      correlativo: true,
      cliente: true,
      empresa: true,
      contactoId: true,
      vendedor: true,
      monto: true,
    },
  })

  if (activos.length === 0) {
    return NextResponse.json({ checked: 0, alerts: 0, message: 'sin proyectos activos' })
  }

  // Entradas de hoy agrupadas por proyectoId
  const entradasHoy = await prisma.bitacoraEntry.findMany({
    where: { fecha: hoy, proyectoId: { in: activos.map(p => p.id) } },
    select: { proyectoId: true },
  })
  const conEntrada = new Set(entradasHoy.map(e => e.proyectoId))

  // Proyectos sin entrada hoy
  const pendientes = activos.filter(p => !conEntrada.has(p.id))

  // Traer teléfono del vendedor (usuario) para que el bot sepa a quién escribir
  const vendedorNombres = Array.from(new Set(pendientes.map(p => p.vendedor).filter(Boolean)))
  const usuarios = vendedorNombres.length > 0
    ? await prisma.usuario.findMany({
        where: { nombre: { in: vendedorNombres }, activo: true },
        select: { nombre: true, email: true },
      })
    : []
  const usuarioByNombre = new Map(usuarios.map(u => [u.nombre, u]))

  const results: Array<{ proyecto: string; sent: boolean; error?: string }> = []
  for (const p of pendientes) {
    const vendedorInfo = usuarioByNombre.get(p.vendedor)
    const r = await emitWebhook('bitacora.sin_actualizar', {
      proyecto_id: p.id,
      proyecto_correlativo: p.correlativo,
      cliente: p.cliente,
      empresa: p.empresa,
      vendedor: p.vendedor,
      vendedor_email: vendedorInfo?.email ?? null,
      fecha_chequeada: hoy,
      monto_proyecto: p.monto,
    })
    results.push({ proyecto: p.correlativo, sent: r.sent, error: r.error })
  }

  return NextResponse.json({
    checked: activos.length,
    alerts: pendientes.length,
    sent_ok: results.filter(r => r.sent).length,
    sent_error: results.filter(r => !r.sent).length,
    details: results,
  })
}
