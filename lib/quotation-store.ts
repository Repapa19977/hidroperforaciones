// Shared store for quotation data
// - localStorage: solo para pasar datos al print page (sesión)
// - API /api/cotizaciones: persistencia real en DB (SQLite)

import type { InputsPerforacion, InputsLimpieza } from './calculator'
import type { PreciosLineas } from './config-store'

export interface HitoPago {
  id: string
  label: string
  pct: number
  fijo: boolean
}

// Plan de pagos — defaults según PDF de referencia P5332.
// Los 4 hitos son editables por cotización; la UI valida que sumen 100%.
// fijo=false permite al usuario ajustar porcentajes; fijo=true los bloquea.
export const DEFAULT_PLAN_PAGOS: HitoPago[] = [
  { id: 'reserva',    label: 'Reserva',                    pct: 10, fijo: true  },
  { id: 'anticipo',   label: 'Anticipo',                   pct: 50, fijo: false },
  { id: 'mitad-perf', label: 'Al 50% de perforación',      pct: 20, fijo: false },
  { id: 'entubar',    label: 'Antes de entubar',           pct: 15, fijo: false },
  { id: 'prueba',     label: 'Antes de prueba de bombeo',  pct: 5,  fijo: false },
]

export interface QuotationData {
  correlativo: string
  tipo: 'perforacion' | 'limpieza'
  fecha: string
  validezDias: number
  cliente: string
  empresa: string
  nit: string
  telefono: string
  email: string
  proyecto: string
  direccion: string
  duracion: string
  vendedor: string
  ip?: InputsPerforacion
  il?: InputsLimpieza
  preciosLineas?: PreciosLineas  // precios editados al momento de cotizar
  condiciones: string            // backward compat — condición activa al momento
  condicionesPerf?: string       // condiciones específicas de perforación
  condicionesLimp?: string       // condiciones específicas de limpieza
  planPagos?: HitoPago[]
  lineasActivas?: Record<string, boolean>   // @deprecated — usar lineasConfig
  lineasConfig?: Record<string, LineaConfig>  // nuevo: mostrar/cobrar independientes
  preciosVentaOverride?: Record<string, number>  // precio venta editado por usuario (override del default)
  costosCotizacionOverride?: Record<string, number>  // costo editado SOLO para esta cotización (no persiste globalmente)
  condicionesSeleccionadas?: Record<string, boolean>  // @deprecated — usar condicionesPerfOverride
  condicionesPerfOverride?: Record<string, CondicionOverridePerf>  // overrides del usuario sobre las 18 default (activa/título/texto)
  condicionesPerfExtras?: CondicionExtraPerf[]  // condiciones adicionales custom agregadas por el usuario
  lineasExtras?: LineaExtra[]  // ítems libres agregados por el usuario (título+desc+costo+venta+cant)
  aplicarIva?: boolean     // aplicar IVA 12% al subtotal (default true)
  aplicarIsr?: boolean     // aplicar ISR 7% al subtotal (default false)
  mostrarDesgloseImpuestos?: boolean  // mostrar desglose Subtotal/IVA/ISR/Total en el PDF (default false)
  valorPorPieManual?: number          // override manual del "VALOR POR PIE" del pie del PDF (si 0 o undef, usa auto-calc total/profundidad)
  mostrarEspesor?: boolean
  descripcionSimple?: boolean
  notas: string
}

export interface LineaConfig {
  mostrar: boolean   // true = visible en PDF al cliente
  cobrar: boolean    // true = suma al subtotal de la cotización
}

/** Override del usuario sobre una de las 18 condiciones default de perforación. */
export interface CondicionOverridePerf {
  activa?: boolean
  tituloCustom?: string
  textoCustom?: string
}

/** Condición adicional agregada por el usuario (no pertenece al catálogo de 18). */
export interface CondicionExtraPerf {
  id: string         // auto-generado (custom-timestamp)
  titulo: string
  texto: string
  activa: boolean
}

