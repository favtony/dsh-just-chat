import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client';
import type { JustChatApi } from './api.ts';
import type { PendingDraftState } from './stores/pending-draft-store.ts';
import type { RemoteEvents, SessionId } from './types.ts';
import type { ViewState } from './stores/view-store.ts';
export interface SessionCreateFace {
    create(options: {
        cwd: string;
        sessionId: SessionId;
    }): Promise<unknown>;
    open(sessionId: SessionId): void;
    list: {
        getSnapshot(): {
            byId: Record<SessionId, {
                agentPreset?: string;
            }>;
        };
    };
}
export interface SubmissionController {
    startPreparation(text: string): Promise<void>;
    ownsSession(sessionId: SessionId): boolean;
    takeHandoff(sessionId: SessionId): string | undefined;
    completeHandoff(sessionId: SessionId): void;
    failHandoff(sessionId: SessionId, error: unknown): void;
}
/**
 * One-shot event/timer gate. An event received before the prepared id is known
 * is deliberately ignored; the root listener only accepts this submission id.
 */
export declare class SubmissionGate {
    private readonly sessionId;
    private readonly resolve;
    private timer;
    private eventSeen;
    private closed;
    constructor(sessionId: SessionId, resolve: () => void);
    signal(sessionId: SessionId): void;
    arm(delayMs: number): void;
    cancel(): void;
    private closeAndResolve;
}
/**
 * Orchestrate directory preparation, official session creation, activation,
 * opening, preset gate, and the later session-scope InputActions handoff.
 */
export declare function createSubmissionController(deps: {
    api: JustChatApi;
    sessions: SessionCreateFace;
    remote: RemoteEvents;
    viewStore: SnapshotStore<ViewState>;
    pendingStore: SnapshotStore<PendingDraftState>;
    nowHasPreset?: (sessionId: SessionId) => boolean;
}): SubmissionController;
//# sourceMappingURL=handoff.d.ts.map