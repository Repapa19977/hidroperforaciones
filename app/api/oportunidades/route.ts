import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET — listar oportunidades (filtra por vendedor si no es superadmin)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const vendedor = searchParams.get('vendedor')  // null = todas

  const rows = await prisma.oportunidad.findMany({
    where: vendedor ? { vendedor } : undefined,
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
