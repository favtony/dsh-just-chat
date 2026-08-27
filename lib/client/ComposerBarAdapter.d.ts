import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client';
import type { PendingDraftState } from './stores/pending-draft-store.ts';
import type { ViewState } from './stores/view-store.ts';
import type { SubmissionController } from './handoff.ts';
import type { LiveComponent } from './live-entry.ts';
import type { ComposerBarProps } from './types.ts';
export interface ComposerBarAdapterDeps {
    pending: SnapshotStore<PendingDraftState>;
    view: SnapshotStore<ViewState>;
    controller: SubmissionController;
    updatePendingDraft(draft: string): void;
    completePendingHandoff(): void;
    startPreparation(text: string): Promise<void>;
}
/** Official InputBar with only the pending just-chat text adapter. */
export declare function createComposerBarAdapter(deps: ComposerBarAdapterDeps): (official: LiveComponent<ComposerBarProps>) => LiveComponent<ComposerBarProps>;
//# sourceMappingURL=ComposerBarAdapter.d.ts.map