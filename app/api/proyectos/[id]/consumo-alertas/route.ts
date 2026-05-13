// Alertas de consumo vs contratado (Fase F).
// Compara lo que se consumió en bitácora contra lo que se contrató en la cotización.
// Devuelve alertas para bentonita, pipas, pies perforados.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calcularPerforacion, pipasClienteCantidad, camionadasGrava, type InputsPerforacion } from '@/lib/calculator'
import { requireSuperAdmin } from '@/lib/auth'

interface Alerta {
  producto: 'pies' | 'bentonita' | 'pipas' | 'grava'
  unidad: string
  contratado: number
  consumido: number
  pct: number
  nivel: 'ok' | 'warning' | 'critico' | 'exceso'
  mensaje: string
  costoExtra: number   // Q de exceso que nos cuesta
  ventaExtra: number   // Q que deberíamos cobrar al cliente
  reservaDisponible?: number
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) return auth.response

  const { id } = await params

  const proyecto = await prisma.proyecto.findUnique({
    where: { id },
    include: { entradas: true },
  })
  if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  // Traer cotización original
  const cotizacion = await prisma.cotizacion.findUnique({ where: { correlativo: proyecto.correlativo } })
  if (!cotizacion?.datos) {
    return NextResponse.json({ alertas: [], motivo: 'Sin cotización de referencia' })
  }

  let ip: InputsPerforacion | null = null
  try {
    const d = typeof cotizacion.datos === 'string' ? JSON.parse(cotizacion.datos) : cotizacion.datos
    ip = d.ip as InputsPerforacion
  } catch { /* ignore */ }

  if (!ip) return NextResponse.json({ alertas: [], motivo: 'Cotización sin parámetros de perforación' })

  // Cotización: calcular cantidades contratadas
  const calc = calcularPerforacion(ip)
  const piesContratados       = ip.profundidad
  const bentonitaContratada   = Math.round(calc.sacosEntregaCliente)  // 70% que cliente paga
  const bentonitaInterno      = Math.round(calc.sacosBentonita)       // 100% que nosotros compramos
  const pipasContratadas      = pipasClienteCantidad(ip.profundidad, ip.rendimientoPorDia ?? 20)
  const gravaContratada       = calc.m3Grava
  const camionadasContratadas = camionadasGrava(calc.m3Grava, 12)

  // Consumos acumulados desde bitácora
  let piesConsumidos = 0, bentonitaConsumida = 0, pipasConsumidas = 0
  for (const e of proyecto.entradas) {
    piesConsumidos     = Math.max(piesConsumidos, e.perforacionTotal)  // último acumulado
    bentonitaConsumida += e.bentonitaSacos
    pipasConsumidas    += e.pipas
  }

  // Precios de referencia (para cálculo de exceso)
  const costoBentonitaSaco    = ip.precioBentonitaSaco ?? 303
  const costoPipa             = 500
  const precioVentaPipa       = 700
  const costoPie              = ip.costoDieselDia ? (ip.costoDieselDia / (ip.rendimientoPorDia ?? 20)) : 115  // diesel/pie aprox
  const precioVentaPie        = ip.precioPorPieVenta

  // Reserva disponible (30% split bentonita)
  const reservaBentonita = await prisma.inventarioReserva.findFirst({
    where: { proyectoId: id, producto: 'bentonita', estado: { in: ['reservado', 'disponible'] } },
  })
  const reservaDisponible = reservaBentonita?.cantidadActual ?? 0

  // ── Construir alertas ──
  const alertas: Alerta[] = []

  function evaluar(
    producto: Alerta['producto'],
    unidad: string,
    contratado: number,
    consumido: number,
    costoUnit: number,
    ventaUnit: number,
    reserva?: number,
  ): Alerta {
    const pct = contratado > 0 ? (consumido / contratado) * 100 : 0
    const excedente = Math.max(0, consumido - contratado)
    const costoExtra = Math.round(excedente * costoUnit)
    const ventaExtra = Math.round(excedente * ventaUnit)
    const formatQ = (value: number) => `Q${value.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    let nivel: Alerta['nivel']
    let mensaje: string
    if (pct >= 100) {
      nivel = 'exceso'
      mensaje = `Excediste el ${producto} contratado por ${excedente.toFixed(1)} ${unidad}. Costo extra ${formatQ(costoExtra)} · cobrable al cliente ${formatQ(ventaExtra)}.`
      if (reserva !== undefined && reserva > 0) {
        mensaje += ` Tienes ${reserva.toFixed(0)} ${unidad} en reserva (30%).`
      }
    } else if (pct >= 90) {
      nivel = 'critico'
      mensaje = `${producto} al ${pct.toFixed(0)}% — quedan ${(contratado - consumido).toFixed(1)} ${unidad}. Alerta alta.`
    } else if (pct >= 80) {
      nivel = 'warning'
      mensaje = `${producto} al ${pct.toFixed(0)}% — quedan ${(contratado - consumido).toFixed(1)} ${unidad}.`
    } else {
      nivel = 'ok'
      mensaje = `${producto} al ${pct.toFixed(0)}% — consumo normal.`
    }
    const alerta: Alerta = {
      producto, unidad,
      contratado: Math.round(contratado), consumido: Math.round(consumido * 10) / 10,
      pct: Math.round(pct), nivel, mensaje, costoExtra, ventaExtra,
    }
    if (reserva !== undefined) alerta.reservaDisponible = Math.round(reserva)
    return alerta
  }

  alertas.push(evaluar('pies', 'pies', piesContratados, piesConsumidos, costoPie, precioVentaPie))
  alertas.push(evaluar('bentonita', 'sacos', bentonitaContratada, bentonitaConsumida, costoBentonitaSaco, costoBentonitaSaco * 1.77, reservaDisponible))
  alertas.push(evaluar('pipas', 'pipas', pipasContratadas, pipasConsumidas, costoPipa, precioVentaPipa))

  // Filtrar solo las que ameritan alerta (>= 80%)
  const alertasActivas = alertas.filter(a => a.nivel !== 'ok')

  return NextResponse.json({
    proyecto: { id: proyecto.id, correlativo: proyecto.correlativo, estado: proyecto.estado },
    contratado: {
      pies: piesContratados,
      bentonitaCliente: bentonitaContratada,
      bentonitaInterno,
      pipas: pipasContratadas,
      gravaM3: gravaContratada,
      camionadas: camionadasContratadas,
    },
    consumido: {
      pies: piesConsumidos,
      bentonita: Math.round(bentonitaConsumida),
      pipas: Math.round(pipasConsumidas),
    },
    alertas,
    alertasActivas,
    totalCostoExtra: alertasActivas.reduce((a, x) => a + x.costoExtra, 0),
    totalVentaExtra: alertasActivas.reduce((a, x) => a + x.ventaExtra, 0),
  })
}
