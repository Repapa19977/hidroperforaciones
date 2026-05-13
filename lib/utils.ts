import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formato estándar de moneda quetzales con dos decimales. Fuente única en toda la app. */
export const formatQ = (n: number): string =>
  `Q ${(Number.isFinite(n) ? n : 0).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Formato de porcentaje desde fracción (0.12 → "12%") */
export const formatPct = (n: number): string =>
  `${(n * 100).toFixed(0)}%`

/** Clases Tailwind para el badge de estado de proyectos.
 *  Valores: activo | pausado | completado | cancelado. */
export function estadoBadgeClass(estado: 'activo' | 'pausado' | 'completado' | 'cancelado' | string): string {
  const map: Record<string, string> = {
    activo:     'bg-emerald-500/20 text-emerald-400',
    pausado:    'bg-amber-500/20 text-amber-400',
    completado: 'bg-blue-500/20 text-blue-400',
    cancelado:  'bg-red-500/20 text-red-400',
  }
  return map[estado] ?? 'bg-slate-500/20 text-slate-400'
}
