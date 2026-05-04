// ── OpenClaw MCP — catálogo de tools (Sprint 1) ─────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any -- Tool handlers receive dynamic Zod-validated payloads. */
// Referencia: specs-bot/MCP_TOOLS_SPRINT1.md
// Implementa los 6 tools mínimos para activar hidra-copiloto.
// Los handlers trabajan con el schema real de HidroCRM (Prisma + cuid, no uuid).

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { DEFAULT_CONFIG, DEFAULT_PRECIOS_LINEAS } from '@/lib/config-store'

// ── Tipos ────────────────────────────────────────────────────────────────────

export type McpScope =
  | 'bot:read'
  | 'bot:calc'
  | 'bot:write'
  | 'bot:analytics'
  | 'bot:finance'
  | 'bot:field'
  | 'bot:geology'
  | 'bot:ops'
  | 'cliente:read'
  | 'cliente:solicitud'

export interface McpCtx {
  scopes: McpScope[]
  sub: string
  clientPhone: string | null
  idempotencyKey: string | null
  ip: string
  userAgent: string
}

export interface ToolDef {
  name: string
  description: string
  scopes: McpScope[]
  inputSchema: z.ZodType
  handler: (args: any, ctx: McpCtx) => Promise<any>
}

export class RpcError extends Error {
  code: number
  data?: any
  constructor(code: number, message: string, data?: any) {
    super(message)
    this.code = code
    this.data = data
  }
}

// ── Idempotencia (in-memory, MVP — bueno para single-instance) ──────────────
// TTL 10 min para que no crezca ilimitado.
const IDEM_TTL_MS = 10 * 60 * 1000
const idemCache = new Map<string, { value: any; expiresAt: number }>()

function idemGet(key: string): any | null {
  const entry = idemCache.get(key)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) { idemCache.delete(key); return null }
  return entry.value
}
function idemSet(key: string, value: any): void {
  idemCache.set(key, { value, expiresAt: Date.now() + IDEM_TTL_MS })
  // Limpieza oportunista
  if (idemCache.size > 1000) {
    const now = Date.now()
    for (const [k, v] of idemCache.entries()) {
      if (v.expiresAt < now) idemCache.delete(k)
    }
  }
}

// ── Helpers compartidos ──────────────────────────────────────────────────────

// Buscar contacto por teléfono (normalizando: quita espacios, +, guiones)
async function contactoByPhone(telefono: string) {
  const normalize = (s: string) => s.replace(/[^\d]/g, '')
  const target = normalize(telefono)
  if (!target) return null
  // Prisma no tiene función para normalizar en SQL con la forma portable, así que
  // traemos candidatos y filtramos. El volumen de contactos es manejable (<10k).
  const candidates = await prisma.contacto.findMany({
    where: { eliminadoEn: null, telefono: { not: '' } },
    select: { id: true, nombre: true, telefono: true, email: true, empresa: true },
    take: 500,
  })
  return candidates.find(c => normalize(c.telefono) === target || normalize(c.telefono).endsWith(target)) ?? null
}

// Parsear `datos` JSON de Cotizacion para estimar margen. Si falla, retorna null.
function margenFromCotizacion(monto: number, datosJson: string): number | null {
  try {
    const d = JSON.parse(datosJson) as any
    // Caso típico: d.costoTotal / d.monto
    const costo = Number(d?.costoTotal ?? d?.costo ?? 0)
    if (costo > 0 && monto > 0) {
      return Math.max(0, Math.min(1, (monto - costo) / monto))
    }
  } catch {}
  return null
}

// ── 1. buscar_oportunidad ────────────────────────────────────────────────────
const buscarOportunidad: ToolDef = {
  name: 'buscar_oportunidad',
  description: 'Obtiene detalle de una oportunidad por ID (correlativo o id interno)',
  scopes: ['bot:read'],
  inputSchema: z.object({
    id: z.string().min(1), // cuid o correlativo
  }),
  handler: async ({ id }) => {
    const o = await prisma.oportunidad.findFirst({
      where: {
        OR: [{ id }, { correlativo: id }],
        eliminadaEn: null,
      },
    })
    if (!o) throw new RpcError(404, 'oportunidad not found')

    // Traer contacto asociado (si hay) para más info
    const contacto = o.contactoId
      ? await prisma.contacto.findUnique({
          where: { id: o.contactoId },
          select: { id: true, nombre: true, telefono: true, email: true, empresa: true },
        })
      : null

    return {
      id: o.id,
      correlativo: o.correlativo,
      etapa: o.etapa,
      monto: o.monto,
      tipo: o.tipo,
      cliente: o.cliente,
      empresa: o.empresa,
      contacto_id: contacto?.id ?? null,
      contacto_telefono: contacto?.telefono ?? null,
      contacto_email: contacto?.email ?? null,
      asesor: o.vendedor,
      proyecto: o.proyecto,
      profundidad: o.profundidad,
      dias_sin_actividad: o.diasSinActividad,
      creada: o.createdAt.toISOString(),
      actualizada: o.updatedAt.toISOString(),
      // Campos del spec que no existen aún en nuestro schema — devuelven null
      siguiente_accion: null,
      probabilidad: null,
    }
  },
}

