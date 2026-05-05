// ── OpenClaw MCP endpoint ────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any -- JSON-RPC payloads are narrowed at runtime with Zod before tool execution. */
// JSON-RPC 2.0 sobre HTTP para que el bot Hidra-Copiloto consuma datos del CRM.
// Auth: JWT HS256 firmado con JWT_SECRET, aud="hidrocrm-mcp", iss="hidrocrm".
// Scopes en el payload dictan qué tools están disponibles.
// Referencia: specs-bot/MCP_TOOLS_SPRINT1.md + specs-bot/AUTH.md

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { z } from 'zod'
import { TOOLS, RpcError, type McpCtx, type McpScope } from '@/lib/mcp/tools'
import { getRequestInfo } from '@/lib/auth'
import { auditLog } from '@/lib/audit'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

// ── Rate limit in-memory (single-instance; para multi-instancia usar Redis) ──
const rateLimits = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now()
  const entry = rateLimits.get(key)
  if (!entry || entry.resetAt < now) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (entry.count >= limit) return false
  entry.count++
  return true
}

// ── JTI revocación (in-memory Set, MVP) ─────────────────────────────────────
// En prod real: Postgres table o Redis set. Para revocar por ahora se reinicia el proceso.
const revokedJtis = new Set<string>()
function isRevoked(jti: string | undefined): boolean {
  return !!jti && revokedJtis.has(jti)
}

// ── JSON-RPC helpers ────────────────────────────────────────────────────────
function jsonRpcOk(id: any, result: any) {
  return NextResponse.json({ jsonrpc: '2.0', id, result })
}
function jsonRpcError(id: any, code: number, message: string, data?: any, httpStatus = 200) {
  return NextResponse.json(
    { jsonrpc: '2.0', id, error: { code, message, ...(data !== undefined && { data }) } },
    { status: httpStatus },
  )
}

const SENSITIVE_ARG_KEYS = ['approval_code', 'approvalcode', 'password', 'token', 'secret', 'pin']

function redactMcpArgs(value: any): any {
  if (Array.isArray(value)) return value.map(redactMcpArgs)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => {
      const normalized = key.toLowerCase().replace(/[-_\s]/g, '')
      const sensitive = SENSITIVE_ARG_KEYS.some(pattern => normalized.includes(pattern.replace(/[-_\s]/g, '')))
      return [key, sensitive ? '[REDACTED]' : redactMcpArgs(nested)]
    }),
  )
}

export async function POST(req: NextRequest) {
  const { ip, userAgent } = getRequestInfo(req)

  // 1) Parse JSON-RPC envelope
  let body: any
  try {
    body = await req.json()
  } catch {
    return jsonRpcError(null, -32700, 'parse error', undefined, 400)
  }
  const { method, params, id } = body ?? {}
  if (body?.jsonrpc !== '2.0') {
    return jsonRpcError(id ?? null, -32600, 'invalid request: jsonrpc must be "2.0"', undefined, 400)
  }

  // 2) Auth — Bearer JWT
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.toLowerCase().startsWith('bearer ')) {
    return jsonRpcError(id, 401, 'missing bearer token', undefined, 401)
  }
  let payload: any
  try {
    ;({ payload } = await jwtVerify(auth.slice(7).trim(), JWT_SECRET, {
      audience: 'hidrocrm-mcp',
      issuer: 'hidrocrm',
    }))
  } catch (err: any) {
    return jsonRpcError(id, 401, `invalid token: ${err.message ?? 'verify failed'}`, undefined, 401)
  }

  const sub = payload.sub as string
  const scopes = (payload.scopes as McpScope[]) ?? []
  const jti = payload.jti as string | undefined

  // 3) Revocación
  if (isRevoked(jti)) {
    return jsonRpcError(id, 401, 'token revoked', undefined, 401)
  }

  // 4) Rate limit por sub (100/min para copiloto, 60/min para cliente — per AUTH.md §8)
  const globalLimit = sub === 'hidra-copiloto' ? 100 : 60
  if (!checkRateLimit(sub, globalLimit)) {
    return jsonRpcError(id, 429, 'rate limited', { retry_after: 60 }, 429)
  }

  const ctx: McpCtx = {
    scopes,
    sub,
    clientPhone: req.headers.get('x-hidra-client-phone'),
    idempotencyKey: req.headers.get('idempotency-key'),
    ip,
    userAgent,
  }

  // 5) Routing MCP
  if (method === 'tools/list') {
    return jsonRpcOk(id, { tools: listTools(scopes) })
  }
  if (method === 'tools/call') {
    return callTool(id, params, ctx)
  }
  if (method === 'ping') {
    return jsonRpcOk(id, { pong: true, sub, scopes })
  }

  return jsonRpcError(id, -32601, `method not found: ${method}`)
}

