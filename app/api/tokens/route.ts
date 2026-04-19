// Endpoints CRUD de ServiceToken para bots/integraciones (ej. OpenClaw).
// Solo superadmin. El token raw se muestra UNA sola vez al crearlo — después solo hash.

import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { prisma } from '@/lib/db'
import { requireSuperAdmin, getRequestInfo } from '@/lib/auth'
import { auditLog } from '@/lib/audit'

// Lista reconocida de scopes (solo informativa, validamos en el backend):
//   bot:read           — GET endpoints bot/*
//   bot:calc           — simular cotizaciones, descuentos
//   bot:write          — crear borradores, registrar mensajes
//   bot:followup       — mandar WhatsApp (template)
//   cliente:read       — portal cliente lectura
//   cliente:solicitud  — cliente registra pedido/queja

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const tokens = await prisma.serviceToken.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, nombre: true, scopes: true, activo: true,
      ultimoUso: true, vecesUsado: true, creadoPor: true, notas: true,
      expiraEn: true, createdAt: true,
    },
  })

  return NextResponse.json(tokens)
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({}))
  const { nombre, scopes, notas, expiraEn } = body as {
    nombre?: string
    scopes?: string[]
    notas?: string
    expiraEn?: string | null
  }

  if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
    return NextResponse.json({ error: 'nombre es requerido' }, { status: 400 })
  }
  const nombreClean = nombre.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-')

  // Chequear unicidad
  const dup = await prisma.serviceToken.findUnique({ where: { nombre: nombreClean } })
  if (dup) return NextResponse.json({ error: 'Ya existe un token con ese nombre' }, { status: 409 })

  // Generar token seguro: prefijo + 32 bytes hex = 70 chars aprox
  const raw = `hcrm_${randomBytes(32).toString('hex')}`
  const tokenHash = createHash('sha256').update(raw).digest('hex')

  const created = await prisma.serviceToken.create({
    data: {
      nombre: nombreClean,
      tokenHash,
      scopes: JSON.stringify(Array.isArray(scopes) ? scopes : []),
      notas: typeof notas === 'string' ? notas : '',
      creadoPor: auth.user.username,
      expiraEn: expiraEn ? new Date(expiraEn) : null,
    },
    select: { id: true, nombre: true, scopes: true, activo: true, expiraEn: true, createdAt: true },
  })

  const info = getRequestInfo(request)
  await auditLog({
    user: auth.user, accion: 'create', entidad: 'servicetoken', entidadId: created.id,
    despues: { nombre: created.nombre, scopes: created.scopes }, ...info,
  })

  // Se devuelve el token raw UNA SOLA VEZ — el admin lo copia y lo configura en el bot
  return NextResponse.json({ ...created, token: raw, aviso: 'Guardalo ahora — no se puede recuperar después' }, { status: 201 })
}