// ── 2. expediente_cliente ────────────────────────────────────────────────────
const expedienteCliente: ToolDef = {
  name: 'expediente_cliente',
  description: 'Expediente completo del cliente (contacto + proyectos + oportunidades + cotizaciones)',
  scopes: ['bot:read', 'cliente:read'],
  inputSchema: z.object({
    contacto_id: z.string().min(1).optional(),
  }),
  handler: async ({ contacto_id }, ctx) => {
    const clienteSoloScope = ctx.scopes.includes('cliente:read') && !ctx.scopes.includes('bot:read')

    let contacto
    if (clienteSoloScope) {
      if (!ctx.clientPhone) throw new RpcError(400, 'X-Hidra-Client-Phone header missing')
      contacto = await contactoByPhone(ctx.clientPhone)
      if (!contacto) {
        // Cliente nuevo — lead pendiente. Para MVP no tenemos tabla Lead, creamos
        // un Contacto con tipo=prospecto y marcamos en notas.
        const nuevo = await prisma.contacto.create({
          data: {
            nombre: `Lead WhatsApp ${ctx.clientPhone}`,
            telefono: ctx.clientPhone,
            tipo: 'prospecto',
            notas: `Creado por bot (hidra-cliente) el ${new Date().toISOString()} — requiere verificación.`,
            vendedor: 'bot',
          },
          select: { id: true, nombre: true, telefono: true },
        })
        return {
          id: nuevo.id,
          nuevo: true,
          telefono: nuevo.telefono,
          requiere_verificacion: true,
        }
      }
    } else {
      if (!contacto_id) throw new RpcError(400, 'contacto_id required for bot scope')
      contacto = await prisma.contacto.findFirst({
        where: { id: contacto_id, eliminadoEn: null },
      })
      if (!contacto) throw new RpcError(404, 'contact not found')
    }

    // Traer proyectos/oportunidades/cotizaciones por contactoId O por cliente match
    // (fallback para records legacy sin contactoId linkeado)
    const matchByContactoOrNombre = {
      OR: [
        { contactoId: contacto.id },
        { cliente: { equals: contacto.nombre, mode: 'insensitive' as const } },
      ],
    }
    const [proyectos, oportunidades, cotizaciones] = await Promise.all([
      prisma.proyecto.findMany({
        where: { ...matchByContactoOrNombre, eliminadoEn: null },
        select: { id: true, correlativo: true, nombre: true, tipo: true, estado: true, fechaInicio: true, monto: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.oportunidad.findMany({
        where: { ...matchByContactoOrNombre, eliminadaEn: null },
        select: { id: true, correlativo: true, etapa: true, monto: true, tipo: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.cotizacion.findMany({
        where: { ...matchByContactoOrNombre, eliminadaEn: null },
        select: { id: true, correlativo: true, monto: true, estado: true, tipo: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return {
      id: contacto.id,
      nuevo: false,
      nombre: contacto.nombre,
      telefono: contacto.telefono,
      email: (contacto as any).email ?? null,
      empresa: (contacto as any).empresa ?? null,
      proyectos: proyectos.map(p => ({
        id: p.id,
        correlativo: p.correlativo,
        nombre: p.nombre,
        tipo: p.tipo,
        estado: p.estado,
        inicio: p.fechaInicio,
        monto: p.monto,
      })),
      oportunidades: oportunidades.map(o => ({
        id: o.id,
        correlativo: o.correlativo,
        etapa: o.etapa,
        monto: o.monto,
        tipo: o.tipo,
        fecha: o.createdAt.toISOString(),
      })),
      cotizaciones: cotizaciones.map(c => ({
        id: c.id,
        correlativo: c.correlativo,
        monto: c.monto,
        estado: c.estado,
        tipo: c.tipo,
        fecha: c.createdAt.toISOString(),
      })),
    }
  },
}

// ── 3. historial_cliente ─────────────────────────────────────────────────────
const historialCliente: ToolDef = {
  name: 'historial_cliente',
  description: 'Busca clientes por nombre (case-insensitive) con histórico resumido',
  scopes: ['bot:read'],
  inputSchema: z.object({
    nombre: z.string().min(2).max(100),
  }),
  handler: async ({ nombre }) => {
    const contactos = await prisma.contacto.findMany({
      where: {
        eliminadoEn: null,
        nombre: { contains: nombre, mode: 'insensitive' },
      },
      select: { id: true, nombre: true, telefono: true, email: true, empresa: true },
      take: 10,
    })
    if (contactos.length === 0) return []

    const ids = contactos.map(c => c.id)
    const nombres = contactos.map(c => c.nombre)
    // OR entre contactoId y cliente string (fallback para records legacy sin FK)
    const matchAnyWhere = {
      OR: [
        { contactoId: { in: ids } },
        { cliente: { in: nombres, mode: 'insensitive' as const } },
      ],
    }
    const [proyectos, oportunidades, cotizaciones] = await Promise.all([
      prisma.proyecto.findMany({
        where: { ...matchAnyWhere, eliminadoEn: null },
        select: { contactoId: true, cliente: true },
      }),
      prisma.oportunidad.findMany({
        where: { ...matchAnyWhere, eliminadaEn: null },
        orderBy: { createdAt: 'desc' },
        select: { contactoId: true, cliente: true, createdAt: true, etapa: true },
      }),
      prisma.cotizacion.findMany({
        where: { ...matchAnyWhere, eliminadaEn: null },
        select: { contactoId: true, cliente: true },
      }),
    ])
    const nombreLower = (s: string) => s.toLowerCase().trim()
    const matchesContacto = (row: { contactoId: string | null; cliente: string }, c: { id: string; nombre: string }) =>
      row.contactoId === c.id || nombreLower(row.cliente) === nombreLower(c.nombre)

    return contactos.map(c => {
      const op = oportunidades.find(o => matchesContacto(o, c))
      return {
        id: c.id,
        nombre: c.nombre,
        telefono: c.telefono,
        empresa: c.empresa,
        proyectos_count: proyectos.filter(p => matchesContacto(p, c)).length,
        cotizaciones_count: cotizaciones.filter(q => matchesContacto(q, c)).length,
        ultima_interaccion: op?.createdAt.toISOString() ?? null,
        ultima_etapa: op?.etapa ?? null,
      }
    })
  },
}

// ── 4. preview_cotizacion ────────────────────────────────────────────────────
const previewCotizacion: ToolDef = {
  name: 'preview_cotizacion',
  description: 'Calcula precio estimado de cotización sin persistir. Para que el asesor vea rango antes de enviar.',
  scopes: ['bot:calc'],
  inputSchema: z.object({
    tipo: z.enum(['pozo_nuevo', 'limpieza_mecanica', 'mantenimiento']),
    municipio: z.string().min(2),
    uso: z.enum(['consumo', 'riego', 'industrial', 'ganaderia']),
    profundidad_estimada_m: z.number().int().positive().optional(),
    hectareas: z.number().positive().optional(),
    cabezas: z.number().int().positive().optional(),
    consumidores: z.number().int().positive().optional(),
  }),
  handler: async (args) => {
    const warnings: string[] = []
    const precios = DEFAULT_PRECIOS_LINEAS
    const config = DEFAULT_CONFIG

    // Estimaciones basadas en uso
    let profundidadM = args.profundidad_estimada_m ?? 0
    let caudalGpm = 0

    if (!profundidadM) {
      // Heurística conservadora por uso
      if (args.uso === 'consumo') profundidadM = (args.consumidores ?? 100) > 200 ? 100 : 70
      else if (args.uso === 'riego') profundidadM = Math.min(150, 60 + (args.hectareas ?? 2) * 10)
      else if (args.uso === 'ganaderia') profundidadM = (args.cabezas ?? 100) > 200 ? 90 : 70
      else profundidadM = 120 // industrial
      warnings.push(`Profundidad estimada automáticamente (${profundidadM} m) — confirmar en prospección`)
    }
    if (args.uso === 'consumo') caudalGpm = Math.max(15, (args.consumidores ?? 100) * 0.2)
    else if (args.uso === 'riego') caudalGpm = Math.max(20, (args.hectareas ?? 2) * 15)
    else if (args.uso === 'ganaderia') caudalGpm = Math.max(10, (args.cabezas ?? 100) * 0.15)
    else caudalGpm = 40

    let monto = 0
    let margenPct = 0.22

    if (args.tipo === 'pozo_nuevo') {
      const pies = profundidadM * 3.2808
      // Precio promedio ponderado de perforación + ampliaciones (aproximado)
      const precioPiePromedio = 280 // Q/pie — mezcla típica perf 8'/12' + amp 14.5'
      monto = pies * precioPiePromedio
      margenPct = 0.24
    } else if (args.tipo === 'limpieza_mecanica') {
      monto = 45_000 // base
      margenPct = 0.20
      if (profundidadM > 150) monto += 15_000
    } else {
      // mantenimiento
      monto = 18_000
      margenPct = 0.18
    }

    if (monto > 250_000) warnings.push('Monto elevado — requiere aprobación de dirección')
    if (args.municipio.toLowerCase().includes('petén') || args.municipio.toLowerCase().includes('peten')) {
      monto *= 1.15
      warnings.push('Traslado largo a Petén agrega ~15% al monto base')
    }

    return {
      precio_estimado: Math.round(monto),
      rango: [Math.round(monto * 0.9), Math.round(monto * 1.1)],
      margen_estimado: Number(margenPct.toFixed(2)),
      profundidad_estimada_m: profundidadM,
      caudal_requerido_gpm: Math.round(caudalGpm),
      requiere_prospeccion: monto > 200_000 || profundidadM > 150,
      advertencias: warnings,
      // Valor de referencia usado en el cálculo (explicabilidad para el bot)
      debug: {
        moneda: 'GTQ',
        precio_pie_base: config.precioPorPieBase,
        precios_linea_usados: precios ? true : false,
      },
    }
  },
}

// ── 5. simular_descuento ─────────────────────────────────────────────────────
const simularDescuento: ToolDef = {
  name: 'simular_descuento',
  description: 'Calcula impacto de un descuento en el margen de una cotización existente',
  scopes: ['bot:calc'],
  inputSchema: z.object({
    cotizacion_id: z.string().min(1), // id o correlativo
    pct: z.number().min(0).max(50),
  }),
  handler: async ({ cotizacion_id, pct }) => {
    const cot = await prisma.cotizacion.findFirst({
      where: {
        OR: [{ id: cotizacion_id }, { correlativo: cotizacion_id }],
        eliminadaEn: null,
      },
    })
    if (!cot) throw new RpcError(404, 'cotizacion not found')

    const precioFinal = cot.monto * (1 - pct / 100)
    // Intentar inferir margen del JSON; si no, asumir 22% (promedio histórico).
    const margenOriginal = margenFromCotizacion(cot.monto, cot.datos) ?? 0.22
    // Descuento se come el margen 1:1 (costo se mantiene)
    const reduccion = pct / 100
    const margenFinal = Math.max(-1, margenOriginal - reduccion)

    return {
      cotizacion_id: cot.id,
      correlativo: cot.correlativo,
      descuento_pct: pct,
      precio_original: cot.monto,
      precio_final: Math.round(precioFinal),
      margen_original_pct: Number(margenOriginal.toFixed(3)),
      margen_final_pct: Number(margenFinal.toFixed(3)),
      saludable: margenFinal >= 0.18,
      alerta: margenFinal < 0.18
        ? `Margen por debajo del objetivo (18%). Margen final estimado: ${(margenFinal * 100).toFixed(1)}%`
        : null,
      margen_estimado: margenFromCotizacion(cot.monto, cot.datos) === null
        ? 'Margen original estimado en 22% (no se encontró costo explícito en la cotización)'
        : null,
    }
  },
}

// ── 6. registrar_mensaje ─────────────────────────────────────────────────────
const registrarMensaje: ToolDef = {
  name: 'registrar_mensaje',
  description: 'Guarda una nota/mensaje en la oportunidad (memoria visible para el asesor)',
  scopes: ['bot:write'],
  inputSchema: z.object({
    oportunidad_id: z.string().min(1),
    mensaje: z.string().min(1).max(5000),
    autor: z.enum(['hidra-copiloto', 'asesor']).default('hidra-copiloto'),
  }),
  handler: async ({ oportunidad_id, mensaje, autor }, ctx) => {
    if (ctx.idempotencyKey) {
      const cached = idemGet(ctx.idempotencyKey)
      if (cached) return cached
    }

    // Verificar que la oportunidad existe
    const op = await prisma.oportunidad.findFirst({
      where: {
        OR: [{ id: oportunidad_id }, { correlativo: oportunidad_id }],
        eliminadaEn: null,
      },
      select: { id: true },
    })
    if (!op) throw new RpcError(404, 'oportunidad not found')

    const row = await prisma.oportunidadAI.create({
      data: {
        oportunidadId: op.id,
        rol: autor === 'asesor' ? 'asesor' : 'asistente',
        mensaje,
        metadata: JSON.stringify({ source: 'mcp', sub: ctx.sub, ip: ctx.ip }),
        usuario: ctx.sub,
      },
      select: { id: true, createdAt: true },
    })

    const result = {
      registrado: true,
      id: row.id,
      oportunidad_id: op.id,
      creado: row.createdAt.toISOString(),
    }
    if (ctx.idempotencyKey) idemSet(ctx.idempotencyKey, result)
    return result
  },
}

// ── Helpers Sprint 2 ─────────────────────────────────────────────────────────
// Resuelve el proyecto actual del cliente: si viene proyecto_id lo usa; si no,
// toma el activo más reciente del contacto. Para scope cliente:read valida que
// el proyecto le pertenezca por contactoId o cliente match.
async function resolverProyectoParaCliente(
  ctx: McpCtx,
  proyectoId: string | undefined,
  contacto: { id: string; nombre: string },
) {
  const baseWhere = { eliminadoEn: null }
  const ownedFilter = {
    OR: [
      { contactoId: contacto.id },
      { cliente: { equals: contacto.nombre, mode: 'insensitive' as const } },
    ],
  }
  if (proyectoId) {
    const p = await prisma.proyecto.findFirst({
      where: {
        ...baseWhere,
        AND: [
          { OR: [{ id: proyectoId }, { correlativo: proyectoId }] },
          ownedFilter,
        ],
      },
    })
    if (!p) throw new RpcError(404, 'proyecto no encontrado o no pertenece al cliente')
    return p
  }
  // Sin id: primero activo, luego cualquiera
  const p = await prisma.proyecto.findFirst({
    where: { ...baseWhere, ...ownedFilter, estado: 'activo' },
    orderBy: { createdAt: 'desc' },
  }) ?? await prisma.proyecto.findFirst({
    where: { ...baseWhere, ...ownedFilter },
    orderBy: { createdAt: 'desc' },
  })
  if (!p) throw new RpcError(404, 'el cliente no tiene proyectos')
  return p
}

// ── 7. mi_proyecto ────────────────────────────────────────────────────────────
const miProyecto: ToolDef = {
  name: 'mi_proyecto',
  description: 'Detalle del proyecto del cliente (avance, pagos totales, siguiente hito). Si no se pasa proyecto_id, devuelve el proyecto activo más reciente del cliente.',
  scopes: ['bot:read', 'cliente:read'],
  inputSchema: z.object({
    proyecto_id: z.string().min(1).optional(),
  }),
  handler: async ({ proyecto_id }, ctx) => {
    const clienteSoloScope = ctx.scopes.includes('cliente:read') && !ctx.scopes.includes('bot:read')
    let contacto: { id: string; nombre: string }
    if (clienteSoloScope) {
      if (!ctx.clientPhone) throw new RpcError(400, 'X-Hidra-Client-Phone header missing')
      const c = await contactoByPhone(ctx.clientPhone)
      if (!c) throw new RpcError(404, 'contacto no encontrado por teléfono')
      contacto = { id: c.id, nombre: c.nombre }
    } else {
      // Bot scope admin: puede pedir cualquier proyecto por id
      if (!proyecto_id) throw new RpcError(400, 'proyecto_id requerido para scope bot:read')
      const p = await prisma.proyecto.findFirst({
        where: {
          eliminadoEn: null,
          OR: [{ id: proyecto_id }, { correlativo: proyecto_id }],
        },
      })
      if (!p) throw new RpcError(404, 'proyecto no encontrado')
      contacto = { id: p.contactoId ?? '', nombre: p.cliente }
    }

    const proy = await resolverProyectoParaCliente(ctx, proyecto_id, contacto)

    // Avance: suma de perforacionTotal de la última entrada
    const ultimaEntrada = await prisma.bitacoraEntry.findFirst({
      where: { proyectoId: proy.id },
      orderBy: { fecha: 'desc' },
      select: { fecha: true, perforacionTotal: true, circulacionPct: true },
    })
    const countEntradas = await prisma.bitacoraEntry.count({ where: { proyectoId: proy.id } })

    // Pagos: suma + plan
    const pagos = await prisma.pago.findMany({
      where: { proyectoId: proy.id, eliminadoEn: null },
      select: { monto: true, hitoId: true, hitoLabel: true, fecha: true },
    })
    const totalCobrado = pagos.reduce((s, p) => s + p.monto, 0)
    const saldoPendiente = Math.max(0, proy.monto - totalCobrado)

    return {
      id: proy.id,
      correlativo: proy.correlativo,
      nombre: proy.nombre,
      tipo: proy.tipo, // "perforacion" | "limpieza"
      estado: proy.estado, // "activo" | "pausado" | "completado"
      cliente: proy.cliente,
      empresa: proy.empresa,
      monto_total: proy.monto,
      fecha_inicio: proy.fechaInicio,
      avance: {
        pies_perforados: ultimaEntrada?.perforacionTotal ?? 0,
        circulacion_pct: ultimaEntrada?.circulacionPct ?? 0,
        dias_registrados: countEntradas,
        ultima_bitacora: ultimaEntrada?.fecha ?? null,
      },
      pagos: {
        total_cobrado: totalCobrado,
        saldo_pendiente: saldoPendiente,
        pct_cobrado: proy.monto > 0 ? Math.round((totalCobrado / proy.monto) * 100) : 0,
        pagos_registrados: pagos.length,
      },
    }
  },
}

// ── 8. mi_bitacora ────────────────────────────────────────────────────────────
const miBitacora: ToolDef = {
  name: 'mi_bitacora',
  description: 'Entradas de bitácora del proyecto. Para scope cliente:read solo devuelve datos visibles al cliente (nota_cliente, avance, fecha) — NUNCA nota_interna.',
  scopes: ['bot:read', 'cliente:read'],
  inputSchema: z.object({
    proyecto_id: z.string().min(1).optional(),
    limit: z.number().int().min(1).max(30).default(10),
  }),
  handler: async ({ proyecto_id, limit }, ctx) => {
    const clienteSoloScope = ctx.scopes.includes('cliente:read') && !ctx.scopes.includes('bot:read')
    let proyecto
    if (clienteSoloScope) {
      if (!ctx.clientPhone) throw new RpcError(400, 'X-Hidra-Client-Phone header missing')
      const c = await contactoByPhone(ctx.clientPhone)
      if (!c) throw new RpcError(404, 'contacto no encontrado por teléfono')
      proyecto = await resolverProyectoParaCliente(ctx, proyecto_id, { id: c.id, nombre: c.nombre })
    } else {
      if (!proyecto_id) throw new RpcError(400, 'proyecto_id requerido')
      proyecto = await prisma.proyecto.findFirst({
        where: {
          eliminadoEn: null,
          OR: [{ id: proyecto_id }, { correlativo: proyecto_id }],
        },
      })
      if (!proyecto) throw new RpcError(404, 'proyecto no encontrado')
    }

    const entradas = await prisma.bitacoraEntry.findMany({
      where: { proyectoId: proyecto.id },
      orderBy: { fecha: 'desc' },
      take: limit,
    })

    // Si es cliente scope, ocultar nota_interna y otros campos sensibles (costos internos)
    return {
      proyecto_id: proyecto.id,
      proyecto_correlativo: proyecto.correlativo,
      entradas: entradas.map(e => {
        const base = {
          fecha: e.fecha,
          turno: e.turno,
          dia_activo: e.diaActivo,
          nota_cliente: e.notaCliente,
          perforacion_dia: e.perforacionDia,
          perforacion_total: e.perforacionTotal,
          ampliacion1_dia: e.ampliacion1Dia,
          ampliacion1_total: e.ampliacion1Total,
          horas_perforacion: e.horasPerforacion,
          horas_limpieza: e.horasLimpieza,
          dia_adverso: e.diaAdverso,
          formacion_geologica: e.formacionGeologica,
          circulacion_pct: e.circulacionPct,
        }
        if (clienteSoloScope) return base
        // Bot admin también ve nota interna + consumos internos
        return {
          ...base,
          nota_interna: e.notaInterna,
          bentonita_sacos: e.bentonitaSacos,
          pipas: e.pipas,
          horas_aforo: e.horasAforo,
          tubos_extraidos: e.tubosExtraidos,
          tubos_instalados: e.tubosInstalados,
          quimico_producto: e.quimicoProducto,
          quimico_canecas: e.quimicoCanecas,
        }
      }),
    }
  },
}

// ── 9. mis_pagos ──────────────────────────────────────────────────────────────
const misPagos: ToolDef = {
  name: 'mis_pagos',
  description: 'Plan de pagos + pagos registrados del proyecto. Calcula saldo por hito y saldo total pendiente.',
  scopes: ['bot:read', 'bot:finance', 'cliente:read'],
  inputSchema: z.object({
    proyecto_id: z.string().min(1).optional(),
  }),
  handler: async ({ proyecto_id }, ctx) => {
    const clienteSoloScope = ctx.scopes.includes('cliente:read') && !ctx.scopes.includes('bot:read') && !ctx.scopes.includes('bot:finance')
    let proyecto
    if (clienteSoloScope) {
      if (!ctx.clientPhone) throw new RpcError(400, 'X-Hidra-Client-Phone header missing')
      const c = await contactoByPhone(ctx.clientPhone)
      if (!c) throw new RpcError(404, 'contacto no encontrado por teléfono')
      proyecto = await resolverProyectoParaCliente(ctx, proyecto_id, { id: c.id, nombre: c.nombre })
    } else {
      if (!proyecto_id) throw new RpcError(400, 'proyecto_id requerido')
      proyecto = await prisma.proyecto.findFirst({
        where: {
          eliminadoEn: null,
          OR: [{ id: proyecto_id }, { correlativo: proyecto_id }],
        },
      })
      if (!proyecto) throw new RpcError(404, 'proyecto no encontrado')
    }

    // Plan: si el proyecto tiene planPagos JSON override, usarlo; si no, plan por defecto
    let plan: Array<{ id: string; label: string; pct: number; fijo?: number }> = []
    try {
      if (proyecto.planPagos) plan = JSON.parse(proyecto.planPagos)
    } catch { /* ignore parse errors */ }
    if (plan.length === 0) {
      // Plan default: reserva 20%, mitad 30%, entubado 30%, aforo 20%
      plan = [
        { id: 'reserva',    label: 'Reserva',    pct: 0.20 },
        { id: 'mitad-perf', label: 'Mitad perf', pct: 0.30 },
        { id: 'entubar',    label: 'Entubado',   pct: 0.30 },
        { id: 'prueba',     label: 'Aforo/prueba', pct: 0.20 },
      ]
    }

    const pagos = await prisma.pago.findMany({
      where: { proyectoId: proyecto.id, eliminadoEn: null },
      orderBy: { fecha: 'asc' },
      select: { id: true, hitoId: true, hitoLabel: true, monto: true, fecha: true, metodo: true, referencia: true },
    })

    const montoPorHito = new Map<string, number>()
    for (const p of pagos) {
      montoPorHito.set(p.hitoId, (montoPorHito.get(p.hitoId) ?? 0) + p.monto)
    }

    const hitos = plan.map(h => {
      const esperado = h.fijo ?? proyecto.monto * h.pct
      const cobrado = montoPorHito.get(h.id) ?? 0
      return {
        id: h.id,
        label: h.label,
        monto_esperado: Math.round(esperado * 100) / 100,
        monto_cobrado: Math.round(cobrado * 100) / 100,
        saldo: Math.round((esperado - cobrado) * 100) / 100,
        cumplido: cobrado >= esperado,
      }
    })

    const totalEsperado = proyecto.monto
    const totalCobrado = pagos.reduce((s, p) => s + p.monto, 0)

    return {
      proyecto_id: proyecto.id,
      proyecto_correlativo: proyecto.correlativo,
      monto_total: totalEsperado,
      total_cobrado: Math.round(totalCobrado * 100) / 100,
      saldo_pendiente: Math.round(Math.max(0, totalEsperado - totalCobrado) * 100) / 100,
      pct_cobrado: totalEsperado > 0 ? Math.round((totalCobrado / totalEsperado) * 100) : 0,
      hitos,
      pagos: pagos.map(p => ({
        id: p.id,
        hito: p.hitoLabel || p.hitoId,
        monto: p.monto,
        fecha: p.fecha,
        metodo: p.metodo,
        referencia: p.referencia,
      })),
    }
  },
}

// ── 10. mi_cotizacion ─────────────────────────────────────────────────────────
const miCotizacion: ToolDef = {
  name: 'mi_cotizacion',
  description: 'Cotización del cliente (detalle). Si no se pasa cotizacion_id, devuelve la más reciente del cliente. Para cliente:read NO expone costo/margen/datos internos.',
  scopes: ['bot:read', 'cliente:read'],
  inputSchema: z.object({
    cotizacion_id: z.string().min(1).optional(),
  }),
  handler: async ({ cotizacion_id }, ctx) => {
    const clienteSoloScope = ctx.scopes.includes('cliente:read') && !ctx.scopes.includes('bot:read')
    let cot
    if (clienteSoloScope) {
      if (!ctx.clientPhone) throw new RpcError(400, 'X-Hidra-Client-Phone header missing')
      const c = await contactoByPhone(ctx.clientPhone)
      if (!c) throw new RpcError(404, 'contacto no encontrado por teléfono')
      const ownedFilter = {
        OR: [
          { contactoId: c.id },
          { cliente: { equals: c.nombre, mode: 'insensitive' as const } },
        ],
      }
      if (cotizacion_id) {
        cot = await prisma.cotizacion.findFirst({
          where: {
            eliminadaEn: null,
            AND: [
              { OR: [{ id: cotizacion_id }, { correlativo: cotizacion_id }] },
              ownedFilter,
            ],
          },
        })
        if (!cot) throw new RpcError(404, 'cotización no encontrada o no pertenece al cliente')
      } else {
        cot = await prisma.cotizacion.findFirst({
          where: { eliminadaEn: null, ...ownedFilter },
          orderBy: { createdAt: 'desc' },
        })
        if (!cot) throw new RpcError(404, 'el cliente no tiene cotizaciones')
      }
    } else {
      if (!cotizacion_id) throw new RpcError(400, 'cotizacion_id requerido')
      cot = await prisma.cotizacion.findFirst({
        where: {
          eliminadaEn: null,
          OR: [{ id: cotizacion_id }, { correlativo: cotizacion_id }],
        },
      })
      if (!cot) throw new RpcError(404, 'cotización no encontrada')
    }

    const base = {
      id: cot.id,
      correlativo: cot.correlativo,
      cliente: cot.cliente,
      empresa: cot.empresa,
      proyecto: cot.proyecto,
      tipo: cot.tipo, // "perforacion" | "limpieza"
      estado: cot.estado, // "borrador" | "enviada" | "confirmada" | "cancelada"
      monto: cot.monto,
      fecha: cot.fecha,
      vendedor: cot.vendedor,
    }
    if (clienteSoloScope) return base
    // Bot admin también puede ver el JSON completo datos (con costos)
    let datosRaw: unknown = null
    try { datosRaw = JSON.parse(cot.datos) } catch { /* ignore */ }
    return { ...base, datos: datosRaw }
  },
}

// ── 11. metricas_periodo ─────────────────────────────────────────────────────
const metricasPeriodo: ToolDef = {
  name: 'metricas_periodo',
  description: 'KPIs del período: cotizaciones, monto, confirmadas, enviadas, canceladas, conversión, por vendedor. Requiere scope bot:analytics.',
  scopes: ['bot:analytics'],
  inputSchema: z.object({
    desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'formato YYYY-MM-DD'),
    hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'formato YYYY-MM-DD'),
    vendedor: z.string().optional(),
  }),
  handler: async ({ desde, hasta, vendedor }) => {
    // El field `fecha` es string en formato DD/MM/YYYY (locale GT), no sirve para
    // filtros de rango. Usamos `createdAt` que sí es DateTime ISO.
    const desdeDate = new Date(desde + 'T00:00:00.000Z')
    const hastaDate = new Date(hasta + 'T23:59:59.999Z')
    const cots = await prisma.cotizacion.findMany({
      where: {
        eliminadaEn: null,
        createdAt: { gte: desdeDate, lte: hastaDate },
        ...(vendedor ? { vendedor } : {}),
      },
      select: { id: true, estado: true, monto: true, vendedor: true, tipo: true },
    })
    const total = cots.length
    const monto = cots.reduce((s, c) => s + c.monto, 0)
    const conf = cots.filter(c => c.estado === 'confirmada')
    const env  = cots.filter(c => c.estado === 'enviada')
    const can  = cots.filter(c => c.estado === 'cancelada')
    const conversionPct = total > 0 ? Math.round((conf.length / total) * 100) : 0

    // Desglose por vendedor
    const porVendedor = new Map<string, { cotizaciones: number; monto: number; confirmadas: number; monto_confirmado: number }>()
    for (const c of cots) {
      const v = porVendedor.get(c.vendedor) ?? { cotizaciones: 0, monto: 0, confirmadas: 0, monto_confirmado: 0 }
      v.cotizaciones++
      v.monto += c.monto
      if (c.estado === 'confirmada') {
        v.confirmadas++
        v.monto_confirmado += c.monto
      }
      porVendedor.set(c.vendedor, v)
    }

    // Proyectos activos en el período (ventana simple)
    const proyectosActivos = await prisma.proyecto.count({
      where: { eliminadoEn: null, estado: 'activo' },
    })

    return {
      periodo: { desde, hasta },
      resumen: {
        total,
        monto: Math.round(monto * 100) / 100,
        confirmadas: conf.length,
        monto_confirmado: Math.round(conf.reduce((s, c) => s + c.monto, 0) * 100) / 100,
        enviadas: env.length,
        canceladas: can.length,
        conversion_pct: conversionPct,
      },
      por_vendedor: Array.from(porVendedor.entries()).map(([v, d]) => ({
        vendedor: v,
        ...d,
        monto: Math.round(d.monto * 100) / 100,
        monto_confirmado: Math.round(d.monto_confirmado * 100) / 100,
      })).sort((a, b) => b.monto - a.monto),
      proyectos_activos: proyectosActivos,
    }
  },
}

// ── Helper: fecha hoy en formato YYYY-MM-DD (GT timezone) ────────────────────
function hoyISO(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guatemala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function addDaysISO(fecha: string, dias: number): string {
  if (dias <= 0) return ''
  const d = new Date(`${fecha}T12:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

// ── Helper: buscar proyecto por id o correlativo ─────────────────────────────
async function resolverProyecto(id: string) {
  const p = await prisma.proyecto.findFirst({
    where: {
      eliminadoEn: null,
      OR: [{ id }, { correlativo: id }],
    },
  })
  if (!p) throw new RpcError(404, `proyecto no encontrado: ${id}`)
  return p
}

// ── 12. listar_proyectos_activos ─────────────────────────────────────────────
const listarProyectosActivos: ToolDef = {
  name: 'listar_proyectos_activos',
  description: 'Lista proyectos activos para que el bot pueda ubicar el proyecto correcto. No modifica datos.',
  scopes: ['bot:ops', 'bot:read'],
  inputSchema: z.object({
    buscar: z.string().max(120).default(''),
    limit: z.coerce.number().int().min(1).max(50).default(25),
  }),
  handler: async ({ buscar, limit }) => {
    const filtro = buscar.trim()
    const proyectos = await prisma.proyecto.findMany({
      where: {
        eliminadoEn: null,
        estado: 'activo',
        ...(filtro ? {
          OR: [
            { correlativo: { contains: filtro, mode: 'insensitive' as const } },
            { cliente: { contains: filtro, mode: 'insensitive' as const } },
            { empresa: { contains: filtro, mode: 'insensitive' as const } },
            { nombre: { contains: filtro, mode: 'insensitive' as const } },
          ],
        } : {}),
      },
      select: {
        id: true,
        correlativo: true,
        cliente: true,
        empresa: true,
        nombre: true,
        tipo: true,
        estado: true,
        fechaInicio: true,
        vendedor: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    })

    const ids = proyectos.map(p => p.id)
    const ultimas = ids.length > 0
      ? await prisma.bitacoraEntry.groupBy({
          by: ['proyectoId'],
          where: { proyectoId: { in: ids } },
          _max: { fecha: true },
        })
      : []
    const ultimaPorProyecto = new Map(ultimas.map(u => [u.proyectoId, u._max.fecha ?? null]))

    return {
      total: proyectos.length,
      proyectos: proyectos.map(p => ({
        id: p.id,
        correlativo: p.correlativo,
        cliente: p.cliente,
        empresa: p.empresa,
        nombre: p.nombre,
        tipo: p.tipo,
        estado: p.estado,
        fecha_inicio: p.fechaInicio,
        vendedor: p.vendedor,
        ultima_bitacora_fecha: ultimaPorProyecto.get(p.id) ?? null,
      })),
    }
  },
}

// ── 13. alertas_bitacora_pendiente ───────────────────────────────────────────
const alertasBitacoraPendiente: ToolDef = {
  name: 'alertas_bitacora_pendiente',
  description: 'Detecta proyectos activos sin bitacora registrada para una fecha y turnos esperados. No modifica datos.',
  scopes: ['bot:ops', 'bot:read'],
  inputSchema: z.object({
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'formato YYYY-MM-DD').optional(),
    turnos_esperados: z.array(z.enum(['dia', 'noche'])).min(1).max(2).default(['dia']),
  }),
  handler: async ({ fecha: fechaInput, turnos_esperados }) => {
    const fecha = fechaInput ?? hoyISO()
    const turnosEsperados = Array.from(new Set(turnos_esperados as Array<'dia' | 'noche'>))

    const proyectos = await prisma.proyecto.findMany({
      where: { eliminadoEn: null, estado: 'activo' },
      select: {
        id: true,
        correlativo: true,
        cliente: true,
        empresa: true,
        nombre: true,
        tipo: true,
        vendedor: true,
        fechaInicio: true,
      },
      orderBy: { updatedAt: 'desc' },
    })

    const ids = proyectos.map(p => p.id)
    const [entradasFecha, ultimas] = ids.length > 0
      ? await Promise.all([
          prisma.bitacoraEntry.findMany({
            where: { proyectoId: { in: ids }, fecha },
            select: { proyectoId: true, turno: true, createdAt: true },
          }),
          prisma.bitacoraEntry.groupBy({
            by: ['proyectoId'],
            where: { proyectoId: { in: ids } },
            _max: { fecha: true },
          }),
        ])
      : [[], []]

    const turnosPorProyecto = new Map<string, Set<string>>()
    for (const entrada of entradasFecha) {
      const turnos = turnosPorProyecto.get(entrada.proyectoId) ?? new Set<string>()
      turnos.add(entrada.turno)
      turnosPorProyecto.set(entrada.proyectoId, turnos)
    }
    const ultimaPorProyecto = new Map(ultimas.map(u => [u.proyectoId, u._max.fecha ?? null]))

    const pendientes = proyectos
      .map(p => {
        const turnosRegistrados = turnosPorProyecto.get(p.id) ?? new Set<string>()
        const faltanTurnos = turnosEsperados.filter(turno => !turnosRegistrados.has(turno))
        return {
          proyecto_id: p.id,
          correlativo: p.correlativo,
          cliente: p.cliente,
          empresa: p.empresa,
          nombre: p.nombre,
          tipo: p.tipo,
          vendedor: p.vendedor,
          fecha_inicio: p.fechaInicio,
          ultima_bitacora_fecha: ultimaPorProyecto.get(p.id) ?? null,
          faltan_turnos: faltanTurnos,
        }
      })
      .filter(p => p.faltan_turnos.length > 0)

    return {
      fecha,
      turnos_esperados: turnosEsperados,
      total_proyectos_activos: proyectos.length,
      total_pendientes: pendientes.length,
      pendientes,
    }
  },
}

// ── 14. registrar_gasto_control ──────────────────────────────────────────────
const registrarGastoControl: ToolDef = {
  name: 'registrar_gasto_control',
  description: 'Registra una compra/gasto en Control de Gastos de un proyecto activo. Solo crea GastoExtra; no borra, no edita pagos y no toca cotizaciones.',
  scopes: ['bot:ops', 'bot:write'],
  inputSchema: z.object({
    proyecto_id: z.string().min(1),
    producto: z.string().min(2).max(120),
    descripcion: z.string().max(500).default(''),
    rubro: z.string().min(1).max(80).default('otro'),
    cantidad: z.coerce.number().positive().default(1),
    unidad: z.string().min(1).max(30).default('Unidad'),
    costo_unitario: z.coerce.number().positive().optional(),
    monto_total: z.coerce.number().positive().optional(),
    valor_unitario: z.coerce.number().min(0).default(0),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'formato YYYY-MM-DD').optional(),
    dias_credito: z.coerce.number().int().min(0).max(365).default(0),
    pagado: z.boolean().optional(),
    proveedor: z.string().max(120).default(''),
    nota: z.string().max(500).default(''),
  }).refine(
    data => data.costo_unitario !== undefined || data.monto_total !== undefined,
    { message: 'Enviar costo_unitario o monto_total' },
  ),
  handler: async (args, ctx) => {
    if (ctx.idempotencyKey) {
      const cached = idemGet(ctx.idempotencyKey)
      if (cached) return cached
    }

    const proy = await resolverProyecto(args.proyecto_id)
    if (proy.estado !== 'activo') {
      throw new RpcError(400, `proyecto ${proy.correlativo} esta en estado "${proy.estado}" — no se pueden registrar gastos`)
    }

    const fecha = args.fecha ?? hoyISO()
    const costoUnitario = args.costo_unitario ?? (args.monto_total / args.cantidad)
    const monto = Math.round(args.cantidad * costoUnitario * 100) / 100
    const fechaVencimiento = addDaysISO(fecha, args.dias_credito)
    const pagado = args.pagado ?? (args.dias_credito === 0)

    const gasto = await prisma.gastoExtra.create({
      data: {
        proyectoId: proy.id,
        fecha,
        producto: args.producto,
        descripcion: args.descripcion,
        rubro: args.rubro,
        costoUnitario,
        valorUnitario: args.valor_unitario,
        cantidad: args.cantidad,
        unidad: args.unidad,
        monto,
        diasCredito: args.dias_credito,
        fechaVencimiento,
        pagado,
        proveedor: args.proveedor,
        nota: args.nota ? `[bot/${ctx.sub}] ${args.nota}` : '',
        creadoPor: ctx.sub,
        concepto: args.producto,
        montoUnit: costoUnitario,
      },
      select: {
        id: true,
        fecha: true,
        producto: true,
        rubro: true,
        cantidad: true,
        unidad: true,
        costoUnitario: true,
        monto: true,
        diasCredito: true,
        fechaVencimiento: true,
        pagado: true,
        proveedor: true,
        createdAt: true,
      },
    })

    const result = {
      registrado: true,
      gasto_id: gasto.id,
      proyecto_id: proy.id,
      proyecto_correlativo: proy.correlativo,
      fecha: gasto.fecha,
      producto: gasto.producto,
      rubro: gasto.rubro,
      cantidad: gasto.cantidad,
      unidad: gasto.unidad,
      costo_unitario: gasto.costoUnitario,
      monto: gasto.monto,
      dias_credito: gasto.diasCredito,
      fecha_vencimiento: gasto.fechaVencimiento || null,
      pagado: gasto.pagado,
      proveedor: gasto.proveedor || null,
      creado: gasto.createdAt.toISOString(),
    }
    if (ctx.idempotencyKey) idemSet(ctx.idempotencyKey, result)
    return result
  },
}

// ── 15. registrar_entrada_bitacora ───────────────────────────────────────────
const registrarEntradaBitacora: ToolDef = {
  name: 'registrar_entrada_bitacora',
  description: 'Crea una entrada diaria de bitácora en un proyecto. Suma los totales acumulados automáticamente desde la última entrada. Idempotente por Idempotency-Key.',
  scopes: ['bot:write', 'bot:field', 'bot:ops'],
  inputSchema: z.object({
    proyecto_id: z.string().min(1),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'formato YYYY-MM-DD').optional(),
    turno: z.enum(['dia', 'noche']).default('dia'),
    tipo: z.string().default('perforacion'),
    perforacion_dia: z.number().min(0).default(0),
    ampliacion1_dia: z.number().min(0).default(0),
    ampliacion2_dia: z.number().min(0).default(0),
    horas_perforacion: z.number().min(0).default(0),
    horas_limpieza: z.number().min(0).default(0),
    horas_aforo: z.number().min(0).default(0),
    bentonita_sacos: z.number().min(0).default(0),
    pipas: z.number().min(0).default(0),
    dia_activo: z.boolean().default(true),
    formacion_geologica: z.string().max(500).default(''),
    circulacion_pct: z.number().int().min(0).max(100).default(0),
    nota_cliente: z.string().max(1000).default(''),
    nota_interna: z.string().max(2000).default(''),
  }),
  handler: async (args, ctx) => {
    if (ctx.idempotencyKey) {
      const cached = idemGet(ctx.idempotencyKey)
      if (cached) return cached
    }

    const proy = await resolverProyecto(args.proyecto_id)
    if (proy.estado !== 'activo') {
      throw new RpcError(400, `proyecto ${proy.correlativo} está en estado "${proy.estado}" — no se pueden registrar entradas`)
    }

    const fecha = args.fecha ?? hoyISO()

    // Sumar acumulados desde la última entrada
    const ultima = await prisma.bitacoraEntry.findFirst({
      where: { proyectoId: proy.id },
      orderBy: { fecha: 'desc' },
      select: { perforacionTotal: true, ampliacion1Total: true, ampliacion2Total: true, rehabilitacionTotal: true },
    })
    const perforacionTotal = (ultima?.perforacionTotal ?? 0) + args.perforacion_dia
    const ampliacion1Total = (ultima?.ampliacion1Total ?? 0) + args.ampliacion1_dia
    const ampliacion2Total = (ultima?.ampliacion2Total ?? 0) + args.ampliacion2_dia

    const entry = await prisma.bitacoraEntry.create({
      data: {
        proyectoId: proy.id,
        fecha,
        turno: args.turno,
        tipo: args.tipo,
        perforacionDia: args.perforacion_dia,
        ampliacion1Dia: args.ampliacion1_dia,
        ampliacion2Dia: args.ampliacion2_dia,
        perforacionTotal,
        ampliacion1Total,
        ampliacion2Total,
        rehabilitacionTotal: ultima?.rehabilitacionTotal ?? 0,
        horasPerforacion: args.horas_perforacion,
        horasLimpieza: args.horas_limpieza,
        horasAforo: args.horas_aforo,
        bentonitaSacos: args.bentonita_sacos,
        pipas: args.pipas,
        diaActivo: args.dia_activo,
        formacionGeologica: args.formacion_geologica,
        circulacionPct: args.circulacion_pct,
        notaCliente: args.nota_cliente,
        notaInterna: args.nota_interna ? `[bot/${ctx.sub}] ${args.nota_interna}` : '',
      },
      select: { id: true, fecha: true, perforacionTotal: true, createdAt: true },
    })

    const result = {
      registrado: true,
      id: entry.id,
      proyecto_id: proy.id,
      proyecto_correlativo: proy.correlativo,
      fecha: entry.fecha,
      perforacion_dia: args.perforacion_dia,
      perforacion_total: entry.perforacionTotal,
      creado: entry.createdAt.toISOString(),
    }
    if (ctx.idempotencyKey) idemSet(ctx.idempotencyKey, result)
    return result
  },
}

// ── 16. reportar_incidente ───────────────────────────────────────────────────
const reportarIncidente: ToolDef = {
  name: 'reportar_incidente',
  description: 'Crea una entrada de bitácora marcada como día adverso (lluvia, avería, falla eléctrica, etc). El día no suma avance pero queda documentado.',
  scopes: ['bot:write', 'bot:field'],
  inputSchema: z.object({
    proyecto_id: z.string().min(1),
    descripcion: z.string().min(3).max(1000),
    tipo_incidente: z.enum(['lluvia', 'averia', 'falla_electrica', 'acceso_bloqueado', 'espera_material', 'otro']).default('otro'),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
  handler: async (args, ctx) => {
    if (ctx.idempotencyKey) {
      const cached = idemGet(ctx.idempotencyKey)
      if (cached) return cached
    }

    const proy = await resolverProyecto(args.proyecto_id)
    const fecha = args.fecha ?? hoyISO()

    const ultima = await prisma.bitacoraEntry.findFirst({
      where: { proyectoId: proy.id },
      orderBy: { fecha: 'desc' },
      select: { perforacionTotal: true, ampliacion1Total: true, ampliacion2Total: true, rehabilitacionTotal: true },
    })

    const entry = await prisma.bitacoraEntry.create({
      data: {
        proyectoId: proy.id,
        fecha,
        turno: 'dia',
        tipo: 'incidente',
        // Día adverso: no suma nada, acarrea los totales anteriores
        perforacionTotal: ultima?.perforacionTotal ?? 0,
        ampliacion1Total: ultima?.ampliacion1Total ?? 0,
        ampliacion2Total: ultima?.ampliacion2Total ?? 0,
        rehabilitacionTotal: ultima?.rehabilitacionTotal ?? 0,
        diaAdverso: true,
        diaActivo: false,
        notaInterna: `[bot/${ctx.sub}] Incidente tipo "${args.tipo_incidente}": ${args.descripcion}`,
        notaCliente: `Día adverso registrado — ${args.tipo_incidente.replace(/_/g, ' ')}`,
      },
      select: { id: true, fecha: true, createdAt: true },
    })

    const result = {
      registrado: true,
      id: entry.id,
      proyecto_id: proy.id,
      proyecto_correlativo: proy.correlativo,
      fecha: entry.fecha,
      tipo_incidente: args.tipo_incidente,
      creado: entry.createdAt.toISOString(),
    }
    if (ctx.idempotencyKey) idemSet(ctx.idempotencyKey, result)
    return result
  },
}

// ── 17. registrar_pago ───────────────────────────────────────────────────────
const registrarPago: ToolDef = {
  name: 'registrar_pago',
  description: 'Registra un pago recibido contra un proyecto. Debe categorizarlo por hito del plan de pagos (reserva/anticipo/mitad-perf/entubar/prueba/otro). Idempotente.',
  scopes: ['bot:write', 'bot:finance'],
  inputSchema: z.object({
    proyecto_id: z.string().min(1),
    hito_id: z.enum(['reserva', 'anticipo', 'mitad-perf', 'entubar', 'prueba', 'otro']),
    hito_label: z.string().max(100).optional(),
    monto: z.number().positive(),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    metodo: z.enum(['transferencia', 'cheque', 'deposito', 'efectivo', 'tarjeta']).default('transferencia'),
    referencia: z.string().max(100).default(''),
    nota: z.string().max(500).default(''),
  }),
  handler: async (args, ctx) => {
    if (ctx.idempotencyKey) {
      const cached = idemGet(ctx.idempotencyKey)
      if (cached) return cached
    }

    const proy = await resolverProyecto(args.proyecto_id)

    // Resolver el label del hito. Prioridad: (1) hito_label explícito, (2) plan del proyecto, (3) default.
    const DEFAULT_LABELS: Record<string, string> = {
      'reserva': 'Reserva',
      'anticipo': 'Anticipo',
      'mitad-perf': 'Mitad perforación',
      'entubar': 'Entubado',
      'prueba': 'Aforo/prueba',
      'otro': 'Otro',
    }
    let hitoLabel = args.hito_label ?? DEFAULT_LABELS[args.hito_id] ?? args.hito_id
    try {
      if (proy.planPagos) {
        const plan = JSON.parse(proy.planPagos) as Array<{ id: string; label: string }>
        const match = plan.find(h => h.id === args.hito_id)
        if (match && !args.hito_label) hitoLabel = match.label
      }
    } catch { /* ignore */ }

    const pago = await prisma.pago.create({
      data: {
        proyectoId: proy.id,
        proyectoCorrelativo: proy.correlativo,
        hitoId: args.hito_id,
        hitoLabel,
        monto: args.monto,
        fecha: args.fecha ?? hoyISO(),
        metodo: args.metodo,
        referencia: args.referencia,
        nota: args.nota ? `[bot/${ctx.sub}] ${args.nota}` : '',
        registradoPor: ctx.sub,
      },
      select: { id: true, monto: true, fecha: true, createdAt: true },
    })

    // Calcular saldo pendiente tras el pago
    const pagos = await prisma.pago.findMany({
      where: { proyectoId: proy.id, eliminadoEn: null },
      select: { monto: true },
    })
    const totalCobrado = pagos.reduce((s, p) => s + p.monto, 0)

    const result = {
      registrado: true,
      id: pago.id,
      proyecto_id: proy.id,
      proyecto_correlativo: proy.correlativo,
      hito_id: args.hito_id,
      hito_label: hitoLabel,
      monto: pago.monto,
      fecha: pago.fecha,
      total_cobrado: Math.round(totalCobrado * 100) / 100,
      saldo_pendiente: Math.round(Math.max(0, proy.monto - totalCobrado) * 100) / 100,
      creado: pago.createdAt.toISOString(),
    }
    if (ctx.idempotencyKey) idemSet(ctx.idempotencyKey, result)
    return result
  },
}

// ── 15. actualizar_contacto ──────────────────────────────────────────────────
const actualizarContacto: ToolDef = {
  name: 'actualizar_contacto',
  description: 'Actualiza datos de un contacto EXISTENTE (teléfono, email, empresa, dirección, notas). NO puede crear contactos ni cambiar el nombre.',
  scopes: ['bot:write'],
  inputSchema: z.object({
    contacto_id: z.string().min(1),
    telefono: z.string().max(30).optional(),
    email: z.string().email().max(200).optional().or(z.literal('')),
    empresa: z.string().max(200).optional(),
    departamento: z.string().max(100).optional(),
    municipio: z.string().max(100).optional(),
    notas: z.string().max(2000).optional(),
  }),
  handler: async (args, ctx) => {
    if (ctx.idempotencyKey) {
      const cached = idemGet(ctx.idempotencyKey)
      if (cached) return cached
    }

    const contacto = await prisma.contacto.findFirst({
      where: { id: args.contacto_id, eliminadoEn: null },
    })
    if (!contacto) throw new RpcError(404, 'contacto no encontrado')

    // Armar patch solo con fields provistos
    const data: Record<string, string> = {}
    if (args.telefono !== undefined) data.telefono = args.telefono
    if (args.email !== undefined) data.email = args.email
    if (args.empresa !== undefined) data.empresa = args.empresa
    if (args.departamento !== undefined) data.departamento = args.departamento
    if (args.municipio !== undefined) data.municipio = args.municipio
    if (args.notas !== undefined) {
      // Append al notas existente con marca de bot en lugar de sobreescribir
      const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
      data.notas = contacto.notas
        ? `${contacto.notas}\n\n[${stamp} · ${ctx.sub}] ${args.notas}`
        : `[${stamp} · ${ctx.sub}] ${args.notas}`
    }

    if (Object.keys(data).length === 0) {
      throw new RpcError(400, 'ningún campo para actualizar provisto')
    }

    const updated = await prisma.contacto.update({
      where: { id: contacto.id },
      data,
      select: { id: true, nombre: true, telefono: true, email: true, empresa: true, departamento: true, municipio: true },
    })

    const result = {
      actualizado: true,
      id: updated.id,
      nombre: updated.nombre,
      telefono: updated.telefono,
      email: updated.email,
      empresa: updated.empresa,
      departamento: updated.departamento,
      municipio: updated.municipio,
      campos_actualizados: Object.keys(data),
    }
    if (ctx.idempotencyKey) idemSet(ctx.idempotencyKey, result)
    return result
  },
}

// ── 16. actualizar_estado_proyecto ───────────────────────────────────────────
const actualizarEstadoProyecto: ToolDef = {
  name: 'actualizar_estado_proyecto',
  description: 'Cambia el estado de un proyecto (activo / pausado / completado). Guarda el motivo en la bitácora interna.',
  scopes: ['bot:write'],
  inputSchema: z.object({
    proyecto_id: z.string().min(1),
    estado: z.enum(['activo', 'pausado', 'completado']),
    motivo: z.string().max(500).optional(),
  }),
  handler: async (args, ctx) => {
    if (ctx.idempotencyKey) {
      const cached = idemGet(ctx.idempotencyKey)
      if (cached) return cached
    }

    const proy = await resolverProyecto(args.proyecto_id)
    if (proy.estado === args.estado) {
      return {
        actualizado: false,
        id: proy.id,
        proyecto_correlativo: proy.correlativo,
        estado: proy.estado,
        mensaje: `proyecto ya está en estado "${args.estado}"`,
      }
    }

    const updated = await prisma.proyecto.update({
      where: { id: proy.id },
      data: { estado: args.estado },
      select: { id: true, correlativo: true, estado: true },
    })

    // Dejar traza del cambio en bitácora interna
    if (args.motivo) {
      const ultima = await prisma.bitacoraEntry.findFirst({
        where: { proyectoId: proy.id },
        orderBy: { fecha: 'desc' },
        select: { perforacionTotal: true, ampliacion1Total: true, ampliacion2Total: true, rehabilitacionTotal: true },
      })
      await prisma.bitacoraEntry.create({
        data: {
          proyectoId: proy.id,
          fecha: hoyISO(),
          turno: 'dia',
          tipo: 'cambio_estado',
          perforacionTotal: ultima?.perforacionTotal ?? 0,
          ampliacion1Total: ultima?.ampliacion1Total ?? 0,
          ampliacion2Total: ultima?.ampliacion2Total ?? 0,
          rehabilitacionTotal: ultima?.rehabilitacionTotal ?? 0,
          diaActivo: false,
          notaInterna: `[bot/${ctx.sub}] Estado cambiado de "${proy.estado}" a "${args.estado}". Motivo: ${args.motivo}`,
        },
      }).catch(() => { /* no blocker si la bitácora falla */ })
    }

    const result = {
      actualizado: true,
      id: updated.id,
      proyecto_correlativo: updated.correlativo,
      estado_anterior: proy.estado,
      estado_nuevo: updated.estado,
      motivo: args.motivo ?? null,
    }
    if (ctx.idempotencyKey) idemSet(ctx.idempotencyKey, result)
    return result
  },
}

// ── Registro de tools ────────────────────────────────────────────────────────
export const TOOLS: Record<string, ToolDef> = {
  [buscarOportunidad.name]: buscarOportunidad,
  [expedienteCliente.name]: expedienteCliente,
  [historialCliente.name]: historialCliente,
  [previewCotizacion.name]: previewCotizacion,
  [simularDescuento.name]: simularDescuento,
  [registrarMensaje.name]: registrarMensaje,
  [miProyecto.name]: miProyecto,
  [miBitacora.name]: miBitacora,
  [misPagos.name]: misPagos,
  [miCotizacion.name]: miCotizacion,
  [metricasPeriodo.name]: metricasPeriodo,
  [listarProyectosActivos.name]: listarProyectosActivos,
  [alertasBitacoraPendiente.name]: alertasBitacoraPendiente,
  [registrarGastoControl.name]: registrarGastoControl,
  [registrarEntradaBitacora.name]: registrarEntradaBitacora,
  [reportarIncidente.name]: reportarIncidente,
  [registrarPago.name]: registrarPago,
  [actualizarContacto.name]: actualizarContacto,
  [actualizarEstadoProyecto.name]: actualizarEstadoProyecto,
}
