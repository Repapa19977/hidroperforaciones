import { config } from 'dotenv'
config()
import pg from 'pg'

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  console.log('ADMINS ACTUALES:')
  const before = await client.query(
    `SELECT id, email, nombre, rol, activo FROM "Usuario" WHERE rol = 'admin' ORDER BY nombre`
  )
  before.rows.forEach(r => console.log('  [' + r.rol + (r.activo ? '' : ' INACTIVO') + '] ' + (r.email || '(sin email)') + ' — ' + r.nombre + ' (id=' + r.id + ')'))

  const marioRow = before.rows.find(r => /mario/i.test(r.nombre))
  if (!marioRow) {
    console.log('\n❌ Mario no está como admin. Abortando.')
    await client.end()
    return
  }

  const aDesactivar = before.rows.filter(r => r.id !== marioRow.id && r.activo)
  if (aDesactivar.length === 0) {
    console.log('\n✅ Mario ya es el único admin activo.')
    await client.end()
    return
  }

  console.log('\nDESACTIVANDO (' + aDesactivar.length + '):')
  for (const u of aDesactivar) {
    await client.query(`UPDATE "Usuario" SET activo = false WHERE id = $1`, [u.id])
    console.log('  ✓ ' + u.nombre + ' (id=' + u.id + ') → activo=false')
  }

  const after = await client.query(
    `SELECT id, email, nombre, rol, activo FROM "Usuario" WHERE rol = 'admin' ORDER BY activo DESC, nombre`
  )
  console.log('\nADMINS DESPUÉS:')
  after.rows.forEach(r => console.log('  [' + (r.activo ? 'ACTIVO' : 'INACTIVO') + '] ' + (r.email || '(sin email)') + ' — ' + r.nombre))

  await client.end()
}

main().catch(e => { console.error(e); process.exit(1) })
