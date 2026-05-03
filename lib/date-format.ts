function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatFechaDDMMYYYY(value: string | Date | null | undefined): string {
  if (!value) return ''

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    return `${pad2(value.getDate())}/${pad2(value.getMonth() + 1)}/${value.getFullYear()}`
  }

  const raw = String(value).trim()
  if (!raw) return ''

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/)
  if (iso) return `${pad2(Number(iso[3]))}/${pad2(Number(iso[2]))}/${iso[1]}`

  const ymdSlash = raw.match(/^(\d{4})[\/.](\d{1,2})[\/.](\d{1,2})$/)
  if (ymdSlash) return `${pad2(Number(ymdSlash[3]))}/${pad2(Number(ymdSlash[2]))}/${ymdSlash[1]}`

  const dmy = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/)
  if (dmy) return `${pad2(Number(dmy[1]))}/${pad2(Number(dmy[2]))}/${dmy[3]}`

  return raw
}

export function formatFechaArchivoPdf(value: string | Date | null | undefined): string {
  return formatFechaDDMMYYYY(value).replace(/\//g, '-')
}

export function parseFechaFlexible(value: string | Date | null | undefined): Date | null {
  if (!value) return null

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12)
  }

  const raw = String(value).trim()
  if (!raw) return null

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/)
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12)

  const ymdSlash = raw.match(/^(\d{4})[\/.](\d{1,2})[\/.](\d{1,2})$/)
  if (ymdSlash) return new Date(Number(ymdSlash[1]), Number(ymdSlash[2]) - 1, Number(ymdSlash[3]), 12)

  const dmy = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/)
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), 12)

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12)
}
