// Detalle de un proyecto para el cliente final. Scope estricto:
// solo si el proyecto pertenece al contacto del cliente autenticado y es visibleParaCliente.
// Incluye: bitácoras (solo notaCliente), plan de pagos, avance, alertas amigables.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request)
  if (!user || user.role !== 'cliente_final' || !user.contactoId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { id } = await params

  const proyecto = await prisma.proyecto.findUnique({
    where: { id },
    select: {
      id: true, correlativo: true, nombre: true, tipo: true, estado: true,
      fechaInicio: true, monto: true, vendedor: true,
      contactoId: true, visibleParaCliente: true, eliminadoEn: true,
    },
  })

  if (!proyecto) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  // Validación scope: el proyecto debe pertenecer al cliente
  if (proyecto.contactoId !== user.contactoId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  if (proyecto.eliminadoEn || !proyecto.visibleParaCliente) {
    return NextResponse.json({ error: 'Proyecto no disponible' }, { status: 404 })
  }

  // Bitácora — SOLO notaCliente (la notaInterna jamás se expone)
  const bitacoras = await prisma.bitacoraEntry.findMany({
    where: { proyectoId: id },
    select: {
      id: true, fecha: true, turno: true,
      perforacionDia: true, perforacionTotal: true,
      notaCliente: true, diaAdverso: true, diaActivo: true,
    },
    orderBy: { fecha: 'desc' },
  })

  // Pagos recibidos + hitos del plan
  const pagos = await prisma.pago.findMany({
    where: { proyectoId: id, eliminadoEn: null },
    select: { id: true, fecha: true, monto: true, metodo: true, hitoId: true, hitoLabel: true },
    orderBy: { fecha: 'asc' },
  })
  const totalRecibido = pagos.reduce((a, p) => a + p.monto, 0)
  const pendiente = Math.max(0, proyecto.monto - totalRecibido)

  // Plan de pagos (priorizar override del proyecto)
  let planPagos: Array<{ id: string; label: string; pct: number }> = []
  const proyectoFull = await prisma.proyecto.findUnique({ where: { id }, select: { planPagos: true } })
  if (proyectoFull?.planPagos) {
    try { planPagos = JSON.parse(proyectoFull.planPagos) } catch {}
  }
  if (planPagos.length === 0) {
    const cot = await prisma.cotizacion.findUnique({ where: { correlativo: proyecto.correlativo }, select: { datos: true } })
    try {
      if (cot?.datos) {
        const d = typeof cot.datos === 'string' ? JSON.parse(cot.datos) : cot.datos
        if (Array.isArray(d.planPagos)) planPagos = d.planPagos
      }
    } catch {}
  }

  // Datos contratados desde cotización (para avance)
  let profundidadTotal = 0
  try {
    const cot = await prisma.cotizacion.findUnique({ where: { correlativo: proyecto.correlativo }, select: { datos: true } })
    if (cot?.datos) {
      const d = typeof cot.datos === 'string' ? JSON.parse(cot.datos) : cot.datos
      profundidadTotal = d.ip?.profundidad ?? 0
    }
  } catch {}

  const piesAcumulados = bitacoras[0]?.perforacionTotal ?? 0
  const pctAvance = profundidadTotal > 0 ? (piesAcumulados / profundidadTotal) * 100 : 0

  return NextResponse.json({
    proyecto: {
      id: proyecto.id,
      correlativo: proyecto.correlativo,
      nombre: proyecto.nombre,
      tipo: proyecto.tipo,
      estado: proyecto.estado,
      fechaInicio: proyecto.fechaInicio,
      vendedor: proyecto.vendedor,
    },
    avance: {
      profundidadTotal,
      piesAcumulados,
      pctAvance,
      ultimaBitacora: bitacoras[0]?.fecha ?? null,
    },
    pagos: {
      totalProyecto: proyecto.monto,
      recibido: totalRecibido,
      pendiente,
      pctCobrado: proyecto.monto > 0 ? (totalRecibido / proyecto.monto) * 100 : 0,
      historial: pagos,
      planPagos,
    },
    bitacora: bitacoras.filter(b => b.notaCliente || b.perforacionDia > 0),  // filtrar entradas sin contenido para el cliente
  })
}
