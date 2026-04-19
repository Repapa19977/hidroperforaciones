// Portal del cliente: devuelve SOLO la info del cliente autenticado.
// Scope estricto: el cliente solo ve sus proyectos (donde contactoId matchea).
// Jamás expone: costos internos, márgenes, otros clientes, inventario.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user || user.role !== 'cliente_final' || !user.contactoId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Contacto del cliente
  const contacto = await prisma.contacto.findUnique({
    where: { id: user.contactoId },
    select: {
      id: true, nombre: true, empresa: true, telefono: true, email: true,
      municipio: true, departamento: true, pais: true,
    },
  })
  if (!contacto) return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 })

  // Proyectos del cliente — SOLO los visibles para el cliente
  const proyectos = await prisma.proyecto.findMany({
    where: {
      contactoId: user.contactoId,
      eliminadoEn: null,
      visibleParaCliente: true,
    },
    select: {
      id: true, correlativo: true, nombre: true, tipo: true, estado: true,
      fechaInicio: true, monto: true, vendedor: true,
    },
    orderBy: { fechaInicio: 'desc' },
  })

  // Para cada proyecto, agregar avance y próximo pago pendiente
  const proyectosConData = await Promise.all(proyectos.map(async p => {
    // Avance desde bitácora (último perforacionTotal)
    const ultimaBitacora = await prisma.bitacoraEntry.findFirst({
      where: { proyectoId: p.id },
      orderBy: { fecha: 'desc' },
      select: { perforacionTotal: true, fecha: true },
    })
    // Próximo pago pendiente
    const pagosRecibidos = await prisma.pago.findMany({
      where: { proyectoId: p.id, eliminadoEn: null },
      select: { monto: true },
    })
    const totalRecibido = pagosRecibidos.reduce((a, x) => a + x.monto, 0)
    const pendiente = Math.max(0, p.monto - totalRecibido)

    return {
      ...p,
      avance: {
        piesAcumulados: ultimaBitacora?.perforacionTotal ?? 0,
        ultimaActualizacion: ultimaBitacora?.fecha ?? null,
      },
      pagos: {
        totalProyecto: p.monto,
        recibido: totalRecibido,
        pendiente,
        pctCobrado: p.monto > 0 ? (totalRecibido / p.monto) * 100 : 0,
      },
    }
  }))

  return NextResponse.json({
    contacto,
    proyectos: proyectosConData,
    totales: {
      proyectos: proyectosConData.length,
      activos: proyectosConData.filter(p => p.estado === 'activo').length,
      completados: proyectosConData.filter(p => p.estado === 'completado').length,
    },
  })
}
