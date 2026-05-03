import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calcularPerforacion, type InputsPerforacion } from '@/lib/calculator'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PorProyecto = {
  id: string
  correlativo: string
  cliente: string
  empresa: string
  bentonita: { real: number; plan: number; clientePago: number; clienteQ: number; costoRealQ: number; pctUsado: number }
  pies:      { real: number; plan: number; pctUsado: number }
  pipas:     { real: number; clienteQ: number }
}

// GET /api/dashboard/operaciones
// Devuelve métricas operativas (bentonita, pipas, pies) por PROYECTO y también agregado.
// Si se pasa ?vendedor=, filtra solo a esos proyectos.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.ok) return auth.response
  if (auth.user.role !== 'admin' && auth.user.role !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const vendedor = auth.user.role === 'admin'
    ? auth.user.vendedor ?? ''
    : req.nextUrl.searchParams.get('vendedor')?.trim() || null
  const proyectos = await prisma.proyecto.findMany({
    where: {
      estado: 'activo',
      eliminadoEn: null,
      ...(vendedor ? { vendedor } : {}),
    },
    include: { entradas: true },
    orderBy: { createdAt: 'desc' },
  })

  const correlativos = proyectos.map(p => p.correlativo)
  const cotizaciones = correlativos.length > 0
    ? await prisma.cotizacion.findMany({ where: { correlativo: { in: correlativos }, eliminadaEn: null } })
    : []
  const cotsMap = new Map(cotizaciones.map(c => [c.correlativo, c]))

  const porProyecto: PorProyecto[] = []

  // Agregados (para el total global que sigue siendo útil)
  let aBentPlan = 0, aBentCli = 0, aBentClienteQ = 0, aBentReal = 0, aBentCostoQ = 0
  let aPiesPlan = 0, aPiesReal = 0
  let aPipasReal = 0, aPipasClienteQ = 0

  for (const p of proyectos) {
    let precioBent = 535.71
    let costoBent = 303
    let bentPlan = 0, bentCli = 0, bentReal = 0, bentCostoQ = 0, bentClienteQ = 0
    let piesPlan = 0, piesReal = 0
    let pipasReal = 0, pipasClienteQ = 0

    const cot = cotsMap.get(p.correlativo)
    if (cot?.datos) {
      try {
        const d = typeof cot.datos === 'string' ? JSON.parse(cot.datos) : cot.datos
        if (d.ip) {
          const ip = d.ip as InputsPerforacion
          const r = calcularPerforacion(ip)
          bentPlan      = r.sacosBentonita
          bentCli       = r.sacosEntregaCliente
          costoBent     = ip.precioBentonitaSaco || 303
          precioBent    = (d.preciosVentaOverride?.bentonita as number | undefined) ?? 535.71
          bentClienteQ  = r.sacosEntregaCliente * precioBent
          piesPlan      = ip.profundidad
          pipasClienteQ = ip.costoPipasAgua || 0
        }
      } catch { /* ignore */ }
    }

    for (const e of p.entradas) {
      bentReal    += e.bentonitaSacos
      bentCostoQ  += e.bentonitaSacos * costoBent
      piesReal    += e.perforacionDia
      pipasReal   += e.pipas
    }

    porProyecto.push({
      id: p.id,
      correlativo: p.correlativo,
      cliente: p.cliente,
      empresa: p.empresa,
      bentonita: {
        real:        bentReal,
        plan:        bentPlan,
        clientePago: bentCli,
        clienteQ:    Math.round(bentClienteQ),
        costoRealQ:  Math.round(bentCostoQ),
        pctUsado:    bentCli > 0 ? (bentReal / bentCli) * 100 : 0,
      },
      pies:  { real: piesReal, plan: piesPlan, pctUsado: piesPlan > 0 ? (piesReal / piesPlan) * 100 : 0 },
      pipas: { real: pipasReal, clienteQ: Math.round(pipasClienteQ) },
    })

    aBentPlan     += bentPlan
    aBentCli      += bentCli
    aBentReal     += bentReal
    aBentCostoQ   += bentCostoQ
    aBentClienteQ += bentClienteQ
    aPiesPlan     += piesPlan
    aPiesReal     += piesReal
    aPipasReal    += pipasReal
    aPipasClienteQ += pipasClienteQ
  }

  // Alertas de vencimientos de gastos extras (global)
  const hoyISO = new Date().toISOString().slice(0, 10)
  const en3dias = (() => { const d = new Date(); d.setDate(d.getDate() + 3); return d.toISOString().slice(0, 10) })()
  const gastos = proyectos.length > 0
    ? await prisma.gastoExtra.findMany({
        where: { proyectoId: { in: proyectos.map(p => p.id) }, pagado: false, fechaVencimiento: { not: '' } },
      })
    : []
  let gastosVencidos = 0, gastosPorVencer = 0
  for (const g of gastos) {
    if (g.fechaVencimiento < hoyISO) gastosVencidos++
    else if (g.fechaVencimiento <= en3dias) gastosPorVencer++
  }

  return NextResponse.json({
    proyectosActivos: proyectos.length,
    porProyecto,
    // Agregados globales (compatibilidad + totales)
    bentonita: {
      real:        aBentReal,
      plan:        aBentPlan,
      clientePago: aBentCli,
      clienteQ:    Math.round(aBentClienteQ),
      costoRealQ:  Math.round(aBentCostoQ),
      pctUsado:    aBentCli > 0 ? (aBentReal / aBentCli) * 100 : 0,
    },
    pies:  { real: aPiesReal, plan: aPiesPlan, pctUsado: aPiesPlan > 0 ? (aPiesReal / aPiesPlan) * 100 : 0 },
    pipas: { real: aPipasReal, clienteQ: Math.round(aPipasClienteQ) },
    alertas: { gastosVencidos, gastosPorVencer },
  })
}
