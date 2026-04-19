import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSuperAdmin, getCurrentUser, getRequestInfo } from '@/lib/auth'
import { auditLog } from '@/lib/audit'

// GET /api/contactos/[id] → contacto + su expediente (cotizaciones y proyectos relacionados)
// Match: 1) contactoId si está seteado (FK), 2) fallback por nombre/empresa (backwards compat).
// Filtra soft-deleted por default (excepto si ?incluirEliminados=1).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const incluirEliminados = new URL(request.url).searchParams.get('incluirEliminados') === '1'

  const contacto = await prisma.contacto.findUnique({ where: { id } })
  if (!contacto) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Dos estrategias combinadas via OR:
  //   1) contactoId === contacto.id (FK real, futuro)
  //   2) match case-insensitive por cliente y/o empresa (backwards compat hasta backfill)
  const nombreNorm = contacto.nombre.trim()
  const empresaNorm = contacto.empresa.trim()
  const matchOR: Array<Record<string, unknown>> = [{ contactoId: id }]
  if (nombreNorm) matchOR.push({ cliente: { equals: nombreNorm, mode: 'insensitive' } })
  if (empresaNorm) matchOR.push({ empresa: { equals: empresaNorm, mode: 'insensitive' } })

  const whereCommon = { OR: matchOR, ...(incluirEliminados ? {} : { eliminadaEn: null }) }
  const whereCommonProy = { OR: matchOR, ...(incluirEliminados ? {} : { eliminadoEn: null }) }

  const [cotizaciones, proyectos, oportunidades] = await Promise.all([
    prisma.cotizacion.findMany({
      where: whereCommon,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, correlativo: true, cliente: true, empresa: true, proyecto: true,
        tipo: true, estado: true, monto: true, fecha: true, vendedor: true, createdAt: true,
        eliminadaEn: true,
      },
    }),
    prisma.proyecto.findMany({
      where: whereCommonProy,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, correlativo: true, cliente: true, empresa: true, nombre: true,
        tipo: true, estado: true, monto: true, vendedor: true, fechaInicio: true,
        eliminadoEn: true,
      },
    }),
    prisma.oportunidad.findMany({
      where: whereCommon,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, correlativo: true, cliente: true, empresa: true, monto: true,
        etapa: true, vendedor: true, fecha: true, tipo: true, eliminadaEn: true,
      },
    }),
  ])

  return NextResponse.json({ contacto, cotizaciones, proyectos, oportunidades })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const user = await getCurrentUser(request)
  const before = await prisma.contacto.findUnique({ where: { id } })

  const row = await prisma.contacto.update({
    where: { id },
    data: {
      nombre:       body.nombre,
      empresa:      body.empresa,
      telefono:     body.telefono,
      email:        body.email,
      tipo:         body.tipo,
      pais:         body.pais,
      departamento: body.departamento ?? '',
      municipio:    body.municipio    ?? '',
      notas:        body.notas,
    },
  })

  const info = getRequestInfo(request)
  await auditLog({ user, accion: 'update', entidad: 'contacto', entidadId: id, antes: before, despues: row, ...info })

  return NextResponse.json(row)
}

// DELETE — soft delete (solo superadmin). Se conserva la fila para no romper expedientes históricos.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const url = new URL(request.url)
  const motivo = url.searchParams.get('motivo') ?? ''

  const before = await prisma.contacto.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (before.eliminadoEn) return NextResponse.json({ error: 'Ya estaba eliminado' }, { status: 409 })

  const row = await prisma.contacto.update({
    where: { id },
    data: {
      eliminadoEn: new Date(),
      eliminadoPor: auth.user.username,
      motivoBorrado: motivo || null,
    },
  })

  const info = getRequestInfo(request)
  await auditLog({ user: auth.user, accion: 'delete', entidad: 'contacto', entidadId: id, antes: before, despues: row, ...info })

  return NextResponse.json({ ok: true, soft: true })
}
