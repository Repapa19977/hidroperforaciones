import { config } from 'dotenv'
config()
import pg from 'pg'

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  const grupos = await client.query<{ rol: string; count: string }>(
    `SELECT rol, COUNT(*)::text AS count FROM "Usuario" GROUP BY rol ORDER BY rol`
  )
  console.log('USUARIOS POR ROL:')
  grupos.rows.forEach(r => console.log('  ' + r.rol + ': ' + r.count))

  const total = await client.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM "Usuario"`)
  console.log('TOTAL: ' + total.rows[0].c)

  const detalle = await client.query<{ email: string; nombre: string; rol: string; activo: boolean }>(
    `SELECT email, nombre, rol, activo FROM "Usuario" ORDER BY rol ASC, email ASC`
  )
  console.log('\nDETALLE:')
  detalle.rows.forEach(u => console.log('  [' + u.rol + '] ' + u.email + ' — ' + u.nombre + (u.activo ? '' : ' (INACTIVO)')))

  await client.end()
}

main().catch(e => { console.error(e); process.exit(1) })
