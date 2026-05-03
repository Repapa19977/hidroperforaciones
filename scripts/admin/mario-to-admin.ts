import { config } from 'dotenv'
config()
import pg from 'pg'

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  const before = await client.query(
    `SELECT id, email, nombre, rol FROM "Usuario" WHERE nombre ILIKE '%mario%' OR email ILIKE '%mario%'`
  )
  console.log('MARIO ANTES:')
  before.rows.forEach(r => console.log('  [' + r.rol + '] ' + r.email + ' — ' + r.nombre + ' (id=' + r.id + ')'))

  if (before.rows.length === 0) {
    console.log('No se encontró Mario. Abortando.')
    await client.end()
    return
  }
  if (before.rows.length > 1) {
    console.log('Más de un Mario. Abortando para evitar cambios ambiguos.')
    await client.end()
    return
  }

  const r = await client.query(
    `UPDATE "Usuario" SET rol = 'admin' WHERE id = $1 RETURNING id, email, nombre, rol`,
    [before.rows[0].id]
  )
  console.log('\nMARIO DESPUÉS:')
  r.rows.forEach(u => console.log('  [' + u.rol + '] ' + u.email + ' — ' + u.nombre))

  await client.end()
}

main().catch(e => { console.error(e); process.exit(1) })
