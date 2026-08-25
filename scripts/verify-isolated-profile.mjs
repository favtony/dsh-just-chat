import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { spawn, spawnSync } from 'node:child_process'
import { delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import {
  createChildEnvironment,
  createIsolatedEnvironment,
} from './isolated-environment.mjs'

const PACKAGE_NAME = 'dsh-just-chat'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const START_TIMEOUT_MS = 15_000

const dshInvocation = (() => {
  if (process.platform !== 'win32') return { command: 'dsh', prefix: [] }
  const path = process.env.PATH
  if (path === undefined) throw new Error('PATH is required to locate dsh')
  const binDir = path.split(delimiter).find(dir => existsSync(join(dir, 'dsh.ps1')) || existsSync(join(dir, 'dsh.cmd')))
  if (binDir === undefined) throw new Error('dsh shim was not found on PATH')
  return { command: process.execPath, prefix: [join(binDir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')] }
})()

const environment = await createIsolatedEnvironment()
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

async function reservePort() {
  const server = createServer()
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen({ host: '127.0.0.1', port: 0 }, resolveListen)
  })
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('无法为隔离 Web 验证分配本地端口。')
  await new Promise((resolveClose, rejectClose) => server.close(error => error === undefined ? resolveClose(undefined) : rejectClose(error)))
  return address.port
}

async function verifyWebStartup(port) {
  const child = spawn(dshInvocation.command, [...dshInvocation.prefix, 'web', '--port', String(port), '--no-open'], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const exited = new Promise(resolveExit => child.once('exit', resolveExit))
  const output = []
  child.stdout.on('data', chunk => output.push(String(chunk)))
  child.stderr.on('data', chunk => output.push(String(chunk)))

  try {
    const deadline = Date.now() + START_TIMEOUT_MS
    const url = `http://127.0.0.1:${port}/`
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`dsh web 在启动前退出（${child.exitCode}）：${output.join('')}`)
      try {
        const response = await fetch(url)
        if (response.ok) return
      } catch {}
      await delay(100)
    }
    throw new Error(`dsh web 未在 ${START_TIMEOUT_MS}ms 内启动：${output.join('')}`)
  } finally {
    if (child.exitCode === null) child.kill()
    await exited
  }
}

try {
  run(['plugin', '--profile', 'web', 'add', `link:${root}`])
  const profile = 'web'
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
  await verifyWebStartup(await reservePort())
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
