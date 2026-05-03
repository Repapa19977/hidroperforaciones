import { z } from 'zod'

// Estados válidos de cotización (alineado con lib/config-store.ts y UI)
export const ESTADOS_COTIZACION = ['borrador', 'enviada', 'confirmada', 'cancelada'] as const

export const patchCotizacionSchema = z.object({
  estado:   z.enum(ESTADOS_COTIZACION).optional(),
  vendedor: z.string().min(1).max(100).optional(),  // reasignación — sólo superadmin
  usuario:  z.string().max(100).optional(),
}).refine(d => d.estado !== undefined || d.vendedor !== undefined, {
  message: 'Falta al menos estado o vendedor para actualizar',
})

export const bitacoraEntrySchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha debe ser YYYY-MM-DD'),
  turno: z.string().max(20).optional().default('dia'),
  estado: z.string().max(50).optional().default(''),
  tipo: z.string().max(20).optional(),
  perforacionDia: z.number().min(0).optional().default(0),
  ampliacion1Dia: z.number().min(0).optional().default(0),
  ampliacion2Dia: z.number().min(0).optional().default(0),
  rehabilitacionDia: z.number().min(0).optional().default(0),
  perforacionTotal: z.number().min(0).optional().default(0),
  ampliacion1Total: z.number().min(0).optional().default(0),
  ampliacion2Total: z.number().min(0).optional().default(0),
  rehabilitacionTotal: z.number().min(0).optional().default(0),
  horasPerforacion: z.number().min(0).max(24).optional().default(0),
  bentonitaSacos: z.number().min(0).optional().default(0),
  pipas: z.number().min(0).optional().default(0),
  horasLimpieza: z.number().min(0).max(24).optional().default(0),
  horasAforo: z.number().min(0).max(24).optional().default(0),
  diaAdverso: z.boolean().optional().default(false),
  notaInterna: z.string().max(2000).optional().default(''),
  notaCliente: z.string().max(2000).optional().default(''),
  formacionGeologica: z.string().max(200).optional().default(''),
  circulacionPct: z.number().min(0).max(100).optional().default(0),
})

export const TIPOS_MOVIMIENTO = ['venta_externa', 'ajuste', 'compra', 'liberacion_proyecto'] as const

export const movimientoInventarioSchema = z.object({
  reservaId: z.string().min(1, 'reservaId requerido'),
  tipo: z.enum(TIPOS_MOVIMIENTO),
  cantidad: z.number().positive('cantidad debe ser > 0'),
  precioUnit: z.number().min(0).optional().default(0),
  cliente: z.string().max(200).optional().default(''),
  nota: z.string().max(500).optional().default(''),
  usuario: z.string().max(100).optional().default(''),
})

export const loginSchema = z.object({
  username: z.string().min(1).max(50).trim(),
  password: z.string().min(1).max(200),
  totpCode: z.string().max(20).optional(),
})

export function formatZodError(err: z.ZodError): { error: string; detalles: Array<{ campo: string; mensaje: string }> } {
  return {
    error: 'Datos inválidos',
    detalles: err.issues.map(issue => ({
      campo: issue.path.join('.') || '(root)',
      mensaje: issue.message,
    })),
  }
}
