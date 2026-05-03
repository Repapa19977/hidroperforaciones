// Prueba final con datos reales de P0540:
// muestra qué se ve en el preview antes y después del fix del override universal

import { config } from 'dotenv'
config()
import pg from 'pg'
import { buildLineasPerf } from '../../lib/pdf-cotizacion'
import { calcularPerforacion } from '../../lib/calculator'
import { DEFAULT_PRECIOS_LINEAS } from '../../lib/config-store'

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  const r = await client.query<{ datos: string }>(`SELECT datos FROM "Cotizacion" WHERE correlativo = 'P0540'`)
  const data = JSON.parse(r.rows[0].datos)
  await client.end()

  const ip = data.ip
  const pl = { ...DEFAULT_PRECIOS_LINEAS, ...(data.preciosLineas || {}) }
  const resCalc = calcularPerforacion(ip)
  const opc = {
    pipaPrecioVentaUnitario: data.pipaPrecioVentaUnitario ?? 700,
    camionadaGravaPrecioVentaUnitario: data.camionadaGravaPrecioVentaUnitario ?? 6000,
    capacidadCamionM3: data.capacidadCamionM3 ?? 12,
  }

  const overrides = data.preciosVentaOverride ?? {}
  console.log('═══ P0540 · Overrides guardados ═══')
  console.log(JSON.stringify(overrides, null, 2))

  const lineas = buildLineasPerf(ip, resCalc, pl, false, false, overrides, opc)

  console.log('\n═══ LÍNEAS QUE SE VAN A MOSTRAR EN EL PREVIEW/PDF ═══')
  console.log('Key'.padEnd(25), 'Cant'.padStart(6), 'Precio/u'.padStart(10), 'Total'.padStart(12), 'Override?')
  console.log('─'.repeat(75))
  for (const l of lineas) {
    const hasOverride = overrides[l.key] !== undefined
    const marker = hasOverride ? '← OVERRIDE APLICADO' : ''
    console.log(
      l.key.padEnd(25),
      String(l.cant).padStart(6),
      String(l.precio).padStart(10),
      String(Math.round(l.total)).padStart(12),
      marker
    )
  }

  const total = lineas.reduce((a, l) => a + l.total, 0)
  console.log('─'.repeat(75))
  console.log('SUBTOTAL'.padEnd(43), String(Math.round(total)).padStart(12))
  console.log('TOTAL C/IVA+ISR'.padEnd(43), String(Math.round(total * 1.17)).padStart(12))
  console.log('TOTAL PACTADO'.padEnd(43), String(ip.profundidad * ip.precioPorPieVenta).padStart(12))
}
main().catch(e => { console.error(e); process.exit(1) })
