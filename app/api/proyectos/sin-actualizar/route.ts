import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { canListProjects } from '@/lib/proyectos-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET — proyectos activos que NO tienen entrada de bitácora hoy
// Opcional: filtrar por vendedor para que el admin solo vea los suyos
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response
  if (!canListProjects(auth.user)) {
    return NextResponse.json({ error: 'No autorizado para ver proyectos' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const vendedor = auth.user.role === 'superadmin' ? searchParams.get('vendedor') : null

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
