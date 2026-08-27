import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const EXPECTED_VERSION = '0.1.1-rc.2'
const HOST_PACKAGES = [
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-ui-renderer',
  '@deepseek-ai/dsh-client-ui-layout',
  '@deepseek-ai/dsh-client-ui-workspace',
  '@deepseek-ai/dsh-client-ui-conversation',
]

function absolute(value) {
  if (typeof value !== 'string' || value === '') return undefined
  return path.resolve(value)
}

function ancestors(start) {
  const result = []
  let current = absolute(start)
  while (current !== undefined) {
    result.push(current)
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return result
}

function dshInstallRoots() {
  const roots = []
  for (const entry of (process.env.PATH ?? '').split(path.delimiter)) {
    if (entry === '') continue
    for (const candidate of [
      path.join(entry, 'node_modules', '@deepseek-ai', 'dsh'),
      path.join(entry, '..', 'lib', 'node_modules', '@deepseek-ai', 'dsh'),
    ]) {
      if (fs.existsSync(path.join(candidate, 'package.json'))) roots.push(path.resolve(candidate))
    }
  }
  return roots
}

function packageJson(root, name) {
  const candidate = path.join(root, 'node_modules', ...name.split('/'), 'package.json')
  try {
    return JSON.parse(fs.readFileSync(candidate, 'utf8'))
  } catch {
    return undefined
  }
}

function isLocalInstall() {
  const cwd = absolute(process.cwd())
  const init = absolute(process.env.INIT_CWD)
  return cwd !== undefined && init !== undefined && cwd === init && fs.existsSync(path.join(cwd, 'src', 'client', 'index.ts'))
}

if (isLocalInstall()) process.exit(0)

const roots = [...new Set([
  ...ancestors(process.env.INIT_CWD),
  ...ancestors(process.cwd()),
  ...ancestors(process.env.npm_config_local_prefix),
  ...dshInstallRoots(),
])]
const found = HOST_PACKAGES.map(name => {
  for (const root of roots) {
    const version = packageJson(root, name)?.version
    if (typeof version === 'string') return { name, version }
  }
  return { name, version: undefined }
})

if (found.some(item => item.version !== EXPECTED_VERSION)) {
  console.error([
    `dsh-just-chat requires DSH internal packages at exact version ${EXPECTED_VERSION}.`,
    'The target profile and its DSH installation do not contain a compatible host package set.',
    found.map(item => `${item.name}=${item.version ?? 'missing'}`).join(', '),
  ].join('\n'))
  process.exit(1)
}

console.log(`dsh-just-chat host compatibility verified at ${roots[0] ?? process.cwd()}`)
