import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET — devuelve el próximo correlativo disponible consultando la DB
export async function GET() {
  const rows = await prisma.cotizacion.findMany({
    select: { correlativo: true },
  })

  let maxNum = 60
  for (const row of rows) {
    const match = row.correlativo.match(/HP-COT-(\d+)/)
    if (match) {
      const n = parseInt(match[1], 10)
      if (n > maxNum) maxNum = n
    }
  }

  const next = maxNum + 1
  return NextResponse.json({ correlativo: `HP-COT-${String(next).padStart(4, '0')}` })
}
