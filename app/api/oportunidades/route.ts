import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET — listar oportunidades (filtra por vendedor si no es superadmin).
// Query: ?vendedor=X · ?papelera=1 (solo eliminadas)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const vendedor = searchParams.get('vendedor')
  const papelera = searchParams.get('papelera') === '1'

  const where: Record<string, unknown> = { eliminadaEn: papelera ? { not: null } : null }
  if (vendedor) where.vendedor = vendedor

  const rows = await prisma.oportunidad.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(rows)
}

// POST — crear oportunidad
export async function POST(request: NextRequest) {
  const body = await request.json()

  const row = await prisma.oportunidad.upsert({
    where: { correlativo: body.correlativo },
    update: body,
    create: {
      correlativo: body.correlativo,
      cliente:     body.cliente,
      empresa:     body.empresa ?? '',
      monto:       body.monto,
      etapa:       body.etapa,
      vendedor:    body.vendedor,
      avatar:      body.avatar ?? '',
      fecha:       body.fecha,
      tipo:        body.tipo,
      profundidad: body.profundidad ?? null,
      proyecto:    body.proyecto ?? '',
      diasSinActividad: body.diasSinActividad ?? 0,
    },
  })

  return NextResponse.json(row)
}
