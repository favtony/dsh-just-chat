import type React from 'react';
import type { PropsHooks, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client';
import type { JustChatApi } from '../api.ts';
/** Settings values owned by the host-side dsh-just-chat namespace. */
export type ConversationDirectorySettings = {
    rootDirectory?: string;
    template?: string;
};
export type ConversationDirectoryInjected = {
    hooks: {
        settings: SettingsScope<ConversationDirectorySettings>;
    };
    api: JustChatApi;
    pickDirectory(): Promise<string | null>;
    saveSettings(rootDirectory: string, template: string): Promise<void>;
};
type ConversationDirectoryCardProps = PropsRuntime<'settings.plugin.item'> & Omit<ConversationDirectoryInjected, 'hooks'> & PropsHooks<ConversationDirectoryInjected['hooks']>;
/** Official plugin-configuration card for the automatic conversation directory. */
export declare function ConversationDirectorySection(props: ConversationDirectoryCardProps): React.ReactElement | null;
export {};
//# sourceMappingURL=ConversationDirectorySection.d.ts.map