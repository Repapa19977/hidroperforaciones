import { config } from 'dotenv'
config()
import pg from 'pg'

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  console.log('═══ CONTACTOS ACTIVOS POR VENDEDOR ═══\n')
  const rows = await client.query(`
    SELECT vendedor, COUNT(*)::int AS n
    FROM "Contacto" WHERE "eliminadoEn" IS NULL
    GROUP BY vendedor ORDER BY n DESC
  `)
  rows.rows.forEach(r => console.log(`  [${r.vendedor || '(vacío)'}]: ${r.n}`))

  console.log('\n═══ DETALLE ═══')
  const det = await client.query(`
    SELECT nombre, empresa, vendedor, "createdAt"
    FROM "Contacto" WHERE "eliminadoEn" IS NULL
    ORDER BY "createdAt" DESC
  `)
  det.rows.forEach(r => {
    const fecha = new Date(r.createdAt).toLocaleString('es-GT')
    console.log(`  · ${r.nombre}${r.empresa ? ' — ' + r.empresa : ''}  [vendedor=${r.vendedor || '(vacío)'}]  @${fecha}`)
  })

  console.log('\n═══ USUARIOS Y SU "vendedor" field ═══')
  const us = await client.query(`
    SELECT email, nombre, rol, activo
    FROM "Usuario" WHERE activo = true
    ORDER BY rol, nombre
  `)
  us.rows.forEach(u => console.log(`  [${u.rol}] ${u.email || '(sin email)'} — ${u.nombre}`))

  await client.end()
}
main().catch(e => { console.error(e); process.exit(1) })
