// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ConversationDirectoryOnboarding,
  createConversationDirectoryOnboardingRegistration,
  type ConversationDirectoryRequestSource,
} from '../../src/client/settings/ConversationDirectoryOnboarding.tsx'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const mounted: Array<ReturnType<typeof createRoot>> = []

afterEach(() => {
  for (const root of mounted.splice(0)) act(() => { root.unmount() })
})

function requestSource(initial: 'conversation-directory' | undefined) {
  let snapshot = initial
  const listeners = new Set<() => void>()
  return {
    source: {
      getSnapshot: () => snapshot,
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    } satisfies ConversationDirectoryRequestSource,
    set(next: 'conversation-directory' | undefined) {
      snapshot = next
      for (const listener of [...listeners]) listener()
    },
  }
}

describe('缺少根目录时打开设置', () => {
  it('只在存在请求期间注册引导项', () => {
    const request = requestSource(undefined)
    const unregister = vi.fn()
    const register = vi.fn(() => unregister)
    const dispose = createConversationDirectoryOnboardingRegistration({ request: request.source, register })

    expect(register).not.toHaveBeenCalled()
    request.set('conversation-directory')
    expect(register).toHaveBeenCalledTimes(1)
    request.set(undefined)
    expect(unregister).toHaveBeenCalledTimes(1)
    dispose()
  })

  it('通过公开 owner 打开对话目录并完成一次请求', async () => {
    const openSection = vi.fn()
    const complete = vi.fn()
    const acknowledge = vi.fn()
    const container = document.createElement('div')
    const root = createRoot(container)
    mounted.push(root)

    await act(async () => {
      root.render(<ConversationDirectoryOnboarding
        stepId="conversation-directory-required"
        openSection={openSection}
        complete={complete}
        acknowledge={acknowledge}
      />)
    })

    expect(openSection).toHaveBeenCalledOnce()
    expect(openSection).toHaveBeenCalledWith('plugins')
    expect(complete).toHaveBeenCalledOnce()
    expect(acknowledge).toHaveBeenCalledOnce()
  })
})
