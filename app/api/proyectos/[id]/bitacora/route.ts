import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET — listar entradas de bitácora de un proyecto
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const rows = await prisma.bitacoraEntry.findMany({
    where: { proyectoId: id },
    orderBy: [{ fecha: 'asc' }, { turno: 'asc' }],
  })
  return NextResponse.json(rows)
}

// POST — agregar nueva entrada de bitácora
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()

  const proyecto = await prisma.proyecto.findUnique({ where: { id } })
  if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  const row = await prisma.bitacoraEntry.create({
    data: {
      proyectoId: id,
      fecha: body.fecha,
      turno: body.turno ?? 'dia',
      estado: body.estado ?? '',
      tipo: body.tipo ?? proyecto.tipo,
      perforacionDia: body.perforacionDia ?? 0,
      ampliacion1Dia: body.ampliacion1Dia ?? 0,
      ampliacion2Dia: body.ampliacion2Dia ?? 0,
      rehabilitacionDia: body.rehabilitacionDia ?? 0,
      perforacionTotal: body.perforacionTotal ?? 0,
      ampliacion1Total: body.ampliacion1Total ?? 0,
      ampliacion2Total: body.ampliacion2Total ?? 0,
      rehabilitacionTotal: body.rehabilitacionTotal ?? 0,
      horasPerforacion: body.horasPerforacion ?? 0,
      bentonitaSacos: body.bentonitaSacos ?? 0,
      pipas: body.pipas ?? 0,
      horasLimpieza: body.horasLimpieza ?? 0,
      horasAforo: body.horasAforo ?? 0,
      diaAdverso: body.diaAdverso ?? false,
      notaInterna: body.notaInterna ?? '',
      notaCliente: body.notaCliente ?? '',
    },
  })

  return NextResponse.json(row, { status: 201 })
}
