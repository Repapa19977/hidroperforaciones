// Configuración global de la app — editable solo por Super Admin
// Persiste en localStorage

export type Rol = 'superadmin' | 'admin'

// ── Precios fijos de líneas de cotización ─────────────────────────────────────
export interface PreciosLineas {
  instalacionEquipo: number        // Q3,500
  registroElectrico: number        // Q8,500
  desarrolloLimpieza: number       // Q12,000 (perforación)
  cementacion: number              // Q4,500
  analisisFisicoQuimico: number    // Q3,200
  analisisBacteriologico: number   // Q2,800
  informeFinal: number             // Q4,500
  desinstalacion: number           // Q3,500
  sartaProduccion: number          // Q12,000
  desarrolloLimpiezaFinal: number  // Q4,500 (limpieza mecánica)
}

export const DEFAULT_PRECIOS_LINEAS: PreciosLineas = {
  instalacionEquipo:       3500,
  registroElectrico:       8500,
  desarrolloLimpieza:     12000,
  cementacion:             4500,
  analisisFisicoQuimico:   3200,
  analisisBacteriologico:  2800,
  informeFinal:            4500,
  desinstalacion:          3500,
  sartaProduccion:        12000,
  desarrolloLimpiezaFinal: 4500,
}

export interface AppConfig {
  // ── Impuestos ─────────────────────────────────────────────────────
  iva: number              // 0.12  (12% — IVA Guatemala)
  isr: number              // 0.07  (7%  — ISR retención)

  // ── Precios de venta base ─────────────────────────────────────────
  precioPorPieBase: number       // Q/pie perforación (ej: 700)
  precioVentaHoraBase: number    // Q/hora limpieza   (ej: 375)

  // ── Costos operativos fijos ───────────────────────────────────────
  costomaquinariaDia: number     // Q4,000
  costoDieselDia: number         // Q2,000
  bonificacionPorPie: number     // Q13
  precioBentonitaSaco: number    // Q157
  costoAforoBase: number         // Q7,931
  costoBombaDefault: number      // Q27,500
  costoGravaDefault: number      // Q9,000
  comisionVendedorPct: number    // 1%

  // ── Precios de líneas de cotización ──────────────────────────────
  preciosLineas: PreciosLineas
  bloquearPreciosAdmin: boolean  // true = solo superadmin puede editar precios de línea
}

const CONFIG_KEY = 'hidrocrm_config'
const ROL_KEY    = 'hidrocrm_rol'
const PIN_SUPERADMIN = '1234'  // PIN simple — cambiar en producción real

export const DEFAULT_CONFIG: AppConfig = {
  iva: 0.12,
  isr: 0.07,
  precioPorPieBase: 700,
  precioVentaHoraBase: 375,
  costomaquinariaDia: 4000,
  costoDieselDia: 2000,
  bonificacionPorPie: 13,
  precioBentonitaSaco: 157,
  costoAforoBase: 7931,
  costoBombaDefault: 27500,
  costoGravaDefault: 9000,
  comisionVendedorPct: 1,
  preciosLineas: DEFAULT_PRECIOS_LINEAS,
  bloquearPreciosAdmin: false,
}

export function getConfig(): AppConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG
  const raw = localStorage.getItem(CONFIG_KEY)
  if (!raw) return DEFAULT_CONFIG
  try { return { ...DEFAULT_CONFIG, ...JSON.parse(raw) } } catch { return DEFAULT_CONFIG }
}

export function saveConfig(cfg: AppConfig) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
  }
}

export function getRol(): Rol {
  if (typeof document === 'undefined') return 'admin'
  const match = document.cookie.match(/user_role=([^;]+)/)
  return (match?.[1] as Rol) ?? 'admin'
}

// Solo para la página de Configuración (PIN local para ajustes dentro de la sesión)
// El rol real viene del JWT establecido en el login
export function setRol(rol: Rol) {
  if (typeof document !== 'undefined') {
    document.cookie = `user_role=${rol};path=/;max-age=${60 * 60 * 8};samesite=lax`
  }
}

export function verificarPinSuperAdmin(pin: string): boolean {
  return pin === PIN_SUPERADMIN
}

// Campos que Admin NO puede editar en la calculadora
export const CAMPOS_SOLO_SUPERADMIN_PERF: (string)[] = [
  'precioPorPieVenta',
  'costomaquinariaDia',
  'costoDieselDia',
  'bonificacionPorPie',
  'precioBentonitaSaco',
  'costoAforoBase',
  'costoGravaTotalQ',
  'costoBomba',
  'comisionVendedorPct',
  'salarioMensual',
  'viaticosDia',
  'hospedajeNoche',
  'precioDieselTraslado',
]

export const CAMPOS_SOLO_SUPERADMIN_LIMP: (string)[] = [
  'precioVentaHora',
  'salarioMensual',
  'viaticosDiarios',
  'hospedajeDiario',
  'precioDiesel',
  'precioQuimicoCaneca',
]
