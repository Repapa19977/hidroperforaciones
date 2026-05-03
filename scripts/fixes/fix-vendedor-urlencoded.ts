import { config } from 'dotenv'
config()
import pg from 'pg'

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  const tablas = ['Contacto', 'Cotizacion', 'Oportunidad', 'Proyecto']
  let total = 0

  for (const tabla of tablas) {
    console.log(`\n── Tabla "${tabla}" ──`)
    const rows = await client.query<{ id: string; vendedor: string }>(
      `SELECT id, vendedor FROM "${tabla}" WHERE vendedor LIKE '%\\%%' ESCAPE '\\'`
    )
    if (rows.rows.length === 0) {
      console.log('  sin filas URL-encoded')
      continue
    }
    console.log(`  ${rows.rows.length} filas con vendedor URL-encoded:`)
    for (const r of rows.rows) {
      let decoded: string
      try { decoded = decodeURIComponent(r.vendedor) } catch { decoded = r.vendedor }
      if (decoded === r.vendedor) continue
      await client.query(`UPDATE "${tabla}" SET vendedor = $1 WHERE id = $2`, [decoded, r.id])
      console.log(`    ✓ "${r.vendedor}" → "${decoded}" (id=${r.id})`)
      total++
    }
  }

  console.log(`\nTOTAL ARREGLADO: ${total}`)
  await client.end()
}
main().catch(e => { console.error(e); process.exit(1) })