// ── Routing de tools/call ───────────────────────────────────────────────────
async function callTool(id: any, params: any, ctx: McpCtx) {
  const { name, arguments: args } = params ?? {}
  const tool = TOOLS[name as string]
  if (!tool) return jsonRpcError(id, -32601, `tool not found: ${name}`)

  // Scope check: al menos uno de los scopes requeridos está en el token
  if (!ctx.scopes.some(s => tool.scopes.includes(s))) {
    return jsonRpcError(id, 403, `scope required: ${tool.scopes.join('|')}`, undefined, 403)
  }

  // Sub-límite writes (20/min per AUTH.md §8)
  if (tool.scopes.includes('bot:write')) {
    if (!checkRateLimit(`${ctx.sub}:write`, 20)) {
      return jsonRpcError(id, 429, 'write rate limited', { retry_after: 60 }, 429)
    }
  }
  // Sub-límite analytics
  if (tool.scopes.includes('bot:analytics')) {
    if (!checkRateLimit(`${ctx.sub}:analytics`, 30)) {
      return jsonRpcError(id, 429, 'analytics rate limited', { retry_after: 60 }, 429)
    }
  }

  // Validar input con Zod
  const parsed = tool.inputSchema.safeParse(args)
  if (!parsed.success) {
    return jsonRpcError(id, -32602, 'invalid params', parsed.error.issues)
  }

  const start = Date.now()
  try {
    const result = await tool.handler(parsed.data, ctx)
    const durationMs = Date.now() - start
    const safeArgs = redactMcpArgs(parsed.data)
    // Auditar TODOS los tool calls (reads + writes) para dashboard de observabilidad del bot.
    // Writes se distinguen por accion='mcp_write', reads/calc/analytics por 'mcp_call'.
    const isWrite = tool.scopes.includes('bot:write')
    auditLog({
      user: { username: ctx.sub, role: 'bot', scopes: ctx.scopes, tokenNombre: ctx.sub },
      accion: isWrite ? 'mcp_write' : 'mcp_call',
      entidad: tool.name,
      entidadId: (result as { id?: string } | null)?.id ?? '',
      despues: { args: safeArgs, duration_ms: durationMs, status: 'ok' },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    }).catch(() => {})
    return jsonRpcOk(id, result)
  } catch (err: unknown) {
    const durationMs = Date.now() - start
    const errObj = err instanceof Error ? err : new Error(String(err))
    const safeArgs = redactMcpArgs(parsed.data)
    auditLog({
      user: { username: ctx.sub, role: 'bot', scopes: ctx.scopes, tokenNombre: ctx.sub },
      accion: 'mcp_error',
      entidad: tool.name,
      entidadId: '',
      despues: { args: safeArgs, duration_ms: durationMs, status: 'error', error: errObj.message },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    }).catch(() => {})
    if (err instanceof RpcError) {
      return jsonRpcError(id, err.code, err.message, err.data)
    }
    console.error(`[mcp] tool ${name} error:`, err)
    return jsonRpcError(id, -32603, errObj.message || 'internal error')
  }
}

function listTools(scopes: McpScope[]) {
  return Object.values(TOOLS)
    .filter(t => t.scopes.some(s => scopes.includes(s)))
    .map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: z.toJSONSchema(t.inputSchema as any),
    }))
}

// Endpoint GET para health check rápido (no requiere auth)
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'hidrocrm-mcp',
    version: '1.0.0',
    tools: Object.keys(TOOLS),
  })
}
