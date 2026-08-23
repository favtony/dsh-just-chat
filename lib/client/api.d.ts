import type { ConversationRecord, PreparationResponse } from './types.ts';
/** Same-origin client API for the four dsh-just-chat host routes. */
export interface JustChatApi {
    saveSettings(rootDirectory: string, template: string, signal?: AbortSignal): Promise<void>;
    preview(template: string, sampleText: string, signal?: AbortSignal): Promise<{
        valid: boolean;
        path?: string;
        message?: string;
    }>;
    prepare(text: string, signal?: AbortSignal): Promise<PreparationResponse>;
    activate(sessionId: string, cwd: string, signal?: AbortSignal): Promise<ConversationRecord>;
    listConversations(signal?: AbortSignal): Promise<readonly ConversationRecord[]>;
}
export declare class JustChatApiError extends Error {
    readonly code: string;
    readonly name = "JustChatApiError";
    constructor(code: string, message: string);
}
/** Default route client. */
export declare function createJustChatApi(base?: string): JustChatApi;
//# sourceMappingURL=api.d.ts.map