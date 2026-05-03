import { spawnSync } from 'node:child_process'

const isWindows = process.platform === 'win32'
const npm = isWindows ? 'npm.cmd' : 'npm'
const npx = isWindows ? 'npx.cmd' : 'npx'

const steps = [
  { name: 'Repo hygiene', cmd: 'node', args: ['scripts/checks/repo-hygiene.mjs'] },
  { name: 'Prisma schema validate', cmd: npx, args: ['prisma', 'validate'] },
  { name: 'Prisma client generate', cmd: npx, args: ['prisma', 'generate'] },
  { name: 'TypeScript noEmit', cmd: npx, args: ['tsc', '--noEmit', '--incremental', 'false', '--pretty', 'false'] },
  { name: 'Next production build', cmd: npm, args: ['run', 'build'] },
]

for (const step of steps) {
  console.log(`\n==> ${step.name}`)
  const command = isWindows ? [step.cmd, ...step.args].join(' ') : step.cmd
  const args = isWindows ? [] : step.args
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: isWindows,
  })

  if (result.status !== 0) {
    console.error(`\nFAILED: ${step.name}`)
    process.exit(result.status ?? 1)
  }
}

console.log('\nPredeploy checks OK')
