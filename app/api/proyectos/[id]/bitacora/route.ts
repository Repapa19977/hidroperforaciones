import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { bitacoraEntrySchema, formatZodError } from '@/lib/validators'
import { requireAuth } from '@/lib/auth'
import { reconciliarReservaBentonitaProyecto } from '@/lib/inventario-bentonita'
import { canAccessProyecto, canWriteProyectoBitacora } from '@/lib/proyectos-auth'

// GET - listar entradas de bitacora de un proyecto
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const proyecto = await prisma.proyecto.findUnique({
    where: { id },
    select: { vendedor: true, estado: true, eliminadoEn: true },
  })
  if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
  if (!canAccessProyecto(auth.user, proyecto)) {
    return NextResponse.json({ error: 'No autorizado para este proyecto' }, { status: 403 })
  }

  const rows = await prisma.bitacoraEntry.findMany({
    where: { proyectoId: id },
    orderBy: [{ fecha: 'asc' }, { turno: 'asc' }],
  })
  return NextResponse.json(rows)
}

// POST - agregar nueva entrada de bitacora
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const raw = await request.json().catch(() => null)
  const parsed = bitacoraEntrySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(formatZodError(parsed.error), { status: 400 })
  }
  const data = parsed.data

  const proyecto = await prisma.proyecto.findUnique({ where: { id } })
  if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
  if (!canWriteProyectoBitacora(auth.user, proyecto)) {
    return NextResponse.json({ error: 'No autorizado para llenar esta bitacora' }, { status: 403 })
  }

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

  // La reserva 30% se recalcula contra la bitacora completa. Primero se consume
  // el tramo cubierto por el cliente; solo el excedente descuenta inventario.
  try {
    await reconciliarReservaBentonitaProyecto(id)
  } catch { /* no bloqueante */ }

  return NextResponse.json(row, { status: 201 })
}
