// Rate limiter simple en memoria. Apto para instancia única (Fly.io con 1 machine).
// Para escalar horizontalmente migrar a Redis/Upstash.

type Entry = { count: number; resetAt: number }
const buckets = new Map<string, Entry>()

/**
 * Verifica rate limit por clave (ej: IP o username).
 * @param key Identificador único del solicitante
 * @param limit Máximo de intentos en la ventana
 * @param windowMs Ventana en milisegundos
 * @returns { ok, remaining, resetAt } — ok=false si excedió
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): {
  ok: boolean
  remaining: number
  resetAt: number
} {
  const now = Date.now()
  const entry = buckets.get(key)

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + windowMs
    buckets.set(key, { count: 1, resetAt })
    return { ok: true, remaining: limit - 1, resetAt }
  }

  if (entry.count >= limit) {
    return { ok: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count += 1
  return { ok: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}

/**
 * Revisa si una clave ya esta bloqueada sin incrementar el contador.
 * Usado en login para no penalizar intentos correctos.
 */
export function getRateLimitStatus(key: string, limit: number, windowMs: number): {
  ok: boolean
  remaining: number
  resetAt: number
} {
  const now = Date.now()
  const entry = buckets.get(key)

  if (!entry || entry.resetAt <= now) {
    return { ok: true, remaining: limit, resetAt: now + windowMs }
  }

  if (entry.count >= limit) {
    return { ok: false, remaining: 0, resetAt: entry.resetAt }
  }

  return { ok: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}

/** Limpia el contador de una clave, por ejemplo despues de login exitoso. */
export function resetRateLimit(key: string) {
  buckets.delete(key)
}

/**
 * Limpia entradas expiradas del bucket. Llamar ocasionalmente desde endpoints activos
 * para evitar crecimiento ilimitado (solo entradas expiradas se eliminan).
 */
export function cleanupRateLimit() {
  const now = Date.now()
  for (const [k, v] of buckets.entries()) {
    if (v.resetAt <= now) buckets.delete(k)
  }
}

/** Extrae IP del request (considera proxies comunes: Fly.io, Vercel, Cloudflare). */
export function getClientIp(req: Request): string {
  const h = req.headers
  return (
    h.get('fly-client-ip') ??
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get('x-real-ip') ??
    'unknown'
  )
}
