// Seed inicial — carga los datos mock de data.ts a la DB
// Llama a POST /api/oportunidades/seed una sola vez
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { opportunities } from '@/lib/data'

export async function POST() {
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
