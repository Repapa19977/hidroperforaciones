import { config } from 'dotenv'
config()
import pg from 'pg'

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  console.log('═══ COTIZACIONES POR VENDEDOR ═══')
  const rows = await client.query(`
    SELECT vendedor, COUNT(*)::int AS n, string_agg(DISTINCT estado, ', ') AS estados
    FROM "Cotizacion" WHERE "eliminadaEn" IS NULL
    GROUP BY vendedor ORDER BY n DESC
  `)
  rows.rows.forEach(r => console.log(`  [${r.vendedor || '(vacío)'}]: ${r.n} cot · estados: ${r.estados}`))

  console.log('\n═══ PROYECTOS POR VENDEDOR ═══')
  const p = await client.query(`
    SELECT vendedor, COUNT(*)::int AS n, string_agg(DISTINCT estado, ', ') AS estados
    FROM "Proyecto" WHERE "eliminadoEn" IS NULL
    GROUP BY vendedor ORDER BY n DESC
  `)
  p.rows.forEach(r => console.log(`  [${r.vendedor || '(vacío)'}]: ${r.n} proy · estados: ${r.estados}`))

  console.log('\n═══ USUARIOS ACTIVOS (campo "nombre") ═══')
  const u = await client.query(`
    SELECT username, nombre, rol FROM "Usuario" WHERE activo = true
  `)
  u.rows.forEach(x => console.log(`  [${x.rol}] username="${x.username}" · nombre="${x.nombre}"`))

  await client.end()
}
main().catch(e => { console.error(e); process.exit(1) })
