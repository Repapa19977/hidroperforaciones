// ============================================================
// CONDICIONES IMPORTANTES — PERFORACIÓN
// Catálogo de 18 cláusulas legales aprobadas para cotizaciones de perforación.
// Cada condición tiene un id único; el usuario puede activar o desactivar
// individualmente. El PDF las renumera 1, 2, 3... (sin huecos) según
// las que estén activas.
// ============================================================

export interface CondicionLegal {
  id: string          // identificador único y estable (no cambiar)
  titulo: string      // título corto para la UI de toggles
  texto: string       // texto legal completo que va al PDF
  defaultActiva: boolean  // por default siempre true — todas activas
}

export const CONDICIONES_PERFORACION: CondicionLegal[] = [
  {
    id: 'referencia-p',
    titulo: 'Número de referencia "P"',
    texto: 'La presente cotización se identifica con un número de referencia antecedido por la letra "P", el cual deberá utilizarse para cualquier comunicación, gestión administrativa o facturación relacionada con el proyecto.',
    defaultActiva: true,
  },
  {
    id: 'condiciones-pago',
    titulo: 'Condiciones de Pago y Movilización',
    texto: 'Condiciones de Pago y Movilización: El anticipo establecido deberá liquidarse previo al ingreso del equipo y una vez que el terreno cuente con las adecuaciones de acceso necesarias; de lo contrario, Hidroperforaciones, Sociedad Anónima no estará obligada a iniciar los trabajos. Asimismo, los pagos por avance físico (etapas o porcentajes) son de cumplimiento obligatorio para el Contratante. Ante el incumplimiento de estos, la empresa podrá suspender la ejecución y retirar su equipo tras cinco (5) días hábiles de atraso, sin responsabilidad legal ni perjuicio alguno. Si transcurrido este plazo el equipo permaneciera en el sitio, se generará un cargo de Q5,000.00 diarios por concepto de maquinaria parada, los cuales serán facturados de inmediato. Hidroperforaciones se reserva el derecho de determinar el momento del retiro del equipo derivado de la falta de pago.',
    defaultActiva: true,
  },
  {
    id: 'alcance-responsabilidad',
    titulo: 'Alcance de Responsabilidad',
    texto: 'Alcance de Responsabilidad: Hidroperforaciones ejecuta los trabajos basándose estrictamente en los estudios, ubicación, profundidad y especificaciones técnicas (diámetros, encamisado, etc.) proporcionados por el Contratante. En consecuencia, la empresa no asume responsabilidad alguna por los resultados obtenidos en cuanto al caudal (cantidad) ni a la calidad fisicoquímica del agua.',
    defaultActiva: true,
  },
  {
    id: 'insumos-servicios',
    titulo: 'Insumos y Servicios',
    texto: 'Insumos y Servicios: La presente cotización contempla una cantidad base de insumos (bentonita, polímeros, agua y grava, entre otros) y horas de servicio técnico (soplado, limpieza mecánica y aforo). Si por condiciones geológicas imprevistas fuera necesario exceder dichas cantidades, Hidroperforaciones notificará al Contratante y procederá al cobro de los excedentes según los precios unitarios pactados. Para garantizar la continuidad de los trabajos, estos montos deberán ser liquidados de inmediato tras la presentación de la factura. De no autorizarse o pagarse estos insumos y trabajos extraordinarios, la empresa queda facultada para suspender las labores sin que esto represente responsabilidad, penalidad o perjuicio alguno, dado que dichos suministros son técnicamente indispensables para la finalización exitosa del proyecto.',
    defaultActiva: true,
  },
  {
    id: 'encamisado',
    titulo: 'Encamisado del pozo',
    texto: 'Encamisado del pozo: Si factores geológicos (como arcillas reactivas, salientes de roca o derrumbes) impidieran el entubado a la profundidad contratada, se cobrarán únicamente los trabajos efectivamente ejecutados según los precios unitarios pactados. Si fuera necesario ampliar el diámetro del pozo (rimado) para superar dichos obstáculos, los pies trabajados se cobrarán de forma adicional a la tarifa vigente del renglón de perforación. Los insumos requeridos para esta operación (bentonita, polímeros, aditivos y pipas de agua) se facturarán por separado según su consumo, siempre que tales trabajos adicionales sean autorizados por el contratante por escrito. Asimismo, se establece que Hidroperforaciones no será responsable si, debido a condiciones adversas como inestabilidad geológica o salientes de roca, el entubado perdiera su verticalidad, por ser estos factores inherentes al terreno proporcionado por el contratante.',
    defaultActiva: true,
  },
  {
    id: 'supervisor',
    titulo: 'Supervisor Designado del Proyecto',
    texto: 'Supervisor Designado del Proyecto: Por transparencia en la ejecución de la obra, es indispensable que el Contratante designe a un supervisor encargado de validar los consumos y las cantidades ejecutadas. En ausencia de dicha supervisión en el sitio, el Contratante aceptará como válidos y definitivos los consumos y trabajos extraordinarios reportados por Hidroperforaciones en la bitácora del proyecto.',
    defaultActiva: true,
  },
  {
    id: 'permisos',
    titulo: 'Responsabilidades, Permisos e Infraestructura',
    texto: 'Responsabilidades, Permisos e Infraestructura: Hidroperforaciones no asume responsabilidad por la gestión de permisos, licencias o multas derivadas de la ejecución del proyecto ante terceros o instituciones gubernamentales. Asimismo, la empresa se exonera de cualquier responsabilidad por daños ocasionados a la infraestructura (pavimento, banquetas, redes aéreas o subterráneas) derivados del acceso, movilización y operación de nuestra maquinaria y equipo.',
    defaultActiva: true,
  },
  {
    id: 'horas-adversas',
    titulo: 'Horas adversas',
    texto: 'Horas adversas: La presente cotización se basa en un rendimiento mínimo de 20 pies por jornada en un turno de 10 horas (equivalente a 2 pies/hora). Si por condiciones geológicas el avance fuese inferior a dicho umbral, se aplicará un cargo de Q500.00 por hora adversa. La hora adversa se calcula como:\nhoras_turno - (pies_perforados / constante)\nLa constante es pies_minimo / horas_turno. Estas horas se registrarán en la bitácora diaria y se facturarán semanalmente. De presentarse un desacuerdo con el cobro justificado, Hidroperforaciones suspenderá los trabajos y retirará el equipo sin responsabilidad alguna. En tal caso, se emitirá un informe de balance para liquidar los fondos recibidos según los renglones ejecutados y los precios unitarios pactados en esta oferta.',
    defaultActiva: true,
  },
  {
    id: 'ampliacion-plazo',
    titulo: 'Ampliación del Plazo Contractual',
    texto: 'Ampliación del Plazo Contractual: Hidroperforaciones, S.A. se reserva el derecho de ampliar el plazo de ejecución estipulado en caso de surgir situaciones ajenas a su control. Estas incluyen, de manera enunciativa más no limitativa: complejidad técnica imprevista en los trabajos debido a condiciones geológicas inherentes al terreno proporcionado, averías mecánicas que requieran reparaciones prolongadas o importación de repuestos, restricciones administrativas o comunitarias que limiten la jornada laboral (incluyendo horarios inhábiles y festivos), así como eventos de caso fortuito o fuerza mayor. En tales circunstancias, Hidroperforaciones, S.A. notificará al Contratante por escrito, detallando el motivo y la estimación del tiempo adicional, sin que ello genere penalizaciones o responsabilidad alguna para la empresa.',
    defaultActiva: true,
  },
  {
    id: 'trabajos-no-incluidos',
    titulo: 'Trabajos no Incluidos en la Oferta',
    texto: 'Trabajos no Incluidos en la Oferta: Cualquier labor, suministro o servicio que no se encuentre explícitamente detallado en la presente cotización será considerado como un trabajo extra. En tal caso, Hidroperforaciones procederá a cotizar dicha actividad para la previa revisión y aprobación por parte del Contratante antes de su ejecución.',
    defaultActiva: true,
  },
  {
    id: 'resguardo-seguridad',
    titulo: 'Resguardo y Seguridad del Equipo',
    texto: 'Resguardo y Seguridad del Equipo: Una vez instalado el equipo de perforación, herramientas e insumos en el área de trabajo, la custodia y seguridad de estos quedan bajo la responsabilidad directa del Contratante. Para garantizar la integridad operativa del proyecto, se establecen las siguientes condiciones:\n• Responsabilidad del Contratante: El cliente deberá proveer las medidas de vigilancia y seguridad necesarias para proteger el equipo contra daños, robos o actos vandálicos mientras permanezca en el sitio.\n• Servicio de Seguridad por Hidroperforaciones: En caso de que el Contratante no pueda o no desee brindar dicha seguridad, Hidroperforaciones gestionará un servicio de vigilancia externo.\n• Facturación de Servicios: Dado que este servicio es ajeno a la operatividad técnica inicial, la seguridad gestionada por nuestra empresa se considerará un trabajo adicional y será facturada íntegramente al finalizar el proyecto o según se acuerde.',
    defaultActiva: true,
  },
  {
    id: 'propiedad-retencion',
    titulo: 'Propiedad y Retención del Equipo',
    texto: 'Propiedad y Retención del Equipo: Se establece de manera inequívoca que toda la maquinaria, herramientas y equipo utilizados en el proyecto son propiedad exclusiva de Hidroperforaciones. En consecuencia, se acuerdan los siguientes términos:\n• Prohibición de Retención: Bajo ninguna circunstancia el Contratante podrá retener el equipo en el sitio de trabajo. Esta disposición prevalece sobre cualquier discrepancia derivada de las cláusulas anteriores o controversias operativas que pudieran surgir.\n• Deslinde de Responsabilidad ante Terceros: Hidroperforaciones responde únicamente ante la persona o entidad que aprobó la cotización original. No asumimos responsabilidad por conflictos, deudas o compromisos adquiridos por el Contratante con terceros (subcontratistas, proveedores locales o personal externo).\n• Penalización por Impedimento de Retiro: Cualquier situación ajena a Hidroperforaciones que impida el retiro físico del equipo será responsabilidad absoluta del Contratante. La custodia y seguridad de la maquinaria seguirán bajo cargo del cliente hasta su salida efectiva. Por cada día que el equipo permanezca retenido o imposibilitado de retiro por causas imputables al Contratante, se establece una multa de Q5,000.00 diarios.',
    defaultActiva: true,
  },
  {
    id: 'trabajos-no-ejecutados',
    titulo: 'Trabajos no Ejecutados',
    texto: 'Trabajos no Ejecutados: Si debido a circunstancias geológicas imprevistas en el terreno no fuera posible realizar algún trabajo contemplado, Hidroperforaciones descontará el o los rubros no ejecutados. Dicho ajuste se realizará con base en las cantidades y precios unitarios descritos en la presente cotización.',
    defaultActiva: true,
  },
  {
    id: 'perforacion-adicional',
    titulo: 'Perforación Adicional y Cambios en el Diseño',
    texto: 'Perforación Adicional y Cambios en el Diseño: Si una vez alcanzada la profundidad pactada el Contratante solicita continuar la perforación, o bien, requiere cambios en las especificaciones técnicas (diámetro de perforación, tipo de tubería o incremento en el metraje de rejilla), se procederá bajo los siguientes términos:\n• Presupuesto Complementario: Hidroperforaciones elaborará una nueva cotización. Se establece que, a mayor profundidad, el costo por pie de perforación se incrementa debido al aumento en los requerimientos técnicos, operativos y al mayor desgaste de los componentes del equipo.\n• Validez de Precios: Los precios unitarios de la oferta inicial no serán vinculantes para los excedentes o cambios de diseño, salvo autorización expresa y por escrito de Hidroperforaciones.\n• Aprobación Formal: El Contratante deberá aprobar formalmente la nueva propuesta antes de proceder con cualquier modificación al diseño original.\n• Continuidad del Proyecto: De no aprobarse el presupuesto complementario, Hidroperforaciones concluirá los trabajos basándose estrictamente en el alcance y las especificaciones pactadas en la cotización inicial.',
    defaultActiva: true,
  },
  {
    id: 'geologicas-adversas',
    titulo: 'Condiciones Geológicas Adversas',
    texto: 'Condiciones Geológicas Adversas: Si durante la ejecución de la obra se presentaran situaciones derivadas de la geología intrínseca del terreno —tales como derrumbes que dificulten el avance por azolve (acumulación de sedimentos), o la presencia de arcilla reactiva o expansiva por un espesor continuo superior a los 75 pies— que comprometan la perforación y pongan en peligro la integridad del pozo o la herramienta por riesgo de atrapamiento, Hidroperforaciones notificará formalmente al contratante para suspender las operaciones. Se advierte técnicamente que continuar la perforación en estratos de arcilla de gran magnitud puede provocar la pérdida de agua de los acuíferos colgados (estratos superiores). Dado que la arcilla actúa como un sello natural, perforar estos estratos de forma imprudente puede causar la disipación del recurso hídrico ya localizado. Ante este escenario, Hidroperforaciones solicitará autorización al contratante para realizar un registro eléctrico a profundidad, con el fin de determinar con exactitud las zonas productoras de agua y proceder al diseño y entubado definitivo del pozo. En caso de que el contratante decida continuar con la perforación ignorando estas recomendaciones técnicas, lo hará bajo su exclusiva responsabilidad, asumiendo los riesgos de atrapamiento de herramienta, pérdida definitiva de caudal y cualquier otro daño derivado de la situación advertida.',
    defaultActiva: true,
  },
  {
    id: 'antepozo',
    titulo: 'Construcción de Antepozo',
    texto: 'Construcción de Antepozo: Si por condiciones intrínsecas del terreno y la inestabilidad geológica de los estratos superiores se produjeran azolves continuos que impidan el avance de la perforación, se hará necesaria la instalación de una tubería protectora (antepozo) con un diámetro superior al de la perforación inicial. Ante esta eventualidad, Hidroperforaciones notificará formalmente al contratante para presentar la cotización de dichos trabajos adicionales. En caso de no ser autorizados, se procederá a la suspensión definitiva de la obra, toda vez que la falta de estabilización del terreno imposibilita la ejecución técnica del proyecto y representa un riesgo inminente de atrapamiento y pérdida de la herramienta de perforación.',
    defaultActiva: true,
  },
  {
    id: 'atrapamiento',
    titulo: 'Contingencias por Atrapamiento de Herramienta',
    texto: 'Contingencias por Inestabilidad del Terreno (Atrapamiento de Herramienta): Ante condiciones geológicas adversas (colapsos de pared, arcillas expansivas o reactivas, o inestabilidad de estratos) que provoquen el atrapamiento de la herramienta de perforación, se procederá bajo los siguientes términos:\n• Rescate Técnico: Hidroperforaciones realizará las maniobras de pesca y rescate necesarias para intentar recuperar el equipo. Durante este periodo, el cronograma contractual quedará suspendido de mutuo acuerdo.\n• Responsabilidad por Pérdida: Si el Contratante decide suspender las maniobras de rescate o si la recuperación técnica resulta imposible tras agotar los recursos disponibles, el costo total de la herramienta perdida en el pozo correrá por cuenta del Contratante.\n• Continuidad o Liquidación: Ante la inviabilidad técnica del punto de perforación, las partes podrán acordar la reubicación del equipo para iniciar un nuevo pozo (sujeto a una nueva cotización) o proceder a la liquidación del proyecto mediante un cuadro de inversión de los trabajos efectivamente realizados, liberando a Hidroperforaciones de cualquier responsabilidad legal o reclamo posterior.',
    defaultActiva: true,
  },
  {
    id: 'aceptacion',
    titulo: 'Aceptación del Contratante',
    texto: 'La aceptación de las presentes condiciones se perfeccionará por la manifestación del consentimiento a través de: firma autógrafa, aceptación vía correo electrónico, emisión de orden de compra o el pago de cualquier suma o por cualquier medio escrito. Las condiciones de pago aquí pactadas prevalecerán sobre cualesquiera otras que el contratante consigne en instrumentos contractuales posteriores. Las partes reconocen expresamente la calidad de título ejecutivo del presente documento.',
    defaultActiva: true,
  },
]

