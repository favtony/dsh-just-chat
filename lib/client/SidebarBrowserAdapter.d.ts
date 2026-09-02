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
 * Keep plugin-specific hooks in a child so the parent can switch to the
 * untouched official component without changing its hook order.
 */
export declare function createSidebarBrowserAdapter(deps: SidebarBrowserAdapterDeps): (official: LiveComponent<WorkspaceBrowserProps>) => LiveComponent<WorkspaceBrowserProps>;
//# sourceMappingURL=SidebarBrowserAdapter.d.ts.map