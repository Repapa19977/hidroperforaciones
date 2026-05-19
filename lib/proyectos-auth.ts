import type { CurrentUser } from '@/lib/auth'
import { canAccessActiveProjectBitacora } from '@/lib/roles'

type ProyectoAccessRow = {
  vendedor: string
  estado: string
  eliminadoEn?: Date | string | null
}

export function canListProjects(user: CurrentUser): boolean {
  return canAccessActiveProjectBitacora(user.role)
}

export function canAccessProyecto(user: CurrentUser, proyecto: ProyectoAccessRow): boolean {
  if (user.role === 'superadmin') return true
  return user.role === 'admin_operativo' && proyecto.estado === 'activo' && !proyecto.eliminadoEn
}

export function canWriteProyectoBitacora(user: CurrentUser, proyecto: ProyectoAccessRow): boolean {
  return canAccessProyecto(user, proyecto)
}

