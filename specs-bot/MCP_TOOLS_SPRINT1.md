# MCP Tools — Sprint 1 (copy-paste ready)

> **Alcance:** los 6 tools mínimos para activar `hidra-copiloto` y dejar la integración bot↔CRM operativa end-to-end.
> **Stack:** Next.js 16 Route Handlers + Zod + jose.
> **Estimación:** 1-2 días de trabajo si el CRM ya tiene los datos (oportunidades, cotizaciones, contactos).

Cuando implementes estas 6, el bot puede empezar a responder con data real a los asesores. Los 24 tools restantes se agregan después en sprints 2-7 (ver `MCP_TOOLS.md` completo).

---

## 0. Setup mínimo del endpoint

```ts
// app/api/mcp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { z } from 'zod';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

// Rate limit in-memory simple (para multi-instancia usar Upstash Redis)
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(tokenSub: string, limit: number): boolean {
  const now = Date.now();
  const entry = rateLimits.get(tokenSub);
  if (!entry || entry.resetAt < now) {
    rateLimits.set(tokenSub, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

function jsonRpcError(id: any, code: number, message: string, data?: any) {
  return NextResponse.json({
    jsonrpc: '2.0',
    id,
    error: { code, message, ...(data && { data }) },
  });
}

function jsonRpcOk(id: any, result: any) {
  return NextResponse.json({ jsonrpc: '2.0', id, result });
}

export async function POST(req: NextRequest) {
  // 1. Parse JSON-RPC envelope
  const body = await req.json();
  const { method, params, id } = body;

  // 2. Auth
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) {
    return jsonRpcError(id, 401, 'missing bearer token');
  }

  let payload: any;
  try {
    ({ payload } = await jwtVerify(auth.slice(7), JWT_SECRET, {
      audience: 'hidrocrm-mcp',
      issuer: 'hidrocrm',
    }));
  } catch (err: any) {
    return jsonRpcError(id, 401, `invalid token: ${err.message}`);
  }

  // 3. JTI revocation check (Redis o in-memory)
  if (await isRevoked(payload.jti)) {
    return jsonRpcError(id, 401, 'token revoked');
  }

  // 4. Rate limiting por sub
  const limit = payload.sub === 'hidra-copiloto' ? 60 : 30;
  if (!checkRateLimit(payload.sub, limit)) {
    return jsonRpcError(id, 429, 'rate limited', { retry_after: 60 });
  }

  // 5. Route method
  const ctx = {
    scopes: payload.scopes as string[],
    sub: payload.sub as string,
    clientPhone: req.headers.get('x-hidra-client-phone'),
    idempotencyKey: req.headers.get('idempotency-key'),
  };

  if (method === 'tools/list') {
    return jsonRpcOk(id, { tools: listTools(ctx.scopes) });
  }

  if (method === 'tools/call') {
    return callTool(id, params, ctx);
  }

  return jsonRpcError(id, -32601, 'method not found');
}

async function isRevoked(jti: string): Promise<boolean> {
  // TODO: implementar con Redis.sismember('revoked_jtis', jti)
  return false;
}
```

---

## 1. Catálogo de tools (Sprint 1)

