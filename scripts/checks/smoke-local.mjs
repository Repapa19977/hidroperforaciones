const baseUrl = process.env.HIDROCRM_BASE_URL ?? 'http://127.0.0.1:3000'

const checks = [
  { path: '/login', ok: [200] },
  { path: '/cliente/login', ok: [200] },
  { path: '/dashboard', ok: [302, 307, 308] },
  { path: '/cotizaciones', ok: [302, 307, 308] },
  { path: '/proyectos', ok: [302, 307, 308] },
  { path: '/contactos', ok: [302, 307, 308] },
  { path: '/api/contactos', ok: [401] },
]

function urlFor(path) {
  return new URL(path, baseUrl).toString()
}

let failed = false

for (const check of checks) {
  try {
    const response = await fetch(urlFor(check.path), { redirect: 'manual' })
    const pass = check.ok.includes(response.status)
    const expected = check.ok.join('/')
    const result = pass ? 'OK' : 'FAIL'
    console.log(`${result} ${check.path} -> ${response.status} expected ${expected}`)
    if (!pass) failed = true
  } catch (error) {
    failed = true
    console.error(`FAIL ${check.path} -> ${error instanceof Error ? error.message : String(error)}`)
  }
}

if (failed) {
  console.error(`\nSmoke local fallo contra ${baseUrl}`)
  process.exit(1)
}

console.log(`\nSmoke local OK contra ${baseUrl}`)
