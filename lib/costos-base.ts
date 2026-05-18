// ============================================================
// COSTOS BASE POR RUBRO — costo interno vs precio al cliente
// Fuente: Excel "Perforacion de pozo 2.0 (3).xlsx"
//   - Hoja "Costos de cotización" (precio venta vs costo interno)
//   - Hoja "Consumo de Bentonita y graba" (venta bentonita Q535.71)
//   - Hoja "Aforo" (costo Q12,161 / venta Q22,000)
//   - Hoja1 (precios Odoo referenciales)
// ============================================================

export interface CostoRubro {
  key: string                   // identificador único
  nombre: string                // descripción legible
  unidad: string                // pie, saco, m³, unidad, global, hora
  costoUnitario: number         // Q — lo que le sale a la empresa
  precioVentaUnitario: number   // Q — lo que cobra al cliente (default del Excel)
  editable: boolean             // true = superadmin puede modificar
  notas?: string                // observación opcional
}

// Nota: el markup se deriva: (venta - costo) / costo × 100
// Si costoUnitario = 0, el rubro es "sin costo base" (solo precio de venta).

export const COSTOS_BASE: Record<string, CostoRubro> = {
  // ── MATERIALES ─────────────────────────────────────────────
  bentonita: {
    key: 'bentonita',
    nombre: 'Bentonita y aditivos',
    unidad: 'saco',
    costoUnitario: 303,           // Excel "Bentonita" fila 11
    precioVentaUnitario: 535.71,  // Excel fila 15 "Precio venta real"
    editable: true,
    notas: 'Markup ~77% (precio sugerido c/impuestos Q360.57 o precio real Q535.71)',
  },
  grava: {
    key: 'grava',
    nombre: 'Grava o piedrín',
    unidad: 'm³',
    costoUnitario: 350,           // Excel "Costos cotización" R5
    precioVentaUnitario: 600,
    editable: true,
  },
  pipasAgua: {
    key: 'pipasAgua',
    nombre: 'Pipas de agua',
    unidad: 'pipa',
    costoUnitario: 500,           // Reunión 2026-04-18 con el jefe: Q 500 costo por pipa
    precioVentaUnitario: 700,     // Reunión 2026-04-18: Q 700 venta al cliente por pipa
    editable: true,
    notas: 'Cantidad interna = profundidad / 20. Al cliente se refleja ceil(internas / 2).',
  },

  // ── SERVICIOS LOGÍSTICOS ───────────────────────────────────
  transporteGrava: {
    key: 'transporteGrava',
    nombre: 'Transporte de grava',
    unidad: 'camionada',
    costoUnitario: 5000,          // Reunión 2026-04-18: Q 5,000 costo por camionada de 12 m³
    precioVentaUnitario: 6000,    // Reunión 2026-04-18: Q 6,000 venta al cliente por camionada
    editable: true,
    notas: 'Camión capacidad 12 m³. Se cobra por camionadas enteras: 1-12 m³ = 1, 13-24 = 2, etc.',
  },
  instalacionGrava: {
    key: 'instalacionGrava',
    nombre: 'Instalación de grava',
    unidad: 'm³',
    costoUnitario: 200,           // Excel R8
    precioVentaUnitario: 500,
    editable: true,
  },
  colocacionAdeme: {
    key: 'colocacionAdeme',
    nombre: 'Colocación de tubería (ADEME)',
    unidad: 'pie',
    costoUnitario: 8,             // Excel "Costos cotización" R9
    precioVentaUnitario: 35,      // Hoja1 Odoo (línea 10)
    editable: true,
  },
  brocal: {
    key: 'brocal',
    nombre: 'Brocal de concreto',
    unidad: 'unidad',
    costoUnitario: 200,           // Excel R6
    precioVentaUnitario: 500,
    editable: true,
  },
  sopleteado: {
    key: 'sopleteado',
    nombre: 'Sopleteado con compresor',
    unidad: 'hora',
    costoUnitario: 0,
    precioVentaUnitario: 500,
    editable: true,
  },
  trasladoGenerador: {
    key: 'trasladoGenerador',
    nombre: 'Traslado generador + instalación',
    unidad: 'global',
    costoUnitario: 0,
    precioVentaUnitario: 2100,
    editable: true,
  },

  // ── CONDICIONALES ──────────────────────────────────────────
  registroElectrico: {
    key: 'registroElectrico',
    nombre: 'Registro eléctrico',
    unidad: 'unidad',
    costoUnitario: 7000,          // FORMULAS PARA RODRI
    precioVentaUnitario: 8000,
    editable: true,
  },
  selloSanitario: {
    key: 'selloSanitario',
    nombre: 'Sello sanitario de concreto',
    unidad: 'pie',
    costoUnitario: 50,
    precioVentaUnitario: 100,
    editable: true,
  },
  extraccionLodos: {
    key: 'extraccionLodos',
    nombre: 'Extracción de lodos',
    unidad: 'viaje',
    costoUnitario: 400,
    precioVentaUnitario: 800,
    editable: true,
  },
  sanitarioPortatil: {
    key: 'sanitarioPortatil',
    nombre: 'Baño portátil',
    unidad: 'mes',
    costoUnitario: 800,
    precioVentaUnitario: 800,
    editable: true,
  },
  analisisQuimico: {
    key: 'analisisQuimico',
    nombre: 'Análisis químico',
    unidad: 'unidad',
    costoUnitario: 1000,          // Excel R3
    precioVentaUnitario: 1400,
    editable: true,
  },
  analisisFQBact: {
    key: 'analisisFQBact',
    nombre: 'Análisis físico-químico',
    unidad: 'unidad',
    costoUnitario: 1000,          // Instrucción jefe 2026-04-20: los 2 análisis unificados
    precioVentaUnitario: 1500,    // costo Q1000 / venta Q1500
    editable: true,
  },

  // ── TAPÓN (sin margen, costo = venta) ──────────────────────
  taponTuberia: {
    key: 'taponTuberia',
    nombre: 'Tapón de tubería',
    unidad: 'unidad',
    costoUnitario: 800,
    precioVentaUnitario: 800,     // Excel R10: sin margen
    editable: true,
  },

  // ── SERVICIOS DE EQUIPO ────────────────────────────────────
  instalacionEquipo: {
    key: 'instalacionEquipo',
    nombre: 'Instalación de equipo',
    unidad: 'global',
    costoUnitario: 0,
    precioVentaUnitario: 3000,    // Hoja1 Odoo línea 3
    editable: true,
  },
  pruebaBombeo: {
    key: 'pruebaBombeo',
    nombre: 'Prueba de bombeo',
    unidad: 'hora',
    costoUnitario: 506.69,        // Excel Aforo: Q12,161 / 24h
    precioVentaUnitario: 700,     // Hoja1 Odoo línea 18
    editable: true,
  },
  limpiezaMecanica: {
    key: 'limpiezaMecanica',
    nombre: 'Limpieza mecánica (en servicio perf)',
    unidad: 'hora',
    costoUnitario: 250,
    precioVentaUnitario: 375,
    editable: true,
    notas: 'FORMULAS PARA RODRI: costo Q250/h, venta Q375/h',
  },
}

