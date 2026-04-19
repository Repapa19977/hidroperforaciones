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
    costoUnitario: 8000,          // Excel R2
    precioVentaUnitario: 12000,
    editable: true,
  },
  selloSanitario: {
    key: 'selloSanitario',
    nombre: 'Sello sanitario de concreto',
    unidad: 'unidad',
    costoUnitario: 0,             // Excel Margenes: 0 (costo absorbido en diesel/otros)
    precioVentaUnitario: 500,
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
    nombre: 'Análisis FQ + Bacteriológico',
    unidad: 'unidad',
    costoUnitario: 0,             // sin costo base registrado
    precioVentaUnitario: 800,     // Hoja1 Odoo (línea 20)
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
    costoUnitario: 331.79,        // Excel "Limpieza mecánica" Q/h sin imprevistos
    precioVentaUnitario: 400,     // app actual (Hoja1 Odoo dice Q325, config dice Q400)
    editable: true,
    notas: 'Costo neto c/imprevistos: Q398.14 — margen default bajo',
  },
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
  overrides: Record<string, number> = {}
): Record<string, CostoRubro> {
  const result: Record<string, CostoRubro> = {}
  for (const key of Object.keys(COSTOS_BASE)) {
    const base = COSTOS_BASE[key]
    const costoOverride = overrides[key]
    result[key] = {
      ...base,
      costoUnitario: typeof costoOverride === 'number' ? costoOverride : base.costoUnitario,
    }
  }
  return result
}
