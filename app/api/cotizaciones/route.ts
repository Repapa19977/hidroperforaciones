import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { contactoDuplicateLockKey, findContactoDuplicate } from '@/lib/contactos-dedup'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Lee del JWT el rol y nombre del vendedor. Si el rol es admin, usamos ese
// nombre para forzar la propiedad de la cotización (admin NO puede asignar
// a otro vendedor aunque lo intente desde el body).
// GET - listar todas activas (filtra eliminadas por default).
// Query params: ?vendedor=X / ?papelera=1 (solo eliminadas)
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const vendedor = auth.user.role === 'admin'
    ? auth.user.vendedor
    : searchParams.get('vendedor')
  const papelera = searchParams.get('papelera') === '1'

  const where: Record<string, unknown> = {
    eliminadaEn: papelera ? { not: null } : null,
  }
  if (vendedor) where.vendedor = vendedor

  const rows = await prisma.cotizacion.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(rows)
}

// POST - crear o actualizar cotización (y auto-upsert contacto si hay teléfono)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response

  const body = await request.json()
  const { correlativo, cliente, empresa, proyecto, tipo, estado, monto, fecha, datos } = body
  let contactoId: string | null = body.contactoId ?? null

  // ── Regla de edición: solo cotizaciones EN BORRADOR son editables ──
  // Si ya existe una cotización con ese correlativo y su estado actual NO es
  // borrador (enviada/confirmada/cancelada), rechazar cualquier edición.
  // Aplica tanto a admin como superadmin. Para modificar hay que crear una
  // cotización nueva con otro correlativo.
  const existente = await prisma.cotizacion.findUnique({
    where: { correlativo },
    select: { estado: true, eliminadaEn: true, vendedor: true },
  })
  if (existente && auth.user.role === 'admin' && existente.vendedor !== auth.user.vendedor) {
    return NextResponse.json({ error: 'No autorizado para editar esta cotizacion' }, { status: 403 })
  }
  if (existente && existente.eliminadaEn === null && existente.estado !== 'borrador') {
    return NextResponse.json({
      error: `Esta cotización está "${existente.estado}" y no se puede editar. Creá una nueva si necesitás cambiar algo.`,
      bloqueada: true,
      estadoActual: existente.estado,
    }, { status: 409 })
  }

  // Enforcement de ownership: si el caller es admin, el vendedor SIEMPRE es
  // él mismo (desde el JWT), ignorando lo que venga en el body. Si es superadmin,
  // puede asignar a cualquier vendedor del body (default: su propio nombre).
  let vendedor: string = body.vendedor ?? ''
  if (auth.user.role === 'admin') {
    vendedor = auth.user.vendedor ?? ''  // forzado, admin no puede reasignar
  } else if (auth.user.role === 'superadmin' && !vendedor) {
    vendedor = auth.user.vendedor ?? ''  // default al propio si no se especifico
  }

  // Auto-upsert contacto si el cliente tiene teléfono registrado (ignora contactos eliminados).
  // Si no llegó contactoId explícito, intentamos resolverlo por nombre+vendedor (fallback).
  // Los campos depto/municipio/proyectoNombre vienen del cotizador y enriquecen el contacto.
  const telefono:       string = (typeof datos === 'object' ? datos?.telefono ?? '' : '') as string
  const email:          string = (typeof datos === 'object' ? datos?.email ?? ''    : '') as string
  const departamento:   string = (typeof datos === 'object' ? datos?.departamento ?? '' : '') as string
  const municipio:      string = (typeof datos === 'object' ? datos?.municipio ?? ''    : '') as string
  const proyectoNombre: string = (typeof datos === 'object' ? datos?.proyecto ?? proyecto ?? '' : proyecto ?? '') as string
  if (cliente && telefono) {
    const contactoAutoId = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${contactoDuplicateLockKey({ nombre: cliente })})::bigint)`

      const candidatos = await tx.contacto.findMany({
        where: { eliminadoEn: null },
        select: {
          id: true, nombre: true, empresa: true, telefono: true, email: true,
          vendedor: true, createdAt: true, departamento: true, municipio: true, proyectoNombre: true,
        },
      })
      const existing = findContactoDuplicate({ nombre: cliente, empresa, telefono, email }, candidatos)
      if (existing) {
        // Completamos campos vacios con lo que venga del cotizador, sin pisar datos ya capturados.
        const parche: Record<string, string> = {}
        if (!existing.telefono     && telefono)       parche.telefono       = telefono
        if (!existing.email        && email)          parche.email          = email
        if (!existing.empresa      && empresa)        parche.empresa        = empresa
        if (!existing.departamento && departamento)   parche.departamento   = departamento
        if (!existing.municipio    && municipio)      parche.municipio      = municipio
        if (!existing.proyectoNombre && proyectoNombre) parche.proyectoNombre = proyectoNombre
        if (Object.keys(parche).length > 0) {
          await tx.contacto.update({ where: { id: existing.id }, data: parche })
        }
        return existing.id
      }

      const nuevo = await tx.contacto.create({
        data: {
          nombre: cliente,
          empresa: empresa ?? '',
          telefono,
          email,
          departamento,
          municipio,
          proyectoNombre,
          vendedor,
        },
      })
      return nuevo.id
    })
    if (!contactoId) contactoId = contactoAutoId
  }

  // Último fallback: si no hay contactoId aún, intentar match por nombre solo (case-insensitive)
  if (!contactoId && cliente) {
    const found = await prisma.contacto.findFirst({
      where: {
        nombre: { equals: cliente, mode: 'insensitive' },
        eliminadoEn: null,
      },
      select: { id: true },
    })
    if (found) contactoId = found.id
  }

  const dataRow = {
    cliente,
    empresa: empresa ?? '',
    proyecto,
    tipo,
    estado: estado ?? 'borrador',
    monto,
    fecha,
    vendedor,
    datos: JSON.stringify(datos ?? {}),
    contactoId,
  }

  let row
  try {
    row = existente
      ? await prisma.cotizacion.update({
          where: { correlativo },
          data: dataRow,
        })
      : await prisma.cotizacion.create({
          data: { correlativo, ...dataRow },
        })
  } catch (e: unknown) {
    if (typeof e === 'object' && e && 'code' in e && (e as { code?: string }).code === 'P2002') {
      return NextResponse.json({
        error: 'Ese correlativo ya fue usado por otra cotización. Generá uno nuevo para evitar duplicados.',
      }, { status: 409 })
    }
    throw e
  }

  return NextResponse.json(row)
}
