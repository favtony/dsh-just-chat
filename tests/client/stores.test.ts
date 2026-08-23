// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import type { SessionId } from '../../src/client/types.ts'
import { createPendingDraftStore, setPendingDraft } from '../../src/client/stores/pending-draft-store.ts'
import { createConversationOrderStore, setConversationOrder } from '../../src/client/stores/conversation-order-store.ts'
import { createViewStore, setConversationRecords } from '../../src/client/stores/view-store.ts'

const sid = (value: string) => value as SessionId

describe('pending draft store', () => {
  beforeEach(() => { localStorage.clear() })

  it('restores only mode and text after recreating the store', () => {
    const first = createPendingDraftStore()
    setPendingDraft(first, 'just-chat', '  保留这条消息  ')

    const second = createPendingDraftStore()
    expect(second.getSnapshot()).toEqual({ mode: 'just-chat', draft: '  保留这条消息  ' })
  })

  it('does not couple pending draft to a view store', () => {
    const pending = createPendingDraftStore()
    const view = createViewStore()
    setPendingDraft(pending, 'just-chat', '草稿')
    setConversationRecords(view, [])

    expect(pending.getSnapshot()).toEqual({ mode: 'just-chat', draft: '草稿' })
    expect(view.getSnapshot().active).toEqual([])
  })

  it('records an explicit ordinary-workspace handoff separately from just-chat mode', () => {
    const pending = createPendingDraftStore()
    setPendingDraft(pending, 'workspace', '交给普通工作区')

    expect(pending.getSnapshot()).toEqual({ mode: 'workspace', draft: '交给普通工作区' })
  })
})

describe('view store', () => {
  it('keeps prepared records separate', () => {
    const view = createViewStore()
    setConversationRecords(view, [
      { sessionId: sid('active-1'), cwd: 'C:/chat/one', rootDirectory: 'C:/chat', createdAt: 1, template: 'x', status: 'active' },
      { sessionId: sid('prepared-1'), cwd: 'C:/chat/two', rootDirectory: 'C:/chat', createdAt: 2, template: 'x', status: 'prepared' },
    ])
    expect(view.getSnapshot().active.map(record => record.sessionId)).toEqual([sid('active-1')])
    expect(view.getSnapshot().prepared.map(record => record.sessionId)).toEqual([sid('prepared-1')])
  })
})

describe('conversation order store', () => {
  beforeEach(() => { localStorage.clear() })

  it('restores the explicit order after recreating the store', () => {
    const first = createConversationOrderStore()
    setConversationOrder(first, sid('second'), undefined)
    setConversationOrder(first, sid('first'), sid('second'))

    const second = createConversationOrderStore()
    expect(second.getSnapshot().sessionIds).toEqual([sid('first'), sid('second')])
  })
})
