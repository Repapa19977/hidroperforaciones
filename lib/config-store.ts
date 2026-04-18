// Configuración global de la app — editable solo por Super Admin
// Persiste en localStorage

export type Rol = 'superadmin' | 'admin'

// ── Precios fijos de líneas de cotización ─────────────────────────────────────
export interface PreciosLineas {
  // ── Líneas originales (backward compat) ──────────────────────────────────
  instalacionEquipo: number        // Q3,000 (Odoo real)
  registroElectrico: number        // Q7,000 (Odoo real)
  desarrolloLimpieza: number       // Q12,000 (extracción lodos — condicional)
  cementacion: number              // Q4,500
  analisisFisicoQuimico: number    // Q3,200 (legacy, reemplazado por analisisCombinado)
  analisisBacteriologico: number   // Q2,800 (legacy)
  informeFinal: number             // Q4,500
  desinstalacion: number           // Q3,500
  sartaProduccion: number          // Q12,000
  desarrolloLimpiezaFinal: number  // Q4,500 (limpieza mecánica módulo separado)

  // ── Nuevas líneas (formato Odoo) ─────────────────────────────────────────
  colocacionTuberia: number        // Q35/pie  — labor ADEME
  transGrava: number               // Q700     — transporte grava al cliente
  instalacionGrava: number         // Q100/m³  — mano de obra instalación grava
  selloSanitario: number           // Q500     — sello sanitario (precio venta)
  sopleteado: number               // Q500     — sopleteado con compresor
  precioLimpiezaHora: number       // Q400/h   — limpieza en cotización de perf
  trasladoGenerador: number        // Q2,100   — generador + bomba + instalación
  pruebaBombeo: number             // Q700/h   — prueba de bombeo
  brocal: number                   // Q500     — brocal de concreto
  analisisCombinado: number        // Q800     — FQ + bacteriológico (Odoo real)
}

export const DEFAULT_PRECIOS_LINEAS: PreciosLineas = {
  // legacy
  instalacionEquipo:       3000,   // Odoo real (era 3500)
  registroElectrico:       7000,   // Odoo real (era 12000 — superadmin puede subir)
  desarrolloLimpieza:     12000,
  cementacion:             4500,
  analisisFisicoQuimico:   3200,
  analisisBacteriologico:  2800,
  informeFinal:            4500,
  desinstalacion:          3500,
  sartaProduccion:        12000,
  desarrolloLimpiezaFinal: 4500,

  // nuevas (Odoo)
  colocacionTuberia:         35,
  transGrava:               700,
  instalacionGrava:         100,
  selloSanitario:           500,
  sopleteado:               500,
  precioLimpiezaHora:       400,      // Q/hora limpieza mecánica (línea 14 separada)
  trasladoGenerador:       2100,
  pruebaBombeo:             950,      // Q/hora unificada: traslado generador + prueba de bombeo
  brocal:                   500,
  analisisCombinado:        800,
}

export interface AppConfig {
  // ── Impuestos ─────────────────────────────────────────────────────
  iva: number              // 0.12  (12% — IVA Guatemala)
  isr: number              // 0.05  (5%  — ISR retención)

  // ── Precios de venta base ─────────────────────────────────────────
  precioPorPieBase: number       // Q/pie perforación (ej: 700)
  precioVentaHoraBase: number    // Q/hora limpieza   (ej: 375)

  // ── Costos operativos fijos ───────────────────────────────────────
  costomaquinariaDia: number     // Q4,000
  costoDieselDia: number         // Q2,000
  bonificacionPorPie: number     // Q13
  precioBentonitaSaco: number    // Q303 — precio real (Hoja 3)
  costoAforoBase: number         // Q9,290 — subtotal real (Hoja AFORO.xlsx)
  costoBombaDefault: number      // Q27,500
  costoGravaDefault: number      // Q9,000
  comisionVendedorPct: number    // 1%
  markupQuimicosLimpieza: number // 1.5 = 50% markup sobre costo de químicos en cotización de limpieza

  // ── Precios de líneas de cotización ──────────────────────────────
  preciosLineas: PreciosLineas
  bloquearPreciosAdmin: boolean  // true = solo superadmin puede editar precios de línea

  // ── Costos base por rubro (overrides del superadmin sobre COSTOS_BASE) ──
  // Map de rubroKey → costoUnitario editado. Si no existe override, se usa el default de COSTOS_BASE.
  costosBaseOverride?: Record<string, number>

  // ── Cuentas bancarias (se imprimen al pie del PDF de cotización) ──
  cuentasBancarias?: CuentaBancaria[]
}

export interface CuentaBancaria {
  banco: string       // ej. "Banco Industrial"
  tipo: string        // ej. "Cuenta monetaria quetzales"
  numero: string      // ej. "027003319-4"
}

const CONFIG_KEY = 'hidrocrm_config'
const ROL_KEY    = 'hidrocrm_rol'
const PIN_SUPERADMIN = '1234'  // PIN simple — cambiar en producción real

export const DEFAULT_CONFIG: AppConfig = {
  iva: 0.12,
  isr: 0.05,
  precioPorPieBase: 700,
  precioVentaHoraBase: 400,
  costomaquinariaDia: 0,       // Excel reunión: Q 0 (editable — margen reservado)
  costoDieselDia: 2300,        // Excel reunión: Q 2,300/día
  bonificacionPorPie: 15,      // Excel reunión: Q 15/pie
  precioBentonitaSaco: 303,  // Q303/saco — precio real (Hoja 3)
  costoAforoBase: 9290,  // subtotal real (Hoja AFORO.xlsx verificada)
  costoBombaDefault: 27500,
  costoGravaDefault: 9000,
  comisionVendedorPct: 1,
  markupQuimicosLimpieza: 1.5,  // 50% markup default; editable por superadmin
  preciosLineas: DEFAULT_PRECIOS_LINEAS,
  bloquearPreciosAdmin: false,
  costosBaseOverride: {},
  // Cuentas bancarias oficiales de HIDROPERFORACIONES, S.A. (se imprimen en el PDF).
  cuentasBancarias: [
    { banco: 'Banco Industrial', tipo: 'Cuenta monetaria quetzales', numero: '027003319-4' },
    { banco: 'Banrural',         tipo: 'Cuenta monetaria quetzales', numero: '3516073418' },
    { banco: 'Banco CHN',        tipo: 'Cuenta monetaria quetzales', numero: '02-099-081589-1' },
    { banco: 'BAC Credomatic',   tipo: 'Cuenta monetaria quetzales', numero: '70571190-2' },
  ],
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
  'costoGravaMaterial',
  'costoGravaPorM3',
  'costoBomba',
  'comisionVendedorPct',
  'salarioMensual',
  'viaticosDia',
  'hospedajeNoche',
  'precioDieselTraslado',
  'espesorLisa',
  'espesorRanurada',
]

export const CAMPOS_SOLO_SUPERADMIN_LIMP: (string)[] = [
  'precioVentaHora',
  'salarioMensual',
  'viaticosDiarios',
  'hospedajeDiario',
  'precioDiesel',
  'precioQuimicoCaneca',
]
