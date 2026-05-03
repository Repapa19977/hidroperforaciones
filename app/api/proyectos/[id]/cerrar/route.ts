import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth'

// POST /api/proyectos/[id]/cerrar
// Cierra un proyecto: cambia estado a "completado" y libera las reservas
// (pasan de "reservado" a "disponible" para venta externa).
// Retorna el profit del proyecto (valor monetario de reservas liberadas).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const today = new Date().toISOString().slice(0, 10)

  // Actualizar estado del proyecto
  const proyecto = await prisma.proyecto.update({
    where: { id },
    data: { estado: 'completado' },
  })

  // Liberar reservas: reservado → disponible
  const reservas = await prisma.inventarioReserva.findMany({
    where: { proyectoId: id, estado: 'reservado' },
  })

  for (const r of reservas) {
    await prisma.inventarioReserva.update({
      where: { id: r.id },
      data: { estado: 'disponible', fechaLiberacion: today },
    })
  }

  // Calcular valor total liberado (costo)
  const valorLiberado = reservas.reduce((a, r) => a + r.cantidadActual * r.costoUnitario, 0)

  return NextResponse.json({
    proyecto,
    reservasLiberadas: reservas.length,
    valorLiberado,
    mensaje: `Proyecto cerrado. ${reservas.length} reservas liberadas (${valorLiberado.toFixed(2)} Q en costo).`,
  })
}
