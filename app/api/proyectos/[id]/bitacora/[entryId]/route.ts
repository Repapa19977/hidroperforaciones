import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { reconciliarReservaBentonitaProyecto } from '@/lib/inventario-bentonita'
import { canWriteProyectoBitacora } from '@/lib/proyectos-auth'
import { canDeleteBitacora } from '@/lib/roles'

// PATCH — actualizar entrada de bitácora
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response

  const { id, entryId } = await params
  const body = await request.json()
  const entry = await prisma.bitacoraEntry.findUnique({
    where: { id: entryId },
    select: {
      proyectoId: true,
      proyecto: { select: { vendedor: true, estado: true, eliminadoEn: true } },
    },
  })
  if (!entry || entry.proyectoId !== id) {
    return NextResponse.json({ error: 'Entrada no encontrada' }, { status: 404 })
  }
  if (!canWriteProyectoBitacora(auth.user, entry.proyecto)) {
    return NextResponse.json({ error: 'No autorizado para editar esta bitacora' }, { status: 403 })
  }

  const row = await prisma.bitacoraEntry.update({
    where: { id: entryId },
    data: {
      ...(body.fecha !== undefined ? { fecha: body.fecha } : {}),
      ...(body.turno !== undefined ? { turno: body.turno } : {}),
      ...(body.estado !== undefined ? { estado: body.estado } : {}),
      ...(body.perforacionDia !== undefined ? { perforacionDia: body.perforacionDia } : {}),
      ...(body.ampliacion1Dia !== undefined ? { ampliacion1Dia: body.ampliacion1Dia } : {}),
      ...(body.ampliacion2Dia !== undefined ? { ampliacion2Dia: body.ampliacion2Dia } : {}),
      ...(body.rehabilitacionDia !== undefined ? { rehabilitacionDia: body.rehabilitacionDia } : {}),
      ...(body.perforacionTotal !== undefined ? { perforacionTotal: body.perforacionTotal } : {}),
      ...(body.ampliacion1Total !== undefined ? { ampliacion1Total: body.ampliacion1Total } : {}),
      ...(body.ampliacion2Total !== undefined ? { ampliacion2Total: body.ampliacion2Total } : {}),
      ...(body.rehabilitacionTotal !== undefined ? { rehabilitacionTotal: body.rehabilitacionTotal } : {}),
      ...(body.horasPerforacion !== undefined ? { horasPerforacion: body.horasPerforacion } : {}),
      ...(body.bentonitaSacos !== undefined ? { bentonitaSacos: body.bentonitaSacos } : {}),
      ...(body.pipas !== undefined ? { pipas: body.pipas } : {}),
      ...(body.horasLimpieza !== undefined ? { horasLimpieza: body.horasLimpieza } : {}),
      ...(body.horasAforo !== undefined ? { horasAforo: body.horasAforo } : {}),
      ...(body.diaAdverso !== undefined ? { diaAdverso: body.diaAdverso } : {}),
      ...(body.notaInterna !== undefined ? { notaInterna: body.notaInterna } : {}),
      ...(body.notaCliente !== undefined ? { notaCliente: body.notaCliente } : {}),
      ...(body.formacionGeologica !== undefined ? { formacionGeologica: body.formacionGeologica } : {}),
      ...(body.circulacionPct !== undefined ? { circulacionPct: body.circulacionPct } : {}),
    },
  })

  try {
    await reconciliarReservaBentonitaProyecto(id)
  } catch { /* no bloqueante */ }

  return NextResponse.json(row)
}

// DELETE — eliminar entrada
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response
  if (!canDeleteBitacora(auth.user.role)) {
    return NextResponse.json({ error: 'Solo superadmin puede eliminar entradas de bitacora' }, { status: 403 })
  }

  const { id, entryId } = await params
  const entry = await prisma.bitacoraEntry.findUnique({
    where: { id: entryId },
    select: { proyectoId: true },
  })
  if (!entry || entry.proyectoId !== id) {
    return NextResponse.json({ error: 'Entrada no encontrada' }, { status: 404 })
  }
  await prisma.bitacoraEntry.delete({ where: { id: entryId } })
  try {
    await reconciliarReservaBentonitaProyecto(id)
  } catch { /* no bloqueante */ }
  return NextResponse.json({ ok: true })
}
