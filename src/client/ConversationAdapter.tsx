import type React from 'react'
import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { ConversationSlotProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { PendingDraftState } from './stores/pending-draft-store.ts'
import { JUST_CHAT_OPTION_ID, projectConversationState } from './workspace-projection.ts'
import type { LiveComponent } from './live-entry.ts'

export interface ConversationAdapterDeps {
  pending: SnapshotStore<PendingDraftState>
}

/** Official ConversationRoot with the same just-chat projection used by its picker. */
export function createConversationAdapter(
  deps: ConversationAdapterDeps,
): (official: LiveComponent<ConversationSlotProps>) => LiveComponent<ConversationSlotProps> {
  return official => function ConversationAdapter(props): React.ReactElement {
    const pending = useSyncExternalStore(
      listener => deps.pending.subscribe(listener),
      () => deps.pending.getSnapshot(),
      () => deps.pending.getSnapshot(),
    )
    const hostState = props.useWorkspaces(state => state)
    const sessionId = props.useSessions(state => state.current)
    const projected = useMemo(
      () => projectConversationState(hostState, pending, sessionId),
      [hostState, pending, sessionId],
    )
    const useWorkspaces = <S,>(selector: (state: typeof hostState) => S): S => {
      // Keep the official selector hook in the same render path; only its
      // snapshot is projected for ConversationRoot's own workspace lookup.
      props.useWorkspaces(state => state)
      return selector(projected)
    }
    const selectWorkspace = useCallback(async (workspaceId: Parameters<ConversationSlotProps['selectWorkspace']>[0]): Promise<void> => {
      if (workspaceId === JUST_CHAT_OPTION_ID) return
      await props.selectWorkspace(workspaceId)
    }, [props.selectWorkspace])
    return official({
      ...props,
      useWorkspaces,
      selectWorkspace,
    }) as React.ReactElement
  }
}
