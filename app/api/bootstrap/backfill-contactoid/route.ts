// Endpoint one-shot para backfill: rellena contactoId en Cotizaciones, Proyectos
// y Oportunidades que aún no lo tienen, haciendo match case-insensitive por
// nombre+empresa contra Contacto. Idempotente (seguro correr varias veces).
// Solo superadmin.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireSuperAdmin, getRequestInfo } from '@/lib/auth'
import { auditLog } from '@/lib/audit'

function buildMap(contactos: Array<{ id: string; nombre: string; empresa: string }>) {
  const map = new Map<string, string>()
  for (const c of contactos) {
    const nombre = c.nombre.trim().toLowerCase()
    const empresa = c.empresa.trim().toLowerCase()
    map.set(`${nombre}|${empresa}`, c.id)
    // Fallback: solo por nombre si la empresa estuviera vacía en el registro destino
    const onlyName = `${nombre}|`
    if (!map.has(onlyName)) map.set(onlyName, c.id)
  }
  return map
}

function lookup(map: Map<string, string>, cliente: string, empresa: string): string | undefined {
  const n = (cliente || '').trim().toLowerCase()
  const e = (empresa || '').trim().toLowerCase()
  return map.get(`${n}|${e}`) || map.get(`${n}|`)
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const contactos = await prisma.contacto.findMany({
    where: { eliminadoEn: null },
    select: { id: true, nombre: true, empresa: true },
  })
  const map = buildMap(contactos)

  // Cotizaciones
  const cots = await prisma.cotizacion.findMany({
    where: { contactoId: null },
    select: { id: true, cliente: true, empresa: true },
  })
  let cotMatched = 0
  for (const r of cots) {
    const cid = lookup(map, r.cliente, r.empresa)
    if (cid) {
      await prisma.cotizacion.update({ where: { id: r.id }, data: { contactoId: cid } })
      cotMatched++
    }
  }

  // Proyectos
  const proys = await prisma.proyecto.findMany({
    where: { contactoId: null },
    select: { id: true, cliente: true, empresa: true },
  })
  let proyMatched = 0
  for (const r of proys) {
    const cid = lookup(map, r.cliente, r.empresa)
    if (cid) {
      await prisma.proyecto.update({ where: { id: r.id }, data: { contactoId: cid } })
      proyMatched++
    }
  }

  // Oportunidades
  const ops = await prisma.oportunidad.findMany({
    where: { contactoId: null },
    select: { id: true, cliente: true, empresa: true },
  })
  let opMatched = 0
  for (const r of ops) {
    const cid = lookup(map, r.cliente, r.empresa)
    if (cid) {
      await prisma.oportunidad.update({ where: { id: r.id }, data: { contactoId: cid } })
      opMatched++
    }
  }

  const info = getRequestInfo(request)
  await auditLog({
    user: auth.user,
    accion: 'backfill_contactoid',
    entidad: 'bootstrap',
    despues: {
      cotizaciones: { revisadas: cots.length, vinculadas: cotMatched },
      proyectos:    { revisadas: proys.length, vinculadas: proyMatched },
      oportunidades:{ revisadas: ops.length,  vinculadas: opMatched },
      contactosDisponibles: contactos.length,
    },
    ...info,
  })

  return NextResponse.json({
    ok: true,
    cotizaciones: { revisadas: cots.length, vinculadas: cotMatched, sinMatch: cots.length - cotMatched },
    proyectos:    { revisadas: proys.length, vinculadas: proyMatched, sinMatch: proys.length - proyMatched },
    oportunidades:{ revisadas: ops.length,  vinculadas: opMatched,   sinMatch: ops.length - opMatched },
    contactosDisponibles: contactos.length,
  })
}
