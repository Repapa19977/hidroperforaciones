export type AppRole = 'admin' | 'admin_operativo' | 'superadmin' | 'cliente_final' | 'bot'
export type InternalRole = Extract<AppRole, 'admin' | 'admin_operativo' | 'superadmin'>

export const INTERNAL_ASSIGNABLE_ROLES: InternalRole[] = ['admin', 'admin_operativo', 'superadmin']

export function isInternalRole(role: string | null | undefined): role is InternalRole {
  return role === 'admin' || role === 'admin_operativo' || role === 'superadmin'
}

export function canAssignVendedor(role: string | null | undefined): boolean {
  return role === 'superadmin' || role === 'admin_operativo'
}

export function canViewAllCotizaciones(role: string | null | undefined): boolean {
  return role === 'superadmin' || role === 'admin_operativo'
}

export function canAccessActiveProjectBitacora(role: string | null | undefined): boolean {
  return role === 'superadmin' || role === 'admin_operativo'
}

export function canDeleteBitacora(role: string | null | undefined): boolean {
  return role === 'superadmin'
}

export function canViewFinancials(role: string | null | undefined): boolean {
  return role === 'superadmin'
}
