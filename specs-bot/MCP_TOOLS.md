# HidroCRM MCP Tools — Contrato v1

> **Audiencia:** dev del VPS (Next.js 16 + Zod + jose)
> **Objetivo:** implementar un MCP server en `https://hidrocrm.com/api/mcp` que expone estas tools para los 6 agents Hidra del bot.
> **Transport:** MCP-over-HTTP (streamable HTTP, JSON-RPC 2.0). Una sola ruta Next.js (`app/api/mcp/route.ts`) atiende `POST` con `method: "tools/call"` + `method: "tools/list"`.

## 1. Setup recomendado en Next.js

```bash
pnpm add @modelcontextprotocol/sdk zod jose
```

```ts
// app/api/mcp/route.ts (ejemplo esqueleto)
import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { z } from 'zod';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return Response.json({ error: 'missing token' }, { status: 401 });

  const { payload } = await jwtVerify(auth.slice(7), JWT_SECRET);
  const scopes = (payload.scopes as string[]) || [];

  const body = await req.json();
  const { method, params, id } = body;

  if (method === 'tools/list') {
    return Response.json({ jsonrpc: '2.0', id, result: { tools: TOOL_CATALOG } });
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    const tool = TOOLS[name];
    if (!tool) return Response.json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'tool not found' } });
    if (!scopes.some(s => tool.scopes.includes(s))) {
      return Response.json({ jsonrpc: '2.0', id, error: { code: 403, message: 'scope insufficient' } });
    }
    const parsed = tool.schema.parse(args);
    const result = await tool.handler(parsed, payload);
    return Response.json({ jsonrpc: '2.0', id, result });
  }

  return Response.json({ error: 'unknown method' }, { status: 400 });
}
```

## 2. Scopes disponibles (JWT claim `scopes: string[]`)

| Scope | Descripción |
|---|---|
| `bot:read` | Lectura de oportunidades, clientes, proyectos, bitácora |
| `bot:calc` | Cálculos de cotización/descuento (sin persistir) |
| `bot:write` | Registrar mensajes, enviar templates WhatsApp |
| `bot:analytics` | Métricas agregadas (super admin) |
| `bot:finance` | Cobranza, pagos, recibos |
| `bot:field` | Avances, fotos, incidentes (equipo técnico) |
| `bot:geology` | Data histórica de zonas, estimadores |
| `cliente:read` | Lectura solo del expediente propio del cliente |
| `cliente:solicitud` | Registrar pedido del cliente para el asesor |

**Token Copiloto** = todos los `bot:*` scopes
**Token Cliente** = `cliente:read cliente:solicitud`

## 3. Catálogo de tools

### 3.1 Lectura general — `bot:read`

#### `buscar_oportunidad`
```ts
args: { id: string (uuid) }
returns: {
  id: string, etapa: 'nuevo'|'contactado'|'cotizado'|'ganada'|'perdida',
  monto: number, cliente: string, asesor: string, creada: string (ISO),
  siguiente_accion?: string, probabilidad?: number
}
```

#### `expediente_cliente`
```ts
args: { contacto_id: string }
returns: {
  id: string, nombre: string, telefono: string,
  proyectos: Array<{ id, tipo, estado, inicio, profundidad_m }>,
  oportunidades: Array<{ id, etapa, monto }>,
  cotizaciones: Array<{ id, monto, estado, fecha }>
}
```

#### `historial_cliente`
```ts
args: { nombre: string }
returns: Array<{ id, nombre, telefono, proyectos_count, ultima_interaccion }>
```

#### `buscar_cotizacion`
```ts
args: { id: string }
returns: { id, oportunidad_id, items: Array<{descripcion, cantidad, precio_unit, total}>,
  total, margen_calculado, estado, firmada_en? }
requires: scope `bot:read` + token must be super_admin (costos internos visibles)
```

#### `estado_proyecto`
```ts
args: { proyecto_id: string }
returns: { id, fase, avance_pct, siguiente_hito: {nombre, eta}, dias_en_fase, alerta? }
```

#### `bitacora_reciente`
```ts
args: { proyecto_id: string, limit?: number }
returns: Array<{ fecha, autor, entrada, visible_al_cliente: boolean, fotos: string[] }>
```

