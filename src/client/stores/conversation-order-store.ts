import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { SessionId } from '../types.ts'

export type ConversationOrderState = {
  sessionIds: readonly SessionId[]
}

/** Create the root-persisted manual order for automatic conversation rows. */
export function createConversationOrderStore(): SnapshotStore<ConversationOrderState> {
  return createSnapshotStore<ConversationOrderState>(
    { sessionIds: [] },
    { persist: { name: 'dsh-just-chat.conversation-order' } },
  )
}

/** Place one automatic conversation before another row or at the end. */
export function setConversationOrder(
  store: SnapshotStore<ConversationOrderState>,
  sessionId: SessionId,
  beforeSessionId: SessionId | undefined,
): void {
  store.update(state => {
    const sessionIds = state.sessionIds.filter(id => id !== sessionId)
    const index = beforeSessionId === undefined ? sessionIds.length : sessionIds.indexOf(beforeSessionId)
    sessionIds.splice(index < 0 ? sessionIds.length : index, 0, sessionId)
    state.sessionIds = sessionIds
  })
}
