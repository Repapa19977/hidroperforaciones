/**
 * Control de Gastos por Proyecto
 * ──────────────────────────────────────────────────────────────────────────
 * Helpers para calcular presupuesto aprobado (desde cotización) vs consumo real
 * (desde bitácora) + % avance físico basado en pies perforados.
 */

import { calcularPerforacion, pipasInternas, type InputsPerforacion, type ResultadosPerforacion, calcularHorasAdversasCompleto, VALOR_HORA_ADVERSA } from './calculator'

export interface PresupuestoRubro {
  key: string
  nombre: string
  cantidadPresupuestada: number
  unidad: string
  montoPresupuestado: number
}

export interface Presupuesto {
  total: number                     // suma de todos los rubros
  rubros: PresupuestoRubro[]
  profundidad: number               // total pies de la cotización
  diasMaquinaria: number            // días estimados
}

export interface EjecutadoRubro {
  key: string                        // mismo key que PresupuestoRubro para joinearlos
  cantidadConsumida: number
  montoGastado: number               // cantidad × precio unitario (del presupuesto)
}

export interface DiaAdverso {
  fecha: string
  piesPerforados: number
  horasProductivas: number
  horasAdversas: number
  cobro: number
}

export interface Ejecutado {
  piesPerforadosTotal: number
  diasActivos: number
  diasInactivos: number
  horasAdversasTotal: number       // suma de horas adversas calculadas por día (solo si pies < 20)
  cobroHorasAdversas: number       // Q a cobrar al cliente por horas adversas (horasAdversas × Q500)
  diasAdversosDetalle: DiaAdverso[]  // desglose día por día
  rubros: EjecutadoRubro[]
  total: number                     // suma de todos los montos gastados
}

export interface BitacoraEntryAgg {
  perforacionDia: number
  bentonitaSacos: number
  pipas: number
  diaAdverso: boolean
  estado: string           // "activo" | "inactivo" | "adverso"
  fecha: string
}

/**
 * Presupuesto del proyecto extraído de los InputsPerforacion de la cotización.
 * Solo cubre perforación (limpieza mecánica es otro flujo).
 */
export function calcularPresupuestoPerforacion(ip: InputsPerforacion): Presupuesto {
  const res: ResultadosPerforacion = calcularPerforacion(ip)

  const rubros: PresupuestoRubro[] = [
    {
      key: 'bentonita',
      nombre: 'Bentonita y aditivos',
      cantidadPresupuestada: res.sacosBentonita,
      unidad: 'sacos',
      montoPresupuestado: res.costoBentonita,
    },
    // Pipas: plan interno = 1 pipa por dia de perforacion real.
    // No incluye los dias extra de maquinaria/mantenimiento.
    {
      key: 'pipas-agua',
      nombre: 'Pipas de agua',
      cantidadPresupuestada: pipasInternas(ip.profundidad, ip.rendimientoPorDia ?? 20),
      unidad: 'pipas',
      montoPresupuestado: res.costoPipasAgua,
    },
    {
      key: 'grava',
      nombre: 'Grava/piedrín',
      cantidadPresupuestada: Math.round(res.m3Grava * 100) / 100,
      unidad: 'm³',
      montoPresupuestado: res.costoGrava,
    },
    {
      key: 'flete-grava',
      nombre: 'Flete de grava',
      cantidadPresupuestada: res.camionesFlete,
      unidad: 'camiones',
      montoPresupuestado: res.costoFleteGrava,
    },
    {
      key: 'tuberia',
      nombre: 'Tubería (lisa + ranurada)',
      cantidadPresupuestada: ip.tubosLisos + ip.tubosRanurados,
      unidad: 'tubos',
      montoPresupuestado: res.costoTuberia + res.costoFiltros,
    },
    {
      key: 'diesel',
      nombre: 'Diésel operación',
      cantidadPresupuestada: res.totalDiasMaquinaria,
      unidad: 'días',
      montoPresupuestado: res.costoDiesel,
    },
    {
      key: 'salarios',
      nombre: 'Salarios',
      cantidadPresupuestada: res.totalDiasMaquinaria,
      unidad: 'días',
      montoPresupuestado: res.costoSalarios,
    },
    {
      key: 'viaticos',
      nombre: 'Viáticos',
      cantidadPresupuestada: res.totalDiasMaquinaria,
      unidad: 'días',
      montoPresupuestado: res.costoViaticos,
    },
    {
      key: 'casa-equipo',
      nombre: 'Casa de equipo',
      cantidadPresupuestada: res.mesesProyecto,
      unidad: 'meses',
      montoPresupuestado: res.costoCasaEquipo,
    },
    {
      key: 'hospedaje',
      nombre: 'Hospedaje',
      cantidadPresupuestada: res.mesesProyecto,
      unidad: 'meses',
      montoPresupuestado: res.costoHospedaje,
    },
    {
      key: 'bonificaciones',
      nombre: 'Bonificaciones por pie',
      cantidadPresupuestada: ip.profundidad,
      unidad: 'pies',
      montoPresupuestado: res.costoBonificaciones,
    },
    {
      key: 'traslado',
      nombre: 'Traslado del equipo',
      cantidadPresupuestada: 1,
      unidad: 'global',
      montoPresupuestado: res.costoTraslado,
    },
    {
      key: 'broca',
      nombre: 'Broca de perforación',
      cantidadPresupuestada: ip.comprarBroca ? 1 : 0,
      unidad: 'broca',
      montoPresupuestado: res.costoBrocaCompra,
    },
    {
      key: 'imprevisto',
      nombre: 'Imprevisto global',
      cantidadPresupuestada: 1,
      unidad: 'global',
      montoPresupuestado: res.imprevistoGlobal,
    },
  ].filter(r => r.montoPresupuestado > 0)

  const total = rubros.reduce((a, r) => a + r.montoPresupuestado, 0)

  return {
    total,
    rubros,
    profundidad: ip.profundidad,
    diasMaquinaria: res.totalDiasMaquinaria,
  }
}

