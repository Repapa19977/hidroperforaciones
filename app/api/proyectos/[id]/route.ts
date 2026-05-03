import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calcularPerforacion, type InputsPerforacion } from '@/lib/calculator'
import { requireSuperAdmin, getRequestInfo } from '@/lib/auth'
import { auditLog } from '@/lib/audit'

// GET — obtener proyecto con todas sus entradas + totales de la cotización
// (profundidadTotal, diasHabilesTotal) para la barra de avance del PDF
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

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
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

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

// DELETE — soft delete del proyecto (conserva bitácora e historial para auditoría)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const motivo = new URL(request.url).searchParams.get('motivo') ?? ''

  const before = await prisma.proyecto.findUnique({ where: { id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (before.eliminadoEn) return NextResponse.json({ error: 'Ya estaba eliminado' }, { status: 409 })

  const row = await prisma.proyecto.update({
    where: { id },
    data: { eliminadoEn: new Date(), eliminadoPor: auth.user.username, motivoBorrado: motivo || null },
  })

  const info = getRequestInfo(request)
  await auditLog({ user: auth.user, accion: 'delete', entidad: 'proyecto', entidadId: id, antes: before, despues: row, ...info })

  return NextResponse.json({ ok: true, soft: true })
}
