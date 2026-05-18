import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { canAccessCotizacion } from '@/lib/cotizaciones-auth'

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response

  const correlativo = request.nextUrl.searchParams.get('correlativo')
  if (!correlativo) return NextResponse.json({ error: 'Missing correlativo' }, { status: 400 })

  const cotizacion = await prisma.cotizacion.findUnique({
    where: { correlativo },
    select: { vendedor: true, datos: true },
  })
  if (cotizacion && !canAccessCotizacion(auth.user, cotizacion)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const historial = await prisma.cotizacionHistorial.findMany({
    where: { correlativo },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(historial)
}
