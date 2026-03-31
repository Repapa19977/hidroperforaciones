export const services = [
  {
    id: "perforacion",
    name: "Perforacion de Pozos",
    shortDesc: "Perforacion profesional de pozos mecanicos con tecnologia de punta y equipo especializado.",
    description: `Realizamos perforacion de pozos mecanicos para uso residencial, comercial, industrial y agricola. Contamos con equipo de perforacion de ultima generacion capaz de alcanzar grandes profundidades en todo tipo de terreno.

Nuestro proceso incluye estudio hidrogeologico previo, perforacion con control de calidad continuo, entubado con filtros y grava, desarrollo del pozo, prueba de bombeo y aforo completo.`,
    icon: "drill",
    features: [
      "Estudio hidrogeologico previo",
      "Perforacion en todo tipo de terreno",
      "Entubado con filtros y grava",
      "Desarrollo y prueba de bombeo",
      "Aforo completo certificado",
      "Proyectos residenciales y comerciales",
    ],
    priceRange: "Q85,000 - Q350,000+",
    priceDetails: [
      { item: "Perforacion por metro", range: "Q450 - Q1,200/m" },
      { item: "Entubado/filtros/grava/sello por metro", range: "Q180 - Q650/m" },
      { item: "Desarrollo + prueba bombeo + aforo", range: "Q6,000 - Q25,000" },
      { item: "Bomba + cable + tablero + instalacion", range: "Q8,000 - Q80,000+" },
    ],
  },
  {
    id: "mantenimiento-basico",
    name: "Mantenimiento Basico",
    shortDesc: "Servicio de 10 horas: extraccion, chequeo, limpieza mecanica y reinstalacion.",
    description: `Nuestro mantenimiento basico de 10 horas incluye extraccion completa del equipo sumergible, chequeo tecnico integral, limpieza mecanica del pozo (cepillado, pistoneado y cubeteado), limpieza electrica del panel de control, medicion de niveles estatico y dinamico, mediciones electricas completas y reinstalacion del equipo.

Ideal para pozos con funcionamiento normal que requieren su servicio preventivo periodico.`,
    icon: "wrench",
    features: [
      "Extraccion de equipo sumergible",
      "Chequeo tecnico integral",
      "Limpieza mecanica: cepillado, pistoneado, cubeteado",
      "Limpieza electrica del panel",
      "Medicion de niveles",
      "Mediciones electricas completas",
      "Reinstalacion del equipo",
    ],
    priceRange: "Q1,500 - Q5,500",
    duration: "10 horas",
  },
  {
    id: "mantenimiento-intermedio",
    name: "Mantenimiento Intermedio",
    shortDesc: "Servicio de 24 horas con inspeccion por camara, revision de paneles y limpieza extendida.",
    description: `El mantenimiento intermedio de 24 horas incluye todo lo del basico mas inspeccion con camara submarina para evaluar el estado interno del pozo, revision exhaustiva de paneles electricos y una limpieza mecanica extendida de 24 horas.

Recomendado para pozos con disminucion de caudal o presion, o que no han recibido mantenimiento en mas de 2 anos.`,
    icon: "camera",
    features: [
      "Todo lo del mantenimiento basico",
      "Inspeccion con camara submarina",
      "Revision exhaustiva de paneles",
      "Limpieza mecanica de 24 horas",
      "Diagnostico visual del estado del pozo",
      "Reporte tecnico con video",
    ],
    priceRange: "Q5,500 - Q15,000",
    duration: "24 horas",
  },
  {
    id: "mantenimiento-completo",
    name: "Mantenimiento Completo",
    shortDesc: "Servicio integral de 30 horas con quimico clarificador, limpieza combinada y aforo.",
    description: `El mantenimiento completo de 30 horas es nuestro servicio mas integral. Incluye todo lo del intermedio mas aplicacion de quimico clarificador, limpieza mecanica de 30 horas combinada con aforo, y aforo de bombeo para determinar el caudal exacto del pozo.

Es la solucion definitiva para pozos con problemas serios de rendimiento, incrustaciones o contaminacion.`,
    icon: "flask",
    features: [
      "Todo lo del mantenimiento intermedio",
      "Quimico clarificador profesional",
      "Limpieza mecanica de 30 horas + aforo",
      "Aforo de bombeo completo",
      "Determinacion exacta de caudal",
      "Recomendaciones de optimizacion",
    ],
    priceRange: "Q12,000 - Q35,000+",
    duration: "30 horas",
  },
  {
    id: "emergencias",
    name: "Servicio de Emergencia",
    shortDesc: "Atencion prioritaria para pozos con fallas criticas. Respuesta rapida garantizada.",
    description: `Atendemos emergencias como fallos totales de bomba, contaminacion del agua, colapso de entubado y otros problemas criticos que requieren atencion inmediata.

Nuestro equipo de respuesta rapida evalua la situacion, proporciona un diagnostico inmediato y ejecuta las reparaciones necesarias para restaurar el suministro de agua lo antes posible.`,
    icon: "alert",
    features: [
      "Respuesta rapida prioritaria",
      "Diagnostico inmediato en sitio",
      "Reparacion de emergencia",
      "Disponibilidad extendida",
      "Equipo de respuesta especializado",
      "Seguimiento post-emergencia",
    ],
    priceRange: "Q2,500 - Q35,000+",
  },
  {
    id: "diagnostico",
    name: "Diagnostico y Visita Tecnica",
    shortDesc: "Evaluacion profesional del estado de su pozo con reporte tecnico detallado.",
    description: `Realizamos visitas tecnicas de diagnostico que incluyen inspeccion visual, medicion de niveles, pruebas electricas, evaluacion del equipo de bombeo y un reporte tecnico completo con recomendaciones.

Ideal como primer paso para determinar que tipo de mantenimiento o intervencion requiere su pozo.`,
    icon: "search",
    features: [
      "Inspeccion visual completa",
      "Medicion de niveles",
      "Pruebas electricas",
      "Evaluacion del equipo de bombeo",
      "Reporte tecnico detallado",
      "Recomendaciones personalizadas",
    ],
    priceRange: "Q450 - Q1,200",
  },
];

export const costBreakdown = {
  title: "Desglose de Costos — Limpieza Mecanica",
  pricePerHour: 375,
  details: {
    dieselPrice: 41,
    cleaningHours: 40,
    workHoursPerDay: 10,
    personnel: 2,
    dailyPerDiem: 25,
    dailyLodging: 100,
    totalWorkDays: 6,
    projectCost: 8731.43,
    costPerHour: 218.29,
    contingency10Pct: 43.66,
    netCostPerHour: 261.94,
    salePricePerHour: 375,
    iva12Pct: 45,
    isr5Pct: 18.75,
    netSalePrice: 311.25,
    profitPerHour: 49.31,
    profitPct: 15.84,
  },
};
