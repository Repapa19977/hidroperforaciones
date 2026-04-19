# Webhooks HidroCRM → Bot — Contrato v1

> **Audiencia:** dev del VPS
> **Propósito:** que el CRM notifique al bot cuando pasan eventos de negocio → el bot empuja WhatsApp proactivo al cliente/asesor.

## 1. Endpoint entrante (del lado bot)

```
POST https://hidroperforaciones.com/webhook/hidrocrm
Content-Type: application/json
X-Hidra-Signature: sha256=<hex>
X-Hidra-Timestamp: <unix-seconds>
X-Hidra-Event: <event-type>
```

El bot valida:
1. `X-Hidra-Timestamp` dentro de ±5 min (anti-replay)
2. `X-Hidra-Signature` = `HMAC-SHA256(secret, timestamp + '.' + body)` en hex
3. Si ambos OK → procesa; si no → 401

## 2. Secret

El bot genera el secret al desplegar y te lo entrega en `HANDOFF.txt`.

Env var en el VPS: `HIDRA_WEBHOOK_SECRET=<64 hex chars>`

```ts
// ejemplo del lado VPS (Next.js)
import { createHmac } from 'node:crypto';

function signWebhook(body: string, secret: string) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
  return { ts, sig };
}

await fetch('https://hidroperforaciones.com/webhook/hidrocrm', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Hidra-Signature': `sha256=${sig}`,
    'X-Hidra-Timestamp': ts,
    'X-Hidra-Event': 'cotizacion.firmada',
  },
  body,
});
```

## 3. Formato de eventos

Todos los eventos comparten envelope:

```ts
{
  "id": "evt_<uuid>",
  "type": "<namespace>.<action>",
  "created_at": "2026-04-19T10:30:00Z",
  "version": "v1",
  "data": { /* específico por tipo */ }
}
```

## 4. Eventos soportados

### `cotizacion.enviada`
```ts
data: { cotizacion_id, oportunidad_id, cliente_id, cliente_nombre, cliente_telefono,
  monto, asesor, pdf_url }
bot_action: Manda al cliente el link del PDF por WhatsApp con template `cotizacion_enviada`.
```

### `cotizacion.firmada`
```ts
data: { cotizacion_id, proyecto_id, cliente_id, cliente_telefono, monto,
  firmada_por: 'cliente'|'asesor' }
bot_action: Mensaje de confirmación + próximos pasos + cronograma.
```

### `cotizacion.rechazada`
```ts
data: { cotizacion_id, motivo, asesor_phone }
bot_action: Notifica al asesor + registra para analytics.
```

### `pago.registrado`
```ts
data: { pago_id, proyecto_id, cliente_id, cliente_telefono, monto, metodo, fecha,
  concepto, recibo_url }
bot_action: Confirmación al cliente + recibo + próximo hito.
```

### `pago.vencido`
```ts
data: { hito_id, proyecto_id, cliente_id, cliente_telefono, monto, dias_vencido, asesor_phone }
bot_action: Recordatorio via Hidra-Tesorero (tono según días de atraso).
```

### `proyecto.iniciado`
```ts
data: { proyecto_id, cliente_id, cliente_telefono, fecha_inicio, equipo, foreman }
bot_action: Mensaje al cliente: "Ya empezamos tu pozo" + timeline inicial.
```

### `proyecto.hito`
```ts
data: { proyecto_id, cliente_id, cliente_telefono, hito: 'perforacion_iniciada'|'50%'|'aforo_listo'|'entrega',
  metros_actuales?, foto_url? }
bot_action: Update proactivo al cliente con imagen de timeline.
```

### `proyecto.incidente`
```ts
data: { proyecto_id, cliente_id, tipo, descripcion, urgente, impacto_dias_estimado,
  asesor_phone, super_admin_phones }
bot_action: Si urgente → alerta a super admins + asesor. Si no urgente → asesor revisa primero.
```

### `cliente.sin_seguimiento`
```ts
data: { cliente_id, cliente_nombre, cliente_telefono, dias_sin_contacto, ultimo_estado_cotizacion }
bot_action: Hidra-Cliente re-engagement automático (tono según etapa).
```

### `lead.nuevo`
```ts
data: { oportunidad_id, cliente_nombre, cliente_telefono, fuente: string,
  asesor_asignado?: string }
bot_action: Si asesor asignado → notifica. Si no → a super admin.
```

### `asesor.alerta`
```ts
data: { asesor_phone, tipo: 'conversion_baja'|'descuento_alto'|'sla_vencido',
  detalle: string }
bot_action: Super admins reciben alerta via Hidra-Analista.
```

## 5. Idempotencia

- El bot usa el `id` del evento como idempotency key (almacenado en Redis 24h)
- Si llega el mismo `id` 2x, el bot responde 200 OK sin procesar de nuevo

## 6. Retries

El VPS debería reintentar si el bot responde:
- **5xx:** retry con backoff exponencial (1s, 4s, 16s, 64s, 256s) → max 5 intentos
- **4xx:** NO retry (es bug del VPS)
- **timeout (>10s):** retry igual que 5xx

Si después de 5 intentos falla → enviar a dead-letter queue local en el VPS + alertar al admin.

## 7. Response esperada

El bot responde siempre:

```json
{ "received": true, "event_id": "evt_abc...", "processed_at": "2026-04-19T10:30:01Z" }
```

- **200**: procesado OK
- **409**: duplicado (idempotency hit) — también es OK, no retry
- **401**: firma inválida → revisar secret
- **429**: bot sobrecargado → retry con backoff
- **500**: error interno → retry

## 8. Orden de eventos

Dentro de un proyecto, el orden típico es:

```
lead.nuevo → cotizacion.enviada → cotizacion.firmada → proyecto.iniciado
  → proyecto.hito (perforacion_iniciada)
  → pago.registrado (anticipo)
  → proyecto.hito (50%)
  → proyecto.hito (aforo_listo)
  → pago.registrado (hito medio)
  → proyecto.hito (entrega)
  → pago.registrado (final)
```

El bot NO asume orden, pero loguea si llega fuera de secuencia para debugging.

## 9. Test webhook

Para verificar integración:

```bash
# Desde el VPS
curl -X POST https://hidroperforaciones.com/webhook/hidrocrm \
  -H 'X-Hidra-Event: test.ping' \
  -H 'X-Hidra-Signature: sha256=<hmac>' \
  -H 'X-Hidra-Timestamp: <unix>' \
  -H 'Content-Type: application/json' \
  -d '{"id":"evt_test","type":"test.ping","created_at":"...","version":"v1","data":{}}'
```

Respuesta esperada: `200 { received: true, event_id: "evt_test" }`.
