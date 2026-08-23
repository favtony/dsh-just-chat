import type { InputActions, SessionId } from './types.ts';
import type { SubmissionController } from './handoff.ts';
/**
 * Runs only in a real session-maybe scope. The component never talks to RPC;
 * the official InputActions path owns durable submission and logging.
 */
export declare function ConversationHandoff(props: {
    sessionId: SessionId | undefined;
    inputActions: InputActions | undefined;
    controller: SubmissionController;
    ready: boolean;
    onComplete(): void;
}): null;
//# sourceMappingURL=ConversationHandoff.d.ts.map