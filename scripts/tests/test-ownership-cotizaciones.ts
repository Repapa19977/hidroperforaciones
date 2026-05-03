// Test E2E: ownership de cotizaciones
// Valida que:
//  · Admin (Mario) al crear cotización → vendedor se fuerza a Mario aunque mande otro
//  · Admin NO puede reasignar vendedor (PATCH → 403)
//  · Superadmin SÍ puede crear con cualquier vendedor y reasignar

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

  // Login como admin (Mario)
  console.log('→ Login como mario (admin)...')
  const cookieAdmin = await login('mario', 'hidro2026')
  if (!cookieAdmin) { console.log('  ✗ No pude autenticarme como mario'); process.exit(1) }
  console.log('  ✓ Autenticado')

  // Login como superadmin (Rodrigo)
  console.log('→ Login como rodrigo (superadmin)...')
  const cookieSuper = await login('rodrigo', 'hidro2026')
  if (!cookieSuper) { console.log('  ✗ No pude autenticarme'); process.exit(1) }
  console.log('  ✓ Autenticado\n')

  const timestamp = Date.now()
  const correlativoAdmin = `TEST_ADM_${timestamp}`
  const correlativoSuper = `TEST_SUP_${timestamp}`

  try {
    // ── T1: Admin crea cotización tratando de asignar a OTRO vendedor ──
    console.log('═══ T1: Admin intenta asignar cotización a otro vendedor ═══')
    {
      const r = await api('/api/cotizaciones', 'POST', cookieAdmin, {
        correlativo: correlativoAdmin,
        cliente: 'Test Ownership',
        empresa: 'Test',
        proyecto: 'Test',
        tipo: 'perforacion',
        estado: 'borrador',
        monto: 1000,
        fecha: new Date().toLocaleDateString('es-GT'),
        vendedor: 'Rodrigo Porres',  // ← intento de impersonar otro vendedor
        datos: {},
      })
      t(ok('POST OK', r.ok, `(${r.status})`))
      const data = await r.json()
      t(ok('Vendedor forzado a Mario Ramírez (no Rodrigo)',
           data.vendedor === 'Mario Ramírez',
           `(got: ${data.vendedor})`))
    }

    // ── T2: Admin intenta reasignar su propia cotización ───────────────
    console.log('\n═══ T2: Admin intenta PATCH vendedor → debe 403 ═══')
    {
      const r = await api(`/api/cotizaciones/${correlativoAdmin}`, 'PATCH', cookieAdmin, {
        vendedor: 'Rodrigo Porres',
      })
      t(ok('Request rechazado (403)', r.status === 403, `(${r.status})`))
    }

    // ── T3: Superadmin SÍ puede reasignar ──────────────────────────────
    console.log('\n═══ T3: Superadmin reasigna vendedor ═══')
    {
      const r = await api(`/api/cotizaciones/${correlativoAdmin}`, 'PATCH', cookieSuper, {
        vendedor: 'Rodrigo Porres',
      })
      t(ok('PATCH OK', r.ok, `(${r.status})`))
      const data = await r.json()
      t(ok('Vendedor actualizado a Rodrigo', data.vendedor === 'Rodrigo Porres', `(got: ${data.vendedor})`))
    }

    // ── T4: Reasigno de vuelta a Mario ─────────────────────────────────
    console.log('\n═══ T4: Superadmin reasigna de vuelta a Mario ═══')
    {
      const r = await api(`/api/cotizaciones/${correlativoAdmin}`, 'PATCH', cookieSuper, {
        vendedor: 'Mario Ramírez',
      })
      t(ok('PATCH OK', r.ok, `(${r.status})`))
      const data = await r.json()
      t(ok('Vendedor actualizado', data.vendedor === 'Mario Ramírez'))
    }

    // ── T5: Superadmin crea cotización asignando a otro admin ──────────
    console.log('\n═══ T5: Superadmin crea asignando a Mario ═══')
    {
      const r = await api('/api/cotizaciones', 'POST', cookieSuper, {
        correlativo: correlativoSuper,
        cliente: 'Test Super',
        empresa: 'Test',
        proyecto: 'Test',
        tipo: 'perforacion',
        estado: 'borrador',
        monto: 2000,
        fecha: new Date().toLocaleDateString('es-GT'),
        vendedor: 'Mario Ramírez',  // superadmin puede asignar a quien quiera
        datos: {},
      })
      t(ok('POST OK', r.ok, `(${r.status})`))
      const data = await r.json()
      t(ok('Vendedor asignado correctamente', data.vendedor === 'Mario Ramírez', `(got: ${data.vendedor})`))
    }

    // ── T6: Admin solo ve sus cotizaciones al listar ────────────────────
    console.log('\n═══ T6: GET /api/cotizaciones?vendedor=Mario devuelve solo de Mario ═══')
    {
      const r = await api('/api/cotizaciones?vendedor=Mario%20Ram%C3%ADrez', 'GET', cookieAdmin)
      const rows = await r.json()
      const todasDeMario = rows.every((c: { vendedor: string }) => c.vendedor === 'Mario Ramírez')
      t(ok('Todas las filas son de Mario', todasDeMario, `(${rows.length} filas)`))
    }

    // ── T7: Validación schema — PATCH vacío rechazado ───────────────────
    console.log('\n═══ T7: PATCH vacío (sin estado ni vendedor) → 400 ═══')
    {
      const r = await api(`/api/cotizaciones/${correlativoAdmin}`, 'PATCH', cookieSuper, {})
      t(ok('Rechazado (400)', r.status === 400, `(${r.status})`))
    }

  } finally {
    // Cleanup: borrar cotizaciones test
    console.log('\n═══ CLEANUP: borrar cotizaciones test ═══')
    const pg = (await import('pg')).default
    const dotenv = (await import('dotenv')).default
    dotenv.config()
    const client = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
    await client.connect()
    const result = await client.query(
      `DELETE FROM "Cotizacion" WHERE correlativo IN ($1, $2)`,
      [correlativoAdmin, correlativoSuper]
    )
    console.log(`  ✓ ${result.rowCount} cotizaciones eliminadas`)
    await client.end()
  }

  console.log(`\n═══ RESULTADO: ${passed} passed · ${failed} failed ═══`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })

export {}
