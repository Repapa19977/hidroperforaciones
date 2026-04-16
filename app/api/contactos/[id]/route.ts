import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()

  const row = await prisma.contacto.update({
    where: { id },
    data: {
      nombre:   body.nombre,
      empresa:  body.empresa,
      telefono: body.telefono,
      email:    body.email,
      tipo:     body.tipo,
      pais:     body.pais,
      notas:    body.notas,
    },
  })

  return NextResponse.json(row)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.contacto.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
