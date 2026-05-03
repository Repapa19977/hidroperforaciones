import { config } from 'dotenv'
config()
import pg from 'pg'

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()
  await client.query(`UPDATE "Usuario" SET rol = 'admin' WHERE username = 'mario'`)
  const r = await client.query(`SELECT username, nombre, rol FROM "Usuario" WHERE username = 'mario'`)
  console.log('Mario:', r.rows[0])
  await client.end()
}
main().catch(e => { console.error(e); process.exit(1) })
