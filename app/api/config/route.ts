import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { DEFAULT_CONFIG } from '@/lib/config-store'
import { requireSuperAdmin, getRequestInfo } from '@/lib/auth'
import { auditLog } from '@/lib/audit'

// Config es un singleton que cambia frecuentemente (tuberías custom, precios, etc.)
// SIEMPRE debe leerse fresco — sin caché de Next ni del browser.
export const dynamic = 'force-dynamic'
export const revalidate = 0

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Pragma': 'no-cache',
}

export async function GET() {
  const row = await prisma.config.findUnique({ where: { id: 'singleton' } })
  const body = !row
    ? DEFAULT_CONFIG
    : (() => { try { return { ...DEFAULT_CONFIG, ...JSON.parse(row.datos) } } catch { return DEFAULT_CONFIG } })()
  return NextResponse.json(body, { headers: NO_CACHE_HEADERS })
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json()
  const before = await prisma.config.findUnique({ where: { id: 'singleton' } })

  await prisma.config.upsert({
    where:  { id: 'singleton' },
    update: { datos: JSON.stringify(body) },
    create: { id: 'singleton', datos: JSON.stringify(body) },
  })

  const info = getRequestInfo(request)
  await auditLog({
    user: auth.user,
    accion: 'update',
    entidad: 'config',
    entidadId: 'singleton',
    antes: before ? { id: before.id } : null,
    despues: { keys: Object.keys(body ?? {}) },
    ...info,
  })

  return NextResponse.json({ ok: true }, { headers: NO_CACHE_HEADERS })
}
