// Configuración global de la app — editable solo por Super Admin
// Persiste en localStorage

export type Rol = 'superadmin' | 'admin_operativo' | 'admin'

// ── Precios fijos de líneas de cotización ─────────────────────────────────────
export interface PreciosLineas {
  // ── Líneas originales (backward compat) ──────────────────────────────────
  instalacionEquipo: number        // Q3,000 (Odoo real)
  registroElectrico: number        // Q8,000 (Excel FORMULAS PARA RODRI)
  desarrolloLimpieza: number       // Q800/viaje (extracción lodos — condicional)
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
  selloSanitario: number           // Q100/pie — sello sanitario según Excel
  sopleteado: number               // Q500     — sopleteado con compresor
  precioLimpiezaHora: number       // Q375/h   — limpieza en cotización de perf
  trasladoGenerador: number        // Q2,100   — generador + bomba + instalación
  pruebaBombeo: number             // Q700/h   — prueba de bombeo
  brocal: number                   // Q500     — brocal de concreto
  analisisCombinado: number        // Q1,500   — análisis físico-químico unificado (instrucción jefe 2026-04-20)
}

export const DEFAULT_PRECIOS_LINEAS: PreciosLineas = {
  // legacy
  instalacionEquipo:       3000,   // Odoo real (era 3500)
  registroElectrico:       8000,
  desarrolloLimpieza:       800,   // Q/viaje; viajes = profundidad / 20
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
  selloSanitario:           100,  // Q/pie; costo interno Q50/pie
  sopleteado:               500,
  precioLimpiezaHora:       375,      // Q/hora limpieza mecánica (línea 14 separada)
  trasladoGenerador:       2100,
  pruebaBombeo:             950,      // Q/hora unificada: traslado generador + prueba de bombeo
  brocal:                   500,
  analisisCombinado:       1500,  // Instrucción jefe 2026-04-20: análisis físico-químico unificado Q1500 venta (Q1000 costo interno)
}

export interface ServicioTuberiaRegla {
  diametro: number
  precioExtraccion: number
  tubosHoraExtraccion: number
  precioInstalacion: number
  tubosHoraInstalacion: number
  personal: number
}

export interface ServicioCotizacionConfig {
  dieselGalon: number
  trasladoKmPorGalon: number
  trasladoPrecioVenta: number
  consumoExtraccionInstalacionGalHora: number
  consumoLimpiezaGalHora: number
  precioLimpiezaHora: number
  costoQuimicoCaneca: number
  precioVentaQuimicoCaneca: number
  horasDiaLimpieza: number
  personalServicio: number
  tablaTuberia: ServicioTuberiaRegla[]
  materialInstalacionPrecio: number
  materialInstalacionCosto: number
  tecnicoChequeoPrecio: number
  tecnicoChequeoCosto: number
  camaraInspeccionPrecio: number
  camaraInspeccionCosto: number
  medicionNivelPrecio: number
  medicionNivelCosto: number
  analisisAguaPrecio: number
  analisisAguaCosto: number
}

export const DEFAULT_SERVICIO_TUBERIA: ServicioTuberiaRegla[] = [
  { diametro: 2,   precioExtraccion: 110, tubosHoraExtraccion: 8, precioInstalacion: 110, tubosHoraInstalacion: 8, personal: 2 },
  { diametro: 2.5, precioExtraccion: 115, tubosHoraExtraccion: 8, precioInstalacion: 115, tubosHoraInstalacion: 8, personal: 2 },
  { diametro: 3,   precioExtraccion: 120, tubosHoraExtraccion: 6, precioInstalacion: 120, tubosHoraInstalacion: 6, personal: 2 },
  { diametro: 4,   precioExtraccion: 140, tubosHoraExtraccion: 5, precioInstalacion: 140, tubosHoraInstalacion: 5, personal: 2 },
  { diametro: 6,   precioExtraccion: 180, tubosHoraExtraccion: 4, precioInstalacion: 180, tubosHoraInstalacion: 4, personal: 3 },
  { diametro: 8,   precioExtraccion: 200, tubosHoraExtraccion: 3, precioInstalacion: 200, tubosHoraInstalacion: 3, personal: 3 },
  { diametro: 10,  precioExtraccion: 220, tubosHoraExtraccion: 2, precioInstalacion: 220, tubosHoraInstalacion: 2, personal: 3 },
]

