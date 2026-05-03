import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireSuperAdmin, getRequestInfo } from '@/lib/auth'
import { auditLog } from '@/lib/audit'
import {
  calcularBalanceProyecto,
  calcularResumenLiquidacion,
  construirLineasLiquidacion,
  normalizarLineasLiquidacion,
  parseLineasGuardadas,
  type LiquidacionLinea,
} from '@/lib/liquidacion-proyecto'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const lineaSchema = z.object({
  key: z.string().min(1),
  nombre: z.string().min(1),
  unidad: z.string().min(1),
  cantidadCotizada: z.number().nonnegative().default(0),
  cantidad: z.number().nonnegative().default(0),
  precioUnitario: z.number().nonnegative().default(0),
  total: z.number().default(0),
  incluido: z.boolean().default(false),
  obligatoria: z.boolean().default(false),
  editableCantidad: z.boolean().default(true),
  editablePrecio: z.boolean().default(true),
  origen: z.enum(['fijo', 'bitacora', 'cotizacion', 'extra']).default('cotizacion'),
})

const inputSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  motivo: z.string().max(1000).optional().default(''),
  lineas: z.array(lineaSchema).optional().default([]),
})

async function cargarContexto(id: string) {
  const proyecto = await prisma.proyecto.findUnique({
    where: { id },
    include: {
      entradas: {
        orderBy: [{ fecha: 'asc' }, { turno: 'asc' }],
      },
    },
  })
  if (!proyecto) return null

  const [cotizacion, pagos, gastos, liquidacion] = await Promise.all([
    prisma.cotizacion.findUnique({ where: { correlativo: proyecto.correlativo } }),
    prisma.pago.findMany({
      where: { proyectoId: id, eliminadoEn: null },
      orderBy: { fecha: 'asc' },
    }),
    prisma.gastoExtra.findMany({
      where: { proyectoId: id },
      orderBy: { fecha: 'desc' },
    }),
    prisma.proyectoLiquidacion.findUnique({
      where: { proyectoId: id },
    }),
  ])

  return { proyecto, cotizacion, pagos, gastos, liquidacion }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function responder(ctx: NonNullable<Awaited<ReturnType<typeof cargarContexto>>>, lineas: LiquidacionLinea[]) {
  const resumen = calcularResumenLiquidacion({
    lineas,
    pagos: ctx.pagos,
    gastos: ctx.gastos,
    montoCotizacion: ctx.proyecto.monto,
    bitacora: ctx.proyecto.entradas,
  })
  const balance = calcularBalanceProyecto({
    cotizacionDatos: ctx.cotizacion?.datos,
    montoCotizacion: ctx.proyecto.monto,
    pagos: ctx.pagos,
    bitacora: ctx.proyecto.entradas,
    lineas,
  })

  return NextResponse.json({
    proyecto: {
      id: ctx.proyecto.id,
      correlativo: ctx.proyecto.correlativo,
      cliente: ctx.proyecto.cliente,
      empresa: ctx.proyecto.empresa,
      nombre: ctx.proyecto.nombre,
      tipo: ctx.proyecto.tipo,
      monto: ctx.proyecto.monto,
      estado: ctx.proyecto.estado,
      vendedor: ctx.proyecto.vendedor,
    },
    liquidacion: ctx.liquidacion ? {
      id: ctx.liquidacion.id,
      estado: ctx.liquidacion.estado,
      fecha: ctx.liquidacion.fecha,
      motivo: ctx.liquidacion.motivo,
      creadoPor: ctx.liquidacion.creadoPor,
      actualizadoPor: ctx.liquidacion.actualizadoPor,
      confirmadoPor: ctx.liquidacion.confirmadoPor,
      confirmadoEn: ctx.liquidacion.confirmadoEn,
      createdAt: ctx.liquidacion.createdAt,
      updatedAt: ctx.liquidacion.updatedAt,
    } : null,
    lineas,
    resumen,
    balance,
    fuentes: {
      pagos: ctx.pagos.length,
      gastos: ctx.gastos.length,
      entradasBitacora: ctx.proyecto.entradas.length,
      tieneCotizacion: Boolean(ctx.cotizacion),
    },
  })
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await cargarContexto(id)
  if (!ctx) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  const guardadas = parseLineasGuardadas(ctx.liquidacion?.lineas)
  const lineas = guardadas.length > 0
    ? guardadas
    : construirLineasLiquidacion({
        cotizacionDatos: ctx.cotizacion?.datos,
        bitacora: ctx.proyecto.entradas,
      })

  return responder(ctx, lineas)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const ctx = await cargarContexto(id)
  if (!ctx) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
  if (ctx.liquidacion?.estado === 'confirmada') {
    return NextResponse.json({ error: 'La liquidacion ya fue confirmada y no se puede editar.' }, { status: 409 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = inputSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({
      error: 'Datos invalidos',
      detalles: parsed.error.issues.map(i => ({ campo: i.path.join('.'), mensaje: i.message })),
    }, { status: 400 })
  }

  const data = parsed.data
  const lineas = normalizarLineasLiquidacion(data.lineas)
  const resumen = calcularResumenLiquidacion({
    lineas,
    pagos: ctx.pagos,
    gastos: ctx.gastos,
    montoCotizacion: ctx.proyecto.monto,
    bitacora: ctx.proyecto.entradas,
  })

  await prisma.proyectoLiquidacion.upsert({
    where: { proyectoId: id },
    create: {
      proyectoId: id,
      proyectoCorrelativo: ctx.proyecto.correlativo,
      estado: 'borrador',
      fecha: data.fecha ?? todayIso(),
      motivo: data.motivo,
      lineas: JSON.stringify(lineas),
      resumen: JSON.stringify(resumen),
      creadoPor: auth.user.username,
      actualizadoPor: auth.user.username,
    },
    update: {
      estado: 'borrador',
      fecha: data.fecha ?? todayIso(),
      motivo: data.motivo,
      lineas: JSON.stringify(lineas),
      resumen: JSON.stringify(resumen),
      actualizadoPor: auth.user.username,
    },
  })

  const updatedCtx = await cargarContexto(id)
  return responder(updatedCtx ?? ctx, lineas)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const ctx = await cargarContexto(id)
  if (!ctx) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  const raw = await request.json().catch(() => null)
  const parsed = inputSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({
      error: 'Datos invalidos',
      detalles: parsed.error.issues.map(i => ({ campo: i.path.join('.'), mensaje: i.message })),
    }, { status: 400 })
  }

  const data = parsed.data
  const lineasInput = data.lineas.length > 0
    ? data.lineas
    : parseLineasGuardadas(ctx.liquidacion?.lineas)
  const lineas = normalizarLineasLiquidacion(lineasInput)
  const resumen = calcularResumenLiquidacion({
    lineas,
    pagos: ctx.pagos,
    gastos: ctx.gastos,
    montoCotizacion: ctx.proyecto.monto,
    bitacora: ctx.proyecto.entradas,
  })
  const fecha = data.fecha ?? todayIso()

  const before = {
    proyecto: ctx.proyecto,
    liquidacion: ctx.liquidacion,
  }

  await prisma.$transaction(async tx => {
    await tx.proyectoLiquidacion.upsert({
      where: { proyectoId: id },
      create: {
        proyectoId: id,
        proyectoCorrelativo: ctx.proyecto.correlativo,
        estado: 'confirmada',
        fecha,
        motivo: data.motivo,
        lineas: JSON.stringify(lineas),
        resumen: JSON.stringify(resumen),
        creadoPor: auth.user.username,
        actualizadoPor: auth.user.username,
        confirmadoPor: auth.user.username,
        confirmadoEn: new Date(),
      },
      update: {
        estado: 'confirmada',
        fecha,
        motivo: data.motivo,
        lineas: JSON.stringify(lineas),
        resumen: JSON.stringify(resumen),
        actualizadoPor: auth.user.username,
        confirmadoPor: auth.user.username,
        confirmadoEn: new Date(),
      },
    })

    await tx.proyecto.update({
      where: { id },
      data: { estado: 'cancelado' },
    })

    await tx.inventarioReserva.updateMany({
      where: { proyectoId: id, estado: 'reservado' },
      data: { estado: 'disponible', fechaLiberacion: fecha },
    })
  })

  const updatedCtx = await cargarContexto(id)
  const info = getRequestInfo(request)
  await auditLog({
    user: auth.user,
    accion: 'cancel',
    entidad: 'proyecto',
    entidadId: id,
    antes: before,
    despues: { proyectoEstado: 'cancelado', liquidacion: updatedCtx?.liquidacion, resumen },
    ...info,
  })

  return responder(updatedCtx ?? ctx, lineas)
}