// Mapa de rubro de configuración → key real de línea en cotización/PDF.
// Algunos rubros del catálogo son administrativos y no tienen línea activa.
export const RUBRO_TO_LINEA_KEY: Record<string, string> = {
  bentonita: 'bentonita',
  grava: 'grava-material',
  pipasAgua: 'pipas-agua',
  transporteGrava: 'transporte-grava',
  instalacionGrava: 'instalacion-grava',
  colocacionAdeme: 'colocacion-ademe',
  brocal: 'brocal',
  sopleteado: 'sopleteado',
  trasladoGenerador: 'traslado-generador',
  registroElectrico: 'registro-electrico',
  selloSanitario: 'sello-sanitario',
  extraccionLodos: 'extraccion-lodos',
  sanitarioPortatil: 'servicio-perf-sanitario',
  analisisFQBact: 'analisis-combinado',
  instalacionEquipo: 'instalacion-equipo',
  pruebaBombeo: 'prueba-bombeo',
  limpiezaMecanica: 'limpieza-mecanica',
}

// ── HELPERS ────────────────────────────────────────────────────

/** Markup % sobre el costo: ((venta - costo) / costo) × 100. Si costo = 0, devuelve 0. */
export function calcMarkupPct(costo: number, venta: number): number {
  if (costo <= 0) return 0
  return ((venta - costo) / costo) * 100
}

/** Precio de venta derivado de un costo y un markup % */
export function calcVentaDesdeMarkup(costo: number, markupPct: number): number {
  return costo * (1 + markupPct / 100)
}

/** Utilidad en Q: venta - costo */
export function calcUtilidad(costo: number, venta: number): number {
  return venta - costo
}

/** Devuelve el rubro por key, con fallback seguro */
export function getCostoRubro(key: string): CostoRubro | undefined {
  return COSTOS_BASE[key]
}

/** Lista todos los rubros como array (para iteración en UI) */
export function listCostosBase(): CostoRubro[] {
  return Object.values(COSTOS_BASE)
}

/**
 * Aplica overrides del superadmin (guardados en AppConfig.costosBaseOverride)
 * sobre el catálogo base. Solo se overridea el campo `costoUnitario`.
 * El precio de venta se mantiene del default (el override de venta es por cotización, no global).
 */
export function getCostosBaseConOverrides(
  overrides: Record<string, number> = {},
  ventaOverrides: Record<string, number> = {},
): Record<string, CostoRubro> {
  const result: Record<string, CostoRubro> = {}
  for (const key of Object.keys(COSTOS_BASE)) {
    const base = COSTOS_BASE[key]
    const costoOverride = overrides[key]
    const ventaOverride = ventaOverrides[key]
    result[key] = {
      ...base,
      costoUnitario: typeof costoOverride === 'number' ? costoOverride : base.costoUnitario,
      precioVentaUnitario: typeof ventaOverride === 'number' ? ventaOverride : base.precioVentaUnitario,
    }
  }
  return result
}

export function preciosVentaOverrideDesdeRubros(
  ventaOverrides: Record<string, number> = {},
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const [rubroKey, venta] of Object.entries(ventaOverrides)) {
    const lineaKey = RUBRO_TO_LINEA_KEY[rubroKey]
    if (lineaKey && typeof venta === 'number') result[lineaKey] = venta
  }
  return result
}
