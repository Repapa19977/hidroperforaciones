import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// GET — listar todas (o filtrar por vendedor)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const vendedor = searchParams.get('vendedor')

  const rows = await prisma.cotizacion.findMany({
    where: vendedor ? { vendedor } : undefined,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(rows)
}

// POST — crear o actualizar cotización (y auto-upsert contacto si hay teléfono)
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { correlativo, cliente, empresa, proyecto, tipo, estado, monto, fecha, vendedor, datos } = body

  const row = await prisma.cotizacion.upsert({
    where: { correlativo },
    update: { cliente, empresa, proyecto, tipo, estado, monto, fecha, vendedor, datos: JSON.stringify(datos ?? {}) },
    create: { correlativo, cliente, empresa: empresa ?? '', proyecto, tipo, estado: estado ?? 'borrador', monto, fecha, vendedor, datos: JSON.stringify(datos ?? {}) },
  })

  // Auto-upsert contacto si el cliente tiene teléfono registrado
  const telefono: string = (typeof datos === 'object' ? datos?.telefono : '') ?? ''
  if (cliente && telefono) {
    const existing = await prisma.contacto.findFirst({
      where: { nombre: cliente, vendedor },
    })
    if (existing) {
      // Update phone if it changed or was empty
      if (!existing.telefono && telefono) {
        await prisma.contacto.update({
          where: { id: existing.id },
          data: { telefono, empresa: empresa ?? existing.empresa },
        })
      }
    } else {
      await prisma.contacto.create({
        data: {
          nombre: cliente,
          empresa: empresa ?? '',
          telefono,
          vendedor,
        },
      })
    }
  }

  return NextResponse.json(row)
}
