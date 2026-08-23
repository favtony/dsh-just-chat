// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createJustChatApi, JustChatApiError } from '../../src/client/api.ts'
import { createSubmissionController, SubmissionGate } from '../../src/client/handoff.ts'
import { createPendingDraftStore, setPendingDraft } from '../../src/client/stores/pending-draft-store.ts'
import { createViewStore } from '../../src/client/stores/view-store.ts'
import type { RemoteEvents, SessionId } from '../../src/client/types.ts'

const sid = (value: string) => value as SessionId

type Listener = (sessionId: SessionId, preset: string) => void

function fixture() {
  const listeners = new Set<Listener>()
  const rawRemote = {
    $on: (_event: 'agent-preset/selected', listener: Listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    emit: (sessionId: SessionId, preset = 'minimal') => { for (const listener of [...listeners]) listener(sessionId, preset) },
    size: () => listeners.size,
  }
  const remote = rawRemote as unknown as RemoteEvents & typeof rawRemote
  const api = {
    ...createJustChatApi('/test'),
    prepare: vi.fn(async () => ({ sessionId: sid('s1'), cwd: 'C:/chat/1', createdAt: 1 })),
    activate: vi.fn(async () => ({ sessionId: sid('s1'), cwd: 'C:/chat/1', rootDirectory: 'C:/chat', createdAt: 1, template: 'x', status: 'active' as const })),
  }
  const sessions = {
    create: vi.fn(async () => undefined),
    open: vi.fn(),
    list: { getSnapshot: () => ({ byId: { s1: { agentPreset: 'minimal' } } }) },
  }
  const viewStore = createViewStore()
  const pendingStore = createPendingDraftStore()
  const controller = createSubmissionController({ api, sessions, remote, viewStore, pendingStore })
  return { api, sessions, remote, viewStore, pendingStore, controller }
}

beforeEach(() => { localStorage.clear(); vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('SubmissionGate', () => {
  it('resolves once for the matching event and ignores a late timer', () => {
    const resolve = vi.fn()
    const gate = new SubmissionGate(sid('s1'), resolve)
    gate.arm(3000)
    gate.signal(sid('other'))
    expect(resolve).not.toHaveBeenCalled()
    gate.signal(sid('s1'))
    vi.advanceTimersByTime(3000)
    expect(resolve).toHaveBeenCalledTimes(1)
  })

  it('resolves once for the timer and ignores a late event', () => {
    const resolve = vi.fn()
    const gate = new SubmissionGate(sid('s1'), resolve)
    gate.arm(3000)
    vi.advanceTimersByTime(2999)
    expect(resolve).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    gate.signal(sid('s1'))
    expect(resolve).toHaveBeenCalledTimes(1)
  })

  it('keeps a pre-arm matching event as the winning signal', () => {
    const resolve = vi.fn()
    const gate = new SubmissionGate(sid('s1'), resolve)
    gate.signal(sid('s1'))
    gate.arm(3000)
    vi.advanceTimersByTime(3000)
    expect(resolve).toHaveBeenCalledTimes(1)
  })
})

describe('submission gate', () => {
  it('registers before prepare, accepts the matching preset event, and hands off once', async () => {
    const f = fixture()
    setPendingDraft(f.pendingStore, 'just-chat', '首条消息')
    const submission = f.controller.startPreparation('首条消息')
    expect(f.remote.size()).toBe(1)
    await submission
    expect(f.viewStore.getSnapshot().submission).toBe('waitingPreset')
    expect(f.controller.ownsSession(sid('s1'))).toBe(true)
    expect(f.controller.ownsSession(sid('other'))).toBe(false)
    expect(f.viewStore.getSnapshot().active).toEqual([{
      sessionId: sid('s1'), cwd: 'C:/chat/1', rootDirectory: 'C:/chat', createdAt: 1, template: 'x', status: 'active',
    }])

    f.remote.emit(sid('s1'))
    expect(f.viewStore.getSnapshot().submission).toBe('handingOff')
    expect(f.controller.takeHandoff(sid('s1'))).toBe('首条消息')
    expect(f.controller.takeHandoff(sid('s1'))).toBeUndefined()
    f.controller.completeHandoff(sid('s1'))

    expect(f.pendingStore.getSnapshot()).toEqual({ mode: 'none', draft: '' })
    expect(f.controller.ownsSession(sid('s1'))).toBe(false)
    expect(f.remote.size()).toBe(0)
  })

  it('uses the three-second timer once and ignores a late preset event', async () => {
    const f = fixture()
    await f.controller.startPreparation('延迟消息')
    expect(f.viewStore.getSnapshot().submission).toBe('waitingPreset')

    vi.advanceTimersByTime(2999)
    expect(f.viewStore.getSnapshot().submission).toBe('waitingPreset')
    vi.advanceTimersByTime(1)
    expect(f.viewStore.getSnapshot().submission).toBe('handingOff')
    expect(f.remote.size()).toBe(0)
    f.remote.emit(sid('s1'))
    expect(f.controller.takeHandoff(sid('s1'))).toBe('延迟消息')
    expect(f.controller.takeHandoff(sid('s1'))).toBeUndefined()
  })

  it('rejects duplicate submissions while the first preparation is in flight', async () => {
    const f = fixture()
    let release!: (value: { sessionId: SessionId; cwd: string; createdAt: number }) => void
    f.api.prepare.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    const first = f.controller.startPreparation('一次')
    const second = f.controller.startPreparation('二次')
    release({ sessionId: sid('s1'), cwd: 'C:/chat/1', createdAt: 1 })
    await Promise.all([first, second])

    expect(f.api.prepare).toHaveBeenCalledTimes(1)
    expect(f.sessions.create).toHaveBeenCalledTimes(1)
    expect(f.sessions.open).toHaveBeenCalledTimes(1)
  })

  it('缺少根目录时保留草稿、请求打开设置，并允许修正后重试', async () => {
    const f = fixture()
    setPendingDraft(f.pendingStore, 'just-chat', '失败后保留')
    f.api.prepare.mockRejectedValueOnce(new JustChatApiError('settings-missing-root', '根目录未配置'))
    await f.controller.startPreparation('失败后保留')

    expect(f.viewStore.getSnapshot().submission).toBe('error')
    expect(f.viewStore.getSnapshot().settingsSectionRequest).toBe('conversation-directory')
    expect(f.pendingStore.getSnapshot()).toEqual({ mode: 'just-chat', draft: '失败后保留' })
    expect(f.remote.size()).toBe(0)

    await f.controller.startPreparation('失败后保留')
    expect(f.api.prepare).toHaveBeenCalledTimes(2)
    expect(f.sessions.create).toHaveBeenCalledTimes(1)
    expect(f.viewStore.getSnapshot().submission).toBe('waitingPreset')
    expect(f.viewStore.getSnapshot().settingsSectionRequest).toBeUndefined()
  })
})
