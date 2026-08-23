import { type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client';
import type { SessionId } from '../types.ts';
export type ConversationOrderState = {
    sessionIds: readonly SessionId[];
};
/** Create the root-persisted manual order for automatic conversation rows. */
export declare function createConversationOrderStore(): SnapshotStore<ConversationOrderState>;
/** Place one automatic conversation before another row or at the end. */
export declare function setConversationOrder(store: SnapshotStore<ConversationOrderState>, sessionId: SessionId, beforeSessionId: SessionId | undefined): void;
//# sourceMappingURL=conversation-order-store.d.ts.map