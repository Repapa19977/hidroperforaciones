import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, requireSuperAdmin } from '@/lib/auth'
import { canListProjects } from '@/lib/proyectos-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET — listar proyectos (superadmin: todos; admin: solo los suyos).
// Query: ?vendedor=X · ?estado=Y · ?papelera=1 (solo eliminados)
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response
  if (!canListProjects(auth.user)) {
    return NextResponse.json({ error: 'No autorizado para ver proyectos' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const isSuperAdmin = auth.user.role === 'superadmin'
  const vendedor = isSuperAdmin ? searchParams.get('vendedor') : null
  const estado = isSuperAdmin ? searchParams.get('estado') : 'activo'
  const papelera = isSuperAdmin && searchParams.get('papelera') === '1'

  const rows = await prisma.proyecto.findMany({
    where: {
      eliminadoEn: papelera ? { not: null } : null,
      ...(vendedor ? { vendedor } : {}),
      ...(estado ? { estado } : {}),
    },
    include: {
      entradas: {
        orderBy: { fecha: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(rows)
}

// POST — crear proyecto manualmente (normalmente se crea automático al confirmar cotización)
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json()
  const { correlativo, cotizacionId, cliente, empresa, nombre, tipo, monto, vendedor, fechaInicio } = body

  const row = await prisma.proyecto.create({
    data: {
      correlativo,
      cotizacionId,
      cliente,
      empresa: empresa ?? '',
      nombre,
      tipo,
      monto,
      vendedor,
      fechaInicio,
    },
  })

  return NextResponse.json(row, { status: 201 })
}
