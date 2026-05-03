// Backup de las tablas transaccionales antes de limpiar para producción.
// Exporta a un solo archivo JSON con timestamp, ubicación: /root/backup-data-<stamp>.json
// Uso: DATABASE_URL=... node scripts/tools/backup-data-before-wipe.mjs
import { execSync } from 'child_process'
import fs from 'fs'

const DB = process.env.DATABASE_URL
if (!DB) { console.error('Falta DATABASE_URL'); process.exit(1) }

function q(sql) {
  const out = execSync(`psql "${DB}" -A -t -c ${JSON.stringify(sql)}`, { encoding: 'utf8' }).trim()
  return out
}

function qJson(table) {
  // Usa row_to_json(t) y agrega con ARRAY_AGG
  const sql = `SELECT COALESCE(json_agg(row_to_json(t)), '[]') FROM "${table}" t`
  const out = q(sql)
  try { return JSON.parse(out) } catch { return [] }
}

const tables = [
  'Contacto',
  'Cotizacion',
  'CotizacionHistorial',
  'Oportunidad',
  'OportunidadAI',
  'Proyecto',
  'BitacoraEntry',
  'Pago',
  'InventarioReserva',
  'MovimientoInventario',
  'GastoExtra',
]

const backup = { timestamp: new Date().toISOString(), tables: {} }
for (const t of tables) {
  const rows = qJson(t)
  backup.tables[t] = rows
  console.log(`  ${t}: ${rows.length} filas`)
}

// Usuarios cliente_final aparte
const clientes = JSON.parse(q(`SELECT COALESCE(json_agg(row_to_json(u)), '[]') FROM "Usuario" u WHERE rol = 'cliente_final'`))
backup.tables['Usuario_cliente_final'] = clientes
console.log(`  Usuario_cliente_final: ${clientes.length} filas`)

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const path = `/root/backup-data-${stamp}.json`
fs.writeFileSync(path, JSON.stringify(backup, null, 2))
console.log(`\nBackup guardado: ${path}`)
console.log(`Tamaño: ${(fs.statSync(path).size / 1024).toFixed(1)} KB`)
