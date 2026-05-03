export type ContactoDuplicateInput = {
  nombre?: string | null
  empresa?: string | null
  telefono?: string | null
  email?: string | null
}

export type ContactoDuplicateCandidate = {
  id: string
  nombre: string
  empresa: string
  telefono?: string | null
  email?: string | null
  vendedor: string
  createdAt: Date | string
}

export function normContactoText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function contactoDuplicateLockKey(input: ContactoDuplicateInput): string {
  return `contacto:${normContactoText(input.nombre)}`
}

export function findContactoDuplicate<T extends ContactoDuplicateCandidate>(
  input: ContactoDuplicateInput,
  candidates: T[],
): T | null {
  const nombreN = normContactoText(input.nombre)
  if (!nombreN) return null

  return candidates.find(candidate => normContactoText(candidate.nombre) === nombreN) ?? null
}

export function findContactosSimilares<T extends ContactoDuplicateCandidate>(
  input: ContactoDuplicateInput,
  candidates: T[],
): T[] {
  const nombreN = normContactoText(input.nombre)
  const empresaN = normContactoText(input.empresa)
  if (!nombreN) return []

  const similares: T[] = []
  for (const candidate of candidates) {
    const candidateNombreN = normContactoText(candidate.nombre)
    const candidateEmpresaN = normContactoText(candidate.empresa)
    if (candidateNombreN === nombreN) continue

    const nombreParecido =
      nombreN.length >= 3 &&
      (candidateNombreN.includes(nombreN) || nombreN.includes(candidateNombreN))
    const mismaEmpresa = Boolean(empresaN && candidateEmpresaN === empresaN)

    if (nombreParecido || mismaEmpresa) similares.push(candidate)
  }

  return similares.slice(0, 5)
}

export function contactoDuplicateMessage(duplicate: ContactoDuplicateCandidate): string {
  const empresa = duplicate.empresa ? ` de ${duplicate.empresa}` : ''
  const fecha = formatFechaContacto(duplicate.createdAt)
  const creado = fecha ? ` Creado el ${fecha} por ${duplicate.vendedor}.` : ` Creado por ${duplicate.vendedor}.`
  return `Ya existe un contacto con ese nombre: "${duplicate.nombre}"${empresa}.${creado} Edita ese contacto en vez de crear otro.`
}

function formatFechaContacto(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })
}
