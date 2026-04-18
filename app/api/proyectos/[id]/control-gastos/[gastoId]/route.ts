import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string; gastoId: string }> }) {
  const { gastoId } = await params
  await prisma.gastoExtra.delete({ where: { id: gastoId } })
  return NextResponse.json({ ok: true })
}
