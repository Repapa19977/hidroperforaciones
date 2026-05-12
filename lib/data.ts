export type Stage = 'new' | 'qualified' | 'proposition' | 'negotiation' | 'won' | 'lost'

export interface Opportunity {
  id: string
  correlativo: string
  cliente: string
  empresa: string
  monto: number
  etapa: Stage
  vendedor: string
  avatar: string
  fecha: string
  tipo: 'Perforación' | 'Limpieza Mecánica' | 'Otro'
  profundidad?: number
  proyecto?: string
  diasSinActividad: number
}

export interface Cotizacion {
  id: string
  correlativo: string
  cliente: string
  estado: 'borrador' | 'enviada' | 'confirmada' | 'cancelada'
  tipo: 'Perforación' | 'Limpieza Mecánica'
  proyecto: string
  monto: number
  fecha: string
  vendedor: string
}

export interface Contacto {
  id: string
  nombre: string
  empresa: string
  tipo: 'cliente' | 'proveedor' | 'prospecto'
  tipoPersona?: 'individual' | 'empresa'
  email: string
  telefono: string
  pais: string
  cotizaciones: number
}

export const STAGES: { id: Stage; label: string; color: string; bg: string }[] = [
  { id: 'new', label: 'Nuevo', color: 'text-slate-400', bg: 'bg-slate-800' },
  { id: 'qualified', label: 'Calificado', color: 'text-blue-400', bg: 'bg-blue-950' },
  { id: 'proposition', label: 'Propuesta', color: 'text-violet-400', bg: 'bg-violet-950' },
  { id: 'negotiation', label: 'Negociación', color: 'text-amber-400', bg: 'bg-amber-950' },
  { id: 'won', label: 'Ganado', color: 'text-emerald-400', bg: 'bg-emerald-950' },
]

