import { mkdtemp, readdir, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ConversationPreparationService } from '../../src/host/preparation.ts'
import { ConversationRecordStore } from '../../src/host/records.ts'
import { FakeTable } from './helpers.ts'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })

describe('conversation preparation', () => {
  it('creates the rendered tree before persisting a prepared record', async () => {
    const root = await mkdtemp(join(tmpdir(), 'just-chat-preparation-'))
    roots.push(root)
    const table = new FakeTable()
    const store = new ConversationRecordStore(table as never)
    const service = new ConversationPreparationService(
      () => ({ rootDirectory: root, template: 'fixed/${message.firstSentence}' }),
      store,
      () => 42,
      () => 'session-1',
    )
    const result = await service.prepare('Hello, world.')
    expect(result).toEqual({ sessionId: 'session-1', cwd: await realpath(join(root, 'fixed', 'Hello')), createdAt: 42 })
    expect(store.get('session-1')).toMatchObject({ status: 'prepared', cwd: result.cwd })
    expect(store.get('session-1')).not.toHaveProperty('text')
    expect(await readdir(join(root, 'fixed'))).toEqual(['Hello'])
  })

  it('rejects a second reservation for the same rendered directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'just-chat-collision-'))
    roots.push(root)
    const store = new ConversationRecordStore(new FakeTable() as never)
    const service = new ConversationPreparationService(() => ({ rootDirectory: root, template: 'same' }), store)
    await service.prepare('first')
    await expect(service.prepare('second')).rejects.toMatchObject({ code: 'path-exists' })
  })
})
