// Shared store for quotation data
// - localStorage: solo para pasar datos al print page (sesión)
// - API /api/cotizaciones: persistencia real en DB (SQLite)

import type { InputsPerforacion, InputsLimpieza } from './calculator'
import type { PreciosLineas } from './config-store'
import type { CurrencyCode } from './currency'

export interface HitoPago {
  id: string
  label: string
  pct: number
  fijo: boolean
  visible?: boolean
}

// Plan de pagos — defaults según PDF de referencia P5332.
// Todos los hitos son editables; la UI/API validan que los visibles sumen 100%.
// visible=false oculta el hito del PDF y del plan activo de cobros.
export const DEFAULT_PLAN_PAGOS: HitoPago[] = [
  { id: 'reserva',    label: 'Reserva',                    pct: 10, fijo: false, visible: true },
  { id: 'anticipo',   label: 'Anticipo',                   pct: 50, fijo: false, visible: true },
  { id: 'mitad-perf', label: 'Al 50% de perforación',      pct: 20, fijo: false, visible: true },
  { id: 'entubar',    label: 'Antes de entubar',           pct: 15, fijo: false, visible: true },
  { id: 'prueba',     label: 'Antes de prueba de bombeo',  pct: 5,  fijo: false, visible: true },
]

export const DEFAULT_PLAN_PAGOS_SERVICIO: HitoPago[] = [
  { id: 'anticipo-servicio', label: 'Anticipo',       pct: 80, fijo: false, visible: true },
  { id: 'contra-entrega',    label: 'Contra entrega', pct: 20, fijo: false, visible: true },
]

export interface QuotationData {
  correlativo: string
  tipo: 'perforacion' | 'limpieza'
  fecha: string
  validezDias: number
  cliente: string
  contactoId?: string | null  // FK al Contacto seleccionado — necesario para que el portal del cliente vea sus cotizaciones/proyectos
  empresa: string
  tipoCliente?: 'individual' | 'empresa'
  nombreComercial?: string
  razonSocial?: string
  nit: string
  telefono: string
  email: string
  proyecto: string
  departamento?: string
  municipio?: string
  aldea?: string
  direccion: string
  duracion: string
  vendedor: string
  vendedorEmail?: string
  vendedorCargo?: string
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
  aplicarIsr?: boolean     // aplicar ISR 5% al subtotal (default true)
  aplicarDescuento?: boolean  // aplicar descuento especial (resta al total final)
  descuentoMonto?: number     // Q descontado (sólo si aplicarDescuento)
  mostrarDesgloseImpuestos?: boolean  // mostrar desglose y texto CON IVA/SIN IVA en el PDF (default true)
  mostrarNotaCheque?: boolean  // mostrar nota de pago a nombre de Hidroperforaciones S.A. bajo el valor por pie (default true)
  valorPorPieManual?: number          // override manual del "VALOR POR PIE" del pie del PDF (si 0 o undef, usa auto-calc total/profundidad)
  monedaCotizacion?: CurrencyCode     // solo presentacion de cotizacion/PDF; montos internos siguen en GTQ
  tipoCambioUsd?: number              // Q por USD usado como snapshot de esta cotizacion
  mostrarEspesor?: boolean
  descripcionSimple?: boolean
  montoGuardado?: number              // snapshot del monto en DB al reimprimir cotizaciones legacy/guardadas
  // Precios snapshot al momento de cotizar (reunión 2026-04-18):
  //   se congelan al guardar la cotización para que al re-imprimir salga con los mismos números
  //   aunque el superadmin cambie la config después.
  pipaPrecioVentaUnitario?: number              // default 700 (editable en Config)
  camionadaGravaPrecioVentaUnitario?: number    // default 6000 (editable en Config)
  capacidadCamionM3?: number                    // default 12
  notas: string
}

