import type React from 'react';
import type { PropsHooks, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SidebarInjected } from './types.ts';
/**
 * Complete sidebar-workspaces replacement. It uses public snapshots and keeps
 * the plugin's active-record projection separate from ordinary workspaces.
 */
export declare function SidebarBrowser(props: PropsRuntime<'sidebar.workspaces'> & PropsRenderSlots<'sidebar.workspaces.directoryFlow'> & Omit<SidebarInjected, 'hooks'> & PropsHooks<SidebarInjected['hooks']>): React.ReactElement;
//# sourceMappingURL=SidebarBrowser.d.ts.map