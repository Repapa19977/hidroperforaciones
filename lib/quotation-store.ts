// Shared store for quotation data
// - localStorage: solo para pasar datos al print page (sesión)
// - API /api/cotizaciones: persistencia real en DB (SQLite)

import type { InputsPerforacion, InputsLimpieza } from './calculator'
import type { PreciosLineas } from './config-store'

export interface QuotationData {
  correlativo: string
  tipo: 'perforacion' | 'limpieza'
  fecha: string
  validezDias: number
  cliente: string
  empresa: string
  nit: string
  telefono: string
  proyecto: string
  direccion: string
  duracion: string
  vendedor: string
  ip?: InputsPerforacion
  il?: InputsLimpieza
  preciosLineas?: PreciosLineas  // precios editados al momento de cotizar
  condiciones: string
  notas: string
}

export interface CotizacionRecord {
  id?: string
  correlativo: string
  cliente: string
  empresa: string
  proyecto: string
  tipo: 'perforacion' | 'limpieza'
  estado: 'borrador' | 'enviada' | 'confirmada' | 'cancelada'
  monto: number
  fecha: string
  vendedor: string
  datos?: string   // QuotationData serializado (disponible desde la API)
}

// ── Print draft (localStorage — sesión) ──────────────────────────────────────
const DRAFT_KEY = 'hidrocrm_quotation_draft'

export function saveQuotation(data: QuotationData) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data))
  }
}

export function loadQuotation(): QuotationData | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(DRAFT_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

// ── Persistencia en DB (API) ──────────────────────────────────────────────────
export async function addCotizacion(
  data: QuotationData,
  monto: number,
  estado: CotizacionRecord['estado'] = 'borrador'
) {
  await fetch('/api/cotizaciones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      correlativo: data.correlativo,
      cliente:     data.cliente,
      empresa:     data.empresa,
      proyecto:    data.proyecto,
      tipo:        data.tipo,
      estado,
      monto,
      fecha:       data.fecha,
      vendedor:    data.vendedor,
      datos:       data,   // full payload stored as JSON for re-open/print
    }),
  })
}

export async function loadCotizaciones(vendedor?: string): Promise<CotizacionRecord[]> {
  const url = vendedor
    ? `/api/cotizaciones?vendedor=${encodeURIComponent(vendedor)}`
    : '/api/cotizaciones'
  const res = await fetch(url)
  if (!res.ok) return []
  return res.json()
}

export async function updateEstadoCotizacion(
  correlativo: string,
  estado: CotizacionRecord['estado'],
  usuario?: string
) {
  await fetch(`/api/cotizaciones/${encodeURIComponent(correlativo)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado, usuario: usuario ?? '' }),
  })
}

export async function deleteCotizacion(correlativo: string) {
  await fetch(`/api/cotizaciones/${encodeURIComponent(correlativo)}`, {
    method: 'DELETE',
  })
}

// ── Correlativo ───────────────────────────────────────────────────────────────
export function getNextCorrelativo(): string {
  if (typeof window === 'undefined') return 'HP-COT-0061'
  const stored = localStorage.getItem('hidrocrm_last_cot_num')
  const last = stored ? parseInt(stored) : 60
  const next = last + 1
  localStorage.setItem('hidrocrm_last_cot_num', String(next))
  return `HP-COT-${String(next).padStart(4, '0')}`
}

// ── Vendedores ────────────────────────────────────────────────────────────────
export const VENDEDORES = [
  'René Domínguez',
  'Gilda García',
  'Mario Ramírez',
  'Carlos Solís',
]

// ── Condiciones default ───────────────────────────────────────────────────────
export const defaultCondiciones = `1. Los precios indicados están en Quetzales (GTQ) e incluyen IVA del 12%.
2. Validez de la cotización: 15 días calendario a partir de la fecha de emisión.
3. Forma de pago: 50% anticipo para iniciar trabajos, 50% contra entrega del informe final.
4. El cliente deberá proporcionar acceso libre al sitio de perforación y energía eléctrica disponible.
5. En caso de encontrarse roca o material duro no previsto, se acordará un ajuste de precio.
6. El tiempo de ejecución puede variar según condiciones geológicas del terreno.
7. El presente presupuesto no incluye permisos municipales ni licencias de perforación.`
