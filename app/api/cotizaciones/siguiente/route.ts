import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET — devuelve el próximo correlativo disponible según tipo
//   ?tipo=perforacion → P####
//   ?tipo=limpieza    → L####
//   (sin tipo)        → P#### (default perforación)
export async function GET(req: NextRequest) {
  const tipo = req.nextUrl.searchParams.get('tipo') ?? 'perforacion'
  const prefijo = tipo === 'limpieza' ? 'L' : 'P'

  const rows = await prisma.cotizacion.findMany({
    select: { correlativo: true },
  })

  let maxNum = 0
  // Regex dinámico según prefijo
  const re = new RegExp(`^${prefijo}(\\d+)$`)
  for (const row of rows) {
    const match = row.correlativo.match(re)
    if (match) {
      const n = parseInt(match[1], 10)
      if (n > maxNum) maxNum = n
    }
  }

  const next = maxNum + 1
  return NextResponse.json({ correlativo: `${prefijo}${String(next).padStart(4, '0')}` })
}
