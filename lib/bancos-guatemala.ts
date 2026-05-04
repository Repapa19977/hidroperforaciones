export const BANCOS_GUATEMALA = [
  'El Credito Hipotecario Nacional de Guatemala',
  'Banco Cuscatlan Guatemala, S. A.',
  'Banco de los Trabajadores',
  'Banco Industrial, S. A.',
  'Banco de Desarrollo Rural, S. A. (Banrural)',
  'Banco Internacional, S. A.',
  'Citibank, N.A., Sucursal Guatemala',
  'Vivibanco, S. A.',
  'Banco Ficohsa Guatemala, S. A.',
  'Banco Promerica, S. A.',
  'Banco de Antigua, S. A.',
  'Banco de America Central, S. A. (BAC)',
  'Banco Agromercantil de Guatemala, S. A. (BAM)',
  'Banco G&T Continental, S. A.',
  'Banco Azteca de Guatemala, S. A.',
  'Banco INV, S. A.',
  'Banco Credicorp, S. A.',
  'Banco Nexa, S. A.',
  'Banco Multimoney, S. A.',
  'Otro banco',
] as const

export type BancoGuatemala = (typeof BANCOS_GUATEMALA)[number]
