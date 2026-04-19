// Genera los 2 tokens de Hidra (copiloto + cliente) en la DB usando pg directo.
// Uso: DATABASE_URL=... node scripts/gen-tokens-hidra.mjs

import pg from 'pg'
import { createHash, randomBytes } from 'crypto'

const { Client } = pg
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()

function cuid() {
  return 'c' + Date.now().toString(36) + randomBytes(6).toString('hex')
}

async function crearToken(nombre, scopes, notas) {
  const raw = 'hcrm_' + randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(raw).digest('hex')
  const existing = await client.query('SELECT id FROM "ServiceToken" WHERE nombre = $1', [nombre])
  if (existing.rows.length > 0) {
    await client.query(
      `UPDATE "ServiceToken"
       SET "tokenHash" = $1, scopes = $2, notas = $3, activo = true, "creadoPor" = 'script', "ultimoUso" = NULL, "vecesUsado" = 0
       WHERE nombre = $4`,
      [tokenHash, JSON.stringify(scopes), notas, nombre],
    )
    return { nombre, raw, regenerado: true }
  }
  await client.query(
    `INSERT INTO "ServiceToken" (id, nombre, "tokenHash", scopes, activo, "vecesUsado", "creadoPor", notas)
     VALUES ($1, $2, $3, $4, true, 0, 'script', $5)`,
    [cuid(), nombre, tokenHash, JSON.stringify(scopes), notas],
  )
  return { nombre, raw, regenerado: false }
}

const copiloto = await crearToken(
  'hidra-copiloto',
  ['bot:read', 'bot:calc', 'bot:write', 'bot:followup'],
  'Hidra en OpenClaw · asesor copiloto en oportunidades',
)
const cliente = await crearToken(
  'hidra-cliente',
  ['cliente:read', 'cliente:solicitud'],
  'Hidra en portal cliente · consultas read-only',
)

console.log('')
console.log('=================================================================')
console.log('  TOKENS DE HIDRA — copialos ahora, no se ven otra vez')
console.log('=================================================================')
console.log('')
console.log('  HIDRA-COPILOTO (asesor interno · oportunidades):')
console.log('  ' + copiloto.raw)
console.log('  Scopes: bot:read, bot:calc, bot:write, bot:followup')
console.log('  ' + (copiloto.regenerado ? '[regenerado — el viejo quedó invalidado]' : '[creado]'))
console.log('')
console.log('  HIDRA-CLIENTE (portal cliente · consultas):')
console.log('  ' + cliente.raw)
console.log('  Scopes: cliente:read, cliente:solicitud')
console.log('  ' + (cliente.regenerado ? '[regenerado — el viejo quedó invalidado]' : '[creado]'))
console.log('')
console.log('=================================================================')
console.log('  En OpenClaw configurar:')
console.log('    Header:   Authorization: Bearer <token>')
console.log('    Base URL: https://hidrocrm.com/api/bot/*')
console.log('              (endpoints se exponen en Fase D)')
console.log('=================================================================')

await client.end()
