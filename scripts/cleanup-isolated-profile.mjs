import {
  assertOwnedIsolationRoot,
  parseCleanupRequest,
  removeOwnedIsolation,
} from './isolated-environment.mjs'

const request = parseCleanupRequest(process.argv.slice(2))
const owned = await assertOwnedIsolationRoot(request.sandboxRoot, request.token)

process.stdout.write([
  '已核对清理目标：',
  `sandboxRoot: ${owned.sandboxRoot}`,
  `ownerToken: ${owned.token}`,
  '',
].join(String.fromCharCode(10)))

await removeOwnedIsolation(owned.sandboxRoot, owned.token)
process.stdout.write(`已删除隔离目录：${owned.sandboxRoot}${String.fromCharCode(10)}`)
