import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import type { SettingsScope } from '@deepseek-ai/dsh-settings';
import type { ConversationDirectorySettings } from '../shared/types.ts';
import { ConversationPreparationService } from './preparation.ts';
import { type LiveSessionsLike, type SessionPersistenceLike } from './recovery.ts';
import { ConversationRecordStore } from './records.ts';
export interface ConversationRouteDependencies {
    readonly preparation: ConversationPreparationService;
    readonly records: ConversationRecordStore;
    readonly persistence: SessionPersistenceLike;
    readonly liveSessions?: LiveSessionsLike;
    readonly settings: Pick<SettingsScope<ConversationDirectorySettings>, 'update'>;
}
/** Registerable prefix route for all dsh-just-chat HTTP operations. */
export declare function createConversationRoute(deps: ConversationRouteDependencies): WebRoute;
//# sourceMappingURL=routes.d.ts.map