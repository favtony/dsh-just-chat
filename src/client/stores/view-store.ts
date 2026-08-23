import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConversationRecord, SessionId, SubmissionPhase, ViewError } from '../types.ts'

/** Root-scoped view state; records remain a projection from the host API. */
export interface ViewState {
  prepared: readonly ConversationRecord[]
  active: readonly ConversationRecord[]
  submission: SubmissionPhase
  frozenDraft: string | undefined
  error: ViewError | undefined
  settingsSectionRequest: 'conversation-directory' | undefined
  conversationSearch: {
    query: string
    status: 'idle' | 'loading' | 'ready' | 'error'
    results: readonly SessionId[]
  }
}

/** Create one view store per plugin fiber. */
export function createViewStore(): SnapshotStore<ViewState> {
  return createSnapshotStore<ViewState>({
    prepared: [],
    active: [],
    submission: 'idle',
    frozenDraft: undefined,
    error: undefined,
    settingsSectionRequest: undefined,
    conversationSearch: { query: '', status: 'idle', results: [] },
  })
}

/** Replace the host record projection while preserving local view choices. */
export function setConversationRecords(
  store: SnapshotStore<ViewState>,
  records: readonly ConversationRecord[],
): void {
  store.update(state => {
    state.active = records.filter(record => record.status === 'active')
    state.prepared = records.filter(record => record.status === 'prepared')
  })
}


/** Update the independent conversation search state. */
export function setConversationSearch(
  store: SnapshotStore<ViewState>,
  query: string,
  status: ViewState['conversationSearch']['status'],
  results: readonly SessionId[] = [],
): void {
  store.update(state => {
    state.conversationSearch = { query, status, results }
  })
}
