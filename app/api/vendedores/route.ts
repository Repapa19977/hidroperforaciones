import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { INTERNAL_ASSIGNABLE_ROLES } from '@/lib/roles'
import { crearVendedorOption } from '@/lib/vendedores'

// GET /api/vendedores - lista de asesores internos activos.
// Usado por filtros y selectores en la UI. No devuelve passwords ni usuarios cliente_final.
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth.ok) return auth.response

  const usuarios = await prisma.usuario.findMany({
    where: { activo: true, rol: { in: INTERNAL_ASSIGNABLE_ROLES } },
    orderBy: { nombre: 'asc' },
    select: { nombre: true, rol: true, email: true, cargo: true },
  })

  const rows = usuarios.map(u => crearVendedorOption(u.nombre, u.email, u.rol, u.cargo))

  const envSuperadmin = process.env.SUPERADMIN_VENDEDOR
  const nombres = new Set(rows.map(u => u.nombre))
  if (envSuperadmin && !nombres.has(envSuperadmin)) {
    rows.unshift(crearVendedorOption(envSuperadmin, null, 'superadmin'))
  }

  return NextResponse.json(rows)
}
