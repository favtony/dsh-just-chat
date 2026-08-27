import type React from 'react'
import { useMemo, useSyncExternalStore } from 'react'
import type { WorkspacePickerProps } from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { WorkspaceId, WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { PendingDraftState } from './stores/pending-draft-store.ts'
import { JUST_CHAT_OPTION_ID, projectPickerState } from './workspace-projection.ts'
import type { LiveComponent } from './live-entry.ts'

export interface WorkspacePickerAdapterDeps {
  pending: SnapshotStore<PendingDraftState>
  chooseWorkspace(): void
  chooseJustChat(): void
}

/** Official WorkspacePicker with one projected just-chat row. */
export function createWorkspacePickerAdapter(
  deps: WorkspacePickerAdapterDeps,
): (official: LiveComponent<WorkspacePickerProps>) => LiveComponent<WorkspacePickerProps> {
  return official => function WorkspacePickerAdapter(props): React.ReactElement {
    const hostState = props.useWorkspaces(state => state)
    const pending = useSyncExternalStore(
      listener => deps.pending.subscribe(listener),
      () => deps.pending.getSnapshot(),
      () => deps.pending.getSnapshot(),
    )
    const projected = useMemo(() => projectPickerState(hostState), [hostState])
    const useWorkspaces = <S,>(selector: (state: WorkspaceListState) => S): S => {
      // WorkspacePicker calls this as a Hook; preserve the host subscription
      // while replacing only the state snapshot it reads.
      props.useWorkspaces(state => state)
      return selector(projected)
    }
    const onPick = (workspaceId: WorkspaceId): void => {
      if (workspaceId === JUST_CHAT_OPTION_ID) {
        deps.chooseJustChat()
        props.onPick(workspaceId)
        props.onClose()
        return
      }
      deps.chooseWorkspace()
      props.onPick(workspaceId)
    }
    return official({
      ...props,
      useWorkspaces,
      selectedId: pending.mode === 'just-chat' ? JUST_CHAT_OPTION_ID : props.selectedId,
      onPick,
    }) as React.ReactElement
  }
}
