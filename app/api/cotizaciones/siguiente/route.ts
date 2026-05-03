import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Piso mínimo de correlativo (instrucción Rodrigo 2026-04-23, go-live producción):
// la numeración real del negocio arranca en 5330. Ambas series (perforación y limpieza)
// arrancan desde ahí. El contador NO reinicia al cambiar el año — sigue incrementando.
// Solo cambia el sufijo -YYYY al año actual del calendario al momento de crear la cotización.
const CORRELATIVO_PISO = 5330

// GET — devuelve el próximo correlativo disponible según tipo
//   ?tipo=perforacion → P####-YYYY
//   ?tipo=limpieza    → S####-YYYY (servicios)
//   (sin tipo)        → P####-YYYY (default perforación)
export async function GET(req: NextRequest) {
  const tipo = req.nextUrl.searchParams.get('tipo') ?? 'perforacion'
  const prefijo = tipo === 'limpieza' ? 'S' : 'P'

  const rows = await prisma.cotizacion.findMany({
    select: { correlativo: true },
  })

  let maxNum = 0
  // Acepta tanto formato nuevo (P5443-2026) como viejo (P5443).
  // Captura solo la parte numérica para decidir el próximo número.
  const re = new RegExp(`^${prefijo}(\\d+)(?:-\\d{4})?$`)
  for (const row of rows) {
    const match = row.correlativo.match(re)
    if (match) {
      const n = parseInt(match[1], 10)
      if (n > maxNum) maxNum = n
    }
  }

  const next = Math.max(maxNum + 1, CORRELATIVO_PISO)
  const anio = new Date().getFullYear()
  return NextResponse.json({
    correlativo: `${prefijo}${String(next).padStart(4, '0')}-${anio}`,
    anio,
    numero: next,
  })
}