export const DEFAULT_SERVICIO_COTIZACION: ServicioCotizacionConfig = {
  dieselGalon: 30,
  trasladoKmPorGalon: 20,
  trasladoPrecioVenta: 1800,
  consumoExtraccionInstalacionGalHora: 2.5,
  consumoLimpiezaGalHora: 3,
  precioLimpiezaHora: 375,
  costoQuimicoCaneca: 700,
  precioVentaQuimicoCaneca: 1400,
  horasDiaLimpieza: 10,
  personalServicio: 2,
  tablaTuberia: DEFAULT_SERVICIO_TUBERIA,
  materialInstalacionPrecio: 1500,
  materialInstalacionCosto: 700,
  tecnicoChequeoPrecio: 2500,
  tecnicoChequeoCosto: 1200,
  camaraInspeccionPrecio: 8000,
  camaraInspeccionCosto: 4500,
  medicionNivelPrecio: 0,
  medicionNivelCosto: 0,
  analisisAguaPrecio: 0,
  analisisAguaCosto: 0,
}

export interface AppConfig {
  // ── Impuestos ─────────────────────────────────────────────────────
  iva: number              // 0.12  (12% — IVA Guatemala)
  isr: number              // 0.05  (5%  — ISR retención)

  // ── Precios de venta base ─────────────────────────────────────────
  precioPorPieBase: number       // Q/pie perforación (ej: 700)
  precioVentaHoraBase: number    // Q/hora limpieza   (ej: 375)
  servicioCotizacion: ServicioCotizacionConfig
  servicioCotizacionConfigVersion?: number

  // ── Costos operativos fijos ───────────────────────────────────────
  costomaquinariaDia: number     // Q4,000
  costoDieselDia: number         // Q2,000
  bonificacionPorPie: number     // Q13
  precioBentonitaSaco: number    // Q303 — precio real (Hoja 3)
  costoAforoBase: number         // Q9,290 — subtotal real (Hoja AFORO.xlsx)
  costoGravaDefault: number      // Q9,000
  comisionVendedorPct: number    // 1%
  markupQuimicosLimpieza: number // 1.5 = 50% markup sobre costo de químicos en cotización de limpieza

  // ── Pipas de agua (perforación) ─────────────────────────────────────
  // Fórmula: internas = profundidad / 20 · cliente = ceil(internas / 2)
  pipaCostoUnitario: number      // Q 500/pipa — costo interno nuestro
  pipaPrecioVentaUnitario: number // Q 700/pipa — se refleja al cliente en PDF

  // ── Transporte grava (perforación) ──────────────────────────────────
  // Fórmula: camionadas = ceil(m³Grava / capacidadCamionM3)
  capacidadCamionM3: number                // 12 m³ por camión (máx por flete)
  camionadaGravaCostoUnitario: number      // Q 5,000 costo nuestro por camionada
  camionadaGravaPrecioVentaUnitario: number // Q 6,000 venta al cliente por camionada

  // ── Precios de líneas de cotización ──────────────────────────────
  preciosLineas: PreciosLineas
  perforacionFormulasConfigVersion?: number
  bloquearPreciosAdmin: boolean  // true = solo superadmin puede editar precios de línea

  // ── Costos base por rubro (overrides del superadmin sobre COSTOS_BASE) ──
  // Map de rubroKey → costoUnitario editado. Si no existe override, se usa el default de COSTOS_BASE.
  costosBaseOverride?: Record<string, number>
  // Map de rubroKey → precio de venta al cliente editado globalmente.
  // Al crear una cotización nueva se convierte a preciosVentaOverride por línea,
  // respetando las fórmulas de cantidades y el rubro residual de perforación.
  costosBaseVentaOverride?: Record<string, number>

  // ── Overrides del catálogo de tuberías ──
  // Map de `${tipo}-${diametro}-${espesor}` → costo interno editado. Ej: "lisa-8-0.25" → 2250.
  // Si no existe, se usa el costo interno del CATALOGO_TUBERIA hardcoded en calculator.ts.
  tuberiasOverride?: Record<string, number>
  // Map de `${tipo}-${diametro}-${espesor}` → % markup sobre costo interno (default 30).
  // El precio cliente de referencia = costo interno × (1 + markup/100). Visualización para tracking;
  // cotización sigue usando MARKUP_TUBERIA = 1.30 hardcoded en pdf-cotizacion.ts.
  tuberiasMarkupPct?: Record<string, number>
  // Tuberías custom agregadas por superadmin (medidas que no están en CATALOGO_TUBERIA).
  // Aparecen en los selectores de diámetro/espesor al cotizar además del catálogo fijo.
  tuberiasExtra?: Array<{
    tipo: 'lisa' | 'ranurada'
    diametro: number     // pulgadas
    espesor: number      // pulgadas
    precio: number       // Q/tubo — costo interno empresa, no precio cliente
    markupPct?: number   // default 30, usado para mostrar precio cliente
  }>

