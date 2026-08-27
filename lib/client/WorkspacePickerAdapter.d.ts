import type { WorkspacePickerProps } from '@deepseek-ai/dsh-client-ui-workspace/client';
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client';
import type { PendingDraftState } from './stores/pending-draft-store.ts';
import type { LiveComponent } from './live-entry.ts';
export interface WorkspacePickerAdapterDeps {
    pending: SnapshotStore<PendingDraftState>;
    chooseWorkspace(): void;
    chooseJustChat(): void;
}
/** Official WorkspacePicker with one projected just-chat row. */
export declare function createWorkspacePickerAdapter(deps: WorkspacePickerAdapterDeps): (official: LiveComponent<WorkspacePickerProps>) => LiveComponent<WorkspacePickerProps>;
//# sourceMappingURL=WorkspacePickerAdapter.d.ts.map