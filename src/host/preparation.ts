import { mkdir, realpath, stat } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { JustChatError } from '../shared/errors.ts'
import { isStrictDescendant, validateRelativePath, validateRootPath } from '../shared/path.ts'
import { renderTemplate } from '../shared/template.ts'
import type { ConversationRecord, ConversationDirectorySettings, PreparationResponse } from '../shared/types.ts'
import { ConversationRecordStore } from './records.ts'

/** Create a prepared directory and durable classification record. */
export class ConversationPreparationService {
  private readonly readSettings: () => ConversationDirectorySettings
  private readonly records: ConversationRecordStore
  private readonly now: () => number
  private readonly makeId: () => string

  constructor(
    readSettings: () => ConversationDirectorySettings,
    records: ConversationRecordStore,
    now: () => number = Date.now,
    makeId: () => string = randomUUID,
  ) {
    this.readSettings = readSettings
    this.records = records
    this.now = now
    this.makeId = makeId
  }

  /** Validate, create, and persist one preparation without retaining its message. */
  async prepare(text: string): Promise<PreparationResponse> {
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new JustChatError('empty-message', 'The first message must contain text.')
    }
    const settings = this.readSettings()
    if (settings.rootDirectory.length === 0) {
      throw new JustChatError('settings-missing-root', 'Choose a conversation root directory before sending.', 409)
    }
    const configuredRoot = validateRootPath(settings.rootDirectory)
    const rootDirectory = await this.canonicalDirectory(configuredRoot)
    const relativeDirectory = renderTemplate(settings.template, text)
    validateRelativePath(relativeDirectory)
    const cwd = resolve(rootDirectory, ...relativeDirectory.split('/'))
    const childRelative = relative(rootDirectory, cwd).replaceAll('\\', '/')
    if (childRelative !== relativeDirectory || !isStrictDescendant(rootDirectory, cwd, childRelative)) {
      throw new JustChatError('path-invalid', 'The rendered directory is outside the configured root.')
    }
    await this.createDirectory(cwd)
    const sessionId = this.makeId()
    const createdAt = this.now()
    const record: ConversationRecord = Object.freeze({
      sessionId,
      cwd,
      rootDirectory,
      createdAt,
      template: settings.template,
      status: 'prepared',
    })
    await this.records.put(record)
    return { sessionId, cwd, createdAt }
  }

  private async canonicalDirectory(rootDirectory: string): Promise<string> {
    try {
      const info = await stat(rootDirectory)
      if (!info.isDirectory()) throw new Error('not a directory')
      return await realpath(rootDirectory)
    } catch {
      throw new JustChatError('settings-invalid-root', 'The conversation root directory is unavailable.', 409)
    }
  }

  private async createDirectory(cwd: string): Promise<void> {
    try {
      await stat(cwd)
      throw new JustChatError('path-exists', 'The generated conversation directory already exists.', 409)
    } catch (error) {
      if (error instanceof JustChatError) throw error
      if (!isMissing(error)) throw new JustChatError('directory-create-failed', 'The conversation directory could not be inspected.', 500)
    }
    try {
      await mkdir(dirname(cwd), { recursive: true })
      await mkdir(cwd)
    } catch (error) {
      if (isAlreadyExists(error)) throw new JustChatError('path-exists', 'The generated conversation directory already exists.', 409)
      throw new JustChatError('directory-create-failed', 'The conversation directory could not be created.', 500)
    }
  }
}

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'ENOENT'
}

function isAlreadyExists(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'EEXIST'
}
