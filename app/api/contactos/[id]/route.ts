import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { prisma } from '@/lib/db'

async function isSuperAdmin(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value
  if (!token) return false
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET!))
    return payload.role === 'superadmin'
  } catch { return false }
}

// GET /api/contactos/[id] → contacto + su expediente (cotizaciones y proyectos relacionados)
// Matching: por `empresa` o `nombre` (texto en las cotizaciones/proyectos), ya que no
// hay FK todavía. Devuelve ambas listas ordenadas por fecha descendente.
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const contacto = await prisma.contacto.findUnique({ where: { id } })
  if (!contacto) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Matcheamos por nombre de cliente o empresa (case-insensitive, trim). Si algún campo
  // del contacto es vacío, no lo usamos para matchear (evita juntar cotizaciones sin relación).
  const nombreNorm  = contacto.nombre.trim()
  const empresaNorm = contacto.empresa.trim()
  const matchOR: Array<Record<string, { equals: string; mode: 'insensitive' }>> = []
  if (nombreNorm)  matchOR.push({ cliente: { equals: nombreNorm,  mode: 'insensitive' } })
  if (empresaNorm) matchOR.push({ empresa: { equals: empresaNorm, mode: 'insensitive' } })

  const [cotizaciones, proyectos] = matchOR.length > 0
    ? await Promise.all([
        prisma.cotizacion.findMany({
          where: { OR: matchOR },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, correlativo: true, cliente: true, empresa: true, proyecto: true,
            tipo: true, estado: true, monto: true, fecha: true, vendedor: true, createdAt: true,
          },
        }),
        prisma.proyecto.findMany({
          where: { OR: matchOR },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, correlativo: true, cliente: true, empresa: true, nombre: true,
            tipo: true, estado: true, monto: true, vendedor: true, fechaInicio: true,
          },
        }),
      ])
    : [[], []]

  return NextResponse.json({ contacto, cotizaciones, proyectos })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()

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

  return NextResponse.json(row)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isSuperAdmin(request)) {
    return NextResponse.json({ error: 'Solo superadmin puede eliminar contactos' }, { status: 403 })
  }
  const { id } = await params
  await prisma.contacto.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
