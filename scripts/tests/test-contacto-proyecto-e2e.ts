// E2E — verifica que al guardar una cotización con depto+municipio+proyecto,
// el contacto se crea/actualiza con esos 3 campos, y que el endpoint de contactos
// acepta proyectoNombre directo (opcional).

const BASE = 'https://hidrocrm.com'

async function login(u: string, p: string) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: p }),
  })
  const cookies = r.headers.getSetCookie?.() ?? []
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

  const pg = (await import('pg')).default
  const dotenv = (await import('dotenv')).default
  dotenv.config()
  const pgClient = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await pgClient.connect()

  const correlativo = `TEST_CPN_${Date.now()}`
  const cliente = `Test ContactoProyecto ${Date.now()}`

  try {
    // T1 — POST cotización con depto+municipio+proyecto → debe auto-crear contacto con estos 3
    console.log('═══ T1: Cotización auto-crea contacto con proyectoNombre+depto+municipio ═══')
    {
      const r = await fetch(`${BASE}/api/cotizaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({
          correlativo, cliente, empresa: 'Finca TEST', proyecto: 'Pozo Finca TEST',
          tipo: 'perforacion', estado: 'borrador', monto: 50000, fecha: '2026-04-23',
          vendedor: 'Rodrigo Porres',
          datos: {
            cliente, correlativo, proyecto: 'Pozo Finca TEST',
            telefono: '55551234',
            email: 'test@test.gt',
            departamento: 'Escuintla',
            municipio: 'Escuintla',
          },
        }),
      })
      t(ok('POST cotización OK', r.ok, `(${r.status})`))

      // Verificar contacto creado
      const row = await pgClient.query(
        `SELECT id, nombre, empresa, telefono, email, departamento, municipio, "proyectoNombre" FROM "Contacto" WHERE nombre = $1 AND "eliminadoEn" IS NULL`,
        [cliente],
      )
      t(ok('Contacto auto-creado', row.rows.length === 1))
      if (row.rows.length === 1) {
        const c = row.rows[0]
        t(ok(`departamento = "Escuintla" (${c.departamento})`, c.departamento === 'Escuintla'))
        t(ok(`municipio = "Escuintla" (${c.municipio})`, c.municipio === 'Escuintla'))
        t(ok(`proyectoNombre = "Pozo Finca TEST" (${c.proyectoNombre})`, c.proyectoNombre === 'Pozo Finca TEST'))
        t(ok(`email = test@test.gt (${c.email})`, c.email === 'test@test.gt'))
      }
    }

    // T2 — POST otro contacto directo con proyectoNombre vacío (opcional) desde el módulo contactos
    console.log('\n═══ T2: POST contacto directo sin proyectoNombre (opcional) ═══')
    {
      const r = await fetch(`${BASE}/api/contactos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({
          nombre: `${cliente} DIRECTO`,
          tipo: 'cliente',
          pais: 'Guatemala',
          vendedor: 'Rodrigo Porres',
          // proyectoNombre omitido
        }),
      })
      t(ok('POST sin proyectoNombre OK', r.ok, `(${r.status})`))
      if (r.ok) {
        const d = await r.json()
        t(ok('proyectoNombre default = ""', d.proyectoNombre === ''))
      }
    }

    // T3 — POST contacto con proyectoNombre explícito
    console.log('\n═══ T3: POST contacto con proyectoNombre explícito ═══')
    let id3 = ''
    {
      const r = await fetch(`${BASE}/api/contactos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({
          nombre: `${cliente} CON_PROY`,
          tipo: 'cliente',
          pais: 'Guatemala',
          vendedor: 'Rodrigo Porres',
          proyectoNombre: 'Pozo Referencia Previa',
        }),
      })
      t(ok('POST con proyectoNombre OK', r.ok))
      if (r.ok) {
        const d = await r.json()
        id3 = d.id
        t(ok(`proyectoNombre guardado = "Pozo Referencia Previa"`, d.proyectoNombre === 'Pozo Referencia Previa'))
      }
    }

    // T4 — PATCH cambia proyectoNombre
    console.log('\n═══ T4: PATCH cambia proyectoNombre ═══')
    if (id3) {
      const r = await fetch(`${BASE}/api/contactos/${id3}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({
          nombre: `${cliente} CON_PROY`, tipo: 'cliente', pais: 'Guatemala',
          departamento: '', municipio: '', telefono: '', email: '',
          proyectoNombre: 'Pozo Actualizado',
        }),
      })
      t(ok('PATCH OK', r.ok))
      if (r.ok) {
        const d = await r.json()
        t(ok(`proyectoNombre actualizado = "Pozo Actualizado"`, d.proyectoNombre === 'Pozo Actualizado'))
      }
    }

    // T5 — Re-guardar cotización NO pisa los campos ya poblados del contacto (solo llena vacíos)
    console.log('\n═══ T5: Re-guardar cotización preserva campos ya poblados ═══')
    {
      // Cambio el depto y municipio en la 2da guardada. El contacto YA tiene Escuintla.
      const r = await fetch(`${BASE}/api/cotizaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({
          correlativo, cliente, empresa: 'Finca TEST', proyecto: 'Pozo Finca TEST',
          tipo: 'perforacion', estado: 'borrador', monto: 50000, fecha: '2026-04-23',
          vendedor: 'Rodrigo Porres',
          datos: {
            cliente, correlativo, proyecto: 'Pozo Finca TEST',
            telefono: '55551234', email: 'test@test.gt',
            departamento: 'Guatemala', municipio: 'Mixco',  // distinto a T1
          },
        }),
      })
      t(ok('POST cotización OK', r.ok))
      const row = await pgClient.query(
        `SELECT departamento, municipio FROM "Contacto" WHERE nombre = $1 AND "eliminadoEn" IS NULL`,
        [cliente],
      )
      t(ok(`Depto NO pisado (sigue Escuintla): ${row.rows[0]?.departamento}`, row.rows[0]?.departamento === 'Escuintla'))
      t(ok(`Municipio NO pisado (sigue Escuintla): ${row.rows[0]?.municipio}`, row.rows[0]?.municipio === 'Escuintla'))
    }

  } finally {
    // Cleanup
    await pgClient.query(`DELETE FROM "Cotizacion" WHERE correlativo = $1`, [correlativo])
    await pgClient.query(`DELETE FROM "Contacto" WHERE nombre LIKE $1`, [`${cliente}%`])
    await pgClient.end()
    console.log('\n  ✓ Cleanup OK')
  }

  console.log(`\n═══ RESULTADO: ${passed} passed · ${failed} failed ═══`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })

export {}
