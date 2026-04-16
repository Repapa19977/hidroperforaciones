import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const correlativo = request.nextUrl.searchParams.get('correlativo')
  if (!correlativo) return NextResponse.json({ error: 'Missing correlativo' }, { status: 400 })

  const historial = await prisma.cotizacionHistorial.findMany({
    where: { correlativo },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(historial)
}
