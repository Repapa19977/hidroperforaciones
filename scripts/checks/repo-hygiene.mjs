import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const ignoredDirs = new Set([
  '.git',
  '.next',
  'node_modules',
  'coverage',
  'out',
  'build',
])

const ignoredPathParts = [
  ['lib', 'generated', 'prisma'],
]

const textExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.prisma',
  '.sh',
  '.sql',
  '.ts',
  '.tsx',
  '.txt',
  '.yml',
  '.yaml',
])

const conflictPatterns = [
  /^<{7} .+$/m,
  /^={7}$/m,
  /^>{7} .+$/m,
]

const forbiddenPatterns = [
  { pattern: /\bconsole\.log\s*\(/, label: 'console.log' },
  { pattern: /\bdebugger\b/, label: 'debugger' },
]

const guardedSourceRoots = new Set(['app', 'components', 'lib'])

function isIgnored(filePath) {
  const relative = path.relative(root, filePath)
  const parts = relative.split(path.sep)

  if (parts.some(part => ignoredDirs.has(part))) return true

  return ignoredPathParts.some(ignored =>
    ignored.every((part, index) => parts[index] === part)
  )
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (isIgnored(fullPath)) continue
    if (entry.isDirectory()) walk(fullPath, files)
    if (entry.isFile()) files.push(fullPath)
  }
  return files
}

function rel(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, '/')
}

function shouldReadAsText(filePath) {
  return textExtensions.has(path.extname(filePath).toLowerCase())
}

function checkText(files) {
  const issues = []

  for (const file of files) {
    if (!shouldReadAsText(file)) continue

    const content = readFileSync(file, 'utf8')
    if (conflictPatterns.some(pattern => pattern.test(content))) {
      issues.push(`${rel(file)}: marcador de conflicto git`)
    }

    const [firstPart] = rel(file).split('/')
    if (guardedSourceRoots.has(firstPart)) {
      for (const { pattern, label } of forbiddenPatterns) {
        if (pattern.test(content)) {
          issues.push(`${rel(file)}: ${label}`)
        }
      }
    }
  }

  return issues
}

function checkDuplicateFiles(files) {
  const bySize = new Map()

  for (const file of files) {
    const size = statSync(file).size
    if (size === 0) continue
    const group = bySize.get(size) ?? []
    group.push(file)
    bySize.set(size, group)
  }

  const duplicateGroups = []

  for (const group of bySize.values()) {
    if (group.length < 2) continue

    const byHash = new Map()
    for (const file of group) {
      const hash = createHash('sha256').update(readFileSync(file)).digest('hex')
      const hashGroup = byHash.get(hash) ?? []
      hashGroup.push(file)
      byHash.set(hash, hashGroup)
    }

    for (const hashGroup of byHash.values()) {
      if (hashGroup.length > 1) duplicateGroups.push(hashGroup.map(rel))
    }
  }

  return duplicateGroups
}

if (!existsSync(path.join(root, 'package.json'))) {
  console.error('Repo hygiene debe correrse desde la raiz del proyecto.')
  process.exit(1)
}

const files = walk(root)
const textIssues = checkText(files)
const duplicateGroups = checkDuplicateFiles(files)

if (textIssues.length || duplicateGroups.length) {
  console.error('\nRepo hygiene fallo:\n')

  for (const issue of textIssues) {
    console.error(`- ${issue}`)
  }

  for (const group of duplicateGroups) {
    console.error(`- archivos duplicados exactos:\n  ${group.join('\n  ')}`)
  }

  process.exit(1)
}

console.log('Repo hygiene OK')
