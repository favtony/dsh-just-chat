import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createChildEnvironment,
  DELETE_CONFIRMATION,
  ISOLATION_PREFIX,
  parseCleanupRequest,
  validateIsolationLocation,
  validateOwnerMarker,
} from '../../scripts/isolated-environment.mjs'

describe('隔离目录位置', () => {
  const temporaryRoot = resolve(tmpdir())
  const validRoot = join(temporaryRoot, `${ISOLATION_PREFIX}unit-test`)

  it('只接受系统临时目录下带固定前缀的直接子目录', () => {
    expect(() => validateIsolationLocation(temporaryRoot, validRoot)).not.toThrow()
  })

  it.each([
    ['系统临时目录本身', temporaryRoot],
    ['用户目录', resolve(process.env.USERPROFILE ?? join(dirname(temporaryRoot), 'user-home'))],
    ['工作区', resolve(process.cwd(), `${ISOLATION_PREFIX}workspace`)],
    ['临时目录外的同前缀目录', join(dirname(temporaryRoot), `${ISOLATION_PREFIX}outside`)],
    ['临时目录内的嵌套目录', join(validRoot, `${ISOLATION_PREFIX}nested`)],
  ])('拒绝%s', (_label, candidate) => {
    expect(() => validateIsolationLocation(temporaryRoot, candidate)).toThrow()
  })
})

describe('隔离目录所有权标记', () => {
  const sandboxRoot = join(resolve(tmpdir()), `${ISOLATION_PREFIX}unit-test`)
  const token = randomUUID()
  const marker = {
    version: 1,
    purpose: 'dsh-just-chat-isolation',
    sandboxRoot,
    token,
  }

  it('接受路径和所有权编号完全匹配的固定格式', () => {
    expect(() => validateOwnerMarker(marker, sandboxRoot, token)).not.toThrow()
  })

  it.each([
    ['路径不匹配', { ...marker, sandboxRoot: `${sandboxRoot}-other` }, token],
    ['编号不匹配', marker, randomUUID()],
    ['编号格式无效', { ...marker, token: 'not-a-token' }, 'not-a-token'],
    ['出现额外字段', { ...marker, extra: true }, token],
  ])('拒绝%s', (_label, candidate, candidateToken) => {
    expect(() => validateOwnerMarker(candidate, sandboxRoot, candidateToken)).toThrow()
  })
})

describe('子进程环境和清理授权', () => {
  const token = randomUUID()
  const sandboxRoot = join(resolve(tmpdir()), `${ISOLATION_PREFIX}unit-test`)

  it('只覆盖子进程变量，不修改父环境对象', () => {
    const base = { PATH: 'test-bin', DSH_HOME: 'parent-dsh', DSH_AGENTS_HOME: 'parent-agents' }
    const environment = {
      sandboxRoot,
      dshHome: join(sandboxRoot, 'dsh-home'),
      agentsHome: join(sandboxRoot, 'agents-home'),
      token,
    }

    const child = createChildEnvironment(environment, base)

    expect(base).toEqual({ PATH: 'test-bin', DSH_HOME: 'parent-dsh', DSH_AGENTS_HOME: 'parent-agents' })
    expect(child).toEqual({
      PATH: 'test-bin',
      DSH_HOME: environment.dshHome,
      DSH_AGENTS_HOME: environment.agentsHome,
    })
  })

  it('清理请求必须同时给出绝对路径、编号和字面确认参数', () => {
    expect(parseCleanupRequest([
      '--sandbox-root', sandboxRoot,
      '--owner-token', token,
      DELETE_CONFIRMATION,
    ])).toEqual({ sandboxRoot, token })

    expect(() => parseCleanupRequest([
      '--sandbox-root', sandboxRoot,
      '--owner-token', token,
    ])).toThrow()
    expect(() => parseCleanupRequest([
      '--sandbox-root', '.',
      '--owner-token', token,
      DELETE_CONFIRMATION,
    ])).toThrow()
  })
})
