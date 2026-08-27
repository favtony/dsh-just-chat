import { existsSync, readFileSync } from 'node:fs'
import { delimiter, dirname, join, resolve } from 'node:path'
import process from 'node:process'

const EXPECTED_VERSION = '0.1.1-rc.2'
const HOST_PACKAGES = [
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-ui-renderer',
  '@deepseek-ai/dsh-client-ui-layout',
  '@deepseek-ai/dsh-client-ui-workspace',
  '@deepseek-ai/dsh-client-ui-conversation',
] as const

function packageManifest(root: string, name: string): { version?: unknown } | undefined {
  const file = join(root, 'node_modules', ...name.split('/'), 'package.json')
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as { version?: unknown }
  } catch {
    return undefined
  }
}

function ancestors(start: string | undefined): string[] {
  if (start === undefined || start === '') return []
  const result: string[] = []
  let current = resolve(start)
  while (true) {
    result.push(current)
    const parent = dirname(current)
    if (parent === current) return result
    current = parent
  }
}

function dshRoots(): string[] {
  const roots: string[] = []
  for (const entry of (process.env.PATH ?? '').split(delimiter)) {
    if (entry === '') continue
    const candidates = [
      join(entry, 'node_modules', '@deepseek-ai', 'dsh'),
      join(entry, '..', 'lib', 'node_modules', '@deepseek-ai', 'dsh'),
    ]
    for (const candidate of candidates) {
      if (existsSync(join(candidate, 'package.json'))) roots.push(resolve(candidate))
    }
  }
  return roots
}

function hostRoots(): string[] {
  return [...new Set([
    ...ancestors(process.cwd()),
    ...ancestors(process.env.INIT_CWD),
    ...ancestors(process.env.npm_config_local_prefix),
    ...dshRoots(),
  ])]
}

function findHostPackage(name: string): { root: string; version: string } | undefined {
  for (const root of hostRoots()) {
    for (const candidate of [root, join(root, 'node_modules', '@deepseek-ai', 'dsh')]) {
      const version = packageManifest(candidate, name)?.version
      if (typeof version === 'string') return { root: candidate, version }
    }
  }
  return undefined
}

/** Fail before mounting any routes when the loaded DSH internals are not the tested build. */
export function assertHostCompatibility(): void {
  const found = HOST_PACKAGES.map(name => ({ name, package: findHostPackage(name) }))
  const incompatible = found.filter(item => item.package?.version !== EXPECTED_VERSION)
  if (incompatible.length === 0) return
  const details = found.map(item => `${item.name}=${item.package?.version ?? 'missing'}`).join(', ')
  throw new Error(`dsh-just-chat requires DSH internal packages at exact version ${EXPECTED_VERSION}; found ${details}`)
}
