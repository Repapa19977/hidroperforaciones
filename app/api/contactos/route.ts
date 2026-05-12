import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import {
  contactoDuplicateLockKey,
  contactoDuplicateMessage,
  findContactoDuplicate,
} from '@/lib/contactos-dedup'

const normalizeTipoPersona = (value: unknown, empresa = '') =>
  value === 'empresa' || (!value && empresa.trim()) ? 'empresa' : 'individual'

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const vendedor = auth.user.role === 'admin'
    ? auth.user.vendedor
    : searchParams.get('vendedor')
  const papelera = searchParams.get('papelera') === '1'
  const tipoPersona = searchParams.get('tipoPersona')

  const where: Record<string, unknown> = { eliminadoEn: papelera ? { not: null } : null }
  if (vendedor) where.vendedor = vendedor
  if (tipoPersona === 'individual' || tipoPersona === 'empresa') where.tipoPersona = tipoPersona

  const rows = await prisma.contacto.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(rows)
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response

  const body = await request.json()

  const nombre = (body.nombre ?? '').trim()
  const empresa = (body.empresa ?? '').trim()
  const telefono = (body.telefono ?? '').trim()
  const email = (body.email ?? '').trim()
  const tipoPersona = normalizeTipoPersona(body.tipoPersona, empresa)

  if (!nombre) {
    return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 })
  }

  const result = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${contactoDuplicateLockKey({ nombre })})::bigint)`

    const candidatos = await tx.contacto.findMany({
      where: { eliminadoEn: null },
      select: { id: true, nombre: true, empresa: true, telefono: true, email: true, vendedor: true, createdAt: true },
    })
    const duplicate = findContactoDuplicate({ nombre, empresa, telefono, email }, candidatos)
    if (duplicate) return { duplicate, row: null }

    const row = await tx.contacto.create({
      data: {
        nombre,
        alias: body.alias ?? '',
        empresa,
        telefono,
        email,
        tipo: body.tipo ?? 'cliente',
        tipoPersona,
        pais: body.pais ?? 'Guatemala',
        departamento: body.departamento ?? '',
        municipio: body.municipio ?? '',
        proyectoNombre: body.proyectoNombre ?? '',
        notas: body.notas ?? '',
        vendedor: auth.user.role === 'admin' ? auth.user.vendedor ?? '' : body.vendedor,
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

  if (!result.row) {
    return NextResponse.json({ error: 'No se pudo crear el contacto.' }, { status: 500 })
  }

  return NextResponse.json(result.row)
}