  // ── Cuentas bancarias (se imprimen al pie del PDF de cotización) ──
  cuentasBancarias?: CuentaBancaria[]

  // ── Horas adversas — política operativa (fórmula del jefe) ──
  // La constante pies/hora se deriva de (piesMinimoTurno / horasTurnoDefault).
  // Fórmula: horasAdversas = horasTurno − (piesPerforados / constante)
  horasTurnoDefault?: number           // default 8
  piesMinimoTurno?: number             // default 20 pies mínimo por turno
  valorHoraAdversa?: number            // default Q500 cobro por hora adversa
  horasAdversasConfigVersion?: number  // v2 = default operativo 8h
}

export interface CuentaBancaria {
  banco: string       // ej. "Banco Industrial"
  tipo: string        // ej. "Cuenta monetaria quetzales"
  numero: string      // ej. "027003319-4"
}

const CONFIG_KEY = 'hidrocrm_config'
const PIN_SUPERADMIN = '1234'  // PIN simple — cambiar en producción real

export const DEFAULT_CONFIG: AppConfig = {
  iva: 0.12,
  isr: 0.05,
  precioPorPieBase: 700,
  precioVentaHoraBase: 375,
  servicioCotizacion: DEFAULT_SERVICIO_COTIZACION,
  servicioCotizacionConfigVersion: 3,
  costomaquinariaDia: 0,       // Excel reunión: Q 0 (editable — margen reservado)
  costoDieselDia: 2300,        // Excel reunión: Q 2,300/día
  bonificacionPorPie: 15,      // Excel reunión: Q 15/pie
  precioBentonitaSaco: 303,  // Q303/saco — precio real (Hoja 3)
  costoAforoBase: 9290,  // subtotal real (Hoja AFORO.xlsx verificada)
  costoGravaDefault: 9000,
  comisionVendedorPct: 1,
  markupQuimicosLimpieza: 1.5,  // 50% markup default; editable por superadmin
  // Pipas de agua — reunión 2026-04-18 con el jefe
  pipaCostoUnitario: 500,
  pipaPrecioVentaUnitario: 700,
  // Transporte grava — reunión 2026-04-18: Q 5,000 costo / Q 6,000 venta por 12 m³
  capacidadCamionM3: 12,
  camionadaGravaCostoUnitario: 5000,
  camionadaGravaPrecioVentaUnitario: 6000,
  preciosLineas: DEFAULT_PRECIOS_LINEAS,
  perforacionFormulasConfigVersion: 1,
  bloquearPreciosAdmin: false,
  costosBaseOverride: {},
  costosBaseVentaOverride: {},
  // Cuentas bancarias oficiales de HIDROPERFORACIONES, S.A. (se imprimen en el PDF).
  cuentasBancarias: [
    { banco: 'Banco Industrial', tipo: 'Cuenta monetaria quetzales', numero: '027003319-4' },
    { banco: 'Banrural',         tipo: 'Cuenta monetaria quetzales', numero: '3516073418' },
    { banco: 'Banco CHN',        tipo: 'Cuenta monetaria quetzales', numero: '02-099-081589-1' },
    { banco: 'BAC Credomatic',   tipo: 'Cuenta monetaria quetzales', numero: '70571190-2' },
  ],
  // Horas adversas — política operativa: 20 pies en turno de 8h.
  horasTurnoDefault: 8,
  piesMinimoTurno: 20,
  valorHoraAdversa: 500,
  horasAdversasConfigVersion: 2,
}

export const HORAS_ADVERSAS_CONFIG_VERSION = 2
export const SERVICIO_COTIZACION_CONFIG_VERSION = 5
export const PERFORACION_FORMULAS_CONFIG_VERSION = 1

