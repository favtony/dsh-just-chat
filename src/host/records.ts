import { defineDomain, domainTable, type Domain, type KvTable } from '@deepseek-ai/dsh-storage-domain'
import { JustChatError } from '../shared/errors.ts'
import type { ConversationRecord, ConversationStatus } from '../shared/types.ts'

interface RecordSchema {
  parse(value: unknown): ConversationRecord
  safeParse(value: unknown): { success: true; data: ConversationRecord } | { success: false; error: Error }
}

const recordSchema: RecordSchema = {
  parse(value: unknown): ConversationRecord {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('record must be an object')
    const record = value as Record<string, unknown>
    const keys = Object.keys(record).sort().join(',')
    if (keys !== 'createdAt,cwd,rootDirectory,sessionId,status,template') throw new Error('record fields are invalid')
    if (typeof record.sessionId !== 'string' || record.sessionId.length === 0) throw new Error('sessionId is invalid')
    if (typeof record.cwd !== 'string' || record.cwd.length === 0) throw new Error('cwd is invalid')
    if (typeof record.rootDirectory !== 'string' || record.rootDirectory.length === 0) throw new Error('rootDirectory is invalid')
    if (typeof record.template !== 'string' || record.template.length === 0) throw new Error('template is invalid')
    if (typeof record.createdAt !== 'number' || !Number.isSafeInteger(record.createdAt) || record.createdAt < 0) throw new Error('createdAt is invalid')
    if (record.status !== 'prepared' && record.status !== 'active') throw new Error('status is invalid')
    return Object.freeze({
      sessionId: record.sessionId,
      cwd: record.cwd,
      rootDirectory: record.rootDirectory,
      createdAt: record.createdAt,
      template: record.template,
      status: record.status,
    })
  },
  safeParse(value: unknown) {
    try {
      return { success: true, data: this.parse(value) }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) }
    }
  },
}

/** Durable domain declaration for automatic conversation classification. */
export const conversationDomainSpec = defineDomain({
  name: 'dsh_just_chat',
  version: 1,
  tables: {
    conversations: domainTable<string, ConversationRecord>(recordSchema as never),
  },
})

/** A typed store over the official storage-domain table. */
export class ConversationRecordStore {
  private readonly table: KvTable<string, ConversationRecord>

  constructor(table: KvTable<string, ConversationRecord>) {
    this.table = table
  }

  /** Read one record by its preallocated session id. */
  get(sessionId: string): ConversationRecord | undefined {
    return this.table.get(sessionId)
  }

  /** Return a stable snapshot of every stored classification record. */
  list(): readonly ConversationRecord[] {
    return [...this.table.entries()].map(([, record]) => record)
  }

  /** Persist one prepared record before exposing its id to the caller. */
  async put(record: ConversationRecord): Promise<void> {
    await this.table.put(record.sessionId, record)
  }

  /** Mark one prepared record active, preserving every immutable field. */
  async activate(sessionId: string, cwd: string): Promise<ConversationRecord> {
    const current = this.table.get(sessionId)
    if (current === undefined) throw new JustChatError('record-not-found', 'The preparation record no longer exists.', 404)
    if (current.cwd !== cwd) throw new JustChatError('record-cwd-mismatch', 'The preparation directory does not match the stored record.', 409)
    if (current.status === 'active') return current
    const next = await this.table.update(sessionId, record => ({ ...record, status: 'active' as ConversationStatus }))
    return next
  }

  /** Remove an abandoned classification record while leaving its directory untouched. */
  async delete(sessionId: string): Promise<void> {
    await this.table.delete(sessionId)
  }

  /** Return active records in their initial sidebar order. */
  active(excludedSessionIds: ReadonlySet<string> = new Set()): readonly ConversationRecord[] {
    return this.list()
      .filter(record => record.status === 'active' && !excludedSessionIds.has(record.sessionId))
      .sort((left, right) => right.createdAt - left.createdAt || left.sessionId.localeCompare(right.sessionId))
  }
}

/** Open the plugin domain through the injected official facility. */
export async function openConversationRecords(ctx: { storageDomain: { open<S extends typeof conversationDomainSpec>(spec: S): Promise<Domain<S>> } }): Promise<{ domain: Domain<typeof conversationDomainSpec>; records: ConversationRecordStore }> {
  const domain = await ctx.storageDomain.open(conversationDomainSpec)
  return { domain, records: new ConversationRecordStore(domain.table('conversations')) }
}
