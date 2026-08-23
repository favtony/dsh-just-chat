import { existsSync } from 'node:fs'
import { access, mkdir, readFile } from 'node:fs/promises'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createChildEnvironment,
  createIsolatedEnvironment,
} from './isolated-environment.mjs'

const PACKAGE_NAME = 'dsh-just-chat'
const DSH_VERSION = '0.1.1-rc.2'
const PORT = 3188
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tarball = join(root, '.artifacts', `${PACKAGE_NAME}-0.1.0.tgz`)
const browsePatch = join(root, 'scripts', 'isolated-web-browse.patch.yml')

const dshInvocation = (() => {
  if (process.platform !== 'win32') return { command: 'dsh', prefix: [] }
  const path = process.env.PATH
  if (path === undefined) throw new Error('PATH is required to locate dsh')
  const binDir = path.split(delimiter).find(dir => existsSync(join(dir, 'dsh.ps1')) || existsSync(join(dir, 'dsh.cmd')))
  if (binDir === undefined) throw new Error('dsh shim was not found on PATH')
  return { command: process.execPath, prefix: [join(binDir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')] }
})()

await access(tarball)
await access(browsePatch)
const environment = await createIsolatedEnvironment()
const profile = `${PACKAGE_NAME}-e2e-${environment.token}`
const conversationRoot = join(environment.dshHome, 'conversation-root')
const workspaceRoot = join(environment.dshHome, 'workspace-root')
await mkdir(conversationRoot)
await mkdir(workspaceRoot)
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
}

try {
  run(['plugin', '--profile', profile, 'add', `@deepseek-ai/dsh-web-app@${DSH_VERSION}`, tarball])
  const manifestPath = join(environment.dshHome, 'profiles', profile, 'package.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  if (manifest.dependencies?.['@deepseek-ai/dsh-web-app'] !== DSH_VERSION) {
    throw new Error('隔离 profile 没有固定到指定的官方 Web 包版本。')
  }
  if (typeof manifest.dependencies?.[PACKAGE_NAME] !== 'string') {
    throw new Error('隔离 profile 没有安装待测插件包。')
  }

  process.stdout.write([
    '隔离 Web profile 已准备并启动；目录会在进程退出后保留。',
    `url: http://127.0.0.1:${PORT}`,
    `conversationRoot: ${conversationRoot}`,
    `workspaceRoot: ${workspaceRoot}`,
    `sandboxRoot: ${environment.sandboxRoot}`,
    `ownerToken: ${environment.token}`,
    '',
  ].join(String.fromCharCode(10)))

  const child = spawn(dshInvocation.command, [
    ...dshInvocation.prefix,
    '--profile',
    profile,
    '--patch',
    browsePatch,
    '--port',
    String(PORT),
    '--no-open',
  ], {
    cwd: root,
    env,
    stdio: 'inherit',
  })
  const [code, signal] = await once(child, 'exit')
  const terminatedOnWindows = process.platform === 'win32' && code === 0xFFFFFFFF
  if (code !== 0 && signal === null && !terminatedOnWindows) throw new Error(`隔离 Web 进程退出码：${code}`)
} catch (error) {
  process.stderr.write([
    '隔离 Web profile 启动失败；目录已保留。',
    `sandboxRoot: ${environment.sandboxRoot}`,
    `ownerToken: ${environment.token}`,
    '',
  ].join(String.fromCharCode(10)))
  throw error
}
