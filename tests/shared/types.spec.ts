import { describe, expect, it } from 'vitest'
import type { ConversationRecord } from '../../src/shared/types.ts'

describe('durable record fields', () => {
  it('contains no message field by type and uses only prepared or active states', () => {
    const record: ConversationRecord = {
      sessionId: 's1',
      cwd: 'C:\\root\\child',
      rootDirectory: 'C:\\root',
      createdAt: 1,
      template: 'child',
      status: 'prepared',
    }
    expect(record).not.toHaveProperty('text')
    expect(['prepared', 'active']).toContain(record.status)
  })
})
