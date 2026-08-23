import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import { createConversationRoute } from '../../src/host/routes.ts'
import { ConversationRecordStore } from '../../src/host/records.ts'
import { ConversationPreparationService } from '../../src/host/preparation.ts'
import { FakeTable, record } from './helpers.ts'

class Request extends EventEmitter {
  method: string
  url: string
  headers: Record<string, string>
  constructor(method: string, url: string, body?: unknown) {
    super()
    this.method = method
    this.url = url
    this.headers = body === undefined ? {} : { 'content-type': 'application/json' }
    queueMicrotask(() => {
      if (body !== undefined) this.emit('data', Buffer.from(JSON.stringify(body)))
      this.emit('end')
    })
  }
}

class Response {
  statusCode = 0
  readonly headers = new Map<string, string | number>()
  body = ''
  setHeader(name: string, value: string | number): void { this.headers.set(name, value) }
  end(body?: string): void { this.body = body ?? '' }
}

function responseBody(response: Response): unknown { return JSON.parse(response.body) }
const settings = { update: async (_patch: object): Promise<void> => undefined }

describe('conversation HTTP route', () => {
  it('dispatches preview and returns only route response fields', async () => {
    const store = new ConversationRecordStore(new FakeTable() as never)
    const route = createConversationRoute({
      records: store,
      preparation: {} as ConversationPreparationService,
      persistence: { list: async () => [] },
      settings,
    })
    const response = new Response()
    await route.handler(new Request('POST', '/api/dsh-just-chat/settings/preview', { template: 'fixed', sampleText: 'hello' }) as unknown as IncomingMessage, response as unknown as ServerResponse)
    expect(response.statusCode).toBe(200)
    expect(responseBody(response)).toEqual({ valid: true, path: 'fixed' })
  })

  it('activates a prepared record only after official session cwd confirmation', async () => {
    const table = new FakeTable()
    const store = new ConversationRecordStore(table as never)
    await store.put(record({ sessionId: 'prepared' }))
    const route = createConversationRoute({ records: store, preparation: {} as ConversationPreparationService, persistence: { list: async () => [{ id: 'prepared', cwd: 'C:\\root\\child' }] }, settings })
    const response = new Response()
    await route.handler(new Request('POST', '/api/dsh-just-chat/preparations/prepared/activate', { cwd: 'C:\\root\\child' }) as unknown as IncomingMessage, response as unknown as ServerResponse)
    expect(response.statusCode).toBe(200)
    expect(responseBody(response)).toMatchObject({ sessionId: 'prepared', status: 'active' })
  })

  it('returns active records as a bare array and rejects unknown paths', async () => {
    const table = new FakeTable()
    const store = new ConversationRecordStore(table as never)
    await store.put(record({ status: 'active' }))
    const route = createConversationRoute({ records: store, preparation: {} as ConversationPreparationService, persistence: { list: async () => [] }, settings })
    const listResponse = new Response()
    await route.handler(new Request('GET', '/api/dsh-just-chat/conversations') as unknown as IncomingMessage, listResponse as unknown as ServerResponse)
    expect(responseBody(listResponse)).toEqual([record({ status: 'active' })])
    const unknownResponse = new Response()
    await route.handler(new Request('GET', '/api/dsh-just-chat/unknown') as unknown as IncomingMessage, unknownResponse as unknown as ServerResponse)
    expect(unknownResponse.statusCode).toBe(404)
  })

  it('saves the root directory and template in one host settings update', async () => {
    const update = vi.fn(async (_patch: object) => undefined)
    const store = new ConversationRecordStore(new FakeTable() as never)
    const route = createConversationRoute({
      records: store,
      preparation: {} as ConversationPreparationService,
      persistence: { list: async () => [] },
      settings: { update },
    })
    const response = new Response()
    const body = { rootDirectory: 'C:\\conversations', template: '${date.yyyy}' }

    await route.handler(new Request('PUT', '/api/dsh-just-chat/settings', body) as unknown as IncomingMessage, response as unknown as ServerResponse)

    expect(response.statusCode).toBe(200)
    expect(update).toHaveBeenCalledExactlyOnceWith(body)
    expect(responseBody(response)).toEqual(body)
  })
})
