// Control de pagos de un proyecto (Fase E).
// GET devuelve: pagos registrados + hitos calculados (esperado, recibido, pendiente, estado).
// POST registra un nuevo pago. Excedente sobre un hito se aplica automáticamente al siguiente.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSuperAdmin, getRequestInfo } from '@/lib/auth'
import { auditLog } from '@/lib/audit'
import { z } from 'zod'

// ── Schemas ────────────────────────────────────────────────────────────
const metodoEnum = z.enum(['cheque', 'transferencia', 'deposito', 'efectivo', 'tarjeta'])

const pagoInputSchema = z.object({
  hitoId: z.string().min(1).max(50),
  hitoLabel: z.string().max(200).optional().default(''),
  monto: z.number().positive(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha YYYY-MM-DD'),
  metodo: metodoEnum.default('transferencia'),
  banco: z.string().max(120).optional().default(''),
  referencia: z.string().max(200).optional().default(''),
  nota: z.string().max(1000).optional().default(''),
})

// ── Hito type ──────────────────────────────────────────────────────────
interface HitoCalculado {
  id: string
  label: string
  pct: number
  montoEsperado: number
  montoRecibido: number
  montoPendiente: number
  estado: 'pagado' | 'parcial' | 'pendiente' | 'excedido'
  pagos: Array<{ id: string; fecha: string; monto: number; metodo: string; banco: string; referencia: string }>
}

interface PlanPagosItem { id: string; label: string; pct: number; fijo?: boolean }

// ── GET ──────────────────────────────────────────────────────────────────
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const proyecto = await prisma.proyecto.findUnique({ where: { id } })
  if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  // Prioridad: plan override del proyecto > plan de la cotización > fallback default
  let planPagos: PlanPagosItem[] = []
  let planSource: 'proyecto' | 'cotizacion' | 'default' = 'default'
  // 1) Override a nivel proyecto
  if (proyecto.planPagos) {
    try {
      const parsed = JSON.parse(proyecto.planPagos)
      if (Array.isArray(parsed) && parsed.length > 0) {
        planPagos = parsed
        planSource = 'proyecto'
      }
    } catch { /* ignore */ }
  }
  // 2) Plan original de la cotización
  if (planPagos.length === 0) {
    const cotizacion = await prisma.cotizacion.findUnique({ where: { correlativo: proyecto.correlativo } })
    try {
      if (cotizacion?.datos) {
        const d = typeof cotizacion.datos === 'string' ? JSON.parse(cotizacion.datos) : cotizacion.datos
        if (Array.isArray(d.planPagos) && d.planPagos.length > 0) {
          planPagos = d.planPagos
          planSource = 'cotizacion'
        }
      }
    } catch { /* ignore */ }
  }
  // 3) Fallback default
  if (planPagos.length === 0) {
    planPagos = [
      { id: 'reserva',    label: 'Reserva',                    pct: 10 },
      { id: 'anticipo',   label: 'Anticipo',                   pct: 50 },
      { id: 'mitad-perf', label: 'Al 50% de perforación',      pct: 20 },
      { id: 'entubar',    label: 'Antes de entubar',           pct: 15 },
      { id: 'prueba',     label: 'Antes de prueba de bombeo',  pct: 5 },
    ]
    planSource = 'default'
  }

  // Traer pagos activos del proyecto
  const pagos = await prisma.pago.findMany({
    where: { proyectoId: id, eliminadoEn: null },
    orderBy: { fecha: 'asc' },
  })

  // ── Calcular estado por hito (con cascada de excedentes) ──
  const totalProyecto = proyecto.monto
  const hitos: HitoCalculado[] = planPagos.map(h => ({
    id: h.id,
    label: h.label,
    pct: h.pct,
    montoEsperado: Math.round(totalProyecto * h.pct / 100),
    montoRecibido: 0,
    montoPendiente: 0,
    estado: 'pendiente',
    pagos: [],
  }))

  // Asignar cada pago al hito declarado, y calcular excedente
  for (const p of pagos) {
    const hito = hitos.find(h => h.id === p.hitoId)
    if (!hito) {
      // Hito no reconocido (ej. 'otro' o cambió el plan) — crear hito ad-hoc
      hitos.push({
        id: p.hitoId,
        label: p.hitoLabel || 'Otro',
        pct: 0,
        montoEsperado: 0,
        montoRecibido: p.monto,
        montoPendiente: 0,
        estado: 'pagado',
        pagos: [{ id: p.id, fecha: p.fecha, monto: p.monto, metodo: p.metodo, banco: p.banco, referencia: p.referencia }],
      })
      continue
    }
    hito.montoRecibido += p.monto
    hito.pagos.push({ id: p.id, fecha: p.fecha, monto: p.monto, metodo: p.metodo, banco: p.banco, referencia: p.referencia })
  }

  // Cascada de excedentes: si un hito recibió más de lo esperado, el excedente
  // se aplica al siguiente hito pendiente (en el mismo orden del plan).
  for (let i = 0; i < hitos.length; i++) {
    const h = hitos[i]
    if (h.montoEsperado === 0) continue // hitos ad-hoc no cascadean
    const excedente = h.montoRecibido - h.montoEsperado
    if (excedente > 0) {
      // Buscar siguiente hito del plan (con montoEsperado > 0) para transferir
      for (let j = i + 1; j < hitos.length; j++) {
        if (hitos[j].montoEsperado > 0) {
          hitos[j].montoRecibido += excedente
          h.montoRecibido = h.montoEsperado // ese hito queda exacto
          break
        }
      }
    }
  }

  // Calcular pendiente y estado final de cada hito
  for (const h of hitos) {
    h.montoPendiente = Math.max(0, h.montoEsperado - h.montoRecibido)
    if (h.montoEsperado === 0) {
      h.estado = h.montoRecibido > 0 ? 'pagado' : 'pendiente'
    } else if (h.montoRecibido >= h.montoEsperado) {
      h.estado = h.montoRecibido > h.montoEsperado ? 'excedido' : 'pagado'
    } else if (h.montoRecibido > 0) {
      h.estado = 'parcial'
    } else {
      h.estado = 'pendiente'
    }
  }

  const totalRecibido = pagos.reduce((a, p) => a + p.monto, 0)
  const totalPendiente = Math.max(0, totalProyecto - totalRecibido)

  return NextResponse.json({
    proyecto: {
      id: proyecto.id, correlativo: proyecto.correlativo, nombre: proyecto.nombre,
      monto: totalProyecto, estado: proyecto.estado,
    },
    planPagos,        // el plan usado (para que el editor lo cargue)
    planSource,       // "proyecto" | "cotizacion" | "default"
    hitos,
    pagos,
    totales: {
      proyecto: totalProyecto,
      recibido: totalRecibido,
      pendiente: totalPendiente,
      pctCobrado: totalProyecto > 0 ? (totalRecibido / totalProyecto) * 100 : 0,
    },
  })
}

// ── POST ──────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const proyecto = await prisma.proyecto.findUnique({ where: { id } })
  if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  const raw = await request.json().catch(() => null)
  const parsed = pagoInputSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({
      error: 'Datos inválidos',
      detalles: parsed.error.issues.map(i => ({ campo: i.path.join('.'), mensaje: i.message })),
    }, { status: 400 })
  }
  const data = parsed.data

  const pago = await prisma.pago.create({
    data: {
      proyectoId: id,
      proyectoCorrelativo: proyecto.correlativo,
      hitoId: data.hitoId,
      hitoLabel: data.hitoLabel,
      monto: data.monto,
      fecha: data.fecha,
      metodo: data.metodo,
      banco: data.metodo === 'efectivo' ? '' : data.banco,
      referencia: data.referencia,
      nota: data.nota,
      registradoPor: auth.user.username,
    },
  })

  const info = getRequestInfo(request)
  await auditLog({
    user: auth.user, accion: 'create', entidad: 'pago', entidadId: pago.id,
    despues: pago, ...info,
  })

  return NextResponse.json(pago, { status: 201 })
}
