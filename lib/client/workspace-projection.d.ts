import type { SessionListState, WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client';
import type { WorkspaceId, SessionId } from './types.ts';
import type { ViewState } from './stores/view-store.ts';
import type { PendingDraftState } from './stores/pending-draft-store.ts';
export declare const JUST_CHAT_OPTION_ID: WorkspaceId;
export declare function automaticSessionIds(view: ViewState, sessions?: SessionListState): SessionId[];
/** Remove plugin-owned sessions from the official workspace grouping view. */
export declare function projectWorkspaceState(state: WorkspaceListState, view: ViewState, sessions?: SessionListState): WorkspaceListState;
/** Project only plugin-owned top-level sessions for the official flat browser. */
export declare function projectAutomaticSessionState(state: SessionListState, automaticIds: readonly SessionId[]): SessionListState;
/** Project the host list for the official workspace browser, hiding plugin-owned sessions. */
export declare function projectOrdinarySessionState(state: SessionListState, automaticIds: readonly SessionId[]): SessionListState;
/** Project only the picker option; automatic conversations never appear as workspaces here. */
export declare function projectPickerState(state: WorkspaceListState): WorkspaceListState;
/** Project the root conversation's current session into the persisted just-chat mode. */
export declare function projectConversationState(state: WorkspaceListState, pending: PendingDraftState, sessionId: SessionId | undefined): WorkspaceListState;
//# sourceMappingURL=workspace-projection.d.ts.map