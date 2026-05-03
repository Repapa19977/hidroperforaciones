import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import {
  findContactoDuplicate,
  findContactosSimilares,
  normContactoText,
} from '@/lib/contactos-dedup'

type Status = 'empty' | 'available' | 'similar' | 'exists'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.response

  const nombreRaw = req.nextUrl.searchParams.get('nombre') ?? ''
  const empresaRaw = req.nextUrl.searchParams.get('empresa') ?? ''
  const excludeId = req.nextUrl.searchParams.get('excludeId') ?? null

  if (!normContactoText(nombreRaw)) {
    return NextResponse.json({ status: 'empty' as Status })
  }

  const candidatos = await prisma.contacto.findMany({
    where: {
      eliminadoEn: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, nombre: true, empresa: true, telefono: true, email: true, vendedor: true, createdAt: true },
  })

  const duplicate = findContactoDuplicate({ nombre: nombreRaw, empresa: empresaRaw }, candidatos)
  if (duplicate) {
    return NextResponse.json({ status: 'exists' as Status, match: duplicate })
  }

  const similares = findContactosSimilares({ nombre: nombreRaw, empresa: empresaRaw }, candidatos)
  if (similares.length > 0) {
    return NextResponse.json({ status: 'similar' as Status, matches: similares })
  }

  return NextResponse.json({ status: 'available' as Status })
}
