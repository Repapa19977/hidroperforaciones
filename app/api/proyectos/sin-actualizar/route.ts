import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET — proyectos activos que NO tienen entrada de bitácora hoy
// Opcional: filtrar por vendedor para que el admin solo vea los suyos
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const vendedor = searchParams.get('vendedor')

  const today = new Date().toISOString().slice(0, 10) // "YYYY-MM-DD"

  const proyectosActivos = await prisma.proyecto.findMany({
    where: {
      estado: 'activo',
      eliminadoEn: null,
      ...(vendedor ? { vendedor } : {}),
    },
    include: {
      entradas: {
        where: { fecha: today },
        take: 1,
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const sinActualizar = proyectosActivos.filter(p => p.entradas.length === 0)

  return NextResponse.json(sinActualizar)
}
