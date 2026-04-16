import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// PATCH — actualizar entrada de bitácora
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const { entryId } = await params
  const body = await request.json()

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
    },
  })

  return NextResponse.json(row)
}

// DELETE — eliminar entrada
export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const { entryId } = await params
  await prisma.bitacoraEntry.delete({ where: { id: entryId } })
  return NextResponse.json({ ok: true })
}
