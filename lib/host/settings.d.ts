import { type SettingsScope } from '@deepseek-ai/dsh-settings';
import type { Context } from '@deepseek-ai/cordis';
import type { ConversationDirectorySettings } from '../shared/types.ts';
/** Settings namespace used by the existing DSH settings panel. */
export declare const CONVERSATION_SETTINGS_NAMESPACE: import("@deepseek-ai/dsh-settings").SettingsNamespace;
/** Composition defaults; an empty root intentionally does not create anything. */
export declare const DEFAULT_SETTINGS: ConversationDirectorySettings;
/** Register the plugin settings on the owning Cordis fiber. */
export declare function registerConversationSettings(ctx: Context): SettingsScope<ConversationDirectorySettings>;
//# sourceMappingURL=settings.d.ts.map