export const opportunities: Opportunity[] = [
  // NEW (8)
  { id: '1', correlativo: 'CRM-001', cliente: 'Pollo Campero', empresa: 'Corporación Campero', monto: 125000, etapa: 'new', vendedor: 'René D.', avatar: 'RD', fecha: '2026-04-10', tipo: 'Perforación', profundidad: 500, proyecto: 'Pozo Zona Industrial', diasSinActividad: 2 },
  { id: '2', correlativo: 'CRM-002', cliente: 'Finca Las Margaritas', empresa: 'Agropecuaria GM', monto: 98500, etapa: 'new', vendedor: 'Gilda G.', avatar: 'GG', fecha: '2026-04-08', tipo: 'Perforación', profundidad: 400, proyecto: 'Pozo Agrícola', diasSinActividad: 4 },
  { id: '3', correlativo: 'CRM-003', cliente: 'Hotel Barceló', empresa: 'Barceló Hotels', monto: 210000, etapa: 'new', vendedor: 'René D.', avatar: 'RD', fecha: '2026-04-07', tipo: 'Perforación', profundidad: 850, proyecto: 'Pozo Principal', diasSinActividad: 5 },
  { id: '4', correlativo: 'CRM-004', cliente: 'MAGA', empresa: 'Min. Agricultura', monto: 185000, etapa: 'new', vendedor: 'Mario R.', avatar: 'MR', fecha: '2026-04-05', tipo: 'Perforación', profundidad: 700, proyecto: 'Pozo Comunal', diasSinActividad: 7 },
  { id: '5', correlativo: 'CRM-005', cliente: 'Cooperativa Agrícola', empresa: 'COOPAG', monto: 78000, etapa: 'new', vendedor: 'Gilda G.', avatar: 'GG', fecha: '2026-04-03', tipo: 'Limpieza Mecánica', proyecto: 'Limpieza Pozo Existente', diasSinActividad: 9 },
  { id: '6', correlativo: 'CRM-006', cliente: 'Industrias Lácteas', empresa: 'ILECHE S.A.', monto: 145000, etapa: 'new', vendedor: 'René D.', avatar: 'RD', fecha: '2026-04-01', tipo: 'Perforación', profundidad: 580, proyecto: 'Pozo Planta', diasSinActividad: 11 },
  { id: '7', correlativo: 'CRM-007', cliente: 'Municipalidad de Escuintla', empresa: 'Municipalidad', monto: 320000, etapa: 'new', vendedor: 'Mario R.', avatar: 'MR', fecha: '2026-03-28', tipo: 'Perforación', profundidad: 1200, proyecto: 'Pozo Municipal', diasSinActividad: 15 },
  { id: '8', correlativo: 'CRM-008', cliente: 'Exportadora Génesis', empresa: 'EG Corp', monto: 92000, etapa: 'new', vendedor: 'Gilda G.', avatar: 'GG', fecha: '2026-03-25', tipo: 'Perforación', profundidad: 380, proyecto: 'Pozo Bodega', diasSinActividad: 18 },
  // QUALIFIED (7)
  { id: '9', correlativo: 'CRM-009', cliente: 'Cervecería Centroamericana', empresa: 'Gallo', monto: 280000, etapa: 'qualified', vendedor: 'René D.', avatar: 'RD', fecha: '2026-04-02', tipo: 'Perforación', profundidad: 1050, proyecto: 'Pozo Planta Norte', diasSinActividad: 3 },
  { id: '10', correlativo: 'CRM-010', cliente: 'Universidad Galileo', empresa: 'UG', monto: 155000, etapa: 'qualified', vendedor: 'Gilda G.', avatar: 'GG', fecha: '2026-03-30', tipo: 'Perforación', profundidad: 620, proyecto: 'Pozo Campus', diasSinActividad: 6 },
  { id: '11', correlativo: 'CRM-011', cliente: 'Agroindustrial del Sur', empresa: 'AIS', monto: 198000, etapa: 'qualified', vendedor: 'René D.', avatar: 'RD', fecha: '2026-03-27', tipo: 'Perforación', profundidad: 780, proyecto: 'Pozo Finca', diasSinActividad: 10 },
  { id: '12', correlativo: 'CRM-012', cliente: 'Grupo Bimbo GT', empresa: 'Bimbo', monto: 175000, etapa: 'qualified', vendedor: 'Mario R.', avatar: 'MR', fecha: '2026-03-24', tipo: 'Perforación', profundidad: 700, proyecto: 'Pozo Panificadora', diasSinActividad: 13 },
  { id: '13', correlativo: 'CRM-013', cliente: 'Club Los Arcos', empresa: 'Club Los Arcos', monto: 88000, etapa: 'qualified', vendedor: 'Gilda G.', avatar: 'GG', fecha: '2026-03-20', tipo: 'Limpieza Mecánica', proyecto: 'Rehabilitación Pozo', diasSinActividad: 17 },
  { id: '14', correlativo: 'CRM-014', cliente: 'COOP San Bartolomé', empresa: 'Cooperativa SB', monto: 142000, etapa: 'qualified', vendedor: 'René D.', avatar: 'RD', fecha: '2026-03-18', tipo: 'Perforación', profundidad: 560, proyecto: 'Pozo Comunitario', diasSinActividad: 19 },
  { id: '15', correlativo: 'CRM-015', cliente: 'Ingenio La Unión', empresa: 'Ingenio LU', monto: 265000, etapa: 'qualified', vendedor: 'Mario R.', avatar: 'MR', fecha: '2026-03-15', tipo: 'Perforación', profundidad: 1000, proyecto: 'Pozo Ingenio', diasSinActividad: 22 },
  // PROPOSITION (15)
  { id: '16', correlativo: 'CRM-016', cliente: 'Cemento Progreso', empresa: 'Cementos S.A.', monto: 385000, etapa: 'proposition', vendedor: 'René D.', avatar: 'RD', fecha: '2026-03-10', tipo: 'Perforación', profundidad: 1400, proyecto: 'Pozo Industrial', diasSinActividad: 1 },
  { id: '17', correlativo: 'CRM-017', cliente: 'Banco Industrial', empresa: 'BI', monto: 165000, etapa: 'proposition', vendedor: 'Gilda G.', avatar: 'GG', fecha: '2026-03-08', tipo: 'Perforación', profundidad: 650, proyecto: 'Pozo Torre Corp', diasSinActividad: 3 },
  { id: '18', correlativo: 'CRM-018', cliente: 'Mega Paca GT', empresa: 'MP Corp', monto: 95000, etapa: 'proposition', vendedor: 'Mario R.', avatar: 'MR', fecha: '2026-03-06', tipo: 'Limpieza Mecánica', proyecto: 'Servicio Pozo 3', diasSinActividad: 5 },
  { id: '19', correlativo: 'CRM-019', cliente: 'Aldeas Infantiles SOS', empresa: 'SOS', monto: 118000, etapa: 'proposition', vendedor: 'René D.', avatar: 'RD', fecha: '2026-03-04', tipo: 'Perforación', profundidad: 480, proyecto: 'Pozo Aldea Norte', diasSinActividad: 7 },
  { id: '20', correlativo: 'CRM-020', cliente: 'Hospital Herrera Llerandi', empresa: 'HHL', monto: 225000, etapa: 'proposition', vendedor: 'Gilda G.', avatar: 'GG', fecha: '2026-03-02', tipo: 'Perforación', profundidad: 890, proyecto: 'Pozo Emergencias', diasSinActividad: 9 },
  { id: '21', correlativo: 'CRM-021', cliente: 'Finca El Paraíso', empresa: 'Inversiones EP', monto: 142000, etapa: 'proposition', vendedor: 'Mario R.', avatar: 'MR', fecha: '2026-02-28', tipo: 'Perforación', profundidad: 560, proyecto: 'Pozo Ganadero', diasSinActividad: 11 },
  { id: '22', correlativo: 'CRM-022', cliente: 'Distribuidora Farmaceutica', empresa: 'DIFA', monto: 178000, etapa: 'proposition', vendedor: 'René D.', avatar: 'RD', fecha: '2026-02-25', tipo: 'Perforación', profundidad: 710, proyecto: 'Pozo Bodega Central', diasSinActividad: 14 },
  { id: '23', correlativo: 'CRM-023', cliente: 'Palmas del Pacífico', empresa: 'Palmas Corp', monto: 295000, etapa: 'proposition', vendedor: 'Gilda G.', avatar: 'GG', fecha: '2026-02-22', tipo: 'Perforación', profundidad: 1100, proyecto: 'Pozo Finca Costera', diasSinActividad: 17 },
  { id: '24', correlativo: 'CRM-024', cliente: 'Municipalidad Mixco', empresa: 'Muni Mixco', monto: 420000, etapa: 'proposition', vendedor: 'Mario R.', avatar: 'MR', fecha: '2026-02-20', tipo: 'Perforación', profundidad: 1600, proyecto: 'Pozos Colonias', diasSinActividad: 19 },
  { id: '25', correlativo: 'CRM-025', cliente: 'Club Guatemala', empresa: 'CG Sport', monto: 88000, etapa: 'proposition', vendedor: 'René D.', avatar: 'RD', fecha: '2026-02-18', tipo: 'Limpieza Mecánica', proyecto: 'Rehab Piscinas', diasSinActividad: 21 },
  { id: '26', correlativo: 'CRM-026', cliente: 'Inmobiliaria Vistas', empresa: 'IV Corp', monto: 195000, etapa: 'proposition', vendedor: 'Gilda G.', avatar: 'GG', fecha: '2026-02-15', tipo: 'Perforación', profundidad: 780, proyecto: 'Pozo Residencial', diasSinActividad: 24 },
  { id: '27', correlativo: 'CRM-027', cliente: 'AEP Guatemala', empresa: 'AEP', monto: 265000, etapa: 'proposition', vendedor: 'Mario R.', avatar: 'MR', fecha: '2026-02-12', tipo: 'Perforación', profundidad: 1000, proyecto: 'Proyecto Aep', diasSinActividad: 27 },
  { id: '28', correlativo: 'CRM-028', cliente: 'Ganadera El Pajal', empresa: 'GEP', monto: 138000, etapa: 'proposition', vendedor: 'René D.', avatar: 'RD', fecha: '2026-02-10', tipo: 'Perforación', profundidad: 540, proyecto: 'Estudio Pozo Ganadero', diasSinActividad: 29 },
  { id: '29', correlativo: 'CRM-029', cliente: 'Textiles del Sur', empresa: 'TS Corp', monto: 172000, etapa: 'proposition', vendedor: 'Gilda G.', avatar: 'GG', fecha: '2026-02-08', tipo: 'Perforación', profundidad: 680, proyecto: 'Pozo Planta Textil', diasSinActividad: 31 },
  { id: '30', correlativo: 'CRM-030', cliente: 'Parque Industrial Zona 12', empresa: 'PI Z12', monto: 340000, etapa: 'proposition', vendedor: 'Mario R.', avatar: 'MR', fecha: '2026-02-05', tipo: 'Perforación', profundidad: 1250, proyecto: 'Pozo Industrial Z12', diasSinActividad: 34 },
  // NEGOTIATION (9)
  { id: '31', correlativo: 'CRM-031', cliente: 'Del Monte Guatemala', empresa: 'Del Monte', monto: 285000, etapa: 'negotiation', vendedor: 'René D.', avatar: 'RD', fecha: '2026-01-28', tipo: 'Perforación', profundidad: 1100, proyecto: 'Del Monte Pozo 2', diasSinActividad: 2 },
  { id: '32', correlativo: 'CRM-032', cliente: 'Aprodipagua', empresa: 'Aprodipagua', monto: 45000, etapa: 'negotiation', vendedor: 'Gilda G.', avatar: 'GG', fecha: '2026-01-25', tipo: 'Limpieza Mecánica', proyecto: 'Limpieza Mecánica Pozo', diasSinActividad: 5 },
  { id: '33', correlativo: 'CRM-033', cliente: 'Inversiones La Ceiba', empresa: 'ILC', monto: 215000, etapa: 'negotiation', vendedor: 'Mario R.', avatar: 'MR', fecha: '2026-01-22', tipo: 'Perforación', profundidad: 850, proyecto: 'Pozo Condominios', diasSinActividad: 8 },
  { id: '34', correlativo: 'CRM-034', cliente: 'Porgua GT', empresa: 'Porgua', monto: 188000, etapa: 'negotiation', vendedor: 'René D.', avatar: 'RD', fecha: '2026-01-20', tipo: 'Perforación', profundidad: 750, proyecto: 'Pozo Planta Caucho', diasSinActividad: 11 },
  { id: '35', correlativo: 'CRM-035', cliente: 'Constructora COCISA', empresa: 'COCISA', monto: 355000, etapa: 'negotiation', vendedor: 'Gilda G.', avatar: 'GG', fecha: '2026-01-18', tipo: 'Perforación', profundidad: 1350, proyecto: 'Pozos Urbanización', diasSinActividad: 13 },
  { id: '36', correlativo: 'CRM-036', cliente: 'Cerveza Modelo GT', empresa: 'Modelo', monto: 245000, etapa: 'negotiation', vendedor: 'Mario R.', avatar: 'MR', fecha: '2026-01-15', tipo: 'Perforación', profundidad: 950, proyecto: 'Pozo Distribuidora', diasSinActividad: 16 },
  { id: '37', correlativo: 'CRM-037', cliente: 'Hospital Privado del Sur', empresa: 'HPS', monto: 198000, etapa: 'negotiation', vendedor: 'René D.', avatar: 'RD', fecha: '2026-01-12', tipo: 'Perforación', profundidad: 780, proyecto: 'Pozo Ampliación', diasSinActividad: 19 },
  { id: '38', correlativo: 'CRM-038', cliente: 'Agrícola San José', empresa: 'ASJ', monto: 125000, etapa: 'negotiation', vendedor: 'Gilda G.', avatar: 'GG', fecha: '2026-01-10', tipo: 'Perforación', profundidad: 500, proyecto: 'Pozo Finca 3', diasSinActividad: 21 },
  { id: '39', correlativo: 'CRM-039', cliente: 'INTECAP', empresa: 'INTECAP', monto: 168000, etapa: 'negotiation', vendedor: 'Mario R.', avatar: 'MR', fecha: '2026-01-08', tipo: 'Perforación', profundidad: 660, proyecto: 'Pozo Centro Capacitación', diasSinActividad: 24 },
  // WON (5)
  { id: '40', correlativo: 'CRM-040', cliente: 'Marketitup', empresa: 'Marketitup', monto: 23449, etapa: 'won', vendedor: 'René D.', avatar: 'RD', fecha: '2026-02-01', tipo: 'Limpieza Mecánica', proyecto: 'Limpieza Mecánica Pozo', diasSinActividad: 0 },
  { id: '41', correlativo: 'CRM-041', cliente: 'Constructora XYZ', empresa: 'XYZ Corp', monto: 185000, etapa: 'won', vendedor: 'Gilda G.', avatar: 'GG', fecha: '2025-12-15', tipo: 'Perforación', profundidad: 720, proyecto: 'Pozo Oficinas Centrales', diasSinActividad: 0 },
  { id: '42', correlativo: 'CRM-042', cliente: 'Ganadera Morales', empresa: 'GM', monto: 142000, etapa: 'won', vendedor: 'Mario R.', avatar: 'MR', fecha: '2025-11-20', tipo: 'Perforación', profundidad: 560, proyecto: 'Pozo Ganadero 1', diasSinActividad: 0 },
  { id: '43', correlativo: 'CRM-043', cliente: 'Municipio San Marcos', empresa: 'Muni SM', monto: 298000, etapa: 'won', vendedor: 'René D.', avatar: 'RD', fecha: '2025-10-10', tipo: 'Perforación', profundidad: 1150, proyecto: 'Pozos Agua Potable', diasSinActividad: 0 },
  { id: '44', correlativo: 'CRM-044', cliente: 'Finca Bella Vista', empresa: 'FBV', monto: 115000, etapa: 'won', vendedor: 'Gilda G.', avatar: 'GG', fecha: '2025-09-05', tipo: 'Perforación', profundidad: 460, proyecto: 'Pozo Riego', diasSinActividad: 0 },
]

