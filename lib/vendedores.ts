export type VendedorOption = {
  nombre: string
  email: string
  rol?: string
}

const DEFAULT_EMAIL = 'ventas@hidroperforaciones.com'

function repararMojibake(texto: string): string {
  if (!/[\u00c2\u00c3]/.test(texto)) return texto
  try {
    const bytes = new Uint8Array(Array.from(texto, ch => ch.charCodeAt(0) & 0xff))
    const reparado = new TextDecoder('utf-8').decode(bytes)
    return reparado.includes('\uFFFD') ? texto : reparado
  } catch {
    return texto
  }
}

export function normalizarVendedor(vendedor: string): string {
  return repararMojibake(vendedor)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9@._%+-]+/g, ' ')
    .trim()
}

export function resolverEmailVendedor(vendedor: string, emailPreferido?: string | null): string {
  const emailDirecto = `${emailPreferido ?? ''} ${vendedor}`
    .match(/[A-Z0-9._%+-]+@hidroperforaciones\.com/i)?.[0]
  const normalizado = normalizarVendedor(vendedor)
  const compact = normalizado.replace(/\s+/g, '')

  const emailConocido = (() => {
    if (!compact) return ''
    if (compact === 'mr' || compact.includes('mramirez') || normalizado.includes('mario') || normalizado.includes('ramirez')) {
      return 'mramirez@hidroperforaciones.com'
    }
    if (compact === 'gg' || compact.includes('ggarcia') || normalizado.includes('gilda') || normalizado.includes('garcia')) {
      return 'ggarcia@hidroperforaciones.com'
    }
    if (compact === 'rd' || compact.includes('rdominguez') || normalizado.includes('rene') || normalizado.includes('dominguez')) {
      return 'rdominguez@hidroperforaciones.com'
    }
    if (
      compact === 'bf' ||
      normalizado.includes('berner') ||
      normalizado.includes('verner') ||
      normalizado.includes('flores') ||
      normalizado.includes('ventas') ||
      normalizado.includes('bentas') ||
      compact.includes('asesordeventas') ||
      compact.includes('asesordebentas')
    ) {
      return DEFAULT_EMAIL
    }
    return ''
  })()

  if (emailConocido && (!emailDirecto || emailDirecto.toLowerCase() === DEFAULT_EMAIL)) {
    return emailConocido
  }

  if (emailDirecto) return emailDirecto.toLowerCase()

  if (!compact) return DEFAULT_EMAIL
  return emailConocido || DEFAULT_EMAIL
}

export function crearVendedorOption(nombre: string, email?: string | null, rol?: string): VendedorOption {
  return {
    nombre,
    email: resolverEmailVendedor(nombre, email),
    rol,
  }
}
