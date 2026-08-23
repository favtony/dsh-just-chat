import { randomUUID } from 'node:crypto'
import { lstat, mkdir, mkdtemp, open, readFile, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

export const ISOLATION_PREFIX = 'dsh-just-chat-isolation-'
export const OWNER_FILENAME = '.dsh-just-chat-owner.json'
export const DELETE_CONFIRMATION = '--confirm-delete'
const OWNER_PURPOSE = 'dsh-just-chat-isolation'
const OWNER_VERSION = 1
const OWNER_TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function comparable(path) {
  const normalized = resolve(path)
  return process.platform === 'win32' ? normalized.toLocaleLowerCase('en-US') : normalized
}

function pathsEqual(left, right) {
  return comparable(left) === comparable(right)
}

export function isStrictDescendant(parent, child) {
  const childRelative = relative(parent, child)
  return childRelative !== ''
    && childRelative !== '..'
    && !childRelative.startsWith(`..${sep}`)
    && !isAbsolute(childRelative)
}

/** 只认可系统临时目录中由固定前缀分配的直接子目录。 */
export function validateIsolationLocation(temporaryRoot, sandboxRoot) {
  if (!isAbsolute(temporaryRoot) || !isAbsolute(sandboxRoot)) {
    throw new Error('隔离目录和系统临时目录都必须是绝对路径。')
  }
  if (!pathsEqual(dirname(sandboxRoot), temporaryRoot)) {
    throw new Error('隔离目录不是系统临时目录的直接子目录。')
  }
  const name = basename(sandboxRoot)
  if (!name.startsWith(ISOLATION_PREFIX) || name.length === ISOLATION_PREFIX.length) {
    throw new Error('隔离目录名称不具有有效的固定前缀和随机后缀。')
  }
}

/** 校验磁盘标记确实声明当前隔离根目录和所有权编号。 */
export function validateOwnerMarker(marker, sandboxRoot, token) {
  if (typeof marker !== 'object' || marker === null || Array.isArray(marker)) {
    throw new Error('隔离目录所有权标记不是对象。')
  }
  const keys = Object.keys(marker).sort().join(',')
  if (keys !== 'purpose,sandboxRoot,token,version') {
    throw new Error('隔离目录所有权标记字段无效。')
  }
  if (marker.version !== OWNER_VERSION || marker.purpose !== OWNER_PURPOSE) {
    throw new Error('隔离目录所有权标记用途或版本无效。')
  }
  if (typeof marker.token !== 'string' || !OWNER_TOKEN_PATTERN.test(marker.token) || marker.token !== token) {
    throw new Error('隔离目录所有权编号不匹配。')
  }
  if (typeof marker.sandboxRoot !== 'string' || !pathsEqual(marker.sandboxRoot, sandboxRoot)) {
    throw new Error('隔离目录所有权标记中的路径不匹配。')
  }
}

function ownerRecord(sandboxRoot, token) {
  return {
    version: OWNER_VERSION,
    purpose: OWNER_PURPOSE,
    sandboxRoot,
    token,
  }
}

async function assertPlainDirectory(path, label) {
  const info = await lstat(path)
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error(`${label}不是普通目录。`)
  }
}

async function assertPlainFile(path, label) {
  const info = await lstat(path)
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`${label}不是普通文件。`)
  }
}

/** 创建本次验证独占的隔离根目录及两个环境子目录。 */
export async function createIsolatedEnvironment() {
  const temporaryRoot = await realpath(tmpdir())
  const sandboxRoot = await mkdtemp(join(temporaryRoot, ISOLATION_PREFIX))
  const canonicalSandboxRoot = await realpath(sandboxRoot)
  validateIsolationLocation(temporaryRoot, canonicalSandboxRoot)
  await assertPlainDirectory(canonicalSandboxRoot, '隔离根目录')

  const token = randomUUID()
  const ownerPath = join(canonicalSandboxRoot, OWNER_FILENAME)
  const owner = await open(ownerPath, 'wx', 0o600)
  try {
    await owner.writeFile(`${JSON.stringify(ownerRecord(canonicalSandboxRoot, token), undefined, 2)}\n`, 'utf8')
  } finally {
    await owner.close()
  }

  const dshHome = join(canonicalSandboxRoot, 'dsh-home')
  const agentsHome = join(canonicalSandboxRoot, 'agents-home')
  await mkdir(dshHome)
  await mkdir(agentsHome)

  return assertIsolatedEnvironment({ sandboxRoot: canonicalSandboxRoot, dshHome, agentsHome, token })
}

