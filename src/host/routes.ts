import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type { SettingsScope } from '@deepseek-ai/dsh-settings'
import { asJustChatError, JustChatError } from '../shared/errors.ts'
import { previewTemplate } from '../shared/template.ts'
import type { ActivationRequest, ConversationDirectorySettings, PreparationRequest, PreviewRequest } from '../shared/types.ts'
import { ConversationPreparationService } from './preparation.ts'
import { assertSessionMatches, type LiveSessionsLike, type SessionPersistenceLike } from './recovery.ts'
import { ConversationRecordStore } from './records.ts'

const ROUTE_PREFIX = '/api/dsh-just-chat'
const BODY_LIMIT = 64 * 1024

export interface ConversationRouteDependencies {
  readonly preparation: ConversationPreparationService
  readonly records: ConversationRecordStore
  readonly persistence: SessionPersistenceLike
  readonly liveSessions?: LiveSessionsLike
  readonly settings: Pick<SettingsScope<ConversationDirectorySettings>, 'update'>
}

/** Registerable prefix route for all dsh-just-chat HTTP operations. */
export function createConversationRoute(deps: ConversationRouteDependencies): WebRoute {
  return {
    kind: 'prefix',
    path: ROUTE_PREFIX,
    handler: async (req, res) => {
      try {
        checkOrigin(req)
        const pathname = new URL(req.url ?? ROUTE_PREFIX, 'http://dsh-just-chat.invalid').pathname
        const relativePath = pathname.slice(ROUTE_PREFIX.length)
        if (req.method === 'PUT' && relativePath === '/settings') {
          await handleSettings(req, res, deps)
          return
        }
        if (req.method === 'POST' && relativePath === '/settings/preview') {
          await handlePreview(req, res)
          return
        }
        if (req.method === 'POST' && relativePath === '/preparations') {
          await handlePreparation(req, res, deps)
          return
        }
        if (req.method === 'POST' && relativePath.startsWith('/preparations/')) {
          await handleActivation(req, res, relativePath, deps)
          return
        }
        if (req.method === 'GET' && relativePath === '/conversations') {
          sendJson(res, 200, deps.records.active())
          return
        }
        sendJson(res, 404, { errorCode: 'not-found', message: 'The requested route does not exist.' })
      } catch (error) {
        const failure = asJustChatError(error, 'storage-failed')
        sendJson(res, failure.status, { errorCode: failure.code, message: failure.message })
      }
    },
  }
}

async function handleSettings(req: IncomingMessage, res: ServerResponse, deps: ConversationRouteDependencies): Promise<void> {
  const request = await readObject<ConversationDirectorySettings>(req, ['rootDirectory', 'template'])
  if (typeof request.rootDirectory !== 'string' || typeof request.template !== 'string') throw invalidRequest()
  await deps.settings.update({ rootDirectory: request.rootDirectory, template: request.template })
  sendJson(res, 200, request)
}

async function handlePreview(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const request = await readObject<PreviewRequest>(req, ['template', 'sampleText'])
  if (typeof request.template !== 'string' || typeof request.sampleText !== 'string') throw invalidRequest()
  try {
    sendJson(res, 200, { valid: true, path: previewTemplate(request.template, request.sampleText) })
  } catch (error) {
    const failure = asJustChatError(error, 'template-invalid')
    sendJson(res, 200, { valid: false, errorCode: failure.code, message: failure.message })
  }
}

async function handlePreparation(req: IncomingMessage, res: ServerResponse, deps: ConversationRouteDependencies): Promise<void> {
  const request = await readObject<PreparationRequest>(req, ['text'])
  if (typeof request.text !== 'string') throw invalidRequest()
  sendJson(res, 201, await deps.preparation.prepare(request.text))
}

async function handleActivation(req: IncomingMessage, res: ServerResponse, pathname: string, deps: ConversationRouteDependencies): Promise<void> {
  const prefix = '/preparations/'
  const suffix = '/activate'
  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) {
    sendJson(res, 404, { errorCode: 'not-found', message: 'The requested route does not exist.' })
    return
  }
  let sessionId: string
  try {
    sessionId = decodeURIComponent(pathname.slice(prefix.length, -suffix.length))
  } catch {
    throw invalidRequest()
  }
  if (sessionId.length === 0 || sessionId.includes('/')) throw invalidRequest()
  const request = await readObject<ActivationRequest>(req, ['cwd'])
  if (typeof request.cwd !== 'string' || request.cwd.length === 0) throw invalidRequest()
  const record = deps.records.get(sessionId)
  if (record === undefined) throw new JustChatError('record-not-found', 'The preparation record no longer exists.', 404)
  if (record.cwd !== request.cwd) throw new JustChatError('record-cwd-mismatch', 'The activation directory does not match the stored record.', 409)
  await assertSessionMatches(sessionId, request.cwd, deps.persistence, deps.liveSessions)
  sendJson(res, 200, await deps.records.activate(sessionId, request.cwd))
}

async function readObject<T>(req: IncomingMessage, expectedKeys: readonly string[]): Promise<T> {
  const contentType = req.headers['content-type']
  if (typeof contentType !== 'string' || contentType.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') {
    throw new JustChatError('content-type-required', 'Requests must use application/json.', 415)
  }
  const raw = await readBody(req)
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    throw invalidRequest()
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw invalidRequest()
  const keys = Object.keys(value).sort()
  const expected = [...expectedKeys].sort()
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) throw invalidRequest()
  return value as T
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let total = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer | string) => {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      total += bytes.byteLength
      if (total > BODY_LIMIT) {
        reject(new JustChatError('body-too-large', 'The request body is too large.', 413))
        return
      }
      chunks.push(bytes)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', error => reject(error))
  })
}

function checkOrigin(req: IncomingMessage): void {
  const origin = req.headers.origin
  const host = req.headers.host
  if (origin === undefined || host === undefined) return
  try {
    if (new URL(origin).host !== host) throw new JustChatError('origin-rejected', 'Cross-origin requests are not accepted.', 403)
  } catch (error) {
    if (error instanceof JustChatError) throw error
    throw new JustChatError('origin-rejected', 'Cross-origin requests are not accepted.', 403)
  }
}

function invalidRequest(): JustChatError {
  return new JustChatError('invalid-request', 'The request JSON fields are invalid.', 400)
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('content-length', Buffer.byteLength(body))
  res.end(body)
}
