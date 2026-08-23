import { ConversationRecordStore } from './records.ts';
/** Minimal immutable metadata needed from the official session services. */
export interface SessionHeaderLike {
    readonly id: string;
    readonly cwd?: string;
}
export interface SessionPersistenceLike {
    list(): Promise<readonly SessionHeaderLike[]>;
}
export interface LiveSessionLike {
    readonly header: SessionHeaderLike;
}
export interface LiveSessionsLike {
    get(id: string): LiveSessionLike | undefined;
    list(): readonly LiveSessionLike[];
}
/** Reconcile durable plugin records against official session metadata. */
export declare function recoverConversationRecords(records: ConversationRecordStore, persistence: SessionPersistenceLike, liveSessions?: LiveSessionsLike): Promise<void>;
/** Verify a client activation against the live or materialized official session. */
export declare function assertSessionMatches(sessionId: string, cwd: string, persistence: SessionPersistenceLike, liveSessions?: LiveSessionsLike): Promise<void>;
/** Read the live session provider without importing the optional session package. */
export declare function getLiveSessions(ctx: {
    get(name: string): unknown;
}): LiveSessionsLike | undefined;
//# sourceMappingURL=recovery.d.ts.map