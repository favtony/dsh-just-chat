import type { ConversationSlotProps } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client';
import type { PendingDraftState } from './stores/pending-draft-store.ts';
import type { LiveComponent } from './live-entry.ts';
export interface ConversationAdapterDeps {
    pending: SnapshotStore<PendingDraftState>;
}
/** Official ConversationRoot with the same just-chat projection used by its picker. */
export declare function createConversationAdapter(deps: ConversationAdapterDeps): (official: LiveComponent<ConversationSlotProps>) => LiveComponent<ConversationSlotProps>;
//# sourceMappingURL=ConversationAdapter.d.ts.map