export const cotizaciones: Cotizacion[] = [
  { id: '1', correlativo: 'HP-COT-0060', cliente: 'Pollo Campero', estado: 'borrador', tipo: 'Perforación', proyecto: 'Perforación de pozo mecánico', monto: 516000, fecha: '2026-04-14', vendedor: 'René D.' },
  { id: '2', correlativo: 'HP-COT-0059', cliente: 'Finca Las Margaritas', estado: 'borrador', tipo: 'Perforación', proyecto: 'Perforación de pozo mecánico', monto: 412000, fecha: '2026-04-12', vendedor: 'Gilda G.' },
  { id: '3', correlativo: 'HP-COT-0058', cliente: 'COOP. San Bartolomé', estado: 'enviada', tipo: 'Perforación', proyecto: 'Perforación de pozo mecánico', monto: 368500, fecha: '2026-04-10', vendedor: 'René D.' },
  { id: '4', correlativo: 'HP-COT-0056', cliente: 'Cervecería Centroamericana', estado: 'borrador', tipo: 'Perforación', proyecto: 'Perforación de pozo mecánico', monto: 682000, fecha: '2026-04-08', vendedor: 'Mario R.' },
  { id: '5', correlativo: 'HP-COT-0054', cliente: 'MAGA', estado: 'cancelada', tipo: 'Perforación', proyecto: 'Perforación de pozo mecánico', monto: 525000, fecha: '2026-04-05', vendedor: 'Gilda G.' },
  { id: '6', correlativo: 'HP-COT-0036', cliente: 'Marketitup', estado: 'confirmada', tipo: 'Limpieza Mecánica', proyecto: 'Servicio limpieza mecánica', monto: 23449, fecha: '2026-02-01', vendedor: 'René D.' },
]

