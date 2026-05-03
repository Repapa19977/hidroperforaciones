import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSuperAdmin } from '@/lib/auth'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; gastoId: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { gastoId } = await params
  await prisma.gastoExtra.delete({ where: { id: gastoId } })
  return NextResponse.json({ ok: true })
}
