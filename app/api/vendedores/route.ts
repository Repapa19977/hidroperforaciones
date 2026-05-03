import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET /api/vendedores — lista de nombres de vendedores activos (admin + superadmin)
// Usado por filtros y selectores en la UI. No devuelve contraseñas ni info sensible.
export async function GET() {
  const usuarios = await prisma.usuario.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' },
    select: { nombre: true, rol: true },
  })

  // Agrega el superadmin del .env si no está ya en la DB (no ensucia duplicados)
  const envSuperadmin = process.env.SUPERADMIN_VENDEDOR
  const nombres = usuarios.map(u => u.nombre)
  if (envSuperadmin && !nombres.includes(envSuperadmin)) {
    return NextResponse.json([
      { nombre: envSuperadmin, rol: 'superadmin' },
      ...usuarios,
    ])
  }
  return NextResponse.json(usuarios)
}
