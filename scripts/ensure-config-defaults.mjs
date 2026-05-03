// Asegura que el Config en la DB tenga todos los defaults nuevos (no pisa valores existentes).
// Uso: DATABASE_URL="..." node scripts/ensure-config-defaults.mjs
import { execSync } from 'child_process'

const DB = process.env.DATABASE_URL
if (!DB) { console.error('Falta DATABASE_URL'); process.exit(1) }

const raw = execSync(`psql "${DB}" -A -t -c "SELECT datos FROM \\"Config\\" WHERE id='singleton'"`, { encoding: 'utf8' }).trim()
const d = JSON.parse(raw)

const defaults = {
  horasTurnoDefault: 10,
  piesMinimoTurno: 20,
  valorHoraAdversa: 500,
  pipaCostoUnitario: 500,
  pipaPrecioVentaUnitario: 700,
  capacidadCamionM3: 12,
  camionadaGravaCostoUnitario: 5000,
  camionadaGravaPrecioVentaUnitario: 6000,
  markupQuimicosLimpieza: 1.5,
  bonificacionPorPie: 15,
}

let changed = 0
for (const [k, v] of Object.entries(defaults)) {
  if (d[k] === undefined) { d[k] = v; changed++ }
}

if (changed === 0) {
  console.log('No hay defaults que agregar. Config al día.')
  process.exit(0)
}

// Guardar via env var para no escapear
const newJson = JSON.stringify(d)
process.env.NEW_CONFIG = newJson
execSync(`psql "${DB}" -c "UPDATE \\"Config\\" SET datos = \\$\\$$NEW_CONFIG\\$\\$ WHERE id='singleton'"`, { stdio: 'inherit', env: process.env })
console.log(`Actualizado: ${changed} campos agregados.`)
