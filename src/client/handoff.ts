import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { JustChatApi } from './api.ts'
import { clearPendingDraft } from './stores/pending-draft-store.ts'
import type { PendingDraftState, } from './stores/pending-draft-store.ts'
import type { RemoteEvents, SessionId, SubmissionPhase, ViewError } from './types.ts'
import type { ViewState } from './stores/view-store.ts'

export interface SessionCreateFace {
  create(options: { cwd: string; sessionId: SessionId }): Promise<unknown>
  open(sessionId: SessionId): void
  list: { getSnapshot(): { byId: Record<SessionId, { agentPreset?: string }> } }
}

export interface SubmissionController {
  startPreparation(text: string): Promise<void>
  ownsSession(sessionId: SessionId): boolean
  takeHandoff(sessionId: SessionId): string | undefined
  completeHandoff(sessionId: SessionId): void
  failHandoff(sessionId: SessionId, error: unknown): void
}

interface Run {
  sessionId: SessionId | undefined
  frozenText: string
  eventSeen: boolean
  timer: ReturnType<typeof setTimeout> | undefined
  listenerDispose: (() => void) | undefined
  handoffClaimed: boolean
  gateClosed: boolean
}

function errorOf(error: unknown): ViewError {
  const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : 'client'
  return { code, message: error instanceof Error ? error.message : String(error) }
}

/**
 * One-shot event/timer gate. An event received before the prepared id is known
 * is deliberately ignored; the root listener only accepts this submission id.
 */
export class SubmissionGate {
  private timer: ReturnType<typeof setTimeout> | undefined
  private eventSeen = false
  private closed = false

  constructor(
    private readonly sessionId: SessionId,
    private readonly resolve: () => void,
  ) {}

  signal(sessionId: SessionId): void {
    if (this.closed || sessionId !== this.sessionId) return
    this.eventSeen = true
    this.closeAndResolve()
  }

  arm(delayMs: number): void {
    if (this.closed) return
    if (this.eventSeen) {
      this.closeAndResolve()
      return
    }
    this.timer = setTimeout(() => { this.closeAndResolve() }, delayMs)
  }

  cancel(): void {
    this.closed = true
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
  }

  private closeAndResolve(): void {
    if (this.closed) return
    this.closed = true
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
    this.resolve()
  }
}

/**
 * Orchestrate directory preparation, official session creation, activation,
 * opening, preset gate, and the later session-scope InputActions handoff.
 */
export function createSubmissionController(deps: {
  api: JustChatApi
  sessions: SessionCreateFace
  remote: RemoteEvents
  viewStore: SnapshotStore<ViewState>
  pendingStore: SnapshotStore<PendingDraftState>
  nowHasPreset?: (sessionId: SessionId) => boolean
}): SubmissionController {
  let run: Run | undefined

  const setPhase = (submission: SubmissionPhase, error?: ViewError): void => {
    deps.viewStore.update(state => {
      state.submission = submission
      state.error = error
    })
  }

  const cleanup = (): void => {
    if (run?.timer !== undefined) clearTimeout(run.timer)
    run?.listenerDispose?.()
    if (run !== undefined) {
      run.timer = undefined
      run.listenerDispose = undefined
    }
  }

  const resolveHandoff = (): void => {
    if (run === undefined || run.gateClosed || run.sessionId === undefined) return
    run.gateClosed = true
    cleanup()
    setPhase('handingOff')
  }

  const startPreparation = async (text: string): Promise<void> => {
    if (run !== undefined || text.trim() === '') return
    const next: Run = {
      sessionId: undefined,
      frozenText: text,
      eventSeen: false,
      timer: undefined,
      listenerDispose: undefined,
      handoffClaimed: false,
      gateClosed: false,
    }
    run = next
    deps.viewStore.update(state => {
      state.submission = 'preparing'
      state.frozenDraft = text
      state.error = undefined
      state.settingsSectionRequest = undefined
    })

    const gateEvent = (sessionId: SessionId): void => {
      if (run !== next || next.sessionId !== sessionId) return
      next.eventSeen = true
      if (next.timer !== undefined) clearTimeout(next.timer)
      next.timer = undefined
      resolveHandoff()
    }
    next.listenerDispose = deps.remote.$on('agent-preset/selected', gateEvent)

    try {
      const prepared = await deps.api.prepare(text)
      if (run !== next) return
      next.sessionId = prepared.sessionId
      setPhase('creatingSession')
      await deps.sessions.create({ cwd: prepared.cwd, sessionId: prepared.sessionId })
      if (run !== next) return
      setPhase('activating')
      const activated = await deps.api.activate(prepared.sessionId, prepared.cwd)
      if (run !== next) return
      deps.viewStore.update(state => {
        state.prepared = state.prepared.filter(record => record.sessionId !== activated.sessionId)
        state.active = [...state.active.filter(record => record.sessionId !== activated.sessionId), activated]
      })
      deps.sessions.open(prepared.sessionId)
      const hasPreset = deps.nowHasPreset?.(prepared.sessionId)
        ?? deps.sessions.list.getSnapshot().byId[prepared.sessionId]?.agentPreset !== undefined
      if (!hasPreset) {
        resolveHandoff()
      } else {
        setPhase('waitingPreset')
        if (next.eventSeen) resolveHandoff()
        else next.timer = setTimeout(resolveHandoff, 3000)
      }
    } catch (error) {
      if (run !== next) return
      cleanup()
      run = undefined
      const viewError = errorOf(error)
      deps.viewStore.update(state => {
        state.submission = 'error'
        state.error = viewError
        if (viewError.code === 'settings-missing-root') {
          state.settingsSectionRequest = 'conversation-directory'
        }
      })
    }
  }

  const takeHandoff = (sessionId: SessionId): string | undefined => {
    if (run === undefined || run.sessionId !== sessionId || run.handoffClaimed || !run.gateClosed) return undefined
    run.handoffClaimed = true
    return run.frozenText
  }

  const ownsSession = (sessionId: SessionId): boolean => run?.sessionId === sessionId

  const completeHandoff = (sessionId: SessionId): void => {
    if (run?.sessionId !== sessionId) return
    clearPendingDraft(deps.pendingStore)
    setPhase('sent')
    deps.viewStore.update(state => { state.frozenDraft = undefined })
    run = undefined
  }

  const failHandoff = (sessionId: SessionId, error: unknown): void => {
    if (run?.sessionId !== sessionId) return
    cleanup()
    setPhase('error', errorOf(error))
    run = undefined
  }

  return { startPreparation, ownsSession, takeHandoff, completeHandoff, failHandoff }
}
