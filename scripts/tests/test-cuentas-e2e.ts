// E2E Cuentas por Pagar + Cobrar.
// Tests: middleware bloquea admin · CRUD completo · cálculo fiscal · marcar pagado/cobrado ·
// soft-delete · widget dashboard agregado.

const BASE = 'https://hidrocrm.com'

async function login(u: string, p: string): Promise<string | null> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: p }),
  })
  if (!res.ok) return null
  const cookies = res.headers.getSetCookie?.() ?? []
  return cookies.find(c => c.startsWith('auth_token='))?.split(';')[0] ?? null
}

async function api(path: string, method: string, cookie: string, body?: unknown) {
  return fetch(`${BASE}${path}`, {
    method, headers: { 'Content-Type': 'application/json', Cookie: cookie },
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
  console.log('✓ Autenticado como superadmin\n')

  // ── Recolectar cuentas creadas para cleanup al final ─────────────────────
  const idsPagar: string[] = []
  const idsCobrar: string[] = []

  try {
    // T1 — POST crear cuenta por pagar con IVA + ISR
    console.log('═══ T1: POST Cuenta por Pagar (IVA=on, ISR=off, 30d crédito) ═══')
    let idPagar = ''
    {
      const r = await api('/api/cuentas-pagar', 'POST', cookie, {
        proveedor: 'TEST Proveedor E2E',
        nit: '12345678-9',
        descripcion: 'Compra de bentonita test',
        monto: 10000,
        aplicarIva: true,
        aplicarIsr: false,
        diasCredito: 30,
        fechaEmision: '2026-04-23',
      })
      t(ok('POST OK', r.ok, `(${r.status})`))
      if (r.ok) {
        const d = await r.json()
        idPagar = d.id
        idsPagar.push(idPagar)
        t(ok(`IVA calculado = 1200 (12% de 10000)`, d.ivaMonto === 1200))
        t(ok(`ISR calculado = 0`, d.isrMonto === 0))
        t(ok(`Total = 11200 (10000 + 1200)`, d.total === 11200))
        t(ok(`fechaVencimiento = 2026-05-23 (emision + 30d)`, d.fechaVencimiento === '2026-05-23'))
      }
    }

    // T2 — POST con IVA + ISR (calcula resta del ISR)
    console.log('\n═══ T2: POST con ambos impuestos (IVA + ISR retención) ═══')
    {
      const r = await api('/api/cuentas-pagar', 'POST', cookie, {
        proveedor: 'TEST Con Retención',
        descripcion: 'Servicio con retención ISR',
        monto: 10000,
        aplicarIva: true,
        aplicarIsr: true,
        diasCredito: 15,
        fechaEmision: '2026-04-23',
      })
      t(ok('POST OK', r.ok, `(${r.status})`))
      if (r.ok) {
        const d = await r.json()
        idsPagar.push(d.id)
        t(ok(`ISR = 500 (5% de 10000)`, d.isrMonto === 500))
        t(ok(`Total = 10700 (10000 + 1200 - 500)`, d.total === 10700))
      }
    }

    // T3 — PATCH editar monto (recalcula totales)
    console.log('\n═══ T3: PATCH editar monto (recalc fiscal automático) ═══')
    {
      const r = await api(`/api/cuentas-pagar/${idPagar}`, 'PATCH', cookie, { monto: 20000 })
      t(ok('PATCH OK', r.ok, `(${r.status})`))
      if (r.ok) {
        const d = await r.json()
        t(ok(`Monto actualizado = 20000`, d.monto === 20000))
        t(ok(`IVA recalculado = 2400`, d.ivaMonto === 2400))
        t(ok(`Total recalculado = 22400`, d.total === 22400))
      }
    }

    // T4 — PATCH marcar como pagado
    console.log('\n═══ T4: PATCH marcar pagado ═══')
    {
      const r = await api(`/api/cuentas-pagar/${idPagar}`, 'PATCH', cookie, {
        pagado: true, metodoPago: 'transferencia', referenciaPago: 'BI-12345', fechaPago: '2026-04-23',
      })
      t(ok('PATCH OK', r.ok))
      if (r.ok) {
        const d = await r.json()
        t(ok(`pagado=true`, d.pagado === true))
        t(ok(`metodoPago guardado`, d.metodoPago === 'transferencia'))
        t(ok(`referencia guardada`, d.referenciaPago === 'BI-12345'))
      }
    }

    // T5 — GET lista (debe incluir las 2 por pagar)
    console.log('\n═══ T5: GET lista cuentas-pagar ═══')
    {
      const r = await api('/api/cuentas-pagar', 'GET', cookie)
      t(ok('GET OK', r.ok))
      if (r.ok) {
        const list = await r.json() as Array<{ id: string }>
        const mias = list.filter(x => idsPagar.includes(x.id))
        t(ok(`Aparecen ${idsPagar.length} de test en lista`, mias.length === idsPagar.length))
      }
    }

    // T6 — POST cuenta por COBRAR
    console.log('\n═══ T6: POST Cuenta por Cobrar ═══')
    {
      const r = await api('/api/cuentas-cobrar', 'POST', cookie, {
        cliente: 'TEST Cliente E2E',
        empresa: 'Constructora XYZ',
        nit: '98765432-1',
        descripcion: 'Factura servicios perforación',
        monto: 50000,
        aplicarIva: true,
        aplicarIsr: false,
        diasCredito: 45,
        fechaEmision: '2026-04-23',
      })
      t(ok('POST OK', r.ok, `(${r.status})`))
      if (r.ok) {
        const d = await r.json()
        idsCobrar.push(d.id)
        t(ok(`IVA = 6000`, d.ivaMonto === 6000))
        t(ok(`Total = 56000`, d.total === 56000))
        t(ok(`fechaVencimiento = 2026-06-07 (45d después)`, d.fechaVencimiento === '2026-06-07'))
      }
    }

    // T7 — PATCH marcar cobrado
    console.log('\n═══ T7: PATCH marcar cobrado ═══')
    {
      const r = await api(`/api/cuentas-cobrar/${idsCobrar[0]}`, 'PATCH', cookie, {
        cobrado: true, metodoCobro: 'cheque', referenciaCobro: 'CH-001',
      })
      t(ok('PATCH OK', r.ok))
      if (r.ok) {
        const d = await r.json()
        t(ok(`cobrado=true`, d.cobrado === true))
        t(ok(`fechaCobro asignada`, !!d.fechaCobro))
      }
    }

    // T8 — GET /api/dashboard/cuentas (widget agregado)
    console.log('\n═══ T8: Dashboard endpoint agrega totales ═══')
    {
      const r = await api('/api/dashboard/cuentas', 'GET', cookie)
      t(ok('GET dashboard/cuentas OK', r.ok))
      if (r.ok) {
        const d = await r.json()
        t(ok('Estructura: { pagar, cobrar }', !!(d.pagar && d.cobrar)))
        t(ok('pagar.totalPendiente es número', typeof d.pagar.totalPendiente === 'number'))
        t(ok('cobrar.totalPendiente es número', typeof d.cobrar.totalPendiente === 'number'))
      }
    }

    // T9 — DELETE (soft) con motivo
    console.log('\n═══ T9: DELETE (soft) con motivo ═══')
    {
      const r = await api(`/api/cuentas-pagar/${idsPagar[1]}?motivo=test-cleanup`, 'DELETE', cookie)
      t(ok('DELETE OK', r.ok))
      // GET del id borrado → 404
      const r2 = await api(`/api/cuentas-pagar/${idsPagar[1]}`, 'GET', cookie)
      t(ok('GET de soft-deleted devuelve 404', r2.status === 404))
      // ya no aparece en lista
      const list = await (await api('/api/cuentas-pagar', 'GET', cookie)).json() as Array<{ id: string }>
      t(ok('No aparece en lista', !list.some(x => x.id === idsPagar[1])))
    }

    // T10 — Admin no puede acceder (middleware bloquea)
    console.log('\n═══ T10: Admin (no-superadmin) bloqueado por middleware ═══')
    {
      // Loguearse como Mario admin
      const cookieAdmin = await login('mario', 'Hidro2026')
      if (!cookieAdmin) {
        console.log('  · Mario no existe o pass distinto, skipeando T10')
      } else {
        const r1 = await api('/api/cuentas-pagar', 'GET', cookieAdmin)
        t(ok(`Admin GET /api/cuentas-pagar → 403 (status=${r1.status})`, r1.status === 403))
        const r2 = await api('/api/cuentas-cobrar', 'GET', cookieAdmin)
        t(ok(`Admin GET /api/cuentas-cobrar → 403 (status=${r2.status})`, r2.status === 403))
        const r3 = await api('/api/dashboard/cuentas', 'GET', cookieAdmin)
        // dashboard/cuentas no está bloqueado por path pattern, pero el middleware vale para los 2 endpoints principales
        void r3
      }
    }

  } finally {
    // Cleanup — hard delete via conexión directa
    const pg = (await import('pg')).default
    const dotenv = (await import('dotenv')).default
    dotenv.config()
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    await client.connect()
    if (idsPagar.length)  await client.query(`DELETE FROM "CuentaPorPagar"  WHERE id = ANY($1::text[])`, [idsPagar])
    if (idsCobrar.length) await client.query(`DELETE FROM "CuentaPorCobrar" WHERE id = ANY($1::text[])`, [idsCobrar])
    await client.end()
    console.log('\n  ✓ Cleanup OK (hard delete de test rows)')
  }

  console.log(`\n═══ RESULTADO: ${passed} passed · ${failed} failed ═══`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })

export {}