/**
 * Agrega las entradas de bitácora y devuelve lo realmente consumido.
 * El monto gastado por rubro = cantidad_consumida × (montoPresupuestado / cantidadPresupuestada).
 * Rubros que la bitácora no tracea (ej. tubería, flete) quedan en 0 a menos que vengan de gastos extras.
 */
export function agregarBitacora(
  entries: BitacoraEntryAgg[],
  presupuesto: Presupuesto,
  paramsAdversas?: { horasTurno?: number; piesMinimoTurno?: number; valorHoraAdversa?: number },
): Ejecutado {
  const piesPerforadosTotal = entries.reduce((a, e) => a + (e.perforacionDia || 0), 0)
  const bentonitaConsumida  = entries.reduce((a, e) => a + (e.bentonitaSacos || 0), 0)
  const pipasConsumidas     = entries.reduce((a, e) => a + (e.pipas || 0), 0)
  const diasActivos         = entries.filter(e => e.estado === 'activo'   || (e.perforacionDia > 0 && !e.diaAdverso)).length
  const diasInactivos       = entries.filter(e => e.estado === 'inactivo' || e.diaAdverso).length

  // Horas adversas — fórmula nueva del jefe (2026-04-20):
  //   constante    = piesMinimoTurno / horasTurno    (default 20 / 10 = 2 pies/hora)
  //   horasAdversas = max(0, horasTurno − pies / constante)
  //   cobro        = horasAdversas × valorHoraAdversa
  // Solo se aplica cuando pies < piesMinimoTurno (día bajo rendimiento).
  const horasTurno        = paramsAdversas?.horasTurno ?? 10
  const piesMinimo        = paramsAdversas?.piesMinimoTurno ?? 20
  const valorHoraAdversa  = paramsAdversas?.valorHoraAdversa ?? 500
  let horasAdversasTotal = 0
  let cobroHorasAdversas = 0
  const diasAdversosDetalle: DiaAdverso[] = []
  for (const e of entries) {
    if (e.perforacionDia > 0 && e.perforacionDia < piesMinimo) {
      const r = calcularHorasAdversasCompleto({
        piesEnTurno: e.perforacionDia,
        horasTurno,
        piesMinimoTurno: piesMinimo,
        valorHoraAdversa,
      })
      horasAdversasTotal += r.horasAdversas
      cobroHorasAdversas += r.cobro
      diasAdversosDetalle.push({
        fecha: e.fecha,
        piesPerforados: e.perforacionDia,
        horasProductivas: r.horasProductivas,
        horasAdversas: r.horasAdversas,
        cobro: r.cobro,
      })
    }
  }

  // Precio unitario real por rubro = monto_presupuesto / cantidad_presupuestada
  const precioUnit = (key: string): number => {
    const r = presupuesto.rubros.find(x => x.key === key)
    if (!r || r.cantidadPresupuestada <= 0) return 0
    return r.montoPresupuestado / r.cantidadPresupuestada
  }

  const rubros: EjecutadoRubro[] = [
    { key: 'bentonita',     cantidadConsumida: bentonitaConsumida,    montoGastado: bentonitaConsumida * precioUnit('bentonita') },
    { key: 'pipas-agua',    cantidadConsumida: pipasConsumidas,       montoGastado: pipasConsumidas    * precioUnit('pipas-agua') },
    // Diésel, viáticos y salarios se imputan proporcionalmente a los días activos
    { key: 'diesel',        cantidadConsumida: diasActivos,           montoGastado: diasActivos        * precioUnit('diesel') },
    { key: 'viaticos',      cantidadConsumida: diasActivos,           montoGastado: diasActivos        * precioUnit('viaticos') },
    { key: 'salarios',      cantidadConsumida: diasActivos,           montoGastado: diasActivos        * precioUnit('salarios') },
    // Bonificación por pie: según pies perforados
    { key: 'bonificaciones', cantidadConsumida: piesPerforadosTotal,  montoGastado: piesPerforadosTotal * precioUnit('bonificaciones') },
  ]

  const total = rubros.reduce((a, r) => a + r.montoGastado, 0)

  return {
    piesPerforadosTotal,
    diasActivos,
    diasInactivos,
    horasAdversasTotal,
    cobroHorasAdversas,
    diasAdversosDetalle,
    rubros,
    total,
  }
}

