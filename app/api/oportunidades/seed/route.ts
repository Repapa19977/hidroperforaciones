// Seed inicial: carga datos mock de data.ts a la DB.
// En produccion queda bloqueado salvo que HIDROCRM_ALLOW_SEED=1.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { opportunities } from '@/lib/data'
import { requireSuperAdmin } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  if (process.env.NODE_ENV === 'production' && process.env.HIDROCRM_ALLOW_SEED !== '1') {
    return NextResponse.json({ error: 'Seed deshabilitado en produccion' }, { status: 403 })
  }

  const existing = await prisma.oportunidad.count()
  if (existing > 0) {
    return NextResponse.json({ ok: false, msg: 'Ya existe data. Seed omitido.' })
  }

  await prisma.oportunidad.createMany({
    data: opportunities.map(o => ({
      correlativo:      o.correlativo,
      cliente:          o.cliente,
      empresa:          o.empresa,
      monto:            o.monto,
      etapa:            o.etapa,
      vendedor:         o.vendedor,
      avatar:           o.avatar,
      fecha:            o.fecha,
      tipo:             o.tipo,
      profundidad:      o.profundidad ?? null,
      proyecto:         o.proyecto ?? '',
      diasSinActividad: o.diasSinActividad,
    })),
  })

  return NextResponse.json({ ok: true, inserted: opportunities.length })
}
