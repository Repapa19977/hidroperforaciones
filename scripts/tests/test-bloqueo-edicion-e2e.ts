// Test E2E: bloqueo de edición por estado
// Valida que:
//   · Borrador SE puede editar
//   · Enviada/Confirmada/Cancelada NO se pueden editar (409) — admin y superadmin
//   · Siempre se puede crear una NUEVA cotización con otro correlativo

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

  const cookieAdmin = await login('mario', 'hidro2026')
  const cookieSuper = await login('rodrigo', 'hidro2026')
  if (!cookieAdmin || !cookieSuper) { console.log('Login falló'); process.exit(1) }
  console.log('✓ Logueado admin + superadmin\n')

  const correlativo = `TEST_BLOQ_${Date.now()}`
  const base = {
    correlativo, cliente: 'Test', empresa: 'Test', proyecto: 'Test',
    tipo: 'perforacion', monto: 1000, fecha: new Date().toLocaleDateString('es-GT'),
    vendedor: 'Mario Ramírez', datos: {},
  }

  try {
    // T1 — Admin crea borrador
    console.log('═══ T1: Admin crea borrador ═══')
    {
      const r = await api('/api/cotizaciones', 'POST', cookieAdmin, { ...base, estado: 'borrador' })
      t(ok('Creación OK', r.ok, `(${r.status})`))
    }

    // T2 — Admin edita borrador (re-guardar) → debe funcionar
    console.log('\n═══ T2: Admin edita borrador ═══')
    {
      const r = await api('/api/cotizaciones', 'POST', cookieAdmin, {
        ...base, estado: 'borrador', proyecto: 'Proyecto editado',
      })
      t(ok('Re-save OK', r.ok, `(${r.status})`))
    }

    // T3 — Admin cambia estado a "enviada" (vía PATCH, no POST)
    console.log('\n═══ T3: Cambio estado a enviada via PATCH ═══')
    {
      const r = await api(`/api/cotizaciones/${correlativo}`, 'PATCH', cookieAdmin, { estado: 'enviada' })
      t(ok('PATCH estado OK', r.ok, `(${r.status})`))
    }

    // T4 — Admin intenta editar cotización ENVIADA → 409
    console.log('\n═══ T4: Admin intenta editar enviada → debe 409 ═══')
    {
      const r = await api('/api/cotizaciones', 'POST', cookieAdmin, {
        ...base, estado: 'enviada', proyecto: 'Intento de hack',
      })
      t(ok('Rechazado 409', r.status === 409, `(${r.status})`))
      const err = await r.json().catch(() => ({}))
      t(ok('Mensaje claro', !!err.error && err.error.includes('enviada'), `"${err.error?.slice(0,60)}"`))
      t(ok('Flag bloqueada=true', err.bloqueada === true))
    }

    // T5 — SUPERADMIN tampoco puede editar enviada → 409
    console.log('\n═══ T5: Superadmin intenta editar enviada → debe 409 ═══')
    {
      const r = await api('/api/cotizaciones', 'POST', cookieSuper, {
        ...base, estado: 'enviada', proyecto: 'Intento superadmin',
      })
      t(ok('Rechazado 409 (aplica a ambos roles)', r.status === 409, `(${r.status})`))
    }

    // T6 — PASAMOS a confirmada → también bloquea
    console.log('\n═══ T6: Cambio a confirmada + intento editar ═══')
    {
      await api(`/api/cotizaciones/${correlativo}`, 'PATCH', cookieSuper, { estado: 'confirmada' })
      const r = await api('/api/cotizaciones', 'POST', cookieSuper, {
        ...base, estado: 'confirmada', proyecto: 'Nope',
      })
      t(ok('Confirmada bloqueada', r.status === 409, `(${r.status})`))
    }

    // T7 — CANCELADA también bloquea
    console.log('\n═══ T7: Cambio a cancelada + intento editar ═══')
    {
      await api(`/api/cotizaciones/${correlativo}`, 'PATCH', cookieSuper, { estado: 'cancelada' })
      const r = await api('/api/cotizaciones', 'POST', cookieAdmin, {
        ...base, estado: 'cancelada', proyecto: 'Nope',
      })
      t(ok('Cancelada bloqueada', r.status === 409, `(${r.status})`))
    }

    // T8 — Siempre se puede crear NUEVA cotización con otro correlativo
    console.log('\n═══ T8: Crear cotización nueva con otro correlativo → OK ═══')
    const nuevoCorr = `TEST_NUEVO_${Date.now()}`
    {
      const r = await api('/api/cotizaciones', 'POST', cookieAdmin, {
        ...base, correlativo: nuevoCorr, estado: 'borrador', proyecto: 'Nueva cotización',
      })
      t(ok('Creación nueva OK', r.ok, `(${r.status})`))
    }

    // Cleanup nuevo
    const pg = (await import('pg')).default
    const dotenv = (await import('dotenv')).default
    dotenv.config()
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    await client.connect()
    await client.query(`DELETE FROM "Cotizacion" WHERE correlativo = ANY($1)`, [[correlativo, nuevoCorr]])
    // También borrar proyecto si se creó al confirmar
    await client.query(`DELETE FROM "Proyecto" WHERE correlativo = ANY($1)`, [[correlativo, nuevoCorr]])
    await client.end()
    console.log('\n  ✓ Cleanup: test cotizaciones + proyectos borrados')

  } catch (e) {
    console.error('ERROR:', e)
    failed++
  }

  console.log(`\n═══ RESULTADO: ${passed} passed · ${failed} failed ═══`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })

export {}
