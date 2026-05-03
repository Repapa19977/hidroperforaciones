// Endpoint de observabilidad del bot — lista últimos N calls al MCP.
// Lee de AuditLog filtrando por accion IN ('mcp_call', 'mcp_write', 'mcp_error').
// Solo superadmin.

import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { prisma } from '@/lib/db'

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

export async function GET(request: NextRequest) {
  if (!await assertSuperAdmin(request)) {
    return NextResponse.json({ error: 'Sin autorización' }, { status: 403 })
  }
  const url = new URL(request.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200)

  const logs = await prisma.auditLog.findMany({
    where: { accion: { in: ['mcp_call', 'mcp_write', 'mcp_error'] } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      usuario: true,
      accion: true,
      entidad: true,
      despues: true,
      ip: true,
    },
  })

  return NextResponse.json(
    logs.map(l => {
      let meta: { args?: unknown; duration_ms?: number; status?: string; error?: string } = {}
      try { meta = JSON.parse(l.despues) } catch { /* ignore */ }
      return {
        id: l.id,
        fecha: l.createdAt.toISOString(),
        sub: l.usuario,
        tool: l.entidad,
        status: meta.status ?? (l.accion === 'mcp_error' ? 'error' : 'ok'),
        duration_ms: meta.duration_ms ?? null,
        error: meta.error ?? null,
        args: meta.args ?? null,
        ip: l.ip,
      }
    }),
  )
}
