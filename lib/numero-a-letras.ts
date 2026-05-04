// Convierte un número entero a su forma escrita en español (quetzales + centavos).
// Ejemplo: 262500 → "doscientos sesenta y dos mil quinientos quetzales con cero centavos"
// Rango soportado: 0 a 999,999,999 (suficiente para cotizaciones de perforación).

const UNIDADES = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve']
const DIEZ_A_DIECINUEVE = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve']
const DECENAS = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

function centenas(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cien'
  if (n < 10) return UNIDADES[n]
  if (n < 20) return DIEZ_A_DIECINUEVE[n - 10]
  if (n === 20) return 'veinte'
  if (n < 30) return 'veinti' + UNIDADES[n - 20]
  if (n < 100) {
    const d = Math.floor(n / 10), u = n % 10
    return DECENAS[d] + (u > 0 ? ' y ' + UNIDADES[u] : '')
  }
  const c = Math.floor(n / 100), r = n % 100
  return CENTENAS[c] + (r > 0 ? ' ' + centenas(r) : '')
}

function miles(n: number): string {
  if (n === 0) return ''
  if (n < 1000) return centenas(n)
  const m = Math.floor(n / 1000), r = n % 1000
  let txt: string
  if (m === 1) txt = 'mil'
  else txt = centenas(m) + ' mil'
  return txt + (r > 0 ? ' ' + centenas(r) : '')
}

function millones(n: number): string {
  if (n === 0) return 'cero'
  if (n < 1_000_000) return miles(n)
  const m = Math.floor(n / 1_000_000), r = n % 1_000_000
  let txt: string
  if (m === 1) txt = 'un millón'
  else txt = miles(m) + ' millones'
  return txt + (r > 0 ? ' ' + miles(r) : '')
}

/**
 * Convierte un monto en quetzales a su representación en letras.
 * Ejemplo: 262500.50 → "doscientos sesenta y dos mil quinientos quetzales con 50/100"
 */
export function numeroAQuetzalesEnLetras(monto: number): string {
  if (monto < 0) return 'menos ' + numeroAQuetzalesEnLetras(-monto)
  const entero = Math.floor(monto)
  const centavos = Math.round((monto - entero) * 100)
  const letrasEntero = millones(entero)
  // Normaliza "un" a "un" / "uno" según contexto (aquí siempre cardinal apocopado: "un quetzal", "veintiún quetzales")
  const ajustado = letrasEntero
    .replace(/\bun\b$/, 'un')        // singular: "un quetzal"
  const plural = entero === 1 ? 'quetzal' : 'quetzales'
  const centavosStr = centavos === 0
    ? 'con cero centavos'
    : `con ${String(centavos).padStart(2, '0')}/100`
  return `${ajustado} ${plural} ${centavosStr}`
}

export function numeroADolaresEnLetras(monto: number): string {
  if (monto < 0) return 'menos ' + numeroADolaresEnLetras(-monto)
  const redondeado = Math.round(monto * 100)
  const entero = Math.floor(redondeado / 100)
  const centavos = redondeado % 100
  const letrasEntero = millones(entero)
  const plural = entero === 1 ? 'dolar estadounidense' : 'dolares estadounidenses'
  const centavosStr = centavos === 0
    ? 'con cero centavos'
    : `con ${String(centavos).padStart(2, '0')}/100`
  return `${letrasEntero} ${plural} ${centavosStr}`
}
