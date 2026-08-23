import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { PendingMode } from '../types.ts'

/** Persisted pre-session text; no attachment, model, or private UI state belongs here. */
export interface PendingDraftState {
  mode: PendingMode
  draft: string
}

/**
 * Create the browser-persisted draft store. The runtime owns the localStorage
 * adapter and persistence lifecycle.
 */
export function createPendingDraftStore(): SnapshotStore<PendingDraftState> {
  return createSnapshotStore<PendingDraftState>(
    { mode: 'none', draft: '' },
    { persist: { name: 'dsh-just-chat.pending-draft' } },
  )
}

/** Keep only text and the explicit mode in the persisted state. */
export function setPendingDraft(
  store: SnapshotStore<PendingDraftState>,
  mode: PendingMode,
  draft: string,
): void {
  store.set({ mode, draft })
}

/** Clear the persisted copy only after InputActions accepted the handoff. */
export function clearPendingDraft(store: SnapshotStore<PendingDraftState>): void {
  store.set({ mode: 'none', draft: '' })
}
