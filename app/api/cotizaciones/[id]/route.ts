import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sacosDebentonita } from '@/lib/calculator'
import { patchCotizacionSchema, formatZodError } from '@/lib/validators'

// GET — obtener cotización con datos completos (para re-abrir/imprimir)
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const row = await prisma.cotizacion.findUnique({ where: { correlativo: id } })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}

// PATCH — cambiar estado (y auto-crear Proyecto al confirmar)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const raw = await request.json().catch(() => null)
  const parsed = patchCotizacionSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(formatZodError(parsed.error), { status: 400 })
  }
  const { estado, usuario } = parsed.data

  const before = await prisma.cotizacion.findUnique({ where: { correlativo: id } })

  const row = await prisma.cotizacion.update({
    where: { correlativo: id },
    data: { estado },
  })

  // Log change history
  if (before && before.estado !== estado) {
    await prisma.cotizacionHistorial.create({
      data: {
        correlativo: id,
        campo: 'estado',
        valorAntes: before.estado,
        valorDespues: estado,
        usuario: usuario ?? '',
      },
    })
  }

  // Auto-crear Proyecto cuando se confirma la cotización
  let proyectoCreado: { id: string; correlativo: string } | null = null
  if (estado === 'confirmada') {
    const existing = await prisma.proyecto.findUnique({ where: { correlativo: id } })
    if (!existing) {
      const today = new Date().toISOString().slice(0, 10)
      const nuevo = await prisma.proyecto.create({
        data: {
          correlativo: id,
          cotizacionId: row.id,
          cliente: row.cliente,
          empresa: row.empresa,
          nombre: row.proyecto,
          tipo: row.tipo,
          monto: row.monto,
          vendedor: row.vendedor,
          fechaInicio: today,
        },
      })
      proyectoCreado = { id: nuevo.id, correlativo: nuevo.correlativo }
    } else {
      proyectoCreado = { id: existing.id, correlativo: existing.correlativo }
    }

    // ── Crear InventarioReserva automáticamente (Fase A+B: bentonita split 70/30) ──
    try {
      const datos = JSON.parse(row.datos || '{}')
      const ip = datos.ip
      if (ip && ip.tipo !== 'limpieza' && proyectoCreado) {
        // Bentonita — calcular sacos de reserva (30% por default)
        // Usa la tabla oficial de calculator.ts para evitar divergencias si la tabla cambia.
        const pctEntrega = ip.pctEntregaBentonita ?? 0.70
        const sacosTotal = sacosDebentonita(ip.diametro, ip.profundidad ?? 0)
        const sacosEntrega = Math.round(sacosTotal * pctEntrega)
        const sacosReserva = Math.max(0, sacosTotal - sacosEntrega)
        if (sacosReserva > 0) {
          const existente = await prisma.inventarioReserva.findFirst({
            where: { proyectoId: proyectoCreado.id, producto: 'bentonita' },
          })
          if (!existente) {
            await prisma.inventarioReserva.create({
              data: {
                proyectoId: proyectoCreado.id,
                proyectoCorrelativo: proyectoCreado.correlativo,
                producto: 'bentonita',
                cantidadOriginal: sacosReserva,
                cantidadActual: sacosReserva,
                unidad: 'saco',
                costoUnitario: ip.precioBentonitaSaco ?? 303,
                precioVentaSugerido: 535.71,
                estado: 'reservado',
                fechaCreacion: new Date().toISOString().slice(0, 10),
                nota: `Split ${Math.round(pctEntrega * 100)}/${Math.round((1 - pctEntrega) * 100)} — reserva del proyecto ${proyectoCreado.correlativo}`,
              },
            })
          }
        }
      }
    } catch { /* No falla la confirmación si el cálculo de reserva falla */ }

    // Auto-avanzar oportunidad a "won" si existe una que coincida con este cliente/vendedor
    await prisma.oportunidad.updateMany({
      where: {
        cliente: row.cliente,
        vendedor: row.vendedor,
        etapa: { notIn: ['won', 'lost'] },
      },
      data: { etapa: 'won' },
    })
  }

  // Cuando se cancela una cotización, marcar oportunidades relacionadas como "lost"
  if (estado === 'cancelada') {
    await prisma.oportunidad.updateMany({
      where: {
        cliente: row.cliente,
        vendedor: row.vendedor,
        etapa: { notIn: ['won', 'lost'] },
      },
      data: { etapa: 'lost' },
    })
  }

  return NextResponse.json({ ...row, proyectoCreado })
}

// DELETE — eliminar
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  await prisma.cotizacion.delete({ where: { correlativo: id } })
  return NextResponse.json({ ok: true })
}
