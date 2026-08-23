import { type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client';
import type { PendingMode } from '../types.ts';
/** Persisted pre-session text; no attachment, model, or private UI state belongs here. */
export interface PendingDraftState {
    mode: PendingMode;
    draft: string;
}
/**
 * Create the browser-persisted draft store. The runtime owns the localStorage
 * adapter and persistence lifecycle.
 */
export declare function createPendingDraftStore(): SnapshotStore<PendingDraftState>;
/** Keep only text and the explicit mode in the persisted state. */
export declare function setPendingDraft(store: SnapshotStore<PendingDraftState>, mode: PendingMode, draft: string): void;
/** Clear the persisted copy only after InputActions accepted the handoff. */
export declare function clearPendingDraft(store: SnapshotStore<PendingDraftState>): void;
//# sourceMappingURL=pending-draft-store.d.ts.map