/** Override aplicado a una condición default (activa/inactiva + texto/título editado opcional). */
export interface CondicionOverride {
  activa?: boolean
  tituloCustom?: string
  textoCustom?: string
}

/** Condición extra agregada por el usuario (no pertenece al catálogo de 18). */
export interface CondicionExtra {
  id: string         // ej. "custom-1712345678901"
  titulo: string
  texto: string
  activa: boolean
}

/**
 * Resuelve la lista final de condiciones para una cotización, aplicando:
 *   - overrides a las 18 default (activa/inactiva + texto/título custom)
 *   - condiciones extras agregadas por el usuario
 * Retorna array listo para PDF con numeración implícita (el orden es final).
 */
export function resolverCondiciones(
  overrides?: Record<string, CondicionOverride>,
  extras?: CondicionExtra[]
): Array<{ id: string; titulo: string; texto: string }> {
  const resultado: Array<{ id: string; titulo: string; texto: string }> = []

  // 1) Las 18 del catálogo con overrides aplicados
  for (const base of CONDICIONES_PERFORACION) {
    const ov = overrides?.[base.id]
    const activa = ov?.activa ?? base.defaultActiva
    if (!activa) continue
    resultado.push({
      id: base.id,
      titulo: ov?.tituloCustom?.trim() || base.titulo,
      texto:  ov?.textoCustom?.trim()  || base.texto,
    })
  }

  // 2) Condiciones extras del usuario (activas)
  for (const extra of extras ?? []) {
    if (!extra.activa) continue
    if (!extra.texto.trim()) continue
    resultado.push({
      id: extra.id,
      titulo: extra.titulo.trim() || 'Condición adicional',
      texto: extra.texto.trim(),
    })
  }

  return resultado
}
