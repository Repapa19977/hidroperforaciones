// Endpoint de rotación de tokens JWT del bot.
// Genera un JWT nuevo firmado con JWT_SECRET para consumir el MCP.
// El superadmin decide cuándo pasarlo al bot y cuándo descartar el viejo.
// Solo superadmin.

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, SignJWT } from 'jose'
import { randomUUID } from 'crypto'

const ALLOWED_SUBS = ['hidra-copiloto', 'hidra-cliente'] as const
type SubType = typeof ALLOWED_SUBS[number]

const SCOPES_BY_SUB: Record<SubType, string[]> = {
  'hidra-copiloto': ['bot:read', 'bot:calc', 'bot:write', 'bot:analytics', 'bot:finance', 'bot:field', 'bot:geology'],
  'hidra-cliente': ['cliente:read', 'cliente:solicitud'],
}

async function assertSuperAdmin(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value
  if (!token) return false
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET!),
    )
    return payload.role === 'superadmin'
  } catch {
    return false
  }
}

// POST — rota (genera) un token nuevo para un sub determinado
export async function POST(request: NextRequest) {
  if (!await assertSuperAdmin(request)) {
    return NextResponse.json({ error: 'Sin autorización' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const sub = body.sub as string | undefined
  const expiresInDays = Math.min(Math.max(parseInt(String(body.expires_in_days ?? 90), 10), 1), 365)

  if (!sub || !ALLOWED_SUBS.includes(sub as SubType)) {
    return NextResponse.json(
      { error: `sub inválido. Debe ser uno de: ${ALLOWED_SUBS.join(', ')}` },
      { status: 400 },
    )
  }

  const now = Math.floor(Date.now() / 1000)
  const exp = now + expiresInDays * 24 * 60 * 60
  const jti = randomUUID()

  const token = await new SignJWT({
    scopes: SCOPES_BY_SUB[sub as SubType],
    sub,
    aud: 'hidrocrm-mcp',
    iss: 'hidrocrm',
    iat: now,
    exp,
    jti,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(new TextEncoder().encode(process.env.JWT_SECRET!))

  return NextResponse.json({
    token,
    sub,
    scopes: SCOPES_BY_SUB[sub as SubType],
    jti,
    issued_at: new Date(now * 1000).toISOString(),
    expires_at: new Date(exp * 1000).toISOString(),
    expires_in_days: expiresInDays,
    // Instrucciones para el usuario
    next_steps: [
      'Copiá este token y pasáselo al asistente del bot por canal seguro.',
      'El asistente debe reemplazar el token actual en el .env del bot y reiniciar.',
      'El token anterior sigue válido hasta su propia expiración — coordiná el cambio con el asistente.',
    ],
  })
}
