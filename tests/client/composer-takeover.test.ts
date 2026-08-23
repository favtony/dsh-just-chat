import { describe, expect, it, vi } from 'vitest'
import { isComposerDisabled } from '../../src/client/ComposerBar.tsx'
import { createComposerTakeover } from '../../src/client/composer-takeover.ts'
import type { PendingDraftState } from '../../src/client/stores/pending-draft-store.ts'

function source<T>(initial: T) {
  let snapshot = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set: (next: T) => {
      snapshot = next
      for (const listener of [...listeners]) listener()
    },
  }
}

describe('临时输入栏注册', () => {
  it('只在无会话且存在待选模式时覆盖，并在交接释放后恢复官方输入栏', () => {
    const pending = source<PendingDraftState>({ mode: 'none', draft: '' })
    const sessions = source<{ current: string | undefined }>({ current: undefined })
    const unregister = vi.fn()
    const register = vi.fn(() => unregister)
    const takeover = createComposerTakeover({ pending, sessions, register })

    expect(register).not.toHaveBeenCalled()
    pending.set({ mode: 'just-chat', draft: '首条消息' })
    expect(register).toHaveBeenCalledTimes(1)

    sessions.set({ current: 'session-1' })
    expect(unregister).not.toHaveBeenCalled()
    takeover.release()
    expect(unregister).toHaveBeenCalledTimes(1)

    sessions.set({ current: undefined })
    expect(register).toHaveBeenCalledTimes(2)
    takeover.dispose()
    expect(unregister).toHaveBeenCalledTimes(2)
  })

  it('在无会话时清除待选模式会撤销覆盖', () => {
    const pending = source<PendingDraftState>({ mode: 'just-chat', draft: '草稿' })
    const sessions = source<{ current: string | undefined }>({ current: undefined })
    const unregister = vi.fn()
    const takeover = createComposerTakeover({ pending, sessions, register: () => unregister })

    pending.set({ mode: 'none', draft: '' })
    expect(unregister).toHaveBeenCalledTimes(1)
    takeover.dispose()
  })
})

describe('只聊天输入栏启用条件', () => {
  it('只忽略只聊天无会话状态下的宿主 disabled', () => {
    expect(isComposerDisabled({
      ownerDisabled: true,
      blocked: false,
      busy: false,
      submission: 'idle',
      mode: 'just-chat',
      realSession: false,
    })).toBe(false)
    expect(isComposerDisabled({
      ownerDisabled: true,
      blocked: false,
      busy: false,
      submission: 'idle',
      mode: 'workspace',
      realSession: false,
    })).toBe(true)
    expect(isComposerDisabled({
      ownerDisabled: true,
      blocked: false,
      busy: false,
      submission: 'preparing',
      mode: 'just-chat',
      realSession: false,
    })).toBe(true)
  })
})
