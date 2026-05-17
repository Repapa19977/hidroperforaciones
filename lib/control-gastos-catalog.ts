export const CONTROL_GASTOS_PRODUCTOS = [
  'Bentonita',
  'Polimeros',
  'tuberia lisa',
  'tuberia ranurada',
  'Diesel',
  'Aceite y lubricantes',
  'repuestos',
  'registro electrico',
  'planilla',
  'entubado',
  'Bonificacion por perforacion',
  'salario',
  'otros',
  'pipa',
  'global',
  'comisiones por venta',
] as const

export const CONTROL_GASTOS_UNIDADES = [
  'sacos',
  'unidad',
  'global',
  'tubos',
  'canecas',
  'litro',
  'metros cubicos',
  'viajes',
  'metros lineal',
  'pie',
  'hora',
] as const

export const CONTROL_GASTOS_PROVEEDORES = [
  'promisa',
  'agua sistemas',
  'JC Portal',
  'Dinagasa',
  'Ingeniero Hector Villegas',
  'gasolinera',
  'Marvin Saravia',
  'Carlos',
] as const

function key(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function inferRubroGasto(producto: string): string {
  const p = key(producto)
  if (!p) return 'otro'
  if (p.includes('bentonita') || p.includes('polimero')) return 'bentonita'
  if (p.includes('tuberia')) return 'tuberia'
  if (p.includes('diesel')) return 'diesel'
  if (p.includes('planilla') || p === 'salario' || p.includes('salarios')) return 'salarios'
  if (p.includes('bonificacion')) return 'bonificaciones'
  if (p.includes('pipa')) return 'pipas-agua'
  if (p.includes('registro electrico')) return 'registro-electrico'
  if (p.includes('entubado')) return 'colocacion-ademe'
  if (p.includes('comisiones')) return 'comisiones'
  return 'otro'
}

export function unidadSugeridaGasto(producto: string): string {
  const p = key(producto)
  if (!p) return 'unidad'
  if (p.includes('bentonita')) return 'sacos'
  if (p.includes('polimero')) return 'canecas'
  if (p.includes('tuberia')) return 'tubos'
  if (p.includes('diesel') || p.includes('aceite')) return 'litro'
  if (p.includes('pipa')) return 'viajes'
  if (p.includes('bonificacion')) return 'pie'
  if (p.includes('entubado')) return 'pie'
  if (p.includes('salario')) return 'hora'
  if (p.includes('repuesto')) return 'unidad'
  return 'global'
}
