import type { CurrentUser } from '@/lib/auth'

export function parseCotizacionDatos(datos: string | null | undefined): Record<string, unknown> {
  if (!datos) return {}
  try {
    const parsed = JSON.parse(datos)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function canAccessCotizacion(user: CurrentUser, row: { vendedor: string; datos?: string | null }): boolean {
  if (user.role === 'superadmin') return true
  if (row.vendedor === user.vendedor) return true

  const datos = parseCotizacionDatos(row.datos)
  return user.role === 'admin_operativo' && datos.creadoPorUsuario === user.username
}

