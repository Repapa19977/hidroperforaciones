// Helpers compartidos para los módulos de Cuentas por Pagar / Cobrar.
// Fórmula fiscal estándar Guatemala: IVA 12% + ISR 5% retención.
// El middleware proxy.ts ya fuerza que solo superadmin llegue a estas rutas.

export const IVA_RATE = 0.12
export const ISR_RATE = 0.05

export interface CuentaInputComun {
  monto: number
  aplicarIva: boolean
  aplicarIsr: boolean
  diasCredito: number
  fechaEmision: string
}

/** Calcula los montos fiscales + fecha de vencimiento a partir de los inputs. */
export function calcularTotales(input: CuentaInputComun) {
  const monto = Math.max(0, Number(input.monto) || 0)
  const ivaMonto = input.aplicarIva ? Math.round(monto * IVA_RATE) : 0
  const isrMonto = input.aplicarIsr ? Math.round(monto * ISR_RATE) : 0
  // IVA se SUMA al total (lo que se debe pagar/cobrar incluye IVA)
  // ISR se RESTA (retención — queda como obligación tributaria, no se paga al proveedor)
  const total = monto + ivaMonto - isrMonto

  // Vencimiento = emision + diasCredito (días calendario)
  let fechaVencimiento = input.fechaEmision
  if (input.diasCredito > 0 && input.fechaEmision) {
    const d = new Date(input.fechaEmision + 'T12:00:00')
    d.setDate(d.getDate() + input.diasCredito)
    fechaVencimiento = d.toISOString().slice(0, 10)
  }

  return { ivaMonto, isrMonto, total, fechaVencimiento }
}

/** Días desde/hasta el vencimiento (negativo si ya venció). */
export function diasRestantes(fechaVencimiento: string, hoy = new Date()): number {
  if (!fechaVencimiento) return 0
  const venc = new Date(fechaVencimiento + 'T12:00:00')
  const diff = (venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
  return Math.round(diff)
}

/** Estado de una cuenta sin pagar/cobrar. */
export type EstadoCuenta = 'vigente' | 'por_vencer' | 'vencida' | 'cerrada'

export function estadoCuenta(cerrada: boolean, fechaVencimiento: string, hoy = new Date()): EstadoCuenta {
  if (cerrada) return 'cerrada'
  const d = diasRestantes(fechaVencimiento, hoy)
  if (d < 0) return 'vencida'
  if (d <= 7) return 'por_vencer'
  return 'vigente'
}
