// Audit log helper — registra acciones sensibles en la tabla AuditLog.
// Uso típico:
//   await auditLog({ user, accion: 'delete', entidad: 'cotizacion', entidadId: id, antes: row })

import { prisma } from './db'
import type { CurrentUser } from './auth'

export interface AuditLogInput {
  user?: CurrentUser | null
  accion: 'create' | 'update' | 'delete' | 'restore' | 'login' | 'logout' | 'approve' | 'confirm' | 'cancel' | string
  entidad: 'cotizacion' | 'contacto' | 'proyecto' | 'oportunidad' | 'usuario' | 'config' | 'servicetoken' | 'bitacora' | 'inventario' | 'gasto' | string
  entidadId?: string
  antes?: unknown
  despues?: unknown
  ip?: string
  userAgent?: string
}

export async function auditLog(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        usuario: input.user?.username ?? '',
        rol: input.user?.role ?? '',
        accion: input.accion,
        entidad: input.entidad,
        entidadId: input.entidadId ?? '',
        antes: input.antes !== undefined ? JSON.stringify(input.antes) : '',
        despues: input.despues !== undefined ? JSON.stringify(input.despues) : '',
        ip: input.ip ?? '',
        userAgent: input.userAgent ?? '',
      },
    })
  } catch (e) {
    // No fallar la operación principal si el log falla. Solo loggear.
    console.error('[auditLog] error insertando registro:', e instanceof Error ? e.message : e)
  }
}
