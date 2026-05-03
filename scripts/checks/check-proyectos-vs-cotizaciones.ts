import { config } from 'dotenv'
config()
import pg from 'pg'

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  console.log('═══ PROYECTOS ACTIVOS ═══')
  const p = await client.query(`
    SELECT correlativo, cliente, empresa, estado, vendedor, "cotizacionId", "createdAt"
    FROM "Proyecto" WHERE "eliminadoEn" IS NULL
    ORDER BY "createdAt" DESC
  `)
  for (const r of p.rows) {
    console.log(`\n  Proyecto ${r.correlativo}: ${r.cliente} — ${r.empresa}`)
    console.log(`    estado=${r.estado} · vendedor=${r.vendedor} · created=${r.createdAt}`)
    // Buscar la cotización asociada
    const c = await client.query(
      `SELECT correlativo, estado, vendedor FROM "Cotizacion" WHERE correlativo = $1`,
      [r.correlativo]
    )
    if (c.rows.length > 0) {
      console.log(`    → Cotización asociada: ${c.rows[0].correlativo} · estado=${c.rows[0].estado} · vendedor=${c.rows[0].vendedor}`)
      if (c.rows[0].estado !== 'confirmada') {
        console.log(`    ⚠ INCONSISTENCIA: hay proyecto activo pero cotización NO está confirmada`)
      }
    } else {
      console.log(`    ⚠ INCONSISTENCIA: no se encontró cotización con ese correlativo`)
    }
  }

  console.log('\n═══ CONTEO ═══')
  const cot = await client.query(`SELECT estado, COUNT(*)::int AS n FROM "Cotizacion" WHERE "eliminadaEn" IS NULL GROUP BY estado`)
  console.log('Cotizaciones por estado:')
  cot.rows.forEach(r => console.log(`  ${r.estado}: ${r.n}`))

  const proy = await client.query(`SELECT estado, COUNT(*)::int AS n FROM "Proyecto" WHERE "eliminadoEn" IS NULL GROUP BY estado`)
  console.log('Proyectos por estado:')
  proy.rows.forEach(r => console.log(`  ${r.estado}: ${r.n}`))

  await client.end()
}
main().catch(e => { console.error(e); process.exit(1) })
