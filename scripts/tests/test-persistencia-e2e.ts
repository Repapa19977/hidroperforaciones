// Test de persistencia end-to-end:
// 1. Lee una cotización existente
// 2. Le inyecta overrides de venta y costo en el JSON
// 3. La vuelve a escribir en BD
// 4. La lee de vuelta
// 5. Verifica que los overrides están intactos en el JSON persistido

import { config } from 'dotenv'
config()
import pg from 'pg'

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  const correlativo = 'P0540'  // cotización de prueba (la más reciente)

  // Paso 1: leer estado inicial
  const r0 = await client.query<{ datos: string }>(
    `SELECT datos FROM "Cotizacion" WHERE correlativo = $1`,
    [correlativo]
  )
  if (r0.rows.length === 0) { console.log('No existe', correlativo); await client.end(); return }
  const datos0 = JSON.parse(r0.rows[0].datos)
  console.log('═══ ANTES ═══')
  console.log('  preciosVentaOverride:', JSON.stringify(datos0.preciosVentaOverride ?? {}))
  console.log('  comparativaCostosOv:  ', JSON.stringify(datos0.comparativaCostosOv ?? {}))

  // Paso 2: inyectar overrides
  const overridesVenta = {
    ...(datos0.preciosVentaOverride ?? {}),
    '__test-persistencia__': 12345,  // marker temporal
  }
  const overridesCosto = {
    ...(datos0.comparativaCostosOv ?? {}),
    '__test-persistencia__': 9999,
  }
  const nuevoDatos = {
    ...datos0,
    preciosVentaOverride: overridesVenta,
    comparativaCostosOv: overridesCosto,
  }
  await client.query(
    `UPDATE "Cotizacion" SET datos = $1 WHERE correlativo = $2`,
    [JSON.stringify(nuevoDatos), correlativo]
  )
  console.log('\n═══ ESCRITO ═══')
  console.log('  Marker inyectado en ambos overrides: __test-persistencia__')

  // Paso 3: leer de vuelta (fresh)
  const r1 = await client.query<{ datos: string }>(
    `SELECT datos FROM "Cotizacion" WHERE correlativo = $1`,
    [correlativo]
  )
  const datos1 = JSON.parse(r1.rows[0].datos)
  console.log('\n═══ DESPUÉS DE RELEER ═══')
  console.log('  preciosVentaOverride:', JSON.stringify(datos1.preciosVentaOverride ?? {}))
  console.log('  comparativaCostosOv:  ', JSON.stringify(datos1.comparativaCostosOv ?? {}))

  // Paso 4: verificar
  console.log('\n═══ VERIFICACIONES ═══')
  const okVenta = datos1.preciosVentaOverride?.['__test-persistencia__'] === 12345
  const okCosto = datos1.comparativaCostosOv?.['__test-persistencia__'] === 9999
  console.log(`  ${okVenta ? '✓' : '✗'} preciosVentaOverride persiste (esperado 12345, got ${datos1.preciosVentaOverride?.['__test-persistencia__']})`)
  console.log(`  ${okCosto ? '✓' : '✗'} comparativaCostosOv persiste (esperado 9999, got ${datos1.comparativaCostosOv?.['__test-persistencia__']})`)

  // Paso 5: cleanup — quitar el marker
  delete datos1.preciosVentaOverride['__test-persistencia__']
  delete datos1.comparativaCostosOv['__test-persistencia__']
  await client.query(
    `UPDATE "Cotizacion" SET datos = $1 WHERE correlativo = $2`,
    [JSON.stringify(datos1), correlativo]
  )
  console.log('\n═══ CLEANUP ═══')
  console.log('  Marker temporal removido. Cotización restaurada al estado original.')

  await client.end()

  if (okVenta && okCosto) {
    console.log('\n🟢 PERSISTENCIA OK — los overrides se guardan y se leen correctamente.')
  } else {
    console.log('\n🔴 FALLO en persistencia.')
    process.exit(1)
  }
}
main().catch(e => { console.error(e); process.exit(1) })
