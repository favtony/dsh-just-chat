import { type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client';
import type { ConversationRecord, SessionId, SubmissionPhase, ViewError } from '../types.ts';
/** Root-scoped view state; records remain a projection from the host API. */
export interface ViewState {
    prepared: readonly ConversationRecord[];
    active: readonly ConversationRecord[];
    submission: SubmissionPhase;
    frozenDraft: string | undefined;
    error: ViewError | undefined;
    settingsSectionRequest: 'conversation-directory' | undefined;
    conversationSearch: {
        query: string;
        status: 'idle' | 'loading' | 'ready' | 'error';
        results: readonly SessionId[];
    };
}
/** Create one view store per plugin fiber. */
export declare function createViewStore(): SnapshotStore<ViewState>;
/** Replace the host record projection while preserving local view choices. */
export declare function setConversationRecords(store: SnapshotStore<ViewState>, records: readonly ConversationRecord[]): void;
/** Update the independent conversation search state. */
export declare function setConversationSearch(store: SnapshotStore<ViewState>, query: string, status: ViewState['conversationSearch']['status'], results?: readonly SessionId[]): void;
//# sourceMappingURL=view-store.d.ts.map