#### `pagos_pendientes`
```ts
args: { proyecto_id: string }
returns: Array<{ id, concepto, monto, vence, estado: 'pendiente'|'vencido' }>
```

### 3.2 Cálculos — `bot:calc`

#### `preview_cotizacion`
```ts
args: {
  tipo: 'pozo_nuevo'|'limpieza_mecanica'|'mantenimiento',
  municipio: string,
  uso: 'consumo'|'riego'|'industrial'|'ganaderia',
  profundidad_estimada_m?: number,
  hectareas?: number,
  cabezas?: number,
  consumidores?: number
}
returns: {
  precio_estimado: number, rango: [number, number],
  margen_estimado: number, profundidad_estimada_m: string,
  caudal_requerido_gpm: number, requiere_prospeccion: boolean,
  advertencias: string[]
}
```

#### `simular_descuento`
```ts
args: { cotizacion_id: string, pct: number }
returns: {
  descuento_pct: number, precio_final: number,
  margen_final_pct: number, saludable: boolean,
  alerta: string | null
}
```

### 3.3 Escritura — `bot:write`

#### `registrar_mensaje`
```ts
args: { oportunidad_id: string, mensaje: string, autor?: 'hidra-copiloto'|'asesor' }
returns: { registrado: boolean, id: string }
```

#### `registrar_solicitud_cliente` (también vía `cliente:solicitud`)
```ts
args: { cliente_id: string, tipo: 'descuento'|'modificacion'|'reclamo'|'emergencia'|'duda',
  mensaje: string, prioritario?: boolean }
returns: { registrado: boolean, id: string, notificado_a: string[] }
```

#### `enviar_mensaje_cliente`
```ts
args: { template_id: string, params: Record<string, string>, destinatario: string }
returns: { enviado: boolean, wamid?: string, error?: string }
note: El VPS resuelve el template_id contra Meta. El bot solo pide el envío.
```

### 3.4 Analytics — `bot:analytics` (super admin)

#### `metricas_periodo`
```ts
args: { desde: string (ISO), hasta: string (ISO) }
returns: { leads: number, cotizaciones_enviadas: number, cerradas: number,
  ingresos_proyectados: number, ingresos_realizados: number,
  margen_realizado_pct: number }
```

#### `ranking_asesores`
```ts
args: { periodo: 'mes'|'trimestre'|'año'|string (ISO range) }
returns: Array<{ asesor_id, nombre, cerradas, ingresos, margen_promedio }>
```

#### `asesor_detalle`
```ts
args: { asesor_id: string, periodo: string }
returns: { asesor, cotizaciones_enviadas, cerradas, tiempo_cierre_promedio_dias,
  descuento_promedio_pct, comparativa_equipo: {...} }
```

#### `embudo_conversion`
```ts
args: { periodo: string }
returns: { nuevo: number, contactado: number, cotizado: number, ganada: number,
  tasas: { nuevo_contactado: number, contactado_cotizado: number, cotizado_ganada: number } }
```

#### `cotizaciones_bajas_margen`
```ts
args: { umbral: number (pct, ej 0.15) }
returns: Array<{ id, cliente, asesor, monto, margen_pct }>
```

#### `clientes_sin_seguimiento`
```ts
args: { dias: number }
returns: Array<{ cliente_id, nombre, ultima_interaccion, dias_sin_contacto, asesor }>
```

#### `proyectos_atrasados`
```ts
args: {}
returns: Array<{ proyecto_id, cliente, fase_actual, dias_atraso, causa? }>
```

### 3.5 Finance — `bot:finance`

#### `saldos_cliente`
```ts
args: { contacto_id: string }
returns: { total_pagado: number, total_pendiente: number, proximo_vencimiento?: string,
  hitos: Array<{ id, concepto, monto, vence, estado }> }
```

#### `cronograma_pagos`
```ts
args: { proyecto_id: string }
returns: Array<{ id, concepto, monto, vence, estado }>
```

#### `hitos_vencidos`
```ts
args: { dias?: number }  // default: 0 (todos los vencidos)
returns: Array<{ hito_id, proyecto_id, cliente, monto, dias_vencido }>
```

