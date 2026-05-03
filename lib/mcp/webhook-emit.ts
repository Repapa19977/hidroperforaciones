// Emisor de webhooks HidroCRM → bot Hidra.
// Firma HMAC-SHA256 según spec del bot: timestamp + "." + body.
// Fire-and-forget: no bloquea la request que disparó el evento.
// Si el endpoint falla, se loguea en audit log pero no reintenta automáticamente
// (Sprint 4: outbox pattern con retry persistente).

import { createHmac, randomUUID } from 'crypto'
import { auditLog } from '@/lib/audit'

// ── Tipos de eventos que emitimos ────────────────────────────────────────────
export type WebhookEventType =
  | 'cotizacion.enviada'
  | 'cotizacion.firmada'
  | 'cotizacion.cancelada'
  | 'pago.registrado'
  | 'pago.vencido'
  | 'proyecto.iniciado'
  | 'proyecto.incidente'
  | 'proyecto.estado_cambiado'
  | 'bitacora.sin_actualizar'
  | 'cliente.sin_seguimiento'
  | 'contacto.actualizado'
  | 'test.ping'

interface WebhookPayload {
  id: string
  type: WebhookEventType
  created_at: string
  version: string
  data: Record<string, unknown>
}

/**
 * Emite un webhook firmado HMAC al bot. No bloquea — usa fire-and-forget con
 * timeout de 10s. Guarda resultado en audit log.
 *
 * @param type  El tipo del evento (ver WebhookEventType)
 * @param data  El payload específico del evento
 */
export async function emitWebhook(
  type: WebhookEventType,
  data: Record<string, unknown>,
): Promise<{ sent: boolean; status: number | null; error?: string }> {
  const url = process.env.HIDRA_WEBHOOK_URL
  const secret = process.env.HIDRA_WEBHOOK_SECRET
  if (!url || !secret) {
    return { sent: false, status: null, error: 'webhook no configurado (falta HIDRA_WEBHOOK_URL o HIDRA_WEBHOOK_SECRET)' }
  }

  const payload: WebhookPayload = {
    id: `evt_${randomUUID()}`,
    type,
    created_at: new Date().toISOString(),
    version: '1.0',
    data,
  }
  const body = JSON.stringify(payload)
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10_000)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hidra-Signature': `sha256=${signature}`,
        'X-Hidra-Timestamp': String(timestamp),
        'X-Hidra-Event': type,
      },
      body,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    // Audit log del webhook emitido
    auditLog({
      user: { username: 'hidrocrm-webhook', role: 'superadmin', scopes: [], tokenNombre: 'webhook-emit' },
      accion: 'webhook_emit',
      entidad: type,
      entidadId: payload.id,
      despues: { url, status: res.status, timestamp },
      ip: '',
      userAgent: 'hidrocrm-webhook/1.0',
    }).catch(() => { /* ignore */ })
    return { sent: res.ok, status: res.status, error: res.ok ? undefined : `HTTP ${res.status}` }
  } catch (err: unknown) {
    clearTimeout(timeoutId)
    const msg = err instanceof Error ? err.message : String(err)
    auditLog({
      user: { username: 'hidrocrm-webhook', role: 'superadmin', scopes: [], tokenNombre: 'webhook-emit' },
      accion: 'webhook_error',
      entidad: type,
      entidadId: payload.id,
      despues: { url, error: msg, timestamp },
      ip: '',
      userAgent: 'hidrocrm-webhook/1.0',
    }).catch(() => { /* ignore */ })
    return { sent: false, status: null, error: msg }
  }
}
