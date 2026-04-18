/**
 * Días hábiles (lun-vie) — excluye sábados y domingos.
 * Se usa para calcular fecha estimada de finalización del proyecto y el
 * "día del proyecto" actual desde que se envió la primera bitácora.
 */

export function esDiaHabil(fecha: Date): boolean {
  const dia = fecha.getDay() // 0=dom, 1=lun, ..., 6=sáb
  return dia !== 0 && dia !== 6
}

/** Agrega N días hábiles a una fecha y devuelve la fecha resultante. */
export function sumarDiasHabiles(inicio: Date, diasHabiles: number): Date {
  const d = new Date(inicio.getTime())
  let agregados = 0
  while (agregados < diasHabiles) {
    d.setDate(d.getDate() + 1)
    if (esDiaHabil(d)) agregados++
  }
  return d
}

/** Cuenta días hábiles entre dos fechas (inclusive ambas si son hábiles). */
export function contarDiasHabiles(desde: Date, hasta: Date): number {
  const start = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate())
  const end   = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate())
  if (end < start) return 0
  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    if (esDiaHabil(cur)) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

/**
 * Dado:
 *  - fecha de la primera bitácora (YYYY-MM-DD)
 *  - duración total del proyecto en días hábiles (ej. 65)
 * Devuelve:
 *  - fechaInicio (la primera bitácora)
 *  - fechaFinEstimada (primera + N días hábiles)
 *  - diaActualDelProyecto (cuántos días hábiles transcurrieron hasta hoy)
 *  - diasRestantes
 */
export function calcularCronograma(
  fechaPrimeraBitacoraISO: string | null,
  diasHabilesTotal: number,
  hoy: Date = new Date(),
): {
  fechaInicio: Date | null
  fechaFinEstimada: Date | null
  diaActualDelProyecto: number
  diasRestantes: number
} {
  if (!fechaPrimeraBitacoraISO) {
    return { fechaInicio: null, fechaFinEstimada: null, diaActualDelProyecto: 0, diasRestantes: diasHabilesTotal }
  }
  const inicio = new Date(fechaPrimeraBitacoraISO + 'T12:00:00')
  const fin = sumarDiasHabiles(inicio, diasHabilesTotal - 1)
  const diaActual = Math.min(diasHabilesTotal, contarDiasHabiles(inicio, hoy))
  const restantes = Math.max(0, diasHabilesTotal - diaActual)
  return {
    fechaInicio: inicio,
    fechaFinEstimada: fin,
    diaActualDelProyecto: diaActual,
    diasRestantes: restantes,
  }
}

export function formatearFecha(d: Date): string {
  return d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })
}
