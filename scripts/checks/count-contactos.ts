import { config } from 'dotenv'
config()
import pg from 'pg'

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()
  const res = await client.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM "Contacto" WHERE "eliminadoEn" IS NULL`)
  console.log('Contactos activos:', res.rows[0].c)
  const sample = await client.query(`SELECT nombre, empresa FROM "Contacto" WHERE "eliminadoEn" IS NULL ORDER BY "createdAt" DESC LIMIT 10`)
  console.log('Últimos 10:')
  sample.rows.forEach(r => console.log('  ·', r.nombre, r.empresa ? '— ' + r.empresa : ''))
  await client.end()
}
main().catch(e => { console.error(e); process.exit(1) })
