import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { canAccessCotizacion, parseCotizacionDatos } from '@/lib/cotizaciones-auth'
import { canAssignVendedor, INTERNAL_ASSIGNABLE_ROLES } from '@/lib/roles'
import { contactoDuplicateLockKey, findContactoDuplicate } from '@/lib/contactos-dedup'
import { crearVendedorOption, normalizarVendedor, type VendedorOption } from '@/lib/vendedores'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

const normalizeTipoPersona = (value: unknown, empresa = '') =>
  value === 'empresa' || value === 'juridica' || (!value && empresa.trim()) ? 'empresa' : 'individual'

function errorDetalleLocal(e: unknown) {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try { return JSON.stringify(e) } catch { return 'Error desconocido' }
}

// Lee del JWT el rol y nombre del vendedor. Si el rol es admin, usamos ese
// nombre para forzar la propiedad de la cotización (admin NO puede asignar
// a otro vendedor aunque lo intente desde el body).
// GET - listar todas activas (filtra eliminadas por default).
// Query params: ?vendedor=X / ?papelera=1 (solo eliminadas)
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const vendedor = auth.user.role === 'superadmin'
    ? searchParams.get('vendedor')
    : auth.user.vendedor
  const papelera = searchParams.get('papelera') === '1'

  const where: Record<string, unknown> = {
    eliminadaEn: papelera ? { not: null } : null,
  }
  if (vendedor) where.vendedor = vendedor

  const rows = await prisma.cotizacion.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(rows)
}

