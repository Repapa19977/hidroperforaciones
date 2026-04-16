import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET — listar proyectos (superadmin: todos; admin: solo los suyos)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const vendedor = searchParams.get('vendedor')
  const estado = searchParams.get('estado')

  const rows = await prisma.proyecto.findMany({
    where: {
      ...(vendedor ? { vendedor } : {}),
      ...(estado ? { estado } : {}),
    },
    include: {
      entradas: {
        orderBy: { fecha: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(rows)
}

// POST — crear proyecto manualmente (normalmente se crea automático al confirmar cotización)
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { correlativo, cotizacionId, cliente, empresa, nombre, tipo, monto, vendedor, fechaInicio } = body

  const row = await prisma.proyecto.create({
    data: {
      correlativo,
      cotizacionId,
      cliente,
      empresa: empresa ?? '',
      nombre,
      tipo,
      monto,
      vendedor,
      fechaInicio,
    },
  })

  return NextResponse.json(row, { status: 201 })
}