```ts
// lib/mcp/tools.ts
import { z } from 'zod';

type ToolDef = {
  name: string;
  description: string;
  scopes: string[];
  inputSchema: z.ZodType;
  handler: (args: any, ctx: Ctx) => Promise<any>;
};

type Ctx = {
  scopes: string[];
  sub: string;
  clientPhone: string | null;
  idempotencyKey: string | null;
};

export const TOOLS: Record<string, ToolDef> = {
  buscar_oportunidad: {
    name: 'buscar_oportunidad',
    description: 'Obtiene detalle de una oportunidad por ID',
    scopes: ['bot:read'],
    inputSchema: z.object({
      id: z.string().uuid(),
    }),
    handler: async ({ id }, ctx) => {
      const row = await db.oportunidades.findUnique({
        where: { id },
        include: { cliente: true, asesor: true, cotizacion: true },
      });
      if (!row) throw rpcError(404, 'oportunidad not found');
      return {
        id: row.id,
        etapa: row.etapa,
        monto: row.monto,
        cliente: row.cliente.nombre,
        cliente_id: row.cliente.id,
        asesor: row.asesor?.nombre ?? null,
        asesor_phone: row.asesor?.telefono ?? null,
        creada: row.createdAt.toISOString(),
        siguiente_accion: row.siguienteAccion ?? null,
        probabilidad: row.probabilidadCierre ?? null,
      };
    },
  },

  expediente_cliente: {
    name: 'expediente_cliente',
    description: 'Expediente completo del cliente (contacto + proyectos + oportunidades + cotizaciones)',
    scopes: ['bot:read', 'cliente:read'],
    inputSchema: z.object({
      contacto_id: z.string().uuid().optional(),
    }),
    handler: async ({ contacto_id }, ctx) => {
      // Si scope cliente → IGNORAR contacto_id, usar phone del header
      let contact;
      if (ctx.scopes.includes('cliente:read') && !ctx.scopes.includes('bot:read')) {
        if (!ctx.clientPhone) throw rpcError(400, 'X-Hidra-Client-Phone missing');
        contact = await db.contactos.findByPhone(ctx.clientPhone);
        if (!contact) {
          // Cliente nuevo → crear lead pendiente
          const lead = await db.leads.create({
            data: { telefono: ctx.clientPhone, origen: 'whatsapp_bot', estado: 'pendiente_verificacion' },
          });
          return {
            id: null,
            nuevo: true,
            lead_id: lead.id,
            telefono: ctx.clientPhone,
            requiere_verificacion: true,
          };
        }
      } else {
        // Scope copiloto (admin): usar contacto_id de args
        if (!contacto_id) throw rpcError(400, 'contacto_id required');
        contact = await db.contactos.findUnique({
          where: { id: contacto_id },
          include: { proyectos: true, oportunidades: true, cotizaciones: true },
        });
        if (!contact) throw rpcError(404, 'contact not found');
      }

      return {
        id: contact.id,
        nuevo: false,
        nombre: contact.nombre,
        telefono: contact.telefono,
        proyectos: (contact.proyectos ?? []).map((p: any) => ({
          id: p.id, tipo: p.tipo, estado: p.estado,
          inicio: p.inicio?.toISOString(), profundidad_m: p.profundidadMetros,
        })),
        oportunidades: (contact.oportunidades ?? []).map((o: any) => ({
          id: o.id, etapa: o.etapa, monto: o.monto,
        })),
        cotizaciones: (contact.cotizaciones ?? []).map((c: any) => ({
          id: c.id, monto: c.monto, estado: c.estado, fecha: c.createdAt.toISOString(),
        })),
      };
    },
  },

  historial_cliente: {
    name: 'historial_cliente',
    description: 'Busca cliente por nombre y retorna lista con histórico resumido',
    scopes: ['bot:read'],
    inputSchema: z.object({
      nombre: z.string().min(2).max(100),
    }),
    handler: async ({ nombre }, ctx) => {
      const results = await db.contactos.findMany({
        where: { nombre: { contains: nombre, mode: 'insensitive' } },
        include: {
          _count: { select: { proyectos: true } },
          oportunidades: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        take: 10,
      });
      return results.map((c: any) => ({
        id: c.id,
        nombre: c.nombre,
        telefono: c.telefono,
        proyectos_count: c._count.proyectos,
        ultima_interaccion: c.oportunidades[0]?.createdAt.toISOString() ?? null,
      }));
    },
  },

  preview_cotizacion: {
    name: 'preview_cotizacion',
    description: 'Calcula precio estimado de cotización sin persistir. Para que el asesor vea rango antes de enviar.',
    scopes: ['bot:calc'],
    inputSchema: z.object({
      tipo: z.enum(['pozo_nuevo', 'limpieza_mecanica', 'mantenimiento']),
      municipio: z.string().min(2),
      uso: z.enum(['consumo', 'riego', 'industrial', 'ganaderia']),
      profundidad_estimada_m: z.number().int().positive().optional(),
      hectareas: z.number().positive().optional(),
      cabezas: z.number().int().positive().optional(),
      consumidores: z.number().int().positive().optional(),
    }),
    handler: async (args, ctx) => {
      // Lógica de pricing: mezcla de tabla de precios por municipio + formulas por uso
      const pricing = await calcularPrecioEstimado(args);
      return {
        precio_estimado: pricing.monto,
        rango: [pricing.monto * 0.9, pricing.monto * 1.1],
        margen_estimado: pricing.margenPct,
        profundidad_estimada_m: pricing.rangoMetros,
        caudal_requerido_gpm: pricing.caudalGpm,
        requiere_prospeccion: pricing.monto > 200_000 || (args.profundidad_estimada_m ?? 0) > 150,
        advertencias: pricing.warnings,
      };
    },
  },

  simular_descuento: {
    name: 'simular_descuento',
    description: 'Calcula impacto de un descuento en el margen de una cotización existente',
    scopes: ['bot:calc'],
    inputSchema: z.object({
      cotizacion_id: z.string().uuid(),
      pct: z.number().min(0).max(50),
    }),
    handler: async ({ cotizacion_id, pct }, ctx) => {
      const cot = await db.cotizaciones.findUnique({ where: { id: cotizacion_id } });
      if (!cot) throw rpcError(404, 'cotizacion not found');

      const precioFinal = cot.monto * (1 - pct / 100);
      const margenActual = cot.margenCalculado; // 0.22 = 22%
      const reduccionMargen = pct / 100;
      const margenFinal = Math.max(0, margenActual - reduccionMargen);

      return {
        descuento_pct: pct,
        precio_original: cot.monto,
        precio_final: Math.round(precioFinal),
        margen_original_pct: margenActual,
        margen_final_pct: margenFinal,
        saludable: margenFinal >= 0.18,
        alerta: margenFinal < 0.18
          ? `Margen por debajo del objetivo (18%). Margen actual: ${(margenFinal * 100).toFixed(1)}%`
          : null,
      };
    },
  },

  registrar_mensaje: {
    name: 'registrar_mensaje',
    description: 'Guarda una nota/mensaje en la oportunidad (memoria visible para el asesor)',
    scopes: ['bot:write'],
    inputSchema: z.object({
      oportunidad_id: z.string().uuid(),
      mensaje: z.string().min(1).max(5000),
      autor: z.enum(['hidra-copiloto', 'asesor']).default('hidra-copiloto'),
    }),
    handler: async ({ oportunidad_id, mensaje, autor }, ctx) => {
      // Idempotency por header
      if (ctx.idempotencyKey) {
        const cached = await idempotencyGet(ctx.idempotencyKey);
        if (cached) return cached;
      }

      const row = await db.mensajes.create({
        data: {
          oportunidadId: oportunidad_id,
          autor,
          contenido: mensaje,
          createdAt: new Date(),
        },
      });

      const result = { registrado: true, id: row.id };

      if (ctx.idempotencyKey) await idempotencySet(ctx.idempotencyKey, result);
      return result;
    },
  },
};

function rpcError(code: number, message: string) {
  const err: any = new Error(message);
  err.code = code;
  return err;
}

// Stub — reemplazá con tu lógica real
async function calcularPrecioEstimado(args: any) {
  return {
    monto: 150_000,
    margenPct: 0.22,
    rangoMetros: '80-120',
    caudalGpm: 30,
    warnings: [] as string[],
  };
}

// Stub helpers de idempotencia
async function idempotencyGet(key: string): Promise<any> { return null; }
async function idempotencySet(key: string, value: any): Promise<void> {}
```

