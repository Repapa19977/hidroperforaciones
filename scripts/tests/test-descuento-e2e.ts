// E2E descuento especial — verifica persistencia en BD + que el JS bundle tenga el botón.

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

  // T1 — Fetch /cotizaciones/nueva HTML → extraer JS chunks → verificar que contienen "Descuento"
  console.log('═══ T1: Verificar que el JS bundle tiene el botón Descuento ═══')
  {
    const r = await fetch(`${BASE}/cotizaciones/nueva`, { headers: { Cookie: cookie } })
    t(ok('HTML carga OK', r.ok, `(${r.status})`))
    const html = await r.text()
    // Extraer refs a chunks /_next/static/chunks/*.js
    const chunks = [...html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map(m => m[0])
    console.log(`  → ${chunks.length} JS chunks referenciados`)

    let encontrado = false
    for (const c of chunks) {
      const js = await fetch(`${BASE}${c}`).then(r => r.text()).catch(() => '')
      if (js.includes('aplicarDescuento') || js.includes('setAplicarDescuento')) {
        encontrado = true
        console.log(`  → 'aplicarDescuento' encontrado en ${c}`)
        break
      }
    }
    t(ok('JS bundle contiene aplicarDescuento', encontrado))
  }

  // T2 — Crear cotización con descuento, verificar persistencia
  console.log('\n═══ T2: Persistencia en BD (POST + re-fetch) ═══')
  const correlativo = `TEST_DESC_${Date.now()}`
  const pg = (await import('pg')).default
  const dotenv = (await import('dotenv')).default
  dotenv.config()
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await client.connect()

  try {
    {
      const r = await fetch(`${BASE}/api/cotizaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({
          correlativo, cliente: 'Test Descuento', empresa: '', proyecto: 'T', tipo: 'perforacion',
          estado: 'borrador', monto: 10000, fecha: '2026-04-22', vendedor: 'Rodrigo Porres',
          datos: {
            cliente: 'Test Descuento', correlativo, proyecto: 'T', tipo: 'perforacion',
            aplicarDescuento: true,
            descuentoMonto: 1500,
          },
        }),
      })
      t(ok('POST OK', r.ok, `(${r.status})`))

      const row = await client.query(`SELECT datos FROM "Cotizacion" WHERE correlativo = $1`, [correlativo])
      const d = JSON.parse(row.rows[0].datos)
      t(ok('aplicarDescuento=true persisti\u00f3', d.aplicarDescuento === true))
      t(ok('descuentoMonto=1500 persisti\u00f3', d.descuentoMonto === 1500))
    }

    // T3 — Actualizar con descuento OFF
    console.log('\n═══ T3: Desactivar descuento ═══')
    {
      const r = await fetch(`${BASE}/api/cotizaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({
          correlativo, cliente: 'Test Descuento', empresa: '', proyecto: 'T', tipo: 'perforacion',
          estado: 'borrador', monto: 10000, fecha: '2026-04-22', vendedor: 'Rodrigo Porres',
          datos: {
            cliente: 'Test Descuento', correlativo, proyecto: 'T', tipo: 'perforacion',
            aplicarDescuento: false,
            descuentoMonto: 0,
          },
        }),
      })
      t(ok('POST re-save OK', r.ok, `(${r.status})`))

      const row = await client.query(`SELECT datos FROM "Cotizacion" WHERE correlativo = $1`, [correlativo])
      const d = JSON.parse(row.rows[0].datos)
      t(ok('aplicarDescuento=false persisti\u00f3', d.aplicarDescuento === false))
      t(ok('descuentoMonto=0 persisti\u00f3', d.descuentoMonto === 0))
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
