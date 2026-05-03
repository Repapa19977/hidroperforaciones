// Test end-to-end de comparativa:
// 1. Lee una cotización existente de la BD
// 2. Inyecta overrides de prueba
// 3. Corre buildLineasPerf con esos overrides
// 4. Verifica que:
//    - los overrides se reflejan en los rubros
//    - el rubro 3 (perforación) absorbe la diferencia
//    - el total al cliente queda fijo

import { config } from 'dotenv'
config()
import pg from 'pg'
import { buildLineasPerf } from '../../lib/pdf-cotizacion'
import { calcularPerforacion, IVA, ISR } from '../../lib/calculator'
import { DEFAULT_PRECIOS_LINEAS } from '../../lib/config-store'

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  // Tomar la última cotización de perforación
  const res = await client.query(`
    SELECT correlativo, datos
    FROM "Cotizacion"
    WHERE tipo = 'perforacion' AND "eliminadaEn" IS NULL AND datos IS NOT NULL
    ORDER BY "createdAt" DESC
    LIMIT 1
  `)
  if (res.rows.length === 0) {
    console.log('No hay cotizaciones perforación para testear.')
    await client.end()
    return
  }

  const cot = res.rows[0]
  const data = typeof cot.datos === 'string' ? JSON.parse(cot.datos) : cot.datos
  const ip = data.ip
  if (!ip) { console.log('Sin ip en la cotización'); await client.end(); return }

  const pl = { ...DEFAULT_PRECIOS_LINEAS, ...(data.preciosLineas || {}) }
  const resCalc = calcularPerforacion(ip)
  const opc = {
    pipaPrecioVentaUnitario: data.pipaPrecioVentaUnitario ?? 700,
    camionadaGravaPrecioVentaUnitario: data.camionadaGravaPrecioVentaUnitario ?? 6000,
    capacidadCamionM3: data.capacidadCamionM3 ?? 12,
  }

  console.log('═══ COTIZACIÓN:', cot.correlativo, '═══')
  console.log('Profundidad:', ip.profundidad, 'pies')
  console.log('Precio/pie venta:', ip.precioPorPieVenta)
  console.log('Total pactado (con IVA+ISR):', ip.profundidad * ip.precioPorPieVenta)

  // ── Caso A: SIN overrides ─────────────────────────────────────
  const lineasSin = buildLineasPerf(ip, resCalc, pl, false, false, {}, opc)
  const totalSin = lineasSin.reduce((a, l) => a + l.total, 0)
  const perfSin = lineasSin.find(l => l.key === 'perforacion')
  console.log('\n── SIN overrides ──')
  console.log('Subtotal de líneas:', Math.round(totalSin))
  console.log('Rubro 3 (perforación): Q', perfSin?.total.toFixed(2), '· precio/pie:', perfSin?.precio)

  // ── Caso B: CON overrides (subir 5 rubros) ────────────────────
  const overrides = {
    'registro-electrico': 8000,
    'brocal':              900,
    'sopleteado':          900,
    'sello-sanitario':    1500,
    'instalacion-grava':    40,
  }
  const lineasCon = buildLineasPerf(ip, resCalc, pl, false, false, overrides, opc)
  const totalCon = lineasCon.reduce((a, l) => a + l.total, 0)
  const perfCon = lineasCon.find(l => l.key === 'perforacion')
  console.log('\n── CON overrides ──')
  console.log('Subtotal de líneas:', Math.round(totalCon))
  console.log('Rubro 3 (perforación): Q', perfCon?.total.toFixed(2), '· precio/pie:', perfCon?.precio)

  // ── Verificaciones ────────────────────────────────────────────
  console.log('\n═══ VERIFICACIONES ═══')

  // 1. Los rubros con override deben tener el precio/u nuevo
  for (const [key, valor] of Object.entries(overrides)) {
    const linea = lineasCon.find(l => l.key === key)
    if (!linea) { console.log(`  ⚠ Rubro "${key}" NO aparece (toggle off?)`); continue }
    const ok = linea.precio === valor
    console.log(`  ${ok ? '✓' : '✗'} Rubro "${key}": precio/u = ${linea.precio} (esperado ${valor})`)
  }

  // 2. El subtotal total NO debe cambiar (rubro 3 absorbe)
  const diffSubtotal = Math.abs(totalSin - totalCon)
  const okSubtotal = diffSubtotal < 2  // tolerancia por redondeo
  console.log(`  ${okSubtotal ? '✓' : '✗'} Subtotal estable: sin=Q${Math.round(totalSin)} vs con=Q${Math.round(totalCon)} (diff Q${diffSubtotal.toFixed(2)})`)

  // 3. El total del cliente (con IVA+ISR) debe ser igual a profundidad × precioPorPieVenta
  const totalObjetivo = ip.profundidad * ip.precioPorPieVenta
  const totalCalculado = totalCon * (1 + IVA + ISR)
  const diffTotal = Math.abs(totalObjetivo - totalCalculado)
  const okTotal = diffTotal < 5
  console.log(`  ${okTotal ? '✓' : '✗'} Total pactado: objetivo=Q${totalObjetivo} vs calculado=Q${Math.round(totalCalculado)} (diff Q${diffTotal.toFixed(2)})`)

  // 4. El rubro 3 se ajusta en sentido inverso a los overrides
  const deltaPerf = (perfCon?.total ?? 0) - (perfSin?.total ?? 0)
  console.log(`  · Rubro 3 ajustado: ${deltaPerf > 0 ? '+' : ''}Q${deltaPerf.toFixed(2)} (absorbe la diferencia)`)

  await client.end()
}

main().catch(e => { console.error(e); process.exit(1) })