---

## 2. Router de tools (tools/call)

```ts
// dentro de route.ts, continuación de callTool
async function callTool(id: any, params: any, ctx: Ctx) {
  const { name, arguments: args } = params ?? {};
  const tool = TOOLS[name];
  if (!tool) return jsonRpcError(id, -32601, `tool not found: ${name}`);

  // Scope check
  if (!ctx.scopes.some(s => tool.scopes.includes(s))) {
    return jsonRpcError(id, 403, `scope required: ${tool.scopes.join('|')}`);
  }

  // Validate input con Zod
  const parsed = tool.inputSchema.safeParse(args);
  if (!parsed.success) {
    return jsonRpcError(id, -32602, 'invalid params', parsed.error.issues);
  }

  // Sub-límite writes
  if (tool.scopes.includes('bot:write')) {
    if (!checkRateLimit(`${ctx.sub}:write`, 10)) {
      return jsonRpcError(id, 429, 'write rate limited');
    }
  }

  try {
    const result = await tool.handler(parsed.data, ctx);
    return jsonRpcOk(id, result);
  } catch (err: any) {
    const code = err.code ?? -32603;
    return jsonRpcError(id, code, err.message ?? 'internal error');
  }
}

function listTools(scopes: string[]) {
  return Object.values(TOOLS)
    .filter(t => t.scopes.some(s => scopes.includes(s)))
    .map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema),
    }));
}

// Helper: convertir Zod a JSON Schema (para MCP tools/list)
// Usar `zod-to-json-schema` de npm o similar
function zodToJsonSchema(schema: z.ZodType): any {
  // ver https://github.com/StefanTerdell/zod-to-json-schema
  return {}; // placeholder
}
```

Instalar: `pnpm add zod-to-json-schema`.

---

## 3. Tests rápidos (curl)

### tools/list
```bash
curl -X POST https://hidrocrm.com/api/mcp \
  -H "Authorization: Bearer $HIDROCRM_TOKEN_COPILOTO" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/list"}'
```
Esperado: `{"jsonrpc":"2.0","id":"1","result":{"tools":[{"name":"buscar_oportunidad",...}]}}`

### tools/call — buscar_oportunidad
```bash
curl -X POST https://hidrocrm.com/api/mcp \
  -H "Authorization: Bearer $HIDROCRM_TOKEN_COPILOTO" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"2","method":"tools/call","params":{"name":"buscar_oportunidad","arguments":{"id":"<uuid-real>"}}}'
```

### tools/call — simular_descuento
```bash
curl -X POST https://hidrocrm.com/api/mcp \
  -H "Authorization: Bearer $HIDROCRM_TOKEN_COPILOTO" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":"3","method":"tools/call","params":{"name":"simular_descuento","arguments":{"cotizacion_id":"<uuid>","pct":15}}}'
```

---

## 4. Checklist de Sprint 1

- [ ] Instalar deps: `pnpm add jose zod zod-to-json-schema`
- [ ] Env: `JWT_SECRET` (generado con `openssl rand -hex 32`)
- [ ] Endpoint: `app/api/mcp/route.ts`
- [ ] Catálogo: `lib/mcp/tools.ts` con los 6 tools
- [ ] Implementar `calcularPrecioEstimado` y `isRevoked` con tu lógica
- [ ] Sustituir stubs de idempotencia por Redis real (opcional MVP)
- [ ] Generar los 2 JWTs con `scripts/admin/generate-tokens.ts`
- [ ] Probar los 3 curls
- [ ] Pasar tokens a Rodri

Una vez validado, continuar con Sprint 2 (`mi_proyecto`, `mi_bitacora`, etc. — ver `MCP_TOOLS.md` §3.8).
