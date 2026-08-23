import type { ConversationRecord, PreparationResponse, SessionId } from './types.ts'

/** Same-origin client API for the four dsh-just-chat host routes. */
export interface JustChatApi {
  saveSettings(rootDirectory: string, template: string, signal?: AbortSignal): Promise<void>
  preview(template: string, sampleText: string, signal?: AbortSignal): Promise<{ valid: boolean; path?: string; message?: string }>
  prepare(text: string, signal?: AbortSignal): Promise<PreparationResponse>
  activate(sessionId: string, cwd: string, signal?: AbortSignal): Promise<ConversationRecord>
  listConversations(signal?: AbortSignal): Promise<readonly ConversationRecord[]>
}

export class JustChatApiError extends Error {
  readonly name = 'JustChatApiError'

  constructor(readonly code: string, message: string) {
    super(message)
  }
}

interface JsonRecord {
  [key: string]: unknown
}

function record(value: unknown, label: string): JsonRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('dsh-just-chat: invalid ' + label)
  return value as JsonRecord
}

function stringField(value: JsonRecord, key: string): string {
  const field = value[key]
  if (typeof field !== 'string') throw new Error('dsh-just-chat: invalid ' + key)
  return field
}

function numberField(value: JsonRecord, key: string): number {
  const field = value[key]
  if (typeof field !== 'number' || !Number.isFinite(field)) throw new Error('dsh-just-chat: invalid ' + key)
  return field
}

/** Convert a validated wire string into the runtime's opaque session id. */
function sessionIdField(value: JsonRecord, key: string): SessionId {
  return stringField(value, key) as SessionId
}

async function json<T>(path: string, init: RequestInit, parse: (body: unknown) => T): Promise<T> {
  const response = await fetch(path, { ...init, headers: { accept: 'application/json', ...init.headers } })
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new Error('dsh-just-chat: host returned non-JSON ' + response.status)
  }
  if (!response.ok) {
    const value = record(body, 'error')
    const message = typeof value.message === 'string' ? value.message : 'HTTP ' + response.status
    const code = typeof value.errorCode === 'string' ? value.errorCode : 'http-error'
    throw new JustChatApiError(code, message)
  }
  return parse(body)
}

function preparation(value: unknown): PreparationResponse {
  const body = record(value, 'preparation')
  return { sessionId: sessionIdField(body, 'sessionId'), cwd: stringField(body, 'cwd'), createdAt: numberField(body, 'createdAt') }
}

function conversation(value: unknown): ConversationRecord {
  const body = record(value, 'conversation')
  const status = body.status
  if (status !== 'prepared' && status !== 'active') throw new Error('dsh-just-chat: invalid conversation status')
  return {
    sessionId: sessionIdField(body, 'sessionId'),
    cwd: stringField(body, 'cwd'),
    rootDirectory: stringField(body, 'rootDirectory'),
    createdAt: numberField(body, 'createdAt'),
    template: stringField(body, 'template'),
    status,
  }
}

/** Default route client. */
export function createJustChatApi(base = '/api/dsh-just-chat'): JustChatApi {
  return {
    saveSettings: (rootDirectory, template, signal) => json(base + '/settings', {
      method: 'PUT', signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rootDirectory, template }),
    }, value => {
      const body = record(value, 'settings')
      stringField(body, 'rootDirectory')
      stringField(body, 'template')
    }),
    preview: (template, sampleText, signal) => json(base + '/settings/preview', {
      method: 'POST', signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ template, sampleText }),
    }, value => {
      const body = record(value, 'preview')
      const valid = body.valid
      if (typeof valid !== 'boolean') throw new Error('dsh-just-chat: invalid preview.valid')
      return { valid, path: typeof body.path === 'string' ? body.path : undefined, message: typeof body.message === 'string' ? body.message : undefined }
    }),
    prepare: (text, signal) => json(base + '/preparations', {
      method: 'POST', signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }),
    }, preparation),
    activate: (sessionId, cwd, signal) => json(base + '/preparations/' + encodeURIComponent(sessionId) + '/activate', {
      method: 'POST', signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cwd }),
    }, conversation),
    listConversations: (signal) => json(base + '/conversations', { method: 'GET', signal }, value => {
      if (!Array.isArray(value)) throw new Error('dsh-just-chat: invalid conversations')
      return value.map(item => conversation(item))
    }),
  }
}