#### `hitos_por_vencer`
```ts
args: { dias: number }  // los que vencen en <= N días
returns: Array<{ hito_id, proyecto_id, cliente, monto, vence }>
```

#### `confirmar_pago`
```ts
args: { pago_id: string, metodo: 'transferencia'|'deposito'|'cheque'|'efectivo',
  fecha: string (ISO), comprobante_url?: string }
returns: { confirmado: boolean, recibo_url?: string }
```

#### `enviar_recibo`
```ts
args: { pago_id: string, email: string }
returns: { enviado: boolean }
```

### 3.6 Field — `bot:field`

#### `mi_proyecto_actual`
```ts
args: { worker_id: string }
returns: { proyecto_id, cliente, fase, siguiente_hito, sitio: {lat, lng} }
```

#### `registrar_avance`
```ts
args: { proyecto_id: string, metros: number, notas?: string, foto_url?: string }
returns: { registrado: boolean, total_metros_dia: number }
```

#### `registrar_foto`
```ts
args: { proyecto_id: string, foto_url: string, descripcion: string }
returns: { registrado: boolean, entrada_bitacora_id: string }
```

#### `reportar_incidente`
```ts
args: { proyecto_id: string, tipo: 'broca_trabada'|'falla_equipo'|'accidente'|'otro',
  descripcion: string, urgente?: boolean }
returns: { incidente_id: string, notificado_a: string[] }
```

#### `cerrar_turno`
```ts
args: { proyecto_id: string, metros_totales: number, notas: string }
returns: { cerrado: boolean, resumen_dia: {...} }
```

### 3.7 Geology — `bot:geology`

#### `proyectos_en_zona`
```ts
args: { municipio: string, km_radio?: number }
returns: Array<{ municipio, profundidad_real_m, caudal_gpm, tipo_roca, fecha }>
```

#### `geologia_zona`
```ts
args: { municipio: string }
returns: { tipo_roca_dominante: string, rango_profundidad_tipico: [number, number],
  caudal_tipico_gpm: [number, number], riesgos: string[], histórico_pozos: number }
```

### 3.8 Cliente scope — `cliente:read` + `cliente:solicitud`

Idénticos a `mi_proyecto`, `mi_bitacora`, `mis_pagos`, `mi_cotizacion`, `mi_cronograma`, pero:
- El token incluye `cliente_id` en el claim
- El handler **ignora** el `cliente_id` de los args y usa el del claim → impide cross-tenant

## 4. Error handling

Todos los errors devuelven JSON-RPC 2.0 error object:

```json
{ "jsonrpc": "2.0", "id": "...", "error": { "code": <int>, "message": "..." } }
```

| Code | Significado |
|---|---|
| -32601 | Tool no encontrado |
| -32602 | Argumentos inválidos (Zod parse error) |
| 401 | Token missing o inválido |
| 403 | Scope insuficiente |
| 404 | Recurso no encontrado (oportunidad/cliente no existe) |
| 429 | Rate limit excedido |
| 500 | Error interno del servidor |

## 5. Rate limiting

In-memory OK para un solo proceso Node (setup actual del VPS).
- 100 calls/min por token → 429 `retry-after: 60`
- Excepciones: tools de escritura (20/min), analytics (30/min)

⚠️ Si el VPS migra a serverless (Vercel), usar Upstash Redis — in-memory se pierde por frío.

## 6. Versionado

- Campo `X-Hidra-Api-Version: v1` en response headers
- Deprecaciones se comunican en `X-Hidra-Deprecation` con fecha
- Breaking changes requieren nuevo path: `/api/mcp/v2`

## 7. Observabilidad (recomendado)

- Log por call: tool, scope, latency, status, cliente_id (si aplica)
- Métricas Prometheus: `hidrocrm_tool_calls_total`, `hidrocrm_tool_duration_seconds`
- Alert: `bot:finance` + write calls spike > 50/hora → posible fraude

## 8. Testing

El bot tiene mocks internos (`hidrocrmService.ts`, función `mockResponse`). Cuando `HIDROCRM_ENABLED=false`, las calls devuelven data mock y el MCP server del VPS ni se toca. Útil para desarrollo offline.

Para integration tests, el VPS debe exponer `/api/mcp/healthz` → `{ status: 'ok', version: 'v1' }`.
