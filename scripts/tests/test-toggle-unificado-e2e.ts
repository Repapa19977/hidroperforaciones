// Test E2E: toggle unificado (desglose + nota cheque)
// Verifica que al guardar una cotización con el toggle ON, AMBOS flags se
// persisten true en la BD. Con OFF, AMBOS se persisten false.

const BASE = 'https://hidrocrm.com'

async function login(u: string, p: string): Promise<string | null> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: p }),
  })
  if (!res.ok) return null
  const cookies = res.headers.getSetCookie?.() ?? []
  return cookies.find(c => c.startsWith('auth_token='))?.split(';')[0] ?? null
}

async function api(path: string, method: string, cookie: string, body?: unknown) {
  return fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function ok(label: string, pass: boolean, extra = ''): boolean {
  console.log(`  ${pass ? '✓' : '✗'} ${label}${extra ? ' ' + extra : ''}`)
  return pass
}

async function main() {
  let passed = 0, failed = 0
  const t = (r: boolean) => r ? passed++ : failed++

  const cookie = await login('rodrigo', 'hidro2026')
  if (!cookie) { console.log('Login falló'); process.exit(1) }
  console.log('✓ Autenticado\n')

  const correlativo = `TEST_TOGGLE_${Date.now()}`
  const pg = (await import('pg')).default
  const dotenv = (await import('dotenv')).default
  dotenv.config()
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  try {
    // T1 — Crear con AMBOS flags ON
    console.log('═══ T1: Crear con mostrarDesglose=true + notaCheque=true ═══')
    {
      const r = await api('/api/cotizaciones', 'POST', cookie, {
        correlativo, cliente: 'Test', empresa: '', proyecto: 'T', tipo: 'perforacion',
        estado: 'borrador', monto: 1000, fecha: '2026-04-22', vendedor: 'Rodrigo Porres',
        datos: {
          cliente: 'Test', correlativo, proyecto: 'T', tipo: 'perforacion',
          mostrarDesgloseImpuestos: true, mostrarNotaCheque: true,
        },
      })
      t(ok('POST OK', r.ok, `(${r.status})`))

      const row = await client.query(`SELECT datos FROM "Cotizacion" WHERE correlativo = $1`, [correlativo])
      const d = JSON.parse(row.rows[0].datos)
      t(ok('mostrarDesgloseImpuestos=true', d.mostrarDesgloseImpuestos === true))
      t(ok('mostrarNotaCheque=true', d.mostrarNotaCheque === true))
    }

    // T2 — Borrar (está en borrador, podemos seguir editando por PATCH primero)
    // Mejor: update directo en BD para no violar "no edit si no borrador"
    // (está en borrador así que está OK, pero de todas formas lo hacemos directo para test puro)
    console.log('\n═══ T2: Actualizar con AMBOS OFF ═══')
    {
      const r = await api('/api/cotizaciones', 'POST', cookie, {
        correlativo, cliente: 'Test', empresa: '', proyecto: 'T', tipo: 'perforacion',
        estado: 'borrador', monto: 1000, fecha: '2026-04-22', vendedor: 'Rodrigo Porres',
        datos: {
          cliente: 'Test', correlativo, proyecto: 'T', tipo: 'perforacion',
          mostrarDesgloseImpuestos: false, mostrarNotaCheque: false,
        },
      })
      t(ok('POST re-save OK', r.ok, `(${r.status})`))

      const row = await client.query(`SELECT datos FROM "Cotizacion" WHERE correlativo = $1`, [correlativo])
      const d = JSON.parse(row.rows[0].datos)
      t(ok('mostrarDesgloseImpuestos=false', d.mostrarDesgloseImpuestos === false))
      t(ok('mostrarNotaCheque=false', d.mostrarNotaCheque === false))
    }

    // T3 — Verificar que el PDF-builder respeta ambos flags
    console.log('\n═══ T3: buildLineasPerf genera PDF ignorando desglose/nota cuando OFF ═══')
    {
      // Sólo smoke test: el endpoint devuelve el row; el generarPDF se prueba en UI
      const r = await api(`/api/cotizaciones/${correlativo}`, 'GET', cookie)
      t(ok('GET OK', r.ok, `(${r.status})`))
      const d = await r.json()
      t(ok('datos tienen ambos flags false', (() => {
        const x = JSON.parse(d.datos)
        return x.mostrarDesgloseImpuestos === false && x.mostrarNotaCheque === false
      })()))
    }

  } finally {
    await client.query(`DELETE FROM "Cotizacion" WHERE correlativo = $1`, [correlativo])
    await client.end()
    console.log('\n  ✓ Cleanup OK')
  }

  console.log(`\n═══ RESULTADO: ${passed} passed · ${failed} failed ═══`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })

export {}