/** 删除前重新从磁盘证明目标属于本项目创建的隔离目录。 */
export async function assertOwnedIsolationRoot(sandboxRoot, token) {
  if (!isAbsolute(sandboxRoot) || typeof token !== 'string' || !OWNER_TOKEN_PATTERN.test(token)) {
    throw new Error('清理目标必须包含绝对隔离目录和所有权编号。')
  }
  await assertPlainDirectory(sandboxRoot, '清理目标')
  const temporaryRoot = await realpath(tmpdir())
  const canonicalSandboxRoot = await realpath(sandboxRoot)
  validateIsolationLocation(temporaryRoot, canonicalSandboxRoot)

  const markerPath = join(canonicalSandboxRoot, OWNER_FILENAME)
  await assertPlainFile(markerPath, '隔离目录所有权标记')
  const markerText = await readFile(markerPath, 'utf8')
  let marker
  try {
    marker = JSON.parse(markerText)
  } catch {
    throw new Error('隔离目录所有权标记不是有效 JSON。')
  }
  validateOwnerMarker(marker, canonicalSandboxRoot, token)
  return { temporaryRoot, sandboxRoot: canonicalSandboxRoot, token }
}

/** 运行 DSH 前证明两个环境目录仍是隔离根目录的普通严格后代。 */
export async function assertIsolatedEnvironment(environment) {
  const owned = await assertOwnedIsolationRoot(environment.sandboxRoot, environment.token)
  await assertPlainDirectory(environment.dshHome, 'DSH_HOME')
  await assertPlainDirectory(environment.agentsHome, 'DSH_AGENTS_HOME')
  const dshHome = await realpath(environment.dshHome)
  const agentsHome = await realpath(environment.agentsHome)
  if (!isStrictDescendant(owned.sandboxRoot, dshHome) || !isStrictDescendant(owned.sandboxRoot, agentsHome)) {
    throw new Error('DSH 环境目录不在隔离根目录内。')
  }
  if (!pathsEqual(dshHome, join(owned.sandboxRoot, 'dsh-home'))
    || !pathsEqual(agentsHome, join(owned.sandboxRoot, 'agents-home'))) {
    throw new Error('DSH 环境目录不是隔离根目录下的固定子目录。')
  }
  return Object.freeze({ sandboxRoot: owned.sandboxRoot, dshHome, agentsHome, token: owned.token })
}

/** 构造子进程环境，不修改父进程 process.env。 */
export function createChildEnvironment(environment, baseEnvironment = process.env) {
  return {
    ...baseEnvironment,
    DSH_HOME: environment.dshHome,
    DSH_AGENTS_HOME: environment.agentsHome,
  }
}

/** 只接受显式命名参数；清理目标和编号不会从环境变量推导。 */
export function parseCleanupRequest(args) {
  let sandboxRoot
  let token
  let confirmed = false

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--sandbox-root' && sandboxRoot === undefined) {
      sandboxRoot = args[index + 1]
      index += 1
    } else if (argument === '--owner-token' && token === undefined) {
      token = args[index + 1]
      index += 1
    } else if (argument === DELETE_CONFIRMATION && !confirmed) {
      confirmed = true
    } else {
      throw new Error(`未知、重复或缺少值的清理参数：${argument ?? '<空>'}`)
    }
  }

  if (typeof sandboxRoot !== 'string' || !isAbsolute(sandboxRoot)) {
    throw new Error('必须通过 --sandbox-root 提供绝对隔离目录。')
  }
  if (typeof token !== 'string' || !OWNER_TOKEN_PATTERN.test(token)) {
    throw new Error('必须通过 --owner-token 提供有效的所有权编号。')
  }
  if (!confirmed) {
    throw new Error(`清理前必须取得用户确认并传入 ${DELETE_CONFIRMATION}。`)
  }

  return Object.freeze({ sandboxRoot, token })
}

/** 只能删除重新通过所有权证明的隔离根目录。 */
export async function removeOwnedIsolation(sandboxRoot, token) {
  const owned = await assertOwnedIsolationRoot(sandboxRoot, token)
  await rm(owned.sandboxRoot, { recursive: true, force: false })
}