/** Línea libre / ítem custom agregado por el usuario a la cotización. */
export interface LineaExtra {
  id: string                  // auto-generado
  nombre: string              // título corto
  descripcion?: string        // descripción extendida opcional (se concatena al nombre en el PDF)
  unidad: string              // Global, Unidad, Hora, Pie, etc.
  cantidad: number
  costoUnitario: number       // costo interno (lo que le sale a la empresa)
  precioVentaUnitario: number // precio al cliente
  mostrar: boolean            // visible en PDF
  cobrar: boolean             // suma al total
}

export const DEFAULT_LINEA_CONFIG: LineaConfig = { mostrar: true, cobrar: true }

/** Helper: resuelve config de una línea (nueva config → backward compat → default) */
export function getLineaConfig(
  key: string,
  nuevoConfig?: Record<string, LineaConfig>,
  legacyActivas?: Record<string, boolean>
): LineaConfig {
  if (nuevoConfig?.[key]) return nuevoConfig[key]
  if (legacyActivas && legacyActivas[key] === false) {
    // backward compat: lineasActivas=false equivalía a "oculto del PDF pero cobrado"
    return { mostrar: false, cobrar: true }
  }
  return DEFAULT_LINEA_CONFIG
}

export interface CotizacionRecord {
  id?: string
  correlativo: string
  cliente: string
  empresa: string
  proyecto: string
  tipo: 'perforacion' | 'limpieza'
  estado: 'borrador' | 'enviada' | 'confirmada' | 'cancelada'
  monto: number
  fecha: string
  vendedor: string
  datos?: string   // QuotationData serializado (disponible desde la API)
}

// ── Print draft (localStorage — sesión) ──────────────────────────────────────
const DRAFT_KEY = 'hidrocrm_quotation_draft'

export function saveQuotation(data: QuotationData) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data))
  }
}

export function loadQuotation(): QuotationData | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(DRAFT_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

// ── Persistencia en DB (API) ──────────────────────────────────────────────────
export async function addCotizacion(
  data: QuotationData,
  monto: number,
  estado: CotizacionRecord['estado'] = 'borrador'
) {
  await fetch('/api/cotizaciones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      correlativo: data.correlativo,
      cliente:     data.cliente,
      empresa:     data.empresa,
      proyecto:    data.proyecto,
      tipo:        data.tipo,
      estado,
      monto,
      fecha:       data.fecha,
      vendedor:    data.vendedor,
      datos:       data,   // full payload stored as JSON for re-open/print
    }),
  })
}

export async function loadCotizaciones(vendedor?: string): Promise<CotizacionRecord[]> {
  const url = vendedor
    ? `/api/cotizaciones?vendedor=${encodeURIComponent(vendedor)}`
    : '/api/cotizaciones'
  const res = await fetch(url)
  if (!res.ok) return []
  return res.json()
}

