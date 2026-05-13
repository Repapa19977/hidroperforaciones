export type CurrencyCode = 'GTQ' | 'USD'

export const DEFAULT_TIPO_CAMBIO_USD = 7.8

export function normalizeCurrency(value: unknown): CurrencyCode {
  return value === 'USD' ? 'USD' : 'GTQ'
}

export function normalizeExchangeRate(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIPO_CAMBIO_USD
}

export function convertFromGTQ(montoQ: number, currency: CurrencyCode, tipoCambioUsd: number): number {
  if (currency === 'USD') return montoQ / normalizeExchangeRate(tipoCambioUsd)
  return montoQ
}

export function formatCurrency(montoQ: number, currency: CurrencyCode = 'GTQ', tipoCambioUsd = DEFAULT_TIPO_CAMBIO_USD): string {
  const amount = convertFromGTQ(montoQ, currency, tipoCambioUsd)
  if (currency === 'USD') {
    return `$ ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return `Q ${Math.round(amount).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