export const contactos: Contacto[] = [
  { id: '1', nombre: 'Carlos Mendoza', empresa: 'Pollo Campero', tipo: 'prospecto', email: 'cmendoza@campero.com', telefono: '+502 2278-8000', pais: 'Guatemala', cotizaciones: 1 },
  { id: '2', nombre: 'Ana García', empresa: 'Cervecería Centroamericana', tipo: 'prospecto', email: 'agarcia@gallo.com', telefono: '+502 2278-9000', pais: 'Guatemala', cotizaciones: 1 },
  { id: '3', nombre: 'Roberto Lima', empresa: 'Del Monte Guatemala', tipo: 'cliente', email: 'rlima@delmonte.com', telefono: '+502 2278-7000', pais: 'Guatemala', cotizaciones: 3 },
  { id: '4', nombre: 'María Soto', empresa: 'Finca Las Margaritas', tipo: 'prospecto', email: 'msoto@margaritas.com', telefono: '+502 5555-1234', pais: 'Guatemala', cotizaciones: 1 },
  { id: '5', nombre: 'Jorge Castillo', empresa: 'MAGA', tipo: 'prospecto', email: 'jcastillo@maga.gob.gt', telefono: '+502 2414-8600', pais: 'Guatemala', cotizaciones: 2 },
  { id: '6', nombre: 'Luisa Flores', empresa: 'Municipalidad de Mixco', tipo: 'prospecto', email: 'lflores@munimixco.gob.gt', telefono: '+502 2433-2100', pais: 'Guatemala', cotizaciones: 1 },
  { id: '7', nombre: 'Pedro Gramajo', empresa: 'Aprodipagua', tipo: 'cliente', email: 'pgramajo@aprodipagua.org', telefono: '+502 5678-9012', pais: 'Guatemala', cotizaciones: 2 },
  { id: '8', nombre: 'Sandra Morales', empresa: 'AEP Guatemala', tipo: 'cliente', email: 'smorales@aep.com', telefono: '+502 2222-3333', pais: 'Guatemala', cotizaciones: 4 },
]
