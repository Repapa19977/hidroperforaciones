import { spawn, spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import path from 'node:path'

const isWindows = process.platform === 'win32'
const npm = isWindows ? 'npm.cmd' : 'npm'
const root = process.cwd()
const port = process.env.PORT ?? '3000'
const baseUrl = process.env.HIDROCRM_BASE_URL ?? `http://127.0.0.1:${port}`

function run(name, command, args, options = {}) {
  console.log(`\n==> ${name}`)
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: isWindows,
    env: { ...process.env, ...options.env },
  })

  if (result.status !== 0) {
    throw new Error(`${name} fallo con codigo ${result.status ?? 1}`)
  }
}

async function waitForServer(url, timeoutMs = 20_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: 'manual' })
      if (response.status > 0) return
    } catch {
      // esperar y reintentar
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error(`Servidor no respondio en ${timeoutMs / 1000}s: ${url}`)
}

let server

try {
  run('Verify completo', npm, ['run', 'verify'])

  console.log('\n==> Levantando servidor local de produccion')
  rmSync(path.join(root, '.next', 'qa-start.out'), { force: true })
  rmSync(path.join(root, '.next', 'qa-start.err'), { force: true })

  server = spawn(npm, ['run', 'start', '--', '-p', port], {
    cwd: root,
    shell: isWindows,
    stdio: 'ignore',
    detached: false,
    env: process.env,
  })

  await waitForServer(`${baseUrl}/login`)
  run('Smoke local', npm, ['run', 'smoke:local'], {
    env: { HIDROCRM_BASE_URL: baseUrl },
  })

  console.log('\nQA local OK')
} catch (error) {
  console.error(`\nQA local fallo: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
} finally {
  if (server?.pid) {
    try {
      if (isWindows) {
        spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
      } else {
        server.kill('SIGTERM')
      }
    } catch {
      // no-op
    }
  }
}
