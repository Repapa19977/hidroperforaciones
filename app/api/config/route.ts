import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { DEFAULT_CONFIG } from '@/lib/config-store'

export async function GET() {
  const row = await prisma.config.findUnique({ where: { id: 'singleton' } })
  if (!row) return NextResponse.json(DEFAULT_CONFIG)

  try {
    return NextResponse.json({ ...DEFAULT_CONFIG, ...JSON.parse(row.datos) })
  } catch {
    return NextResponse.json(DEFAULT_CONFIG)
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  await prisma.config.upsert({
    where:  { id: 'singleton' },
    update: { datos: JSON.stringify(body) },
    create: { id: 'singleton', datos: JSON.stringify(body) },
  })

  return NextResponse.json({ ok: true })
}
