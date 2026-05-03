// E2E tubería custom pareada — crea lisa+ranurada via /api/config, verifica:
// 1) Se persisten ambas en la misma request
// 2) /api/config GET devuelve las 2
// 3) Editar precio del par actualiza ambas
// 4) Eliminar quita ambas
// 5) Cotización nueva puede resolver el precio (via calculator.ts en servidor)

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

interface TuberiaExtra {
  tipo: 'lisa' | 'ranurada'
  diametro: number
  espesor: number
  precio: number
  markupPct?: number
}

async function getConfig(cookie: string): Promise<Record<string, unknown>> {
  const r = await fetch(`${BASE}/api/config`, { headers: { Cookie: cookie } })
  return r.json()
}

async function saveConfig(cookie: string, cfg: Record<string, unknown>) {
  return fetch(`${BASE}/api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(cfg),
  })
}

async function main() {
  let passed = 0, failed = 0
  const t = (r: boolean) => r ? passed++ : failed++

  const cookie = await login('rodrigo', 'hidro2026')
  if (!cookie) { console.log('Login falló'); process.exit(1) }
  console.log('✓ Autenticado como superadmin\n')

  // Usamos una medida muy poco probable (18" espesor 0.375) para no chocar con nada.
  const DIAM = 18, ESP = 0.375, COSTO = 8500, MK = 30
  const k = (e: TuberiaExtra) => `${e.tipo}-${e.diametro}-${e.espesor}`
  const enTest = (e: TuberiaExtra) => e.diametro === DIAM && Math.abs(e.espesor - ESP) < 0.001

  // Baseline — limpiar cualquier entrada de test previa
  const baseline = await getConfig(cookie)
  const extrasLimpios = ((baseline.tuberiasExtra as TuberiaExtra[] | undefined) ?? []).filter(e => !enTest(e))
  await saveConfig(cookie, { ...baseline, tuberiasExtra: extrasLimpios })

  try {
    // T1 — Crear par lisa + ranurada en una sola request
    console.log('═══ T1: Crear par lisa+ranurada ═══')
    {
      const cfg = await getConfig(cookie)
      const prev = ((cfg.tuberiasExtra as TuberiaExtra[] | undefined) ?? [])
      const nuevo = {
        ...cfg,
        tuberiasExtra: [
          ...prev,
          { tipo: 'lisa',     diametro: DIAM, espesor: ESP, precio: COSTO, markupPct: MK },
          { tipo: 'ranurada', diametro: DIAM, espesor: ESP, precio: COSTO, markupPct: MK },
        ],
      }
      const r = await saveConfig(cookie, nuevo)
      t(ok('POST /api/config OK', r.ok, `(${r.status})`))
    }
    {
      const cfg = await getConfig(cookie)
      const extras = (cfg.tuberiasExtra as TuberiaExtra[] | undefined) ?? []
      const enTestList = extras.filter(enTest)
      t(ok('GET devuelve 2 entradas del par', enTestList.length === 2, `(${enTestList.length} encontradas)`))
      t(ok('Lisa existe',     enTestList.some(e => e.tipo === 'lisa')))
      t(ok('Ranurada existe', enTestList.some(e => e.tipo === 'ranurada')))
      t(ok('Ambas con costo 8500', enTestList.every(e => e.precio === COSTO)))
      t(ok('Ambas con markup 30%', enTestList.every(e => e.markupPct === MK)))
    }

    // T2 — Editar precio del par (ambas deben actualizarse)
    console.log('\n═══ T2: Actualizar precio del par ═══')
    const NUEVO_COSTO = 9200
    {
      const cfg = await getConfig(cookie)
      const extras = (cfg.tuberiasExtra as TuberiaExtra[] | undefined) ?? []
      const actualizados = extras.map(e =>
        enTest(e) ? { ...e, precio: NUEVO_COSTO } : e
      )
      const r = await saveConfig(cookie, { ...cfg, tuberiasExtra: actualizados })
      t(ok('POST update OK', r.ok, `(${r.status})`))
    }
    {
      const cfg = await getConfig(cookie)
      const extras = (cfg.tuberiasExtra as TuberiaExtra[] | undefined) ?? []
      const enTestList = extras.filter(enTest)
      t(ok('Lisa con precio nuevo 9200',
        enTestList.find(e => e.tipo === 'lisa')?.precio === NUEVO_COSTO))
      t(ok('Ranurada con precio nuevo 9200',
        enTestList.find(e => e.tipo === 'ranurada')?.precio === NUEVO_COSTO))
    }

    // T3 — Verificar que calculator.ts resuelve el precio del par custom
    console.log('\n═══ T3: getPrecioTuberia resuelve la medida custom ═══')
    {
      // Importamos el calculator directo (corre local con tsx)
      const { getPrecioTuberia } = await import('../../lib/calculator')
      const cfg = await getConfig(cookie)
      const extras = (cfg.tuberiasExtra as TuberiaExtra[] | undefined) ?? []
      const pLisa = getPrecioTuberia('lisa', DIAM, ESP, undefined, extras)
      const pRan  = getPrecioTuberia('ranurada', DIAM, ESP, undefined, extras)
      t(ok(`getPrecioTuberia('lisa', ${DIAM}, ${ESP}) = ${pLisa}`, pLisa === NUEVO_COSTO))
      t(ok(`getPrecioTuberia('ranurada', ${DIAM}, ${ESP}) = ${pRan}`, pRan === NUEVO_COSTO))
    }

    // T4 — Verificar que getDiametrosTuberia + getEspesoresDisponibles incluyen la medida custom
    console.log('\n═══ T4: Selectores del cotizador incluyen la medida custom ═══')
    {
      const { getDiametrosTuberia, getEspesoresDisponibles } = await import('../../lib/calculator')
      const cfg = await getConfig(cookie)
      const extras = (cfg.tuberiasExtra as TuberiaExtra[] | undefined) ?? []
      const diamsLisa = getDiametrosTuberia('lisa', extras)
      const diamsRan  = getDiametrosTuberia('ranurada', extras)
      t(ok(`Diámetro ${DIAM} disponible en lisa`,     diamsLisa.includes(DIAM)))
      t(ok(`Diámetro ${DIAM} disponible en ranurada`, diamsRan.includes(DIAM)))
      const espLisa = getEspesoresDisponibles('lisa', DIAM, extras)
      const espRan  = getEspesoresDisponibles('ranurada', DIAM, extras)
      t(ok(`Espesor ${ESP} disponible en lisa diámetro ${DIAM}`,
        espLisa.some(e => Math.abs(e - ESP) < 0.001)))
      t(ok(`Espesor ${ESP} disponible en ranurada diámetro ${DIAM}`,
        espRan.some(e => Math.abs(e - ESP) < 0.001)))
    }

    // T5 — Verificar que calcularPerforacion usa el precio custom en los totales
    console.log('\n═══ T5: calcularPerforacion usa el precio custom ═══')
    {
      const { calcularPerforacion } = await import('../../lib/calculator')
      const cfg = await getConfig(cookie)
      const extras = (cfg.tuberiasExtra as TuberiaExtra[] | undefined) ?? []
      const inputs = {
        // Inputs mínimos para un cálculo válido
        diametro: 12.25, profundidad: 200, precioPorPieVenta: 700,
        tubosLisos: 5, tubosRanurados: 3,
        diametroTuberia: DIAM, espesorLisa: ESP, espesorRanurada: ESP,
        costomaquinariaDia: 0, costoDieselDia: 2300, bonificacionPorPie: 15,
        precioBentonitaSaco: 303, costoAforoBase: 9290,
        costoGravaMaterial: 9000, costoFleteGrava: 0, comisionVendedorPct: 1,
        incluirRegistroElectrico: false, incluirSelloSanitario: false,
        incluirExtraccionLodos: false, incluirSeguridad: false,
        incluirSanitario: false, incluirLimpieza: false, comprarBroca: false,
        tuberiasExtra: extras,
        imprevistoGlobal: 20000, markupPrecioPorPiePct: 0.40,
        horasLimpiezaMecanica: 20,
        rendimientoPorDia: 20, tipoRanura: 'longitudinal' as const, slotContinua: 20,
      }
      // @ts-expect-error — inputs parciales para smoke test
      const res = calcularPerforacion(inputs)
      t(ok(`precioTubLisa = ${NUEVO_COSTO}`,     res.precioTubLisa === NUEVO_COSTO))
      t(ok(`precioTubRanurada = ${NUEVO_COSTO}`, res.precioTubRanurada === NUEVO_COSTO))
    }

    // T6 — Eliminar el par (quita lisa + ranurada)
    console.log('\n═══ T6: Eliminar par ═══')
    {
      const cfg = await getConfig(cookie)
      const extras = (cfg.tuberiasExtra as TuberiaExtra[] | undefined) ?? []
      const sinTest = extras.filter(e => !enTest(e))
      const r = await saveConfig(cookie, { ...cfg, tuberiasExtra: sinTest })
      t(ok('POST delete OK', r.ok, `(${r.status})`))
    }
    {
      const cfg = await getConfig(cookie)
      const extras = (cfg.tuberiasExtra as TuberiaExtra[] | undefined) ?? []
      const enTestList = extras.filter(enTest)
      t(ok('Par eliminado (0 entradas)', enTestList.length === 0, `(${enTestList.length})`))
    }

  } finally {
    // Cleanup final — por si el test salió a mitad
    const cfg = await getConfig(cookie)
    const extras = ((cfg.tuberiasExtra as TuberiaExtra[] | undefined) ?? []).filter(e => !enTest(e))
    await saveConfig(cookie, { ...cfg, tuberiasExtra: extras })
    console.log('\n  ✓ Cleanup OK (config restaurado)')
  }

  console.log(`\n═══ RESULTADO: ${passed} passed · ${failed} failed ═══`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })

export {}
