import pg from 'pg'
import dotenv from 'dotenv'

async function main() {
  dotenv.config()
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()
  const tablas: Array<[string, boolean]> = [
    ['Cotizacion', true], ['CotizacionHistorial', true], ['Contacto', true],
    ['Proyecto', true], ['BitacoraEntry', true], ['InventarioReserva', true],
    ['MovimientoInventario', true], ['GastoExtra', true], ['Pago', true],
    ['Oportunidad', true], ['OportunidadAI', true], ['MagicLink', true],
    ['AuditLog', true], ['CuentaPorPagar', true], ['CuentaPorCobrar', true],
    ['Usuario', false], ['Config', false], ['ServiceToken', false], ['_prisma_migrations', false],
  ]
  console.log('\n─── Estado actual de la BD ───\n')
  for (const [t, borrar] of tablas) {
    const r = await c.query(`SELECT COUNT(*)::int AS n FROM "${t}"`)
    const emoji = borrar ? '🗑️ ' : '✓  '
    const accion = borrar ? 'BORRAR   ' : 'PRESERVAR'
    console.log(`  ${emoji} ${accion}  ${t.padEnd(24)} ${String(r.rows[0].n).padStart(4)} filas`)
  }
  await c.end()
}

main().catch(e => { console.error(e); process.exit(1) })

export {}
