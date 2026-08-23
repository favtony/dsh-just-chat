import { JustChatError } from '../shared/errors.ts'
import { ConversationRecordStore } from './records.ts'

/** Minimal immutable metadata needed from the official session services. */
export interface SessionHeaderLike {
  readonly id: string
  readonly cwd?: string
}

export interface SessionPersistenceLike {
  list(): Promise<readonly SessionHeaderLike[]>
}

export interface LiveSessionLike {
  readonly header: SessionHeaderLike
}

export interface LiveSessionsLike {
  get(id: string): LiveSessionLike | undefined
  list(): readonly LiveSessionLike[]
}

/** Reconcile durable plugin records against official session metadata. */
export async function recoverConversationRecords(
  records: ConversationRecordStore,
  persistence: SessionPersistenceLike,
  liveSessions?: LiveSessionsLike,
): Promise<void> {
  const persisted = await persistence.list()
  const headers = new Map<string, SessionHeaderLike>(persisted.map(header => [header.id, header]))
  for (const session of liveSessions?.list() ?? []) headers.set(session.header.id, session.header)
  for (const record of records.list()) {
    const header = headers.get(record.sessionId)
    if (header === undefined || header.cwd !== record.cwd) {
      await records.delete(record.sessionId)
      continue
    }
    if (record.status === 'prepared') await records.activate(record.sessionId, record.cwd)
  }
}

/** Verify a client activation against the live or materialized official session. */
export async function assertSessionMatches(
  sessionId: string,
  cwd: string,
  persistence: SessionPersistenceLike,
  liveSessions?: LiveSessionsLike,
): Promise<void> {
  const live = liveSessions?.get(sessionId)
  if (live !== undefined) {
    if (live.header.cwd !== cwd) throw new JustChatError('session-cwd-mismatch', 'The official session cwd does not match the preparation.', 409)
    return
  }
  const header = (await persistence.list()).find(item => item.id === sessionId)
  if (header === undefined) throw new JustChatError('session-not-found', 'The official session has not been created.', 409)
  if (header.cwd !== cwd) throw new JustChatError('session-cwd-mismatch', 'The official session cwd does not match the preparation.', 409)
}

/** Read the live session provider without importing the optional session package. */
export function getLiveSessions(ctx: { get(name: string): unknown }): LiveSessionsLike | undefined {
  const value = ctx.get('sessions')
  if (value === undefined) return undefined
  return value as LiveSessionsLike
}
