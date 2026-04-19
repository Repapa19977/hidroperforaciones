# Autenticación HidroCRM ↔ Bot — Contrato v1

> **Audiencia:** dev del VPS
> **Librerías:** `jose` (JWT para el VPS) + `node:crypto` (HMAC webhooks)

## 1. Service tokens JWT (VPS → bot)

El VPS emite 2 tokens long-lived al arrancar (o en un panel admin):

### Token Copiloto (asesores internos)
```ts
{
  sub: 'hidra-copiloto',
  aud: 'hidrocrm-mcp',
  iss: 'hidrocrm',
  scopes: ['bot:read', 'bot:calc', 'bot:write', 'bot:analytics', 'bot:finance', 'bot:field', 'bot:geology'],
  iat: <unix>,
  exp: <unix + 90*24*3600>  // 90 días, rotar antes
}
```

### Token Cliente (portal cliente)
```ts
{
  sub: 'hidra-cliente',
  aud: 'hidrocrm-mcp',
  iss: 'hidrocrm',
  scopes: ['cliente:read', 'cliente:solicitud'],
  cliente_id: null,  // ← se rellena por request (ver abajo)
  iat: <unix>,
  exp: <unix + 90*24*3600>
}
```

### Emisión (ejemplo)

```ts
// VPS: pages/admin/generate-tokens.ts
import { SignJWT } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

async function generateCopilotoToken() {
  return new SignJWT({
    scopes: ['bot:read', 'bot:calc', 'bot:write', 'bot:analytics', 'bot:finance', 'bot:field', 'bot:geology'],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('hidra-copiloto')
    .setAudience('hidrocrm-mcp')
    .setIssuer('hidrocrm')
    .setIssuedAt()
    .setExpirationTime('90d')
    .sign(SECRET);
}
```

⚠️ **JWT_SECRET** debe tener ≥ 256 bits (32 bytes). Genera:
```bash
openssl rand -hex 32
```

## 2. Cliente scope — el cliente_id se inyecta por request

El token cliente **NO** lleva `cliente_id` fijo. Es un token "service" que el bot usa para actuar en nombre de cualquier cliente. El `cliente_id` se identifica por el teléfono del cliente que está hablando por WhatsApp.

### Flujo:
1. Cliente escribe por WhatsApp: `+50233xxxxxxx`
2. Bot busca el contacto en CRM: `cliente_id = abc123`
3. Bot llama a MCP con `arguments: { cliente_id: 'abc123', ...otros }`
4. VPS valida:
   - Token es válido + scope `cliente:read`
   - Tool pedida permite cliente scope
   - **cliente_id en args corresponde al teléfono esperado** (el bot pasa el teléfono en header `X-Hidra-Client-Phone` como prueba)

### Header de verificación cliente

```
X-Hidra-Client-Phone: +50230362699
```

El VPS verifica:
```ts
const contact = await db.contacts.findByPhone(req.headers['x-hidra-client-phone']);
if (!contact || contact.id !== args.cliente_id) {
  return error(403, 'cliente_id mismatch');
}
```

Esto bloquea cross-tenant aunque alguien robara el token del bot.

## 3. Verificación en el VPS (MCP endpoint)

```ts
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

async function authenticate(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) throw new Error('missing token');

  const { payload } = await jwtVerify(auth.slice(7), SECRET, {
    audience: 'hidrocrm-mcp',
    issuer: 'hidrocrm',
  });

  return {
    sub: payload.sub as 'hidra-copiloto' | 'hidra-cliente',
    scopes: payload.scopes as string[],
  };
}
```

## 4. Scope enforcement

Cada tool declara scopes aceptados:

```ts
const TOOLS = {
  buscar_oportunidad: {
    scopes: ['bot:read'],
    schema: z.object({ id: z.string().uuid() }),
    handler: async (args, ctx) => { /* ... */ },
  },
  mi_proyecto: {
    scopes: ['cliente:read'],
    schema: z.object({ cliente_id: z.string().uuid() }),
    handler: async (args, ctx) => {
      // ctx.clientPhone = header
      // validate args.cliente_id corresponde al phone
    },
  },
  simular_descuento: {
    scopes: ['bot:calc'],
    schema: z.object({ cotizacion_id: z.string(), pct: z.number().min(0).max(50) }),
    handler: /* ... */,
  },
};
```

## 5. Rotación de tokens

Los tokens duran 90 días. Antes del vencimiento (~7 días), el VPS:
1. Emite token nuevo
2. Envía webhook `auth.token_rotated` con `{ new_token, scope }`
3. Bot lo recibe, guarda en `openclaw secrets`, empieza a usarlo
4. Token viejo sigue válido por 7 días más (overlap window)
5. A los 7 días: vence y debe revocar

Si no hay rotación automática: el VPS debe avisar por Slack/email al super admin.

## 6. Revocación inmediata

Si un token se compromete:
1. Super admin abre panel VPS `/admin/tokens` → click `Revoke`
2. VPS agrega JTI a blocklist en Redis
3. Cada request verifica si el JTI está revocado → si sí, 401

```ts
// Campo `jti: crypto.randomUUID()` en el token al emitirlo
// Y el verificador:
if (await redis.sismember('revoked_jtis', payload.jti)) {
  throw new Error('token revoked');
}
```

## 7. Webhook HMAC (bot → VPS)

Complementa lo de WEBHOOKS.md:

Secret compartido (generado por el bot al desplegar): `HIDRA_WEBHOOK_SECRET=<64 hex>`

El bot verifica en el endpoint entrante:
```ts
const expected = createHmac('sha256', SECRET).update(`${ts}.${body}`).digest('hex');
if (signature !== `sha256=${expected}`) return 401;
if (Math.abs(now - ts) > 300) return 401;  // ±5min
```

## 8. Rate limiting por token

- Token Copiloto: 100 calls/min
- Token Cliente: 60 calls/min
- Tools de escritura: sub-límite 20/min
- Tools de analytics: sub-límite 30/min

Si excede → 429 `Retry-After: <seconds>`.

## 9. Entregables (lo que el bot necesita de vos)

Al terminar de implementar, pasame por canal seguro (Signal/1Password/WhatsApp con auto-borrado):

```
HIDROCRM_BASE_URL=https://hidrocrm.com/api/mcp
HIDROCRM_TOKEN_COPILOTO=<JWT>
HIDROCRM_TOKEN_CLIENTE=<JWT>
```

Y confirmame que el VPS tiene `HIDRA_WEBHOOK_SECRET` configurado con el valor que te entregué en `HANDOFF.txt`.
