import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { prisma } from '@/lib/db'
import { sacosDebentonita } from '@/lib/calculator'
import { canAccessCotizacion } from '@/lib/cotizaciones-auth'
import { patchCotizacionSchema, formatZodError } from '@/lib/validators'
import { requireAuth, getCurrentUser, getRequestInfo } from '@/lib/auth'
import { canAssignVendedor, INTERNAL_ASSIGNABLE_ROLES } from '@/lib/roles'
import { auditLog } from '@/lib/audit'
import { crearVendedorOption, normalizarVendedor, type VendedorOption } from '@/lib/vendedores'

async function getJwtRole(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get('auth_token')?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET!))
    return String(payload.role ?? '')
  } catch { return null }
}

async function resolverVendedorAsignable(nombre: string): Promise<VendedorOption | null> {
  const buscado = normalizarVendedor(nombre)
  if (!buscado) return null

  const usuarios = await prisma.usuario.findMany({
    where: { activo: true, rol: { in: INTERNAL_ASSIGNABLE_ROLES } },
    select: { nombre: true, email: true, rol: true, cargo: true },
  })
  const usuario = usuarios.find(u => normalizarVendedor(u.nombre) === buscado)
  if (usuario) return crearVendedorOption(usuario.nombre, usuario.email, usuario.rol, usuario.cargo)

  const envSuperadmin = process.env.SUPERADMIN_VENDEDOR
  if (envSuperadmin && normalizarVendedor(envSuperadmin) === buscado) {
    return crearVendedorOption(envSuperadmin, null, 'superadmin')
  }
  return null
}

// GET — obtener cotización con datos completos (para re-abrir/imprimir)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const row = await prisma.cotizacion.findUnique({ where: { correlativo: id } })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canAccessCotizacion(auth.user, row)) {
    return NextResponse.json({ error: 'No autorizado para esta cotizacion' }, { status: 403 })
  }
  return NextResponse.json(row)
}

// PATCH — cambiar estado (y auto-crear Proyecto al confirmar)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const raw = await request.json().catch(() => null)
  const parsed = patchCotizacionSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(formatZodError(parsed.error), { status: 400 })
  }
  const { estado, vendedor, usuario } = parsed.data

  // Safeguard: solo superadmin u operativo puede reasignar vendedor
  if (vendedor !== undefined) {
    const role = await getJwtRole(request)
    if (!canAssignVendedor(role)) {
      return NextResponse.json({ error: 'Solo superadmin u operativo puede reasignar el vendedor' }, { status: 403 })
    }
  }

  const before = await prisma.cotizacion.findUnique({ where: { correlativo: id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canAccessCotizacion(auth.user, before)) {
    return NextResponse.json({ error: 'No autorizado para esta cotizacion' }, { status: 403 })
  }

  const data: Record<string, unknown> = {}
  if (estado   !== undefined) data.estado = estado
  let vendedorAsignado: VendedorOption | null = null
  if (vendedor !== undefined) {
    vendedorAsignado = await resolverVendedorAsignable(vendedor)
    if (!vendedorAsignado) {
      return NextResponse.json({ error: 'El asesor asignado debe ser un usuario interno activo.' }, { status: 400 })
    }
    data.vendedor = vendedorAsignado.nombre
    const datos = JSON.parse(before.datos || '{}')
    data.datos = JSON.stringify({
      ...datos,
      vendedor: vendedorAsignado.nombre,
      vendedorEmail: vendedorAsignado.email,
      vendedorCargo: vendedorAsignado.cargo,
    })
  }

  const row = await prisma.cotizacion.update({
    where: { correlativo: id },
    data,
  })

  // Propagar reasignación al Proyecto asociado (si existe)
  if (vendedor !== undefined) {
    await prisma.proyecto.updateMany({
      where: { correlativo: id },
      data: { vendedor: vendedorAsignado?.nombre ?? vendedor },
    }).catch(() => {})
  }

  // Log change history
  if (before && estado !== undefined && before.estado !== estado) {
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
  if (before && vendedorAsignado && before.vendedor !== vendedorAsignado.nombre) {
    await prisma.cotizacionHistorial.create({
      data: {
        correlativo: id,
        campo: 'vendedor',
        valorAntes: before.vendedor,
        valorDespues: vendedorAsignado.nombre,
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
          contactoId: row.contactoId,  // hereda FK al Contacto para que el portal del cliente lo vea
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

// DELETE — soft delete (marca como eliminada, conserva correlativo para no romper secuencia)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const user = await getCurrentUser(request)
  const url = new URL(request.url)
  const motivo = url.searchParams.get('motivo') ?? ''

  const before = await prisma.cotizacion.findUnique({ where: { correlativo: id } })
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canAccessCotizacion(auth.user, before)) {
    return NextResponse.json({ error: 'No autorizado para esta cotizacion' }, { status: 403 })
  }
  if (before.eliminadaEn) {
    return NextResponse.json({ error: 'Ya estaba eliminada' }, { status: 409 })
  }

  // Bloquear soft-delete si tiene proyecto activo (regla del jefe: primero cerrar proyecto)
  const proyectoAsociado = await prisma.proyecto.findUnique({
    where: { correlativo: id },
    select: { id: true, estado: true, eliminadoEn: true },
  })
  if (proyectoAsociado && !proyectoAsociado.eliminadoEn && proyectoAsociado.estado !== 'completado') {
    return NextResponse.json({
      error: 'No se puede eliminar: la cotización tiene un proyecto activo. Cerrá el proyecto primero.',
    }, { status: 409 })
  }

  const row = await prisma.cotizacion.update({
    where: { correlativo: id },
    data: {
      eliminadaEn: new Date(),
      eliminadaPor: user?.username ?? '',
      motivoBorrado: motivo || null,
    },
  })

  const info = getRequestInfo(request)
  await auditLog({
    user, accion: 'delete', entidad: 'cotizacion', entidadId: id,
    antes: before, despues: { eliminadaEn: row.eliminadaEn, motivoBorrado: row.motivoBorrado },
    ip: info.ip, userAgent: info.userAgent,
  })

  return NextResponse.json({ ok: true, soft: true })
}

// POST — restaurar desde papelera (quitar soft delete)
// Endpoint usado via /api/cotizaciones/[id]/restaurar (ver route.ts hermano)
