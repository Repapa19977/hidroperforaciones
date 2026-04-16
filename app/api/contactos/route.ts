import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const vendedor = searchParams.get('vendedor')

  const rows = await prisma.contacto.findMany({
    where: vendedor ? { vendedor } : undefined,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(rows)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const row = await prisma.contacto.create({
    data: {
      nombre:   body.nombre,
      empresa:  body.empresa  ?? '',
      telefono: body.telefono ?? '',
      email:    body.email    ?? '',
      tipo:     body.tipo     ?? 'cliente',
      pais:     body.pais     ?? 'Guatemala',
      notas:    body.notas    ?? '',
      vendedor: body.vendedor,
    },
  })

  return NextResponse.json(row)
}