// POST - crear o actualizar cotización (y auto-upsert contacto si hay teléfono)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response

  try {
  const body = await request.json()
  const { correlativo, cliente, empresa, proyecto, tipo, estado, monto, fecha } = body
  const datosBase = (body.datos && typeof body.datos === 'object') ? body.datos : {}
  let contactoId: string | null = body.contactoId ?? null
  const montoNumero = Number(monto)

  if (!correlativo || typeof correlativo !== 'string') {
    return NextResponse.json({ error: 'Falta el correlativo de la cotizacion.' }, { status: 400 })
  }
  if (!cliente || typeof cliente !== 'string') {
    return NextResponse.json({ error: 'Falta el cliente de la cotizacion.' }, { status: 400 })
  }
  if (!proyecto || typeof proyecto !== 'string') {
    return NextResponse.json({ error: 'Falta el proyecto de la cotizacion.' }, { status: 400 })
  }
  if (tipo !== 'perforacion' && tipo !== 'limpieza') {
    return NextResponse.json({ error: 'El tipo de cotizacion no es valido.' }, { status: 400 })
  }
  if (!Number.isFinite(montoNumero)) {
    return NextResponse.json({
      error: 'El monto de la cotizacion no es valido. Revisa los campos numericos antes de guardar.',
    }, { status: 400 })
  }

  // ── Regla de edición: solo cotizaciones EN BORRADOR son editables ──
  // Si ya existe una cotización con ese correlativo y su estado actual NO es
  // borrador (enviada/confirmada/cancelada), rechazar cualquier edición.
  // Aplica tanto a admin como superadmin. Para modificar hay que crear una
  // cotización nueva con otro correlativo.
  const existente = await prisma.cotizacion.findUnique({
    where: { correlativo },
    select: { estado: true, eliminadaEn: true, vendedor: true, datos: true },
  })
  if (existente && !canAccessCotizacion(auth.user, existente)) {
    return NextResponse.json({ error: 'No autorizado para editar esta cotizacion' }, { status: 403 })
  }
  if (existente && existente.eliminadaEn === null && existente.estado !== 'borrador') {
    return NextResponse.json({
      error: `Esta cotización está "${existente.estado}" y no se puede editar. Creá una nueva si necesitás cambiar algo.`,
      bloqueada: true,
      estadoActual: existente.estado,
    }, { status: 409 })
  }

  // Enforcement de ownership: si el caller es admin, el vendedor SIEMPRE es
  // él mismo (desde el JWT), ignorando lo que venga en el body. Si es superadmin,
  // puede asignar a cualquier vendedor del body (default: su propio nombre).
  let vendedor: string = body.vendedor ?? ''
  let vendedorInfo: VendedorOption | null = null
  if (!canAssignVendedor(auth.user.role)) {
    vendedor = auth.user.vendedor ?? ''  // forzado, admin no puede reasignar
    vendedorInfo = await resolverVendedorAsignable(vendedor) ?? crearVendedorOption(vendedor)
  } else if (canAssignVendedor(auth.user.role) && !vendedor) {
    vendedor = auth.user.vendedor ?? ''  // default al propio si no se especifico
  }
  if (canAssignVendedor(auth.user.role)) {
    vendedorInfo = await resolverVendedorAsignable(vendedor)
    if (!vendedorInfo) {
      return NextResponse.json({ error: 'El asesor asignado debe ser un usuario interno activo.' }, { status: 400 })
    }
    vendedor = vendedorInfo.nombre
  }
  const datosExistentes = parseCotizacionDatos(existente?.datos)
  const datosCotizacion = {
    ...datosBase,
    creadoPorUsuario: typeof datosExistentes.creadoPorUsuario === 'string' ? datosExistentes.creadoPorUsuario : auth.user.username,
    creadoPorVendedor: typeof datosExistentes.creadoPorVendedor === 'string' ? datosExistentes.creadoPorVendedor : (auth.user.vendedor ?? ''),
    vendedor,
    vendedorEmail: vendedorInfo?.email ?? crearVendedorOption(vendedor).email,
    vendedorCargo: vendedorInfo?.cargo ?? crearVendedorOption(vendedor).cargo,
  }

  // Auto-upsert contacto si el cliente tiene teléfono registrado (ignora contactos eliminados).
  // Si no llegó contactoId explícito, intentamos resolverlo por nombre+vendedor (fallback).
  // La ubicacion del cotizador pertenece al pozo/proyecto; no se copia como direccion de oficina del contacto.
  const telefono:       string = (datosCotizacion.telefono ?? '') as string
  const email:          string = (datosCotizacion.email ?? '') as string
  const proyectoNombre: string = (datosCotizacion.proyecto ?? proyecto ?? '') as string
  const tipoPersona = normalizeTipoPersona(
    datosCotizacion.tipoPersona ?? datosCotizacion.tipoCliente,
    empresa ?? '',
  )
  if (cliente && telefono) {
    const contactoAutoId = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${contactoDuplicateLockKey({ nombre: cliente })})::bigint)`

      const candidatos = await tx.contacto.findMany({
        where: { eliminadoEn: null },
        select: {
          id: true, nombre: true, empresa: true, telefono: true, email: true,
          vendedor: true, createdAt: true, proyectoNombre: true, tipoPersona: true,
        },
      })
      const existing = findContactoDuplicate({ nombre: cliente, empresa, telefono, email }, candidatos)
      if (existing) {
        // Completamos datos de identidad del contacto sin pisar campos capturados.
        const parche: Record<string, string> = {}
        if (!existing.telefono     && telefono)       parche.telefono       = telefono
        if (!existing.email        && email)          parche.email          = email
        if (!existing.empresa      && empresa)        parche.empresa        = empresa
        if (!existing.proyectoNombre && proyectoNombre) parche.proyectoNombre = proyectoNombre
        if (tipoPersona === 'empresa' && existing.tipoPersona !== 'empresa') parche.tipoPersona = 'empresa'
        if (Object.keys(parche).length > 0) {
          await tx.contacto.update({ where: { id: existing.id }, data: parche })
        }
        return existing.id
      }

      const nuevo = await tx.contacto.create({
        data: {
          nombre: cliente,
          empresa: empresa ?? '',
          telefono,
          email,
          tipoPersona,
          departamento: '',
          municipio: '',
          proyectoNombre,
          vendedor,
        },
      })
      return nuevo.id
    })
    if (!contactoId) contactoId = contactoAutoId
  }

  // Último fallback: si no hay contactoId aún, intentar match por nombre solo (case-insensitive)
  if (!contactoId && cliente) {
    const found = await prisma.contacto.findFirst({
      where: {
        nombre: { equals: cliente, mode: 'insensitive' },
        eliminadoEn: null,
      },
      select: { id: true },
    })
    if (found) contactoId = found.id
  }

  const planPagos = Array.isArray(datosCotizacion.planPagos) ? datosCotizacion.planPagos : []
  if (planPagos.length > 0) {
    const visibles = planPagos.filter((h: { visible?: boolean }) => h.visible !== false)
    const sumaPlan = visibles.reduce((acc: number, h: { pct?: number }) => acc + Number(h.pct ?? 0), 0)
    if (visibles.length === 0 || Math.abs(sumaPlan - 100) > 0.01) {
      return NextResponse.json({
        error: visibles.length === 0
          ? 'Debe haber al menos un hito visible en el plan de pagos.'
          : `El plan de pagos visible debe sumar 100% (actual: ${sumaPlan.toFixed(1)}%).`,
      }, { status: 400 })
    }
  }

  const dataRow = {
    cliente,
    empresa: empresa ?? '',
    proyecto,
    tipo,
    estado: estado ?? 'borrador',
    monto: montoNumero,
    fecha,
    vendedor,
    datos: JSON.stringify(datosCotizacion),
    contactoId,
  }

  let row
  try {
    row = existente
      ? await prisma.cotizacion.update({
          where: { correlativo },
          data: dataRow,
        })
      : await prisma.cotizacion.create({
          data: { correlativo, ...dataRow },
        })
  } catch (e: unknown) {
    if (typeof e === 'object' && e && 'code' in e && (e as { code?: string }).code === 'P2002') {
      return NextResponse.json({
        error: 'Ese correlativo ya fue usado por otra cotización. Generá uno nuevo para evitar duplicados.',
      }, { status: 409 })
    }
    console.error('[api/cotizaciones POST]', e)
    return NextResponse.json({
      error: 'No se pudo guardar la cotizacion en la base de datos.',
      detalle: process.env.NODE_ENV === 'production' ? undefined : errorDetalleLocal(e),
    }, { status: 500 })
  }

  return NextResponse.json(row)
  } catch (e: unknown) {
    console.error('[api/cotizaciones POST]', e)
    return NextResponse.json({
      error: 'No se pudo guardar la cotizacion.',
      detalle: process.env.NODE_ENV === 'production' ? undefined : errorDetalleLocal(e),
    }, { status: 500 })
  }
}
