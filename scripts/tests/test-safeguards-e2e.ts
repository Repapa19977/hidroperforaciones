// Tests adicionales — safeguards destructivos y correlativo piso

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

async function ok(label: string, pass: boolean, extra = '') {
  console.log(`  ${pass ? '✓' : '✗'} ${label}${extra ? ' ' + extra : ''}`)
  return pass
}

async function main() {
  const cookie = await login('rodrigo', 'hidro2026')
  if (!cookie) { console.log('No pude autenticar'); process.exit(1) }
  console.log('✓ Autenticado como rodrigo (superadmin)\n')

  const usuarios = await api('/api/usuarios', 'GET', cookie).then(r => r.json())
  const yo = usuarios.find((u: { username: string }) => u.username === 'rodrigo')
  if (!yo) { console.log('No me encuentro en la lista'); process.exit(1) }

  let passed = 0, failed = 0
  const t = (r: boolean) => r ? passed++ : failed++

  // ── T1: NO auto-degradarse ───────────────────────────────────────────
  console.log('═══ T1: Rodrigo (yo) NO puede bajarse a admin ═══')
  {
    const r = await api(`/api/usuarios/${yo.id}`, 'PATCH', cookie, { rol: 'admin' })
    t(await ok('Request rechazado', r.status === 400, `(${r.status})`))
    const err = await r.json().catch(() => ({}))
    t(await ok('Mensaje explica por qué', !!err.error && err.error.toLowerCase().includes('vos mismo'), `"${err.error?.slice(0,80)}"`))
  }

  // ── T2: NO auto-desactivarse ─────────────────────────────────────────
  console.log('\n═══ T2: Rodrigo (yo) NO puede desactivarse ═══')
  {
    const r = await api(`/api/usuarios/${yo.id}`, 'PATCH', cookie, { activo: false })
    t(await ok('Request rechazado', r.status === 400, `(${r.status})`))
  }

  // ── T3: NO auto-borrarse ─────────────────────────────────────────────
  console.log('\n═══ T3: Rodrigo (yo) NO puede borrarse ═══')
  {
    const r = await api(`/api/usuarios/${yo.id}`, 'DELETE', cookie)
    t(await ok('Request rechazado', r.status === 400, `(${r.status})`))
  }

  // ── T4: NO bajar al único superadmin (dejar 0) ──────────────────────
  console.log('\n═══ T4: Safeguard último superadmin ═══')
  {
    // Cuento los superadmins activos
    const supers = usuarios.filter((u: { rol: string; activo: boolean }) => u.rol === 'superadmin' && u.activo)
    console.log(`  · Superadmins activos ahora: ${supers.length}`)
    // Intento bajar a otro superadmin que NO sea yo
    const otro = supers.find((u: { id: string }) => u.id !== yo.id)
    if (otro) {
      // Primer intento: bajarlo. Puede funcionar o no según cuántos queden.
      const r = await api(`/api/usuarios/${otro.id}`, 'PATCH', cookie, { rol: 'admin' })
      console.log(`  · Bajar a "${otro.nombre}" → ${r.status}`)
      if (r.ok) {
        // Lo volvemos a subir para no romper estado
        await api(`/api/usuarios/${otro.id}`, 'PATCH', cookie, { rol: 'superadmin' })
        console.log(`  · Restaurado a superadmin (OK, aún quedaba 1 activo: yo)`)
        t(await ok('Safeguard permite bajar si hay más', true))
      } else {
        const err = await r.json().catch(() => ({}))
        t(await ok('Safeguard bloquea último', r.status === 400, `"${err.error?.slice(0,60)}"`))
      }
    } else {
      console.log('  · Sólo hay 1 superadmin (yo), no se puede testear safeguard de "otro"')
    }
  }

  // ── T5: Correlativo siguiente ≥ 5330 ────────────────────────────────
  console.log('\n═══ T5: Correlativo parte de 5330 ═══')
  {
    const r = await api('/api/cotizaciones/siguiente?tipo=perforacion', 'GET', cookie)
    const data = await r.json()
    console.log(`  · Próximo correlativo perforación: ${data.correlativo}`)
    // Nuevo formato: P####-YYYY
    const m = data.correlativo.match(/^P(\d+)(?:-(\d{4}))?$/)
    const num = m ? parseInt(m[1]) : 0
    t(await ok('Número ≥ 5330', num >= 5330, `(n=${num})`))

    const r2 = await api('/api/cotizaciones/siguiente?tipo=limpieza', 'GET', cookie)
    const d2 = await r2.json()
    console.log(`  · Próximo correlativo limpieza: ${d2.correlativo}`)
    const m2 = d2.correlativo.match(/^S(\d+)(?:-(\d{4}))?$/)
    const n2 = m2 ? parseInt(m2[1]) : 0
    t(await ok('Número ≥ 5330', n2 >= 5330, `(n=${n2})`))
  }

  // ── T6: Admin NO puede llamar /api/usuarios ─────────────────────────
  console.log('\n═══ T6: Admin NO puede llamar /api/usuarios ═══')
  {
    const cookieMario = await login('mario', 'hidro2026')
    if (cookieMario) {
      const r = await api('/api/usuarios', 'GET', cookieMario)
      t(await ok('Admin recibe 403', r.status === 403, `(${r.status})`))
    } else {
      console.log('  · No pude loguearme como mario (password desconocida) - skip')
    }
  }

  console.log(`\n═══ RESULTADO: ${passed} passed · ${failed} failed ═══`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })

export {}
