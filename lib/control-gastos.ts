/**
 * Control de Gastos por Proyecto
 * ──────────────────────────────────────────────────────────────────────────
 * Helpers para calcular presupuesto aprobado (desde cotización) vs consumo real
 * (desde bitácora) + % avance físico basado en pies perforados.
 */

import { calcularPerforacion, type InputsPerforacion, type ResultadosPerforacion, calcularHorasAdversasCompleto, VALOR_HORA_ADVERSA } from './calculator'

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
    // Pipas: plan estimado = días maquinaria / 3 (aprox 1 pipa cada 3 días)
    // para que se pueda comparar contra las pipas consumidas por día en la bitácora.
    {
      key: 'pipas-agua',
      nombre: 'Pipas de agua',
      cantidadPresupuestada: Math.max(1, Math.round(res.totalDiasMaquinaria / 3)),
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
      cantidadPresupuestada: ip.personalPerforacion,
      unidad: 'personas',
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
): Ejecutado {
  const piesPerforadosTotal = entries.reduce((a, e) => a + (e.perforacionDia || 0), 0)
  const bentonitaConsumida  = entries.reduce((a, e) => a + (e.bentonitaSacos || 0), 0)
  const pipasConsumidas     = entries.reduce((a, e) => a + (e.pipas || 0), 0)
  const diasActivos         = entries.filter(e => e.estado === 'activo'   || (e.perforacionDia > 0 && !e.diaAdverso)).length
  const diasInactivos       = entries.filter(e => e.estado === 'inactivo' || e.diaAdverso).length

  // Horas adversas — aplicadas SOLO cuando pies < 20 por día (turno 8h)
  // Fórmula Excel: horasAdversas = 8 − pies/2.5 × Q 500/h
  let horasAdversasTotal = 0
  let cobroHorasAdversas = 0
  const diasAdversosDetalle: DiaAdverso[] = []
  for (const e of entries) {
    if (e.perforacionDia > 0 && e.perforacionDia < 20) {
      const r = calcularHorasAdversasCompleto({ piesEnTurno: e.perforacionDia, horasTurno: 8 })
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
    { key: 'salarios',      cantidadConsumida: diasActivos,           montoGastado: diasActivos        * (precioUnit('salarios') * presupuesto.diasMaquinaria / Math.max(1, presupuesto.diasMaquinaria)) },
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
