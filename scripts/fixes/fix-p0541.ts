import { config } from 'dotenv'
config()
import pg from 'pg'

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  const before = await client.query(`SELECT correlativo, cliente, estado FROM "Cotizacion" WHERE correlativo = 'P0541'`)
  console.log('ANTES:', before.rows[0])

  await client.query(`UPDATE "Cotizacion" SET estado = 'confirmada' WHERE correlativo = 'P0541'`)

  const after = await client.query(`SELECT correlativo, cliente, estado FROM "Cotizacion" WHERE correlativo = 'P0541'`)
  console.log('DESPUÉS:', after.rows[0])

  console.log('\nVerificación conteos:')
  const c = await client.query(`SELECT estado, COUNT(*)::int AS n FROM "Cotizacion" WHERE "eliminadaEn" IS NULL GROUP BY estado`)
  c.rows.forEach(r => console.log(`  cotizaciones ${r.estado}: ${r.n}`))
  const p = await client.query(`SELECT estado, COUNT(*)::int AS n FROM "Proyecto" WHERE "eliminadoEn" IS NULL GROUP BY estado`)
  p.rows.forEach(r => console.log(`  proyectos ${r.estado}: ${r.n}`))

  await client.end()
}
main().catch(e => { console.error(e); process.exit(1) })
