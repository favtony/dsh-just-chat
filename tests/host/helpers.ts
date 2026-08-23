import type { ConversationRecord } from '../../src/shared/types.ts'

export class FakeTable {
  private readonly values = new Map<string, ConversationRecord>()

  get(key: string): ConversationRecord | undefined { return this.values.get(key) }
  entries(): readonly (readonly [string, ConversationRecord])[] { return [...this.values.entries()] }
  async put(key: string, value: ConversationRecord): Promise<void> { this.values.set(key, value) }
  async update(key: string, callback: (value: ConversationRecord) => ConversationRecord): Promise<ConversationRecord> {
    const value = this.values.get(key)
    if (value === undefined) throw new Error('missing record')
    const next = callback(value)
    this.values.set(key, next)
    return next
  }
  async delete(key: string): Promise<void> { this.values.delete(key) }
}

export function record(overrides: Partial<ConversationRecord> = {}): ConversationRecord {
  return {
    sessionId: 'session-1',
    cwd: 'C:\\root\\child',
    rootDirectory: 'C:\\root',
    createdAt: 1,
    template: 'child',
    status: 'prepared',
    ...overrides,
  }
}
