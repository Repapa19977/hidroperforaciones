import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, requireSuperAdmin, getRequestInfo } from '@/lib/auth'
import { auditLog } from '@/lib/audit'

import {
  contactoDuplicateLockKey,
  contactoDuplicateMessage,
  findContactoDuplicate,
  normContactoText,
} from '@/lib/contactos-dedup'

// Normaliza: lowercase, trim, sin tildes — Postgres ILIKE no ignora diacríticos.
// GET /api/contactos/[id] → contacto + su expediente (cotizaciones y proyectos relacionados)
// Match: 1) contactoId si está seteado (FK), 2) fallback por nombre/empresa (backwards compat).
// Filtra soft-deleted por default (excepto si ?incluirEliminados=1).
const normalizeTipoPersona = (value: unknown, empresa = '') =>
  value === 'empresa' || (!value && empresa.trim()) ? 'empresa' : 'individual'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const incluirEliminados = new URL(request.url).searchParams.get('incluirEliminados') === '1'

  const contacto = await prisma.contacto.findUnique({ where: { id } })
  if (!contacto) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (auth.user.role === 'admin' && contacto.vendedor !== auth.user.vendedor) {
    return NextResponse.json({ error: 'No autorizado para este contacto' }, { status: 403 })
  }

  // Dos estrategias combinadas via OR:
  //   1) contactoId === contacto.id (FK real, futuro)
  //   2) match case-insensitive por cliente y/o empresa (backwards compat hasta backfill)
  const nombreNorm = contacto.nombre.trim()
  const empresaNorm = contacto.empresa.trim()
  const matchOR: Array<Record<string, unknown>> = [{ contactoId: id }]
  if (nombreNorm) matchOR.push({ cliente: { equals: nombreNorm, mode: 'insensitive' } })
  if (empresaNorm) matchOR.push({ empresa: { equals: empresaNorm, mode: 'insensitive' } })

  const ownerFilter = auth.user.role === 'admin' ? { vendedor: auth.user.vendedor } : {}
  const whereCommon = { OR: matchOR, ...(incluirEliminados ? {} : { eliminadaEn: null }), ...ownerFilter }
  const whereCommonProy = { OR: matchOR, ...(incluirEliminados ? {} : { eliminadoEn: null }), ...ownerFilter }

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
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await request.json()
  const before = await prisma.contacto.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (auth.user.role === 'admin' && before.vendedor !== auth.user.vendedor) {
    return NextResponse.json({ error: 'No autorizado para este contacto' }, { status: 403 })
  }

  const nombre  = (body.nombre  ?? '').trim()
  const empresa = (body.empresa ?? '').trim()
  const telefono = (body.telefono ?? '').trim()
  const email = (body.email ?? '').trim()
  const tipoPersona = normalizeTipoPersona(body.tipoPersona, empresa)

  const result = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${contactoDuplicateLockKey({ nombre })})::bigint)`

    if (normContactoText(nombre) !== normContactoText(before.nombre)) {
      const otros = await tx.contacto.findMany({
        where: { id: { not: id }, eliminadoEn: null },
        select: { id: true, nombre: true, empresa: true, telefono: true, email: true, vendedor: true, createdAt: true },
      })
      const duplicate = findContactoDuplicate({ nombre, empresa, telefono, email }, otros)
      if (duplicate) return { duplicate, row: null }
    }

    const row = await tx.contacto.update({
      where: { id },
      data: {
        nombre,
        alias:        body.alias ?? '',
        empresa,
        telefono,
        email,
        tipo:         body.tipo,
        tipoPersona,
        pais:         body.pais,
        departamento: body.departamento ?? '',
        municipio:    body.municipio    ?? '',
        proyectoNombre: body.proyectoNombre ?? '',
        notas:        body.notas,
      },
    })
    return { duplicate: null, row }
  })

  if (result.duplicate) {
    return NextResponse.json({
      error: contactoDuplicateMessage(result.duplicate),
      duplicate: result.duplicate,
    }, { status: 409 })
  }

  const row = result.row
  if (!row) return NextResponse.json({ error: 'No se pudo actualizar el contacto.' }, { status: 500 })

  const info = getRequestInfo(request)
  await auditLog({ user: auth.user, accion: 'update', entidad: 'contacto', entidadId: id, antes: before, despues: row, ...info })

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