export async function updateEstadoCotizacion(
  correlativo: string,
  estado: CotizacionRecord['estado'],
  usuario?: string
): Promise<{ proyectoCreado?: { id: string; correlativo: string } | null } | null> {
  const res = await fetch(`/api/cotizaciones/${encodeURIComponent(correlativo)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado, usuario: usuario ?? '' }),
  })
  return res.ok ? res.json() : null
}

export async function deleteCotizacion(correlativo: string) {
  await fetch(`/api/cotizaciones/${encodeURIComponent(correlativo)}`, {
    method: 'DELETE',
  })
}

// ── Correlativo ───────────────────────────────────────────────────────────────
// Perforación: P#### (ej. P0001)
// Limpieza: L#### (ej. L0001)
// Fallback: HP-COT-#### (backward compat para cotizaciones viejas)
export function getNextCorrelativo(tipo: 'perforacion' | 'limpieza' = 'perforacion'): string {
  const prefijo = tipo === 'perforacion' ? 'P' : 'L'
  if (typeof window === 'undefined') return `${prefijo}0001`
  const storageKey = `hidrocrm_last_num_${prefijo}`
  const stored = localStorage.getItem(storageKey)
  const last = stored ? parseInt(stored) : 0
  const next = last + 1
  localStorage.setItem(storageKey, String(next))
  return `${prefijo}${String(next).padStart(4, '0')}`
}

// ── Vendedores ────────────────────────────────────────────────────────────────
export const VENDEDORES = [
  'René Domínguez',
  'Gilda García',
  'Mario Ramírez',
  'Carlos Solís',
]

// ── Condiciones default ───────────────────────────────────────────────────────
export const defaultCondiciones = `1. Los precios indicados están en Quetzales (GTQ) e incluyen IVA del 12%.
2. Validez de la cotización: 15 días calendario a partir de la fecha de emisión.
3. Forma de pago: según plan de pagos acordado con el cliente.
4. El cliente deberá proporcionar acceso libre al sitio de perforación y energía eléctrica disponible.
5. En caso de encontrarse roca o material duro no previsto, se acordará un ajuste de precio.
6. El tiempo de ejecución puede variar según condiciones geológicas del terreno.
7. El presente presupuesto no incluye permisos municipales ni licencias de perforación.`

// Condiciones importantes — texto completo replicando Presupuesto P5332 (formato Hidroperforaciones S.A.)
export const defaultCondicionesPerf = `1. La presente cotización se encuentra registrada con un número correlativo precedido por la letra "P", el cual será utilizado como referencia única e inalterable en toda comunicación relacionada con el proyecto.

2. El proyecto se considerará autorizado por el CLIENTE en el momento en que el CONTRATANTE realice cualquier pago, o bien emita una orden de trabajo u orden de compra, aceptando de manera expresa todas las condiciones importantes establecidas en la presente cotización. La fecha de ingreso del equipo quedará sujeta al pago del cien por ciento (100%) del anticipo estipulado en la oferta, así como a la disponibilidad del equipo. El tiempo contractual comenzará a computarse a partir del inicio efectivo de los trabajos de perforación.

3. Por cada pago recibido por parte del CONTRATANTE, HIDROPERFORACIONES, S.A. emitirá el correspondiente recibo de caja como constancia de dicho abono. La factura por el monto total de los trabajos será emitida únicamente contra el pago final del proyecto. HIDROPERFORACIONES, S.A. no reconocerá ningún pago que no haya sido efectuado a su favor mediante cheque, depósito bancario o transferencia electrónica, realizados exclusivamente en cuentas registradas a nombre de la empresa.

4. El CONTRATANTE será responsable de proporcionar a HIDROPERFORACIONES, S.A. el punto de perforación y la profundidad a cotizar, ya sea de forma directa o con base en un estudio técnico que recomiende dicha profundidad, siendo sobre esta información que se emite la presente oferta. En consecuencia, HIDROPERFORACIONES, S.A. no asume responsabilidad alguna respecto a las condiciones geológicas del terreno, ni garantiza la cantidad ni la calidad del agua que pueda obtenerse, al tratarse de situaciones propias, naturales e impredecibles del subsuelo.

5. La presente cotización establece una forma de pago sujeta al avance físico del proyecto, la cual deberá ser estrictamente respetada por el CONTRATANTE. HIDROPERFORACIONES, S.A. se reserva el derecho de suspender los trabajos sin responsabilidad ni perjuicio alguno en caso de incumplimiento en los pagos correspondientes a los porcentajes de avance estipulados. Durante el período de suspensión por falta de pago, se generará un cargo de Q5,000.00 (Cinco mil quetzales) diarios, los cuales deberán ser cancelados en su totalidad antes de reanudar los trabajos. Si el CONTRATANTE no realiza los pagos correspondientes en un plazo de cuatro (4) días calendario, HIDROPERFORACIONES, S.A. podrá retirar sus equipos sin responsabilidad ni perjuicio alguno. Para reanudar los trabajos, el CONTRATANTE deberá cubrir nuevamente el costo indicado en los numerales 1 y 2 de la cotización, quedando además el reinicio sujeto a una nueva programación de ingreso de acuerdo con la disponibilidad de la empresa. En caso de que, debido a los atrasos en el pago —ya sea antes del entubado o al momento del retorno al sitio—, el pozo haya sufrido colapso, reducción de diámetro por arcilla o azolve, se generará un cobro adicional por concepto de materiales (bentonita, polímeros), días de trabajo y consumo de diésel necesarios para alcanzar nuevamente la profundidad lograda antes de la suspensión o retiro de operaciones.

6. Si al momento de iniciar el proceso de entubado no se ha cancelado el cien por ciento (100%) del porcentaje estipulado en la oferta correspondiente a dicha etapa, NO se procederá con el entubado del pozo. El CONTRATANTE contará con un plazo máximo de cuarenta y ocho (48) horas para efectuar el pago correspondiente. En caso de no realizarse el pago dentro de dicho plazo, HIDROPERFORACIONES, S.A. quedará facultada para retirar su equipo de perforación sin responsabilidad ni perjuicio alguno.

7. En caso de que, durante el proceso de perforación, se presenten condiciones geológicas adversas que generen inestabilidad en el terreno, será necesario realizar un encamisado parcial del pozo (ante pozo) mediante la instalación de un tubo protector. Este procedimiento no se encuentra incluido en la presente oferta, por lo que HIDROPERFORACIONES, S.A. notificará al CONTRATANTE sobre la necesidad de su ejecución, acompañando dicha notificación con la propuesta económica correspondiente para su aprobación. Si el CONTRATANTE no aprueba la propuesta, HIDROPERFORACIONES, S.A. procederá a suspender los trabajos sin responsabilidad ni perjuicio alguno, dado que este tipo de condiciones representan un riesgo para la herramienta y el equipo de perforación.

8. En caso de que, debido a condiciones geológicas inherentes al terreno —tales como arcilla reactiva, derrumbes, colapsos, pérdida de circulación u otras similares— ocurra un atrapamiento de la herramienta de perforación que imposibilite su rescate y no permita alcanzar la profundidad contratada, HIDROPERFORACIONES, S.A. únicamente cobrará las cantidades y renglones efectivamente ejecutados conforme a la presente oferta. En tal situación, se podrá proceder al entubado a la profundidad alcanzada, sin que ello implique responsabilidad ni perjuicio alguno para HIDROPERFORACIONES, S.A.. En caso de que se intente el rescate de la herramienta atrapada, se generará un cargo de Q5,000.00 (Cinco mil quetzales) diarios durante el tiempo que dure dicho procedimiento. Si el CONTRATANTE decide no esperar la ejecución del procedimiento de rescate, será responsable del pago total del valor de la herramienta y equipo no recuperado, toda vez que este tipo de situaciones no son imputables a HIDROPERFORACIONES, S.A., dado que el punto de perforación ha sido definido por el CONTRATANTE.

9. En la presente oferta se establece una cantidad específica de sacos de bentonita —incluyendo polímeros y aditivos correspondientes—, así como las pipas de agua. Si, debido a las condiciones geológicas del terreno, fuese necesario utilizar cantidades adicionales de estos insumos, se aplicarán los siguientes cargos: Q600.00 (Seiscientos quetzales) por cada saco adicional de bentonita que incluye polímeros y traslado al punto de trabajo; Q500.00 (Quinientos quetzales) por cada pipa de agua extra. En caso de que el CONTRATANTE no acepte dicho cobro adicional, HIDROPERFORACIONES, S.A. procederá a suspender la perforación sin responsabilidad ni perjuicio alguno. Si transcurridos cinco (5) días calendario el CONTRATANTE no emite una respuesta por escrito sobre su aprobación o desaprobación del pago por los sacos y pipas adicionales, HIDROPERFORACIONES, S.A. podrá retirar su equipo del área de trabajo. Para la continuación de los trabajos, será indispensable que el CONTRATANTE realice el pago por adelantado de al menos cincuenta y seis (56) sacos adicionales.

10. HIDROPERFORACIONES, S.A. no se hace responsable de los daños ocasionados a la infraestructura del proyecto, tales como calles, banquetas, bordillos, grama, u otros, derivados del acceso y tránsito de la maquinaria pesada necesaria para la ejecución de los trabajos. Será responsabilidad exclusiva del CONTRATANTE prever y asumir los posibles daños que pueda sufrir la infraestructura como consecuencia del movimiento y operación de los equipos dentro del área de trabajo.

11. El CONTRATANTE será responsable de obtener los permisos y licencias necesarios ante terceros para la ejecución de los trabajos ofertados. En caso de que se presenten multas, sanciones o reclamos derivados de la falta, insuficiencia o irregularidad en dichos permisos o licencias, el CONTRATANTE será el único responsable de resolverlos, eximiendo en todo momento a HIDROPERFORACIONES, S.A. de cualquier reclamo civil, administrativo o penal que pudiera derivarse de los mismos.

12. En la presente oferta se estipula una cantidad de días hábiles para la culminación de los trabajos contratados. Para efectos de esta cláusula, se entiende por días hábiles aquellos que no incluyen sábados, domingos ni días festivos. El plazo de ejecución podrá ser ampliado por causas ajenas al control de HIDROPERFORACIONES, S.A., entre ellas: problemas geológicos que afecten el avance de la perforación; reparaciones al equipo de perforación derivadas de las condiciones geológicas del terreno; importación de repuestos para la maquinaria; restricciones impuestas por la comunidad, vecinos, autoridades o limitaciones de horario que impidan laborar las 8 horas diarias estipuladas.

13. En caso de que, al alcanzar la profundidad contratada, el CONTRATANTE desee continuar con la perforación a una mayor profundidad de la establecida en la presente oferta, será necesario renegociar el valor de la perforación adicional. Si el CONTRATANTE no aceptara las nuevas condiciones económicas, HIDROPERFORACIONES, S.A. tendrá el derecho de suspender los trabajos de perforación y retirar su equipo, sin que ello implique responsabilidad ni genere perjuicio alguno para la empresa. De manera alternativa, si así lo decidiera el CONTRATANTE, se procederá a entubar el pozo a la profundidad originalmente cotizada, sin que ello implique modificación de los términos establecidos en la presente oferta.

14. HIDROPERFORACIONES, S.A. no estará obligada a realizar ningún trabajo que no se encuentre expresamente detallado en los renglones de la presente oferta. En caso de que, durante la ejecución del proyecto, sea necesario llevar a cabo trabajos adicionales no contemplados en esta cotización, los mismos serán cotizados por separado y únicamente serán ejecutados con la autorización expresa y por escrito del CONTRATANTE.

15. El equipo de perforación es propiedad exclusiva de HIDROPERFORACIONES, S.A., y bajo ningún motivo el CONTRATANTE podrá impedir su retiro, ya sea durante o después de la ejecución de los trabajos. HIDROPERFORACIONES, S.A. se reserva el derecho de accionar legalmente en caso de que se obstaculice el retiro del equipo. Desde ya se establece un cargo de Q5,000.00 diarios por cada día calendario que el equipo permanezca retenido de forma injustificada. Asimismo, el CONTRATANTE asume la responsabilidad por cualquier daño ocasionado al equipo por terceros, actos vandálicos u otras circunstancias mientras este permanezca en el sitio sin autorización de retiro.

16. El CONTRATANTE queda obligado a proporcionar seguridad adecuada para el resguardo del equipo, maquinaria y herramientas propiedad de HIDROPERFORACIONES, S.A., durante todo el tiempo que estos permanezcan en el sitio de trabajo. El CONTRATANTE será responsable por cualquier pérdida, robo o siniestro que afecte dichos bienes. En caso de que el CONTRATANTE no proporcione las condiciones mínimas de seguridad, HIDROPERFORACIONES, S.A. contratará los servicios necesarios por su cuenta, y el costo correspondiente será trasladado y cobrado por separado al CONTRATANTE.

17. En relación con las actividades de limpieza mecánica, soplado con compresor y aforo, si por razones geológicas las horas estipuladas en la presente oferta no fueran suficientes para alcanzar resultados óptimos, se procederá a ejecutar horas adicionales, las cuales serán cobradas por separado a los siguientes valores: Q375.00 por hora de limpieza mecánica; Q1,500.00 por cada hora de uso de compresor; Q800.00 por cada hora de aforo. Estos valores serán facturados conforme a la cantidad de horas o jornadas adicionales efectivamente ejecutadas y requerirán aprobación previa del CONTRATANTE.

18. En la presente cotización se establece un tiempo de ejecución asumiendo condiciones geológicas que permitan avanzar como mínimo 20 pies diarios en turnos de 8 horas de trabajo. De no cumplirse este rendimiento, la empresa incurrirá en gastos adicionales debido a condiciones geológicas adversas, tales como: presencia de rocas densas, arcillas, pérdida de circulación, derrumbes por inestabilidad del terreno, o cualquier otra condición propia del subsuelo proporcionado por el CONTRATANTE. En tales casos, HIDROPERFORACIONES, S.A. cobrará la suma de Q4,500.00 (Cuatro mil quinientos quetzales) por cada turno de 8 horas considerado como TURNO DE PERFORACIÓN ADVERSO. Estos turnos deberán ser pagados inmediatamente al ser requeridos por la empresa, para lo cual se extenderá la factura correspondiente. En caso de incumplimiento de pago, los trabajos serán suspendidos hasta que se realice la cancelación. Si el CONTRATANTE se niega a pagar los turnos adversos ejecutados, HIDROPERFORACIONES, S.A. tendrá el derecho de retirar el equipo sin responsabilidad ni perjuicio alguno, una vez transcurridos cinco (5) días calendario desde la negativa de pago.

19. En la presente oferta se incluye una cantidad determinada de metros cúbicos de grava o piedrín. No obstante, en caso de que por condiciones geológicas sea necesario utilizar un volumen mayor al previsto, dicho volumen adicional será facturado junto con el flete correspondiente, con base en el precio unitario establecido en esta oferta.

20. Si por razones geológicas de inestabilidad del pozo no fuera posible realizar el registro eléctrico, HIDROPERFORACIONES, S.A. procederá a elaborar el perfil de entubado con base en las muestras estratigráficas obtenidas durante la perforación, siempre y cuando haya existido circulación durante el proceso.

21. En el supuesto de que HIDROPERFORACIONES, S.A. sea contratada por un contratista, no asumirá responsabilidad alguna respecto de trabajos, obligaciones o compromisos adquiridos por dicho contratista con terceros ajenos a HIDROPERFORACIONES, S.A. La responsabilidad de HIDROPERFORACIONES, S.A. se limitará exclusivamente a los trabajos contratados directamente con el CONTRATANTE, de conformidad con lo estipulado en la presente cotización. En caso de presentarse desacuerdos, conflictos o reclamaciones derivados de negociaciones con terceros, HIDROPERFORACIONES, S.A. podrá suspender y retirar su equipo sin asumir responsabilidad ni obligación de resarcimiento alguno.

22. El CONTRATANTE deberá designar y contar con un profesional calificado que supervise de manera continua los avances diarios del proyecto. Dicho profesional tendrá la responsabilidad de verificar y avalar los siguientes aspectos: pies perforados en cada jornada; consumos de bentonita, agua y demás insumos; registro y control de pipas de agua utilizadas; demás renglones de trabajo estipulados en la presente cotización. En caso de que el CONTRATANTE no cuente con dicho supervisor, se entenderá que acepta como válidos los avances y consumos descritos en la bitácora diaria elaborada por HIDROPERFORACIONES, S.A.`

export const defaultCondicionesLimp = `1. Los precios indicados están en Quetzales (GTQ) e incluyen IVA del 12%.
2. Validez de la cotización: 15 días calendario a partir de la fecha de emisión.
3. Forma de pago: según plan de pagos adjunto acordado con el cliente.
4. El cliente deberá proporcionar acceso libre al pozo y energía eléctrica disponible en el sitio.
5. El precio incluye los químicos y aditivos de limpieza especificados en esta cotización.
6. El tiempo de ejecución puede variar según el estado y condiciones del pozo.
7. El presente presupuesto no incluye reparaciones estructurales del pozo.`
