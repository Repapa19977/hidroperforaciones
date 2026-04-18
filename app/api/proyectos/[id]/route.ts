import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calcularPerforacion, type InputsPerforacion } from '@/lib/calculator'

// GET — obtener proyecto con todas sus entradas + totales de la cotización
// (profundidadTotal, diasHabilesTotal) para la barra de avance del PDF
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const row = await prisma.proyecto.findUnique({
    where: { id },
    include: {
      entradas: {
        orderBy: [{ fecha: 'asc' }, { turno: 'asc' }],
      },
    },
  })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Buscar teléfono y email del cliente en Contacto
  const contacto = await prisma.contacto.findFirst({
    where: { nombre: row.cliente },
    select: { telefono: true, email: true },
  })

  // Extraer totales del proyecto desde la cotización original
  let profundidadTotal: number | null = null
  let diasHabilesTotal: number | null = null
  let bentonitaPlan: number | null = null   // sacos que el cliente pagó (entrega)
  let pipasPlan: number | null = null        // estimado por días (1 cada 3 días)
  const cotizacion = await prisma.cotizacion.findUnique({ where: { correlativo: row.correlativo } })
  if (cotizacion?.datos) {
    try {
      const d = typeof cotizacion.datos === 'string' ? JSON.parse(cotizacion.datos) : cotizacion.datos
      if (d.ip) {
        const ip = d.ip as InputsPerforacion
        const r = calcularPerforacion(ip)
        profundidadTotal = ip.profundidad
        diasHabilesTotal = r.totalDiasMaquinaria
        bentonitaPlan    = r.sacosEntregaCliente  // 70% que el cliente paga
        pipasPlan        = Math.max(1, Math.round(r.totalDiasMaquinaria / 3))
      }
    } catch { /* ignore */ }
  }

  return NextResponse.json({
    ...row,
    telefonoCliente: contacto?.telefono ?? '',
    emailCliente:    contacto?.email    ?? '',
    profundidadTotal,
    diasHabilesTotal,
    bentonitaPlan,
    pipasPlan,
  })
}

// PATCH — actualizar estado del proyecto
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()

  const row = await prisma.proyecto.update({
    where: { id },
    data: {
      ...(body.estado !== undefined ? { estado: body.estado } : {}),
      ...(body.nombre !== undefined ? { nombre: body.nombre } : {}),
    },
  })

  return NextResponse.json(row)
}

// DELETE — eliminar proyecto (y en cascada sus entradas)
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.proyecto.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
