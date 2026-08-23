import { describe, expect, it } from 'vitest'
import { recoverConversationRecords } from '../../src/host/recovery.ts'
import { ConversationRecordStore } from '../../src/host/records.ts'
import { FakeTable, record } from './helpers.ts'

describe('conversation recovery', () => {
  it('activates matching prepared records and deletes records without sessions', async () => {
    const table = new FakeTable()
    const store = new ConversationRecordStore(table as never)
    await store.put(record({ sessionId: 'prepared' }))
    await store.put(record({ sessionId: 'missing', status: 'active' }))
    await recoverConversationRecords(store, { list: async () => [{ id: 'prepared', cwd: 'C:\\root\\child' }] })
    expect(store.get('prepared')).toMatchObject({ status: 'active' })
    expect(store.get('missing')).toBeUndefined()
  })

  it('deletes a cwd mismatch while leaving directory ownership outside recovery', async () => {
    const table = new FakeTable()
    const store = new ConversationRecordStore(table as never)
    await store.put(record({ sessionId: 'mismatch' }))
    await recoverConversationRecords(store, { list: async () => [{ id: 'mismatch', cwd: 'C:\\other' }] })
    expect(store.get('mismatch')).toBeUndefined()
  })
})
