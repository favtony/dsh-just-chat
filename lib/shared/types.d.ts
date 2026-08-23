import type { JustChatErrorCode } from './errors.ts';
/** The only durable classification states owned by this plugin. */
export type ConversationStatus = 'prepared' | 'active';
/** Durable classification record. It deliberately contains no chat text. */
export interface ConversationRecord {
    readonly sessionId: string;
    readonly cwd: string;
    readonly rootDirectory: string;
    readonly createdAt: number;
    readonly template: string;
    readonly status: ConversationStatus;
}
/** Name used for a record before the host confirms its official session. */
export type PreparationRecord = ConversationRecord;
/** Settings registered by the host and edited by the existing settings UI. */
export interface ConversationDirectorySettings {
    readonly rootDirectory: string;
    readonly template: string;
}
/** Preview request and result. */
export interface PreviewRequest {
    readonly template: string;
    readonly sampleText: string;
}
export interface PreviewResponse {
    readonly valid: boolean;
    readonly path?: string;
    readonly errorCode?: JustChatErrorCode;
    readonly message?: string;
}
/** Reservation request and response. */
export interface PreparationRequest {
    readonly text: string;
}
export interface PreparationResponse {
    readonly sessionId: string;
    readonly cwd: string;
    readonly createdAt: number;
}
/** Activation request. */
export interface ActivationRequest {
    readonly cwd: string;
}
/** The conversations route returns only active records. */
export type ConversationsResponse = readonly ConversationRecord[];
//# sourceMappingURL=types.d.ts.map