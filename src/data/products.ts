export const productCategories = [
  {
    id: "bombas",
    name: "Bombas Sumergibles",
    description: "Equipos de bombeo de alta eficiencia para todo tipo de aplicacion.",
  },
  {
    id: "motores",
    name: "Motores",
    description: "Motores electricos sumergibles de alta durabilidad.",
  },
  {
    id: "tuberia",
    name: "Tuberia y Accesorios",
    description: "Tuberia PVC y accesorios para instalacion de equipos de bombeo.",
  },
  {
    id: "paneles",
    name: "Paneles y Electricos",
    description: "Tableros de control, arrancadores, protectores y accesorios electricos.",
  },
  {
    id: "materiales",
    name: "Materiales de Mantenimiento",
    description: "Quimicos, grasas, sellos y materiales para servicio de pozos.",
  },
];

export const products = [
  // Bombas por HP
  {
    id: "bomba-05-1hp",
    name: "Bomba Sumergible 0.5 - 1 HP",
    category: "bombas",
    description: "Bomba sumergible para pozos residenciales de baja demanda. Ideal para viviendas unifamiliares.",
    specs: {
      potencia: "0.5 - 1 HP",
      tuberia: '1" - 1.25"',
      caudal: "20 - 60 GPM",
      aplicacion: "Residencial",
    },
    priceRange: "Q1,800 - Q6,000",
    featured: true,
  },
  {
    id: "bomba-15-2hp",
    name: "Bomba Sumergible 1.5 - 2 HP",
    category: "bombas",
    description: "Bomba de rango medio para residencias grandes, condominios o uso comercial ligero.",
    specs: {
      potencia: "1.5 - 2 HP",
      tuberia: '1.25" - 1.5"',
      caudal: "40 - 120 GPM",
      aplicacion: "Residencial / Comercial",
    },
    priceRange: "Q4,500 - Q14,000",
    featured: true,
  },
  {
    id: "bomba-3-5hp",
    name: "Bomba Sumergible 3 - 5 HP",
    category: "bombas",
    description: "Bomba de alta capacidad para uso comercial, industrial o agricola de mediana escala.",
    specs: {
      potencia: "3 - 5 HP",
      tuberia: '1.5" - 2"',
      caudal: "80 - 220 GPM",
      aplicacion: "Comercial / Industrial",
    },
    priceRange: "Q9,000 - Q28,000",
    featured: true,
  },
  {
    id: "bomba-75-10hp",
    name: "Bomba Sumergible 7.5 - 10+ HP",
    category: "bombas",
    description: "Bomba industrial de alto rendimiento para pozos de gran profundidad y alto caudal.",
    specs: {
      potencia: "7.5 - 10+ HP",
      tuberia: '2" - 3"',
      caudal: "150 - 400+ GPM",
      aplicacion: "Industrial / Agricola",
    },
    priceRange: "Q22,000 - Q75,000+",
    featured: true,
  },
  // Tuberia PVC
  {
    id: "tuberia-1-125",
    name: 'Tuberia PVC 1" - 1.25"',
    category: "tuberia",
    description: "Tuberia de columna para bombas de 0.5 a 1 HP.",
    specs: {
      diametro: '1" - 1.25"',
      compatibilidad: "0.5 - 1 HP",
      material: "PVC de alta presion",
    },
    priceRange: "Q18 - Q55/m",
    featured: false,
  },
  {
    id: "tuberia-125-15",
    name: 'Tuberia PVC 1.25" - 1.5"',
    category: "tuberia",
    description: "Tuberia de columna para bombas de 1.5 a 2 HP.",
    specs: {
      diametro: '1.25" - 1.5"',
      compatibilidad: "1.5 - 2 HP",
      material: "PVC de alta presion",
    },
    priceRange: "Q28 - Q90/m",
    featured: false,
  },
  {
    id: "tuberia-15-2",
    name: 'Tuberia PVC 1.5" - 2"',
    category: "tuberia",
    description: "Tuberia de columna para bombas de 3 a 5 HP.",
    specs: {
      diametro: '1.5" - 2"',
      compatibilidad: "3 - 5 HP",
      material: "PVC de alta presion",
    },
    priceRange: "Q45 - Q180/m",
    featured: false,
  },
  {
    id: "tuberia-2-3",
    name: 'Tuberia PVC 2" - 3"',
    category: "tuberia",
    description: "Tuberia de columna para bombas de 7.5 a 10+ HP.",
    specs: {
      diametro: '2" - 3"',
      compatibilidad: "7.5 - 10+ HP",
      material: "PVC de alta presion",
    },
    priceRange: "Q120 - Q450/m",
    featured: false,
  },
  // Materiales
  {
    id: "materiales-mantenimiento",
    name: "Kit de Materiales de Mantenimiento",
    category: "materiales",
    description: "Materiales comunes para intervenciones de mantenimiento: cloro, acido, grasa, cinta, conectores.",
    specs: {
      incluye: "Cloro/hipoclorito, acido desincrustante, grasa dielectrica, cinta teflon, prensaestopa, conectores",
      costoTipico: "Q1,200 - Q6,500 por intervencion",
    },
    priceRange: "Q1,200 - Q6,500",
    featured: false,
  },
  {
    id: "cable-sumergible",
    name: "Cable Sumergible #10 / #12",
    category: "paneles",
    description: "Cable electrico sumergible de alta resistencia para conexion de bombas.",
    specs: {
      calibre: "#10 / #12",
      tipo: "Sumergible",
      aislamiento: "Resistente al agua",
    },
    priceRange: "Consultar",
    featured: false,
  },
  {
    id: "tablero-control",
    name: "Tablero de Control Electrico",
    category: "paneles",
    description: "Tablero de control con proteccion termica, contactor y arrancador para bombas sumergibles.",
    specs: {
      componentes: "Contactor, protector termico, arrancador/capacitor",
      proteccion: "Sobrecarga, bajo voltaje, fase perdida",
    },
    priceRange: "Consultar",
    featured: false,
  },
];

export const datosParaCotizar = {
  mantenimiento: [
    "Profundidad del pozo",
    "Diametro del entubado",
    "A cuantos pies esta el equipo",
    "Tipo de motor y bomba",
    "Diametro de tuberia de columna",
    "Perfil del pozo",
  ],
  pozoBombaMotor: [
    "Nivel dinamico",
    "Nivel estatico",
    "Profundidad total",
    "Corte del pozo (ubicacion ranuradas)",
    "Diametro",
    "Aforo",
    "Distancia hacia tanque",
    "Corriente electrica disponible",
    "Uso del agua",
    "Diametro y tuberia instalada",
  ],
};
