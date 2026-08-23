// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConversationHandoff } from '../../src/client/ConversationHandoff.tsx'
import type { SubmissionController } from '../../src/client/handoff.ts'
import type { InputActions, SessionId } from '../../src/client/types.ts'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const mounted: Array<ReturnType<typeof createRoot>> = []

afterEach(() => {
  for (const root of mounted.splice(0)) act(() => { root.unmount() })
})

describe('首条消息交接', () => {
  it('会话先出现时等待交接状态，再向官方输入状态机提交一次', async () => {
    const controller: SubmissionController = {
      startPreparation: vi.fn(async () => undefined),
      ownsSession: vi.fn(() => true),
      takeHandoff: vi.fn(() => '首条消息'),
      completeHandoff: vi.fn(),
      failHandoff: vi.fn(),
    }
    const inputActions = {
      setDraft: vi.fn(),
      submit: vi.fn(),
    } as unknown as InputActions
    const onComplete = vi.fn()
    const container = document.createElement('div')
    const root = createRoot(container)
    mounted.push(root)

    await act(async () => {
      root.render(<ConversationHandoff
        sessionId={'session-1' as SessionId}
        inputActions={inputActions}
        controller={controller}
        ready={false}
        onComplete={onComplete}
      />)
    })
    expect(inputActions.submit).not.toHaveBeenCalled()

    await act(async () => {
      root.render(<ConversationHandoff
        sessionId={'session-1' as SessionId}
        inputActions={inputActions}
        controller={controller}
        ready
        onComplete={onComplete}
      />)
    })

    expect(inputActions.setDraft).toHaveBeenCalledWith('首条消息')
    expect(inputActions.submit).toHaveBeenCalledTimes(1)
    expect(controller.completeHandoff).toHaveBeenCalledWith('session-1')
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
