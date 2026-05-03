import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getRequestInfo, requireAuth } from '@/lib/auth'
import { auditLog } from '@/lib/audit'

// GET — listar oportunidades (filtra por vendedor si no es superadmin).
// Query: ?vendedor=X · ?papelera=1 (solo eliminadas)
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const vendedor = auth.user.role === 'admin'
    ? auth.user.vendedor
    : searchParams.get('vendedor')
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
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response

  const body = await request.json()
  const vendedor = auth.user.role === 'admin'
    ? auth.user.vendedor ?? ''
    : body.vendedor

  if (!body.correlativo) {
    return NextResponse.json({ error: 'Correlativo requerido' }, { status: 400 })
  }

  const existente = await prisma.oportunidad.findUnique({ where: { correlativo: body.correlativo } })
  if (existente && auth.user.role === 'admin' && existente.vendedor !== auth.user.vendedor) {
    return NextResponse.json({ error: 'No autorizado para editar esta oportunidad' }, { status: 403 })
  }

  const row = await prisma.oportunidad.upsert({
    where: { correlativo: body.correlativo },
    update: { ...body, vendedor },
    create: {
      correlativo: body.correlativo,
      cliente:     body.cliente,
      empresa:     body.empresa ?? '',
      monto:       body.monto,
      etapa:       body.etapa,
      vendedor,
      avatar:      body.avatar ?? '',
      fecha:       body.fecha,
      tipo:        body.tipo,
      profundidad: body.profundidad ?? null,
      proyecto:    body.proyecto ?? '',
      diasSinActividad: body.diasSinActividad ?? 0,
    },
  })

  await auditLog({
    user: auth.user,
    accion: existente ? 'update' : 'create',
    entidad: 'oportunidad',
    entidadId: row.id,
    antes: existente,
    despues: row,
    ...getRequestInfo(request),
  })

  return NextResponse.json(row)
}
