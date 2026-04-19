import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calcularPerforacion, type InputsPerforacion } from '@/lib/calculator'

// GET /api/dashboard/operaciones
// Agrega métricas operativas (bentonita, pipas, pies) de TODOS los proyectos activos:
// consumido vs presupuestado.
export async function GET() {
  const proyectos = await prisma.proyecto.findMany({
    where: { estado: 'activo', eliminadoEn: null },
    include: { entradas: true },
  })

  let bentonitaPlan = 0          // sacos totales que se COMPRAN internamente (100%)
  let bentonitaClientePago = 0   // sacos que el cliente pagó (70%)
  let bentonitaClienteQ = 0      // Q facturados al cliente por bentonita
  let bentonitaReal = 0          // sacos realmente consumidos en bitácora
  let bentonitaCostoRealQ = 0    // Q del costo real de lo consumido
  let piesPlan = 0
  let piesReal = 0
  let pipasReal = 0              // pipas consumidas en bitácora
  let pipasClienteQ = 0          // Q facturados al cliente por pipas
  let gastosVencidos = 0
  let gastosPorVencer = 0

  // Cotizaciones para los proyectos activos (match por correlativo)
  const correlativos = proyectos.map(p => p.correlativo)
  const cotizaciones = correlativos.length > 0
    ? await prisma.cotizacion.findMany({ where: { correlativo: { in: correlativos }, eliminadaEn: null } })
    : []
  const cotsMap = new Map(cotizaciones.map(c => [c.correlativo, c]))

  for (const p of proyectos) {
    let precioBentonitaSaco = 0      // precio venta al cliente (Q por saco)
    let costoBentonitaInterno = 303  // costo interno aprox
    // Presupuestado (plan) desde cotización
    const cot = cotsMap.get(p.correlativo)
    if (cot?.datos) {
      try {
        const d = typeof cot.datos === 'string' ? JSON.parse(cot.datos) : cot.datos
        if (d.ip) {
          const ip = d.ip as InputsPerforacion
          const r = calcularPerforacion(ip)
          bentonitaPlan         += r.sacosBentonita
          bentonitaClientePago  += r.sacosEntregaCliente
          costoBentonitaInterno  = ip.precioBentonitaSaco || 303
          // Precio venta al cliente por saco: viene de preciosVentaOverride o default
          const precioVentaSaco = (d.preciosVentaOverride?.bentonita as number | undefined) ?? 535.71
          precioBentonitaSaco   = precioVentaSaco
          bentonitaClienteQ    += r.sacosEntregaCliente * precioVentaSaco
          piesPlan             += ip.profundidad
          pipasClienteQ        += ip.costoPipasAgua || 0
        }
      } catch { /* ignore */ }
    }
    // Consumido (real) desde bitácora
    for (const e of p.entradas) {
      bentonitaReal        += e.bentonitaSacos
      bentonitaCostoRealQ  += e.bentonitaSacos * costoBentonitaInterno
      piesReal             += e.perforacionDia
      pipasReal            += e.pipas
    }
    void precioBentonitaSaco // referencia para claridad
  }

  // Alertas de vencimientos de gastos extras (todos los proyectos activos)
  const hoyISO = new Date().toISOString().slice(0, 10)
  const en3dias = (() => { const d = new Date(); d.setDate(d.getDate() + 3); return d.toISOString().slice(0, 10) })()
  const gastos = await prisma.gastoExtra.findMany({
    where: { proyectoId: { in: proyectos.map(p => p.id) }, pagado: false, fechaVencimiento: { not: '' } },
  })
  for (const g of gastos) {
    if (g.fechaVencimiento < hoyISO) gastosVencidos++
    else if (g.fechaVencimiento <= en3dias) gastosPorVencer++
  }

  return NextResponse.json({
    proyectosActivos: proyectos.length,
    bentonita: {
      real: bentonitaReal,
      plan: bentonitaPlan,                  // 100% que se compra
      clientePago: bentonitaClientePago,    // 70% que el cliente pagó
      clienteQ: Math.round(bentonitaClienteQ),
      costoRealQ: Math.round(bentonitaCostoRealQ),
      pctUsado: bentonitaClientePago > 0 ? (bentonitaReal / bentonitaClientePago) * 100 : 0,
    },
    pies: { real: piesReal, plan: piesPlan, pctUsado: piesPlan > 0 ? (piesReal / piesPlan) * 100 : 0 },
    pipas: {
      real: pipasReal,
      clienteQ: Math.round(pipasClienteQ),  // Q que el cliente pagó (global)
    },
    alertas: { gastosVencidos, gastosPorVencer },
  })
}