export function normalizeAppConfig(raw?: Partial<AppConfig> | null): AppConfig {
  const cfg: AppConfig = { ...DEFAULT_CONFIG, ...(raw ?? {}) }
  cfg.preciosLineas = { ...DEFAULT_PRECIOS_LINEAS, ...(raw?.preciosLineas ?? {}) }
  const rawPerforacionFormulasVersion = Number(raw?.perforacionFormulasConfigVersion ?? 0)
  if (rawPerforacionFormulasVersion < PERFORACION_FORMULAS_CONFIG_VERSION) {
    cfg.preciosLineas = {
      ...cfg.preciosLineas,
      registroElectrico: DEFAULT_PRECIOS_LINEAS.registroElectrico,
      desarrolloLimpieza: DEFAULT_PRECIOS_LINEAS.desarrolloLimpieza,
      selloSanitario: DEFAULT_PRECIOS_LINEAS.selloSanitario,
      precioLimpiezaHora: DEFAULT_PRECIOS_LINEAS.precioLimpiezaHora,
    }
  }
  cfg.perforacionFormulasConfigVersion = PERFORACION_FORMULAS_CONFIG_VERSION
  const rawServicio = raw?.servicioCotizacion
  const numeroPositivo = (value: unknown, fallback: number) => {
    const n = Number(value)
    return Number.isFinite(n) && n > 0 ? n : fallback
  }
  cfg.servicioCotizacion = {
    ...DEFAULT_SERVICIO_COTIZACION,
    ...(rawServicio ?? {}),
    tablaTuberia: Array.isArray(rawServicio?.tablaTuberia) && rawServicio.tablaTuberia.length > 0
      ? rawServicio.tablaTuberia.map((r, idx) => {
          const fallback = DEFAULT_SERVICIO_TUBERIA[idx] ?? DEFAULT_SERVICIO_TUBERIA[0]
          return {
            diametro: Number(r.diametro) || fallback.diametro,
            precioExtraccion: numeroPositivo(r.precioExtraccion, fallback.precioExtraccion),
            tubosHoraExtraccion: Number(r.tubosHoraExtraccion) || fallback.tubosHoraExtraccion,
            precioInstalacion: numeroPositivo(r.precioInstalacion, fallback.precioInstalacion),
            tubosHoraInstalacion: Number(r.tubosHoraInstalacion) || fallback.tubosHoraInstalacion,
            personal: (Number(r.diametro) || fallback.diametro) >= 6 ? 3 : 2,
          }
        })
      : DEFAULT_SERVICIO_TUBERIA,
  }
  const rawServicioVersion = Number(raw?.servicioCotizacionConfigVersion ?? 0)
  if (rawServicioVersion < SERVICIO_COTIZACION_CONFIG_VERSION) {
    cfg.servicioCotizacion = {
      ...cfg.servicioCotizacion,
      precioVentaQuimicoCaneca: DEFAULT_SERVICIO_COTIZACION.precioVentaQuimicoCaneca,
      materialInstalacionPrecio: DEFAULT_SERVICIO_COTIZACION.materialInstalacionPrecio,
      materialInstalacionCosto: DEFAULT_SERVICIO_COTIZACION.materialInstalacionCosto,
      tecnicoChequeoPrecio: DEFAULT_SERVICIO_COTIZACION.tecnicoChequeoPrecio,
      tecnicoChequeoCosto: DEFAULT_SERVICIO_COTIZACION.tecnicoChequeoCosto,
      camaraInspeccionPrecio: DEFAULT_SERVICIO_COTIZACION.camaraInspeccionPrecio,
      camaraInspeccionCosto: DEFAULT_SERVICIO_COTIZACION.camaraInspeccionCosto,
      medicionNivelPrecio: DEFAULT_SERVICIO_COTIZACION.medicionNivelPrecio,
      medicionNivelCosto: DEFAULT_SERVICIO_COTIZACION.medicionNivelCosto,
      analisisAguaPrecio: DEFAULT_SERVICIO_COTIZACION.analisisAguaPrecio,
      analisisAguaCosto: DEFAULT_SERVICIO_COTIZACION.analisisAguaCosto,
    }
  }
  cfg.servicioCotizacionConfigVersion = SERVICIO_COTIZACION_CONFIG_VERSION
  const rawVersion = Number(raw?.horasAdversasConfigVersion ?? 0)

  // Migracion suave: configs guardadas antes de v2 traian 10h como default.
  // Si despues alguien setea 10h manualmente, ya queda versionado como v2.
  if (rawVersion < HORAS_ADVERSAS_CONFIG_VERSION && Number(raw?.horasTurnoDefault ?? DEFAULT_CONFIG.horasTurnoDefault) === 10) {
    cfg.horasTurnoDefault = 8
  }

  cfg.horasAdversasConfigVersion = HORAS_ADVERSAS_CONFIG_VERSION
  return cfg
}

export function getConfig(): AppConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG
  const raw = localStorage.getItem(CONFIG_KEY)
  if (!raw) return DEFAULT_CONFIG
  try { return normalizeAppConfig(JSON.parse(raw)) } catch { return DEFAULT_CONFIG }
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
  'precioVentaQuimicoCaneca',
  'precioMaterialInstalacionServicio',
  'costoMaterialInstalacionServicio',
  'precioTecnicoChequeoServicio',
  'costoTecnicoChequeoServicio',
  'precioInspeccionCamara',
  'costoInspeccionCamara',
  'bonificacionDiaria',
  'tiemposViaticosDia',
  'servicioTrasladoKmGalon',
  'servicioTrasladoPrecioVenta',
  'servicioConsumoExtraccionInstalacionGalHora',
  'servicioConsumoLimpiezaGalHora',
]
