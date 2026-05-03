// Helper para autenticar endpoints /api/cron/* via header X-Cron-Secret.
// El secret vive solo en el VPS (env var CRON_SECRET) y en el crontab.

import type { NextRequest } from 'next/server'

export function assertCronAuth(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected || expected.length < 16) {
    // Si no está configurado, rechazar por defecto — safer than accepting.
    return false
  }
  const provided = request.headers.get('x-cron-secret') ?? ''
  if (provided.length !== expected.length) return false
  // Comparación tiempo-constante para evitar timing attacks
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i)
  }
  return diff === 0
}
