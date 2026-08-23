import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createChildEnvironment,
  createIsolatedEnvironment,
} from './isolated-environment.mjs'

const PACKAGE_NAME = 'dsh-just-chat'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const dshInvocation = (() => {
  if (process.platform !== 'win32') return { command: 'dsh', prefix: [] }
  const path = process.env.PATH
  if (path === undefined) throw new Error('PATH is required to locate dsh')
  const binDir = path.split(delimiter).find(dir => existsSync(join(dir, 'dsh.ps1')) || existsSync(join(dir, 'dsh.cmd')))
  if (binDir === undefined) throw new Error('dsh shim was not found on PATH')
  return { command: process.execPath, prefix: [join(binDir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')] }
})()

const environment = await createIsolatedEnvironment()
const profile = `${PACKAGE_NAME}-profile-${environment.token}`
const env = createChildEnvironment(environment)

function run(args) {
  const result = spawnSync(dshInvocation.command, [...dshInvocation.prefix, ...args], {
    cwd: root,
    env,
    encoding: 'utf8',
  })
  if (result.error !== undefined) throw result.error
  if (result.status !== 0) {
    throw new Error([`dsh ${args.join(' ')}`, result.stdout, result.stderr].filter(Boolean).join(String.fromCharCode(10)))
  }
  return { stdout: result.stdout, stderr: result.stderr }
}

try {
  run(['plugin', '--profile', profile, 'add', `link:${root}`])
  const manifestPath = join(environment.dshHome, 'profiles', profile, 'package.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const dependency = manifest.dependencies?.[PACKAGE_NAME]
  if (typeof dependency !== 'string' || !dependency.startsWith('link:')) {
    throw new Error(`profile dependency missing: ${PACKAGE_NAME}`)
  }
  const bundles = manifest.dsh?.profile?.bundles
  if (!Array.isArray(bundles) || !bundles.includes(PACKAGE_NAME)) {
    throw new Error(`profile bundle missing: ${PACKAGE_NAME}`)
  }
  const dump = run(['--profile', profile, '--dump-config'])
  if (!dump.stdout.includes(`# == ${PACKAGE_NAME}`)) {
    throw new Error(`dump-config did not include ${PACKAGE_NAME} layer`)
  }
  process.stdout.write([
    '隔离 profile 验证通过；目录已保留。',
    `sandboxRoot: ${environment.sandboxRoot}`,
    `ownerToken: ${environment.token}`,
    '',
  ].join(String.fromCharCode(10)))
} catch (error) {
  process.stderr.write([
    '隔离 profile 验证失败；目录已保留。',
    `sandboxRoot: ${environment.sandboxRoot}`,
    `ownerToken: ${environment.token}`,
    '',
  ].join(String.fromCharCode(10)))
  throw error
}
