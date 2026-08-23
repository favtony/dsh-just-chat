/** Stable errors exposed by the host boundary. */
export type JustChatErrorCode = 'invalid-request' | 'empty-message' | 'settings-missing-root' | 'settings-invalid-root' | 'settings-invalid-template' | 'template-invalid' | 'template-empty-path' | 'path-invalid' | 'path-exists' | 'path-too-long' | 'directory-create-failed' | 'record-not-found' | 'record-cwd-mismatch' | 'session-not-found' | 'session-cwd-mismatch' | 'storage-failed' | 'method-not-allowed' | 'not-found' | 'body-too-large' | 'content-type-required' | 'origin-rejected';
/** Error that can be serialized at the browser boundary without exposing input text. */
export declare class JustChatError extends Error {
    readonly name = "JustChatError";
    readonly code: JustChatErrorCode;
    readonly status: number;
    constructor(code: JustChatErrorCode, message: string, status?: number);
}
/** Convert an unknown failure into a stable host error without retaining its detail. */
export declare function asJustChatError(error: unknown, fallbackCode?: JustChatErrorCode): JustChatError;
//# sourceMappingURL=errors.d.ts.map