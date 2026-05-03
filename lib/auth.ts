// Helpers de autenticación/autorización server-side.
// Consolida patrones dispersos en los endpoints (jwtVerify, role checks, ip/userAgent,
// password hashing + validación).

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto'

/** SHA-256 estándar usado para hashear passwords de Usuario y cliente_final. */
export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

const SCRYPT_PREFIX = 'scrypt'
const SCRYPT_KEYLEN = 64

function safeEqualHex(a: string, b: string): boolean {
  if (!/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b)) return false
  const ab = Buffer.from(a, 'hex')
  const bb = Buffer.from(b, 'hex')
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/** Hash moderno para passwords nuevos. Mantiene sha256() para compatibilidad legacy/env. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex')
  return `${SCRYPT_PREFIX}$${salt}$${derived}`
}

/** Verifica hashes nuevos scrypt y hashes legacy SHA-256 sin romper usuarios existentes. */
export function verifyPassword(password: string, storedHash?: string | null): boolean {
  if (!storedHash) return false
  const parts = storedHash.split('$')
  if (parts.length === 3 && parts[0] === SCRYPT_PREFIX) {
    const [, salt, expected] = parts
    const derived = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex')
    return safeEqualHex(derived, expected)
  }
  return safeEqualHex(sha256(password), storedHash)
}

export function isLegacyPasswordHash(storedHash?: string | null): boolean {
  return !!storedHash && !storedHash.startsWith(`${SCRYPT_PREFIX}$`)
}

/** Política de passwords de la app:
 *    - mínimo 8 caracteres
 *    - al menos una letra
 *    - al menos un número
 *  Retorna mensaje de error en español, o null si cumple. Usado en creación
 *  y cambio de password (usuarios, cliente_final).
 */
export function validarPassword(pw: string): string | null {
  if (!pw || pw.length < 8) return 'La contraseña debe tener al menos 8 caracteres'
  if (!/[a-zA-Z]/.test(pw)) return 'La contraseña debe incluir al menos una letra'
  if (!/[0-9]/.test(pw))   return 'La contraseña debe incluir al menos un número'
  return null
}

export type Rol = 'admin' | 'superadmin' | 'cliente_final' | 'bot'

export interface CurrentUser {
  username: string
  role: Rol
  vendedor?: string
  // Para cliente_final
  contactoId?: string
  // Para bot (ServiceToken)
  tokenNombre?: string
  scopes?: string[]
}

/**
 * Devuelve el usuario actual basado en:
 *   1) Cookie `auth_token` con JWT (humano logueado)
 *   2) Header `Authorization: Bearer <token>` (ServiceToken para bots)
 * Retorna null si no hay auth válida.
 */
export async function getCurrentUser(request: NextRequest): Promise<CurrentUser | null> {
  // --- 1) Intentar JWT en cookie (humano) ---
  const jwtToken = request.cookies.get('auth_token')?.value
  if (jwtToken) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
      const { payload } = await jwtVerify(jwtToken, secret)
      return {
        username: (payload.sub as string) ?? '',
        role: (payload.role as Rol) ?? 'admin',
        vendedor: (payload.vendedor as string) ?? undefined,
        contactoId: (payload.contactoId as string) ?? undefined,
      }
    } catch {
      // caer a bearer
    }
  }

  // --- 2) ServiceToken Bearer (bots) ---
  const authHeader = request.headers.get('authorization') ?? ''
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i)
  if (bearerMatch) {
    const raw = bearerMatch[1].trim()
    if (raw) {
      const { createHash } = await import('crypto')
      const tokenHash = createHash('sha256').update(raw).digest('hex')
      const { prisma } = await import('./db')
      const st = await prisma.serviceToken.findUnique({ where: { tokenHash } })
      if (st && st.activo && (!st.expiraEn || st.expiraEn > new Date())) {
        // Actualizar uso de forma fire-and-forget
        prisma.serviceToken.update({
          where: { id: st.id },
          data: { ultimoUso: new Date(), vecesUsado: { increment: 1 } },
        }).catch(() => {})
        let scopes: string[] = []
        try { scopes = JSON.parse(st.scopes) } catch {}
        return {
          username: `bot:${st.nombre}`,
          role: 'bot',
          tokenNombre: st.nombre,
          scopes,
        }
      }
    }
  }

  return null
}

/** Helper: requiere superadmin, si no 403 */
export async function requireSuperAdmin(request: NextRequest): Promise<
  { ok: true; user: CurrentUser } | { ok: false; response: NextResponse }
> {
  const user = await getCurrentUser(request)
  if (!user || user.role !== 'superadmin') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Solo superadmin' }, { status: 403 }),
    }
  }
  return { ok: true, user }
}

/** Helper: requiere cualquier login válido (humano o bot) */
export async function requireAuth(request: NextRequest): Promise<
  { ok: true; user: CurrentUser } | { ok: false; response: NextResponse }
> {
  const user = await getCurrentUser(request)
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }),
    }
  }
  return { ok: true, user }
}

/** Helper: requiere que el bot tenga un scope específico */
export async function requireBotScope(request: NextRequest, scope: string): Promise<
  { ok: true; user: CurrentUser } | { ok: false; response: NextResponse }
> {
  const user = await getCurrentUser(request)
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  }
  if (user.role !== 'bot') {
    return { ok: false, response: NextResponse.json({ error: 'Solo bots' }, { status: 403 }) }
  }
  if (!user.scopes?.includes(scope)) {
    return {
      ok: false,
      response: NextResponse.json({ error: `Scope '${scope}' requerido`, scopes: user.scopes }, { status: 403 }),
    }
  }
  return { ok: true, user }
}

/** Extraer IP y User-Agent de la request (para audit log y rate limit) */
export function getRequestInfo(request: Request): { ip: string; userAgent: string } {
  const h = request.headers
  const ip =
    h.get('fly-client-ip') ??
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get('x-real-ip') ??
    'unknown'
  const userAgent = h.get('user-agent') ?? ''
  return { ip, userAgent }
}
