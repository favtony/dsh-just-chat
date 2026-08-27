import type { WorkspaceBrowserProps } from '@deepseek-ai/dsh-client-ui-workspace/client';
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client';
import type { ViewState } from './stores/view-store.ts';
import type { ConversationOrderState } from './stores/conversation-order-store.ts';
import type { LiveComponent } from './live-entry.ts';
export interface SidebarBrowserAdapterDeps {
    view: SnapshotStore<ViewState>;
    order: SnapshotStore<ConversationOrderState>;
    refreshConversationRecords(): Promise<void>;
}
/**
 * Reuses the host WorkspaceBrowser twice: real workspaces remain in the
 * workspace tree, while plugin-owned conversations use the official flat list
 * as a separate top-level section.
 */
export declare function createSidebarBrowserAdapter(deps: SidebarBrowserAdapterDeps): (official: LiveComponent<WorkspaceBrowserProps>) => LiveComponent<WorkspaceBrowserProps>;
//# sourceMappingURL=SidebarBrowserAdapter.d.ts.map