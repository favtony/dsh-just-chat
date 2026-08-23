import { describe, expect, it } from 'vitest'
import { ConversationRecordStore } from '../../src/host/records.ts'
import { FakeTable, record } from './helpers.ts'

describe('conversation records', () => {
  it('activates the same record idempotently and lists active records only', async () => {
    const store = new ConversationRecordStore(new FakeTable() as never)
    await store.put(record({ sessionId: 'prepared', createdAt: 1 }))
    await store.put(record({ sessionId: 'active', status: 'active', createdAt: 2 }))
    const first = await store.activate('prepared', 'C:\\root\\child')
    const second = await store.activate('prepared', 'C:\\root\\child')
    expect(second).toEqual(first)
    expect(store.active()).toEqual([record({ sessionId: 'prepared', status: 'active', createdAt: 1 }), record({ sessionId: 'active', status: 'active', createdAt: 2 })].sort((left, right) => right.createdAt - left.createdAt))
  })

  it('rejects activation with a different cwd without changing the record', async () => {
    const store = new ConversationRecordStore(new FakeTable() as never)
    await store.put(record({ sessionId: 'prepared' }))
    await expect(store.activate('prepared', 'C:\\other')).rejects.toMatchObject({ code: 'record-cwd-mismatch' })
    expect(store.get('prepared')).toMatchObject({ status: 'prepared' })
  })
})