export interface LineaConfig {
  mostrar: boolean   // true = visible en PDF al cliente
  cobrar: boolean    // true = suma al subtotal de la cotización
  nombreCustom?: string       // nombre/título editable para la línea base
  descripcionCustom?: string  // texto editable visible para líneas base o nota interna para toggles
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
  rubro?: string              // bloque/rubro del Excel: basico, equipamiento, aforo, libre
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
      contactoId:  data.contactoId ?? null,  // FK para portal cliente (vincula proyecto al contacto)
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
// Limpieza/servicios: S#### (ej. S0001)
// Fallback: HP-COT-#### (backward compat para cotizaciones viejas)
// Piso mínimo del fallback local — debe coincidir con CORRELATIVO_PISO del endpoint
// /api/cotizaciones/siguiente (instrucción Rodrigo 2026-04-23, producción desde 5330).
// Formato: P####-YYYY (ej. P5330-2026). El año es el del calendario al crear.
const CORRELATIVO_PISO_LOCAL = 5330

export function getNextCorrelativo(tipo: 'perforacion' | 'limpieza' = 'perforacion'): string {
  const prefijo = tipo === 'perforacion' ? 'P' : 'S'
  const anio = new Date().getFullYear()
  if (typeof window === 'undefined') {
    return `${prefijo}${String(CORRELATIVO_PISO_LOCAL).padStart(4, '0')}-${anio}`
  }
  const storageKey = `hidrocrm_last_num_${prefijo}`
  const stored = localStorage.getItem(storageKey)
  const last = stored ? parseInt(stored) : 0
  const next = Math.max(last + 1, CORRELATIVO_PISO_LOCAL)
  localStorage.setItem(storageKey, String(next))
  return `${prefijo}${String(next).padStart(4, '0')}-${anio}`
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

export const defaultCondicionesLimp = `1. La presente cotización se identifica con un número de referencia antecedido por la letra "S", el cual deberá utilizarse para cualquier comunicación, gestión administrativa o facturación relacionada con el proyecto.

2. Condiciones de Pago y Movilización: El anticipo establecido deberá liquidarse previo al ingreso del equipo y una vez que el área de trabajo cuente con las adecuaciones de acceso necesarias; de lo contrario, Hidroperforaciones, Sociedad Anónima no estará obligada a iniciar los trabajos. Asimismo, los pagos por avance físico (etapas o porcentajes) son de cumplimiento obligatorio para el Contratante. Ante el incumplimiento de estos, la empresa podrá suspender la ejecución y retirar su equipo tras cinco (5) días hábiles de atraso, sin responsabilidad legal ni perjuicio alguno. Si transcurrido este plazo el equipo permaneciera en el sitio, se generará un cargo de Q3,000.00 diarios por concepto de maquinaria parada, los cuales serán facturados de inmediato. Hidroperforaciones se reserva el derecho de determinar el momento del retiro del equipo derivado de la falta de pago.

3. Ampliación del Plazo Contractual: HIDROPERFORACIONES, S.A. se reserva el derecho de ampliar el plazo de ejecución estipulado en caso de surgir situaciones ajenas a su control. Estas incluyen, de manera enunciativa más no limitativa: complejidad técnica imprevista en los trabajos, averías mecánicas que requieran reparaciones prolongadas o importación de repuestos, restricciones administrativas o comunitarias que limiten la jornada laboral (incluyendo horarios inhábiles y festivos), así como eventos de caso fortuito o fuerza mayor. En tales circunstancias, HIDROPERFORACIONES, S.A. notificará al CONTRATANTE por escrito, detallando el motivo y la estimación del tiempo adicional, sin que ello genere penalizaciones o responsabilidad alguna para la empresa.

4. Autorización de Trabajos y Equipos: Una vez que HIDROPERFORACIONES, S.A. notifique al CONTRATANTE sobre el equipo a instalar o los trabajos a ejecutar, este dispondrá de 48 horas para emitir su autorización. De lo contrario, se aplicará una tarifa por inactividad de Q2,000.00 diarios. Si transcurridos cinco (5) días calendario persiste la falta de aprobación, la empresa podrá retirar el equipo sin responsabilidad alguna; el CONTRATANTE deberá cubrir los costos incurridos hasta el momento, incluyendo los cargos por demora acumulados.

5. Insumos y Servicios: La presente cotización contempla una cantidad base de insumos. Si por condiciones de la tubería a limpiarse fuera necesario exceder dichas cantidades, Hidroperforaciones notificará al Contratante y procederá al cobro de los excedentes según los precios unitarios pactados. Para garantizar la continuidad de los trabajos, estos montos deberán ser liquidados de inmediato tras la presentación de la factura. De no autorizarse o pagarse estos insumos y trabajos extraordinarios, la empresa queda facultada para suspender las labores sin que esto represente responsabilidad, penalidad o perjuicio alguno, dado que dichos suministros son técnicamente indispensables para la finalización exitosa del proyecto.

6. Supervisor Designado del Proyecto: Por transparencia en la ejecución de la obra, es indispensable que el Contratante designe a un supervisor encargado de validar los consumos y las cantidades ejecutadas. En ausencia de dicha supervisión en el sitio, el Contratante aceptará como válidos y definitivos los consumos y trabajos extraordinarios reportados por Hidroperforaciones en la bitácora del proyecto.

7. Responsabilidades, Permisos e Infraestructura: Hidroperforaciones no asume responsabilidad por la gestión de permisos, licencias o multas derivadas de la ejecución del proyecto ante terceros o instituciones gubernamentales. Asimismo, la empresa se exonera de cualquier responsabilidad por daños ocasionados a la infraestructura (pavimento, banquetas, redes aéreas o subterráneas) derivados del acceso, movilización y operación de nuestra maquinaria y equipo.

8. Trabajos y Repuestos no Incluidos en la Oferta: Cualquier labor, suministro o servicio que no se encuentre explícitamente detallado en la presente cotización será considerado como un trabajo extra. En tal caso, Hidroperforaciones procederá a cotizar dicha actividad para la previa revisión y aprobación por parte del Contratante antes de su ejecución.

9. Resguardo y Seguridad del Equipo: Una vez instalado el equipo de perforación, herramientas e insumos en el área de trabajo, la custodia y seguridad de estos quedan bajo la responsabilidad directa del Contratante. El cliente deberá proveer las medidas de vigilancia y seguridad necesarias para proteger el equipo contra daños, robos o actos vandálicos mientras permanezca en el sitio. En caso de que el Contratante no pueda o no desee brindar dicha seguridad, Hidroperforaciones gestionará un servicio de vigilancia externo. Dado que este servicio es ajeno a la operatividad técnica inicial, la seguridad gestionada por nuestra empresa se considerará un trabajo adicional y será facturada íntegramente al finalizar el proyecto o según se acuerde.

10. Reserva de Dominio y Derecho de Retiro: Todos los equipos instalados bajo la presente oferta permanecerán bajo la propiedad exclusiva de HIDROPERFORACIONES, S.A. hasta que el CONTRATANTE haya liquidado el pago total de los mismos. En caso de que el pago total no se efectúe dentro de un plazo de quince (15) días calendario contados a partir de la fecha de instalación, HIDROPERFORACIONES, S.A. queda facultada para desinstalar y retirar los equipos de la propiedad del CONTRATANTE. Dicho retiro se realizará sin responsabilidad alguna por la interrupción de suministros, servicios o cualquier otro perjuicio derivado de la desinstalación. El CONTRATANTE asumirá los gastos operativos de desmontaje y transporte generados por el incumplimiento de pago.

11. Propiedad y Retención del Equipo: Toda la maquinaria, herramientas y equipo utilizados en el proyecto son propiedad exclusiva de Hidroperforaciones. Bajo ninguna circunstancia el Contratante podrá retener el equipo en el sitio de trabajo. Hidroperforaciones responde únicamente ante la persona o entidad que aprobó la cotización original y no asumirá responsabilidad por conflictos, deudas o compromisos adquiridos por el Contratante con terceros. Cualquier situación ajena a Hidroperforaciones que impida el retiro físico del equipo será responsabilidad absoluta del Contratante. Por cada día que el equipo permanezca retenido o imposibilitado de retiro por causas imputables al Contratante, se establece una multa de Q5,000.00 diarios.

12. Condiciones para la Instalación de Equipos en Pozos Preexistentes: En proyectos donde se contrate la instalación de equipos sumergibles (motor o bomba) en pozos perforados o intervenidos previamente por terceros, HIDROPERFORACIONES, S.A. recomienda realizar una nueva limpieza mecánica bajo la supervisión de nuestra empresa antes de la instalación. De no ejecutarse la limpieza recomendada, HIDROPERFORACIONES, S.A. no otorgará garantía sobre el equipo instalado. El CONTRATANTE asume total responsabilidad por cualquier avería derivada de la presencia de materiales extraños o condiciones mecánicas deficientes del pozo que afecten el desempeño o la vida útil del equipo sumergible.

13. Autorización de Trabajos y Cargos por Inactividad: Una vez que HIDROPERFORACIONES, S.A. presente al CONTRATANTE la propuesta del equipo a instalar o el plan de trabajo a ejecutar, el CONTRATANTE dispondrá de un plazo máximo de 48 horas para otorgar su autorización. De no recibirse una respuesta dentro del plazo estipulado, se generará un cargo diario de Q2,000.00 en concepto de equipo inactivo, facturado por cada día de retraso. Si transcurridos cinco (5) días calendario desde la notificación inicial la autorización aún no ha sido emitida, HIDROPERFORACIONES, S.A. estará facultada para retirar su maquinaria y personal del proyecto sin responsabilidad alguna por incumplimiento. En caso de retiro, el CONTRATANTE deberá liquidar de inmediato todos los costos devengados hasta la fecha, incluyendo cargos por inactividad y gastos de movilización/desmovilización.

14. Extracción de Equipo Sumergible y Límite de Responsabilidad: En caso de que, durante las maniobras de extracción o instalación de cualquier equipo sumergible, ocurra el degollamiento de las roscas de la tubería debido al deterioro o fatiga del material, HIDROPERFORACIONES, S.A. quedará eximida de toda responsabilidad. La empresa no estará obligada a realizar maniobras de pesca para la recuperación del equipo afectado. Si HIDROPERFORACIONES, S.A. decide emprender el rescate técnico, el inicio de los trabajos no garantiza el éxito del rescate dada la naturaleza incierta de estas contingencias; se establecerá un periodo máximo para los intentos de recuperación y los montos devengados por maniobras de rescate no serán reembolsables ni estarán sujetos a devolución, independientemente del resultado de la operación.

15. Garantía de Equipos y Servicios de Instalación: Los equipos suministrados e instalados por HIDROPERFORACIONES, S.A. cuentan con una garantía limitada por un periodo determinado, la cual cubre exclusivamente defectos de fabricación o errores en la ejecución de la instalación, conforme a los términos del certificado de garantía correspondiente. La validez de dicha garantía quedará sin efecto si los equipos son manipulados, modificados, desinstalados o reparados por personal ajeno a HIDROPERFORACIONES, S.A.; por cualquier alteración técnica o física realizada por terceros; o por uso indebido fuera de las especificaciones técnicas del equipo o negligencia en su mantenimiento.

16. La aceptación de las presentes condiciones se perfeccionará por la manifestación del consentimiento a través de: firma autógrafa, aceptación vía correo electrónico, emisión de orden de compra o el pago de cualquier suma o por cualquier medio escrito. Las condiciones de pago aquí pactadas prevalecerán sobre cualesquiera otras que el contratante consigne en instrumentos contractuales posteriores. Las partes reconocen expresamente la calidad de título ejecutivo del presente documento.`
