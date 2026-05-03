// Test E2E completo de gestión de usuarios.
// Hace login real con /api/auth/login → usa la cookie para probar TODO el flujo
// de gestión: crear, editar nombre, cambiar password, cambiar rol, safeguards,
// desactivar, reactivar, borrar (soft).

const BASE = 'https://hidrocrm.com'
const USERNAME_TEST = 'e2e_test_temp_user'
const PASSWORD_VALIDA = 'Test1234'
const PASSWORD_INVALIDA = 'abc'  // muy corta, sin número

async function login(username: string, password: string): Promise<string | null> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    console.log(`  ❌ Login falló: ${res.status}`)
    return null
  }
  const cookies = res.headers.getSetCookie?.() ?? []
  const authCookie = cookies.find(c => c.startsWith('auth_token='))
  if (!authCookie) { console.log('  ❌ No se recibió auth_token'); return null }
  return authCookie.split(';')[0]  // solo "auth_token=..."
}

async function api(path: string, method: string, cookie: string, body?: unknown) {
  return fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function ok(label: string, expected: boolean, got: boolean, extra = '') {
  const pass = expected === got
  console.log(`  ${pass ? '✓' : '✗'} ${label}${extra ? ' ' + extra : ''}`)
  return pass
}

async function main() {
  // Credenciales de Rodrigo (ajustar si cambiaron)
  const CREDS: Array<[string, string]> = [
    ['rodrigo', 'hidro2026'],
    ['superadmin', process.env.SUPERADMIN_PASS ?? ''],
  ]

  let cookie: string | null = null
  for (const [u, p] of CREDS) {
    if (!p) continue
    console.log(`→ Login como ${u}...`)
    cookie = await login(u, p)
    if (cookie) { console.log(`  ✓ Autenticado`); break }
  }
  if (!cookie) {
    console.log('\n❌ No pude autenticarme. Pasá las credenciales correctas.')
    process.exit(1)
  }

  let passed = 0, failed = 0
  const track = (r: boolean) => r ? passed++ : failed++
  let testUserId: string | null = null

  try {
    // ── TEST 1: Listar usuarios existentes ──────────────────────────────
    console.log('\n═══ T1: GET /api/usuarios (listar) ═══')
    {
      const r = await api('/api/usuarios', 'GET', cookie)
      track(await ok('GET devuelve 200', true, r.ok, `(${r.status})`))
      const data = await r.json()
      track(await ok('Es un array', true, Array.isArray(data), `(${data.length} users)`))
    }

    // ── TEST 2: Validación password débil ───────────────────────────────
    console.log('\n═══ T2: POST con password débil (debe fallar) ═══')
    {
      const r = await api('/api/usuarios', 'POST', cookie, {
        username: USERNAME_TEST, nombre: 'Test E2E', password: PASSWORD_INVALIDA, rol: 'admin',
      })
      track(await ok('Password débil rechazada', true, r.status === 400, `(${r.status})`))
      const err = await r.json().catch(() => ({}))
      track(await ok('Con mensaje claro', true, !!err.error, `(${err.error?.slice(0,50)}…)`))
    }

    // ── TEST 3: Crear usuario test ──────────────────────────────────────
    console.log('\n═══ T3: POST crear usuario válido ═══')
    {
      const r = await api('/api/usuarios', 'POST', cookie, {
        username: USERNAME_TEST, nombre: 'Test E2E Original', password: PASSWORD_VALIDA, rol: 'admin',
      })
      track(await ok('Creación OK', true, r.status === 201, `(${r.status})`))
      const user = await r.json()
      testUserId = user.id
      track(await ok('Devuelve id', true, !!user.id))
      track(await ok('Rol admin', true, user.rol === 'admin', `(rol=${user.rol})`))
    }

    if (!testUserId) throw new Error('Sin id de test user — abortar')

    // ── TEST 4: Duplicado username ──────────────────────────────────────
    console.log('\n═══ T4: POST mismo username (debe fallar 409) ═══')
    {
      const r = await api('/api/usuarios', 'POST', cookie, {
        username: USERNAME_TEST, nombre: 'Dup', password: PASSWORD_VALIDA, rol: 'admin',
      })
      track(await ok('Duplicado rechazado', true, r.status === 409, `(${r.status})`))
    }

    // ── TEST 5: Cambiar nombre ──────────────────────────────────────────
    console.log('\n═══ T5: PATCH cambiar nombre ═══')
    {
      const r = await api(`/api/usuarios/${testUserId}`, 'PATCH', cookie, { nombre: 'Test E2E Renombrado' })
      track(await ok('PATCH nombre OK', true, r.ok, `(${r.status})`))
      const user = await r.json()
      track(await ok('Nombre actualizado', true, user.nombre === 'Test E2E Renombrado', `(${user.nombre})`))
    }

    // ── TEST 6: Cambiar password (válida) ───────────────────────────────
    console.log('\n═══ T6: PATCH cambiar password ═══')
    {
      const r = await api(`/api/usuarios/${testUserId}`, 'PATCH', cookie, { password: 'Nueva1234' })
      track(await ok('PATCH password OK', true, r.ok, `(${r.status})`))
    }

    // ── TEST 7: Cambiar password (inválida) ─────────────────────────────
    console.log('\n═══ T7: PATCH password débil (debe fallar) ═══')
    {
      const r = await api(`/api/usuarios/${testUserId}`, 'PATCH', cookie, { password: 'abc' })
      track(await ok('Password débil rechazada', true, r.status === 400, `(${r.status})`))
    }

    // ── TEST 8: Subir rol a superadmin ──────────────────────────────────
    console.log('\n═══ T8: PATCH rol admin → superadmin ═══')
    {
      const r = await api(`/api/usuarios/${testUserId}`, 'PATCH', cookie, { rol: 'superadmin' })
      track(await ok('PATCH rol OK', true, r.ok, `(${r.status})`))
      const user = await r.json()
      track(await ok('Es superadmin', true, user.rol === 'superadmin', `(rol=${user.rol})`))
    }

    // ── TEST 9: Bajar rol a admin ───────────────────────────────────────
    console.log('\n═══ T9: PATCH rol superadmin → admin ═══')
    {
      const r = await api(`/api/usuarios/${testUserId}`, 'PATCH', cookie, { rol: 'admin' })
      track(await ok('PATCH rol OK', true, r.ok, `(${r.status})`))
      const user = await r.json()
      track(await ok('Es admin', true, user.rol === 'admin', `(rol=${user.rol})`))
    }

    // ── TEST 10: Desactivar ─────────────────────────────────────────────
    console.log('\n═══ T10: PATCH activo=false ═══')
    {
      const r = await api(`/api/usuarios/${testUserId}`, 'PATCH', cookie, { activo: false })
      track(await ok('Desactivación OK', true, r.ok, `(${r.status})`))
      const user = await r.json()
      track(await ok('Activo=false', false, user.activo, `(activo=${user.activo})`))
    }

    // ── TEST 11: Reactivar ──────────────────────────────────────────────
    console.log('\n═══ T11: PATCH activo=true ═══')
    {
      const r = await api(`/api/usuarios/${testUserId}`, 'PATCH', cookie, { activo: true })
      track(await ok('Reactivación OK', true, r.ok, `(${r.status})`))
      const user = await r.json()
      track(await ok('Activo=true', true, user.activo, `(activo=${user.activo})`))
    }

    // ── TEST 12: DELETE soft ─────────────────────────────────────────────
    console.log('\n═══ T12: DELETE (soft) ═══')
    {
      const r = await api(`/api/usuarios/${testUserId}`, 'DELETE', cookie)
      track(await ok('DELETE OK', true, r.ok, `(${r.status})`))
      const data = await r.json()
      track(await ok('Flag soft=true', true, data.soft === true))
    }

    // ── TEST 13: Verify password (válido) ────────────────────────────────
    console.log('\n═══ T13: POST verify-password ═══')
    {
      // Usamos las credenciales del login original
      const usedPass = CREDS.find(([, p]) => p)?.[1]
      const r = await api('/api/auth/verify-password', 'POST', cookie, { password: usedPass })
      track(await ok('Password correcta aceptada', true, r.ok, `(${r.status})`))

      const r2 = await api('/api/auth/verify-password', 'POST', cookie, { password: 'passwordIncorrecta123' })
      track(await ok('Password incorrecta rechazada', true, r2.status === 401, `(${r2.status})`))
    }

    // ── TEST 14: Safeguard — no degradar último superadmin ──────────────
    // Este es difícil de testear sin manipular la BD. Sólo validamos que el
    // sistema rechaza si quedaran 0 superadmins (requiere estado controlado).
    // Lo dejamos documentado.
    console.log('\n═══ T14: Safeguard último superadmin (lógico) ═══')
    console.log('  · La lógica está en /api/usuarios/[id] línea 74-80')
    console.log('  · Se testea cuando: superadmin_activos_restantes === 0')

  } finally {
    // ── Cleanup: hard delete del test user ──────────────────────────────
    if (testUserId) {
      console.log('\n═══ CLEANUP: borrar test user de BD ═══')
      const pg = (await import('pg')).default
      const dotenv = (await import('dotenv')).default
      dotenv.config()
      const client = new pg.Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      })
      await client.connect()
      await client.query(`DELETE FROM "Usuario" WHERE id = $1`, [testUserId])
      console.log('  ✓ Test user removido de BD (hard delete)')
      await client.end()
    }
  }

  console.log(`\n═══ RESULTADO: ${passed} passed · ${failed} failed ═══`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(1) })

export {}