/** Valor del cobro por hora adversa (default Q 500). Re-export para UI. */
export { VALOR_HORA_ADVERSA }

/** Avance físico: pies perforados / total pies de la cotización. Clamp [0, 100]. */
export function calcularAvance(piesPerforados: number, profundidad: number): number {
  if (profundidad <= 0) return 0
  return Math.min(100, Math.max(0, (piesPerforados / profundidad) * 100))
}

// ══════════════════════════════════════════════════════════════════════════
// COMPRADO POR RUBRO — agrupa GastoExtra por rubro y calcula semáforo.
// Control de Gastos es INDEPENDIENTE de la bitácora:
//   · Presupuesto:  lo que la cotización dice que va a costar (N unidades × Q)
//   · Comprado:     lo que Rodrigo registró en el libro de compras (GastoExtra)
//   · Semáforo:     basado en cantidades (no en %)
// ══════════════════════════════════════════════════════════════════════════
export interface CompradoRubro {
  key: string                     // coincide con PresupuestoRubro.key
  cantidadComprada: number        // sum(cantidad) de GastoExtra del rubro
  montoComprado: number           // sum(cantidad × costoUnitario) del rubro
  comprasCount: number            // cantas compras se registraron en este rubro
}

export interface EstadoRubro extends PresupuestoRubro, CompradoRubro {
  faltante: number                // cantidadPresupuestada − cantidadComprada
  estado: 'verde' | 'amarillo' | 'rojo'
  // verde   = faltante > 10   (hay margen holgado)
  // amarillo= 0 ≤ faltante ≤ 10 (falta poco, ojo)
  // rojo    = faltante < 0    (sobre-comprado)
}

/**
 * Agrupa compras por `rubro` (campo del GastoExtra) y suma cantidades + montos.
 * El rubro de GastoExtra puede ser un key del presupuesto (bentonita, grava, pipas…)
 * o 'otro' / 'imprevisto' para compras sin rubro asociado.
 */
export function calcularCompradoPorRubro(
  gastos: Array<{ rubro: string; cantidad: number; costoUnitario: number }>
): Map<string, CompradoRubro> {
  const map = new Map<string, CompradoRubro>()
  for (const g of gastos) {
    const key = g.rubro || 'otro'
    const cur = map.get(key) ?? { key, cantidadComprada: 0, montoComprado: 0, comprasCount: 0 }
    cur.cantidadComprada += g.cantidad
    cur.montoComprado    += g.cantidad * g.costoUnitario
    cur.comprasCount     += 1
    map.set(key, cur)
  }
  return map
}

/**
 * Calcula el estado (verde/amarillo/rojo) por cada rubro del presupuesto
 * comparando vs lo comprado. Umbral amarillo = 10 unidades físicas (instrucción
 * Rodrigo 2026-04-22).
 */
export function calcularEstadoPorRubro(
  presupuesto: Presupuesto,
  gastos: Array<{ rubro: string; cantidad: number; costoUnitario: number }>,
  umbralAmarillo = 10,
): EstadoRubro[] {
  const compradoMap = calcularCompradoPorRubro(gastos)
  return presupuesto.rubros.map(r => {
    const c = compradoMap.get(r.key) ?? { key: r.key, cantidadComprada: 0, montoComprado: 0, comprasCount: 0 }
    const faltante = r.cantidadPresupuestada - c.cantidadComprada
    const estado: EstadoRubro['estado'] =
      faltante < 0            ? 'rojo' :
      faltante <= umbralAmarillo ? 'amarillo' :
                                   'verde'
    return {
      ...r,
      cantidadComprada: c.cantidadComprada,
      montoComprado:    c.montoComprado,
      comprasCount:     c.comprasCount,
      faltante,
      estado,
    }
  })
}
