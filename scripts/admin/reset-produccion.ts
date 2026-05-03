// Script de limpieza pre-producción (2026-04-23).
// Borra TODA la data transaccional/operativa para arrancar desde 0 con datos reales.
// Preserva: Usuario, Config (tuberías/precios), ServiceToken, _prisma_migrations.
// Ejecutar UNA sola vez antes del go-live. Destructivo e irreversible.

import pg from 'pg'
import dotenv from 'dotenv'

// Orden de borrado respetando FKs: pagos antes de proyecto, cotizacion-historial antes de cotizacion, etc.
// Usamos DELETE (no TRUNCATE CASCADE) para ser explícitos y evitar efectos colaterales.
const TABLAS_EN_ORDEN: string[] = [
  // Hijos primero
  'Pago',
  'MovimientoInventario',
  'InventarioReserva',
  'GastoExtra',
  'BitacoraEntry',
  'OportunidadAI',
  'CotizacionHistorial',
  // Padres
  'Proyecto',
  'Oportunidad',
  'Cotizacion',
  'Contacto',
  // Independientes
  'MagicLink',
  'AuditLog',
  'CuentaPorPagar',
  'CuentaPorCobrar',
]

async function main() {
  dotenv.config()
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) throw new Error('Falta DATABASE_URL')

  const c = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  await c.connect()

  console.log('\n═══ RESET PRE-PRODUCCIÓN ═══')
  console.log(`Conectado a: ${dbUrl.split('@')[1]?.split('/')[0] ?? '???'}\n`)

  // Preview antes de borrar
  console.log('─── Filas que se borrarán ───')
  for (const t of TABLAS_EN_ORDEN) {
    const r = await c.query(`SELECT COUNT(*)::int AS n FROM "${t}"`)
    console.log(`  ${t.padEnd(24)} ${String(r.rows[0].n).padStart(4)}`)
  }

  // Preview de lo que se preserva
  console.log('\n─── Filas que se preservan ───')
  for (const t of ['Usuario', 'Config', 'ServiceToken']) {
    const r = await c.query(`SELECT COUNT(*)::int AS n FROM "${t}"`)
    console.log(`  ${t.padEnd(24)} ${String(r.rows[0].n).padStart(4)}`)
  }

  // Ejecutar en transacción
  console.log('\n─── Ejecutando DELETE (transacción) ───')
  try {
    await c.query('BEGIN')
    for (const t of TABLAS_EN_ORDEN) {
      const r = await c.query(`DELETE FROM "${t}"`)
      console.log(`  ✓ DELETE FROM "${t}"  (${r.rowCount} filas)`)
    }
    await c.query('COMMIT')
    console.log('\n✓ COMMIT exitoso')
  } catch (err) {
    await c.query('ROLLBACK')
    console.error('\n✗ ERROR — rollback aplicado:', (err as Error).message)
    throw err
  }

  // Verificar que todo quedó en 0
  console.log('\n─── Verificación post-delete ───')
  let todoLimpio = true
  for (const t of TABLAS_EN_ORDEN) {
    const r = await c.query(`SELECT COUNT(*)::int AS n FROM "${t}"`)
    const n = r.rows[0].n
    if (n !== 0) todoLimpio = false
    console.log(`  ${n === 0 ? '✓' : '✗'} ${t.padEnd(24)} ${n}`)
  }

  // Verificar preservadas
  console.log('\n─── Preservadas (deben mantener sus filas) ───')
  for (const t of ['Usuario', 'Config', 'ServiceToken', '_prisma_migrations']) {
    const r = await c.query(`SELECT COUNT(*)::int AS n FROM "${t}"`)
    console.log(`  ${r.rows[0].n > 0 ? '✓' : '✗'} ${t.padEnd(24)} ${r.rows[0].n}`)
  }

  await c.end()

  if (!todoLimpio) {
    console.log('\n⚠ ALGUNAS TABLAS AÚN TIENEN DATOS. Revisá.')
    process.exit(1)
  }
  console.log('\n═══ BD LIMPIA — listo para go-live ═══\n')
}

main().catch(e => { console.error(e); process.exit(1) })

export {}
