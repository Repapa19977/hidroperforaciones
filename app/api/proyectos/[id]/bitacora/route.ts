import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { bitacoraEntrySchema, formatZodError } from '@/lib/validators'

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
  const raw = await request.json().catch(() => null)
  const parsed = bitacoraEntrySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(formatZodError(parsed.error), { status: 400 })
  }
  const data = parsed.data

  const proyecto = await prisma.proyecto.findUnique({ where: { id } })
  if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  const row = await prisma.bitacoraEntry.create({
    data: {
      proyectoId: id,
      fecha: data.fecha,
      turno: data.turno,
      estado: data.estado,
      tipo: data.tipo ?? proyecto.tipo,
      perforacionDia: data.perforacionDia,
      ampliacion1Dia: data.ampliacion1Dia,
      ampliacion2Dia: data.ampliacion2Dia,
      rehabilitacionDia: data.rehabilitacionDia,
      perforacionTotal: data.perforacionTotal,
      ampliacion1Total: data.ampliacion1Total,
      ampliacion2Total: data.ampliacion2Total,
      rehabilitacionTotal: data.rehabilitacionTotal,
      horasPerforacion: data.horasPerforacion,
      bentonitaSacos: data.bentonitaSacos,
      pipas: data.pipas,
      horasLimpieza: data.horasLimpieza,
      horasAforo: data.horasAforo,
      diaAdverso: data.diaAdverso,
      notaInterna: data.notaInterna,
      notaCliente: data.notaCliente,
      formacionGeologica: data.formacionGeologica,
      circulacionPct: data.circulacionPct,
    },
  })

  return NextResponse.json(row, { status: 201 })
}
