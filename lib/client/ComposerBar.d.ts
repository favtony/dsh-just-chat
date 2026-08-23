import type React from 'react';
import type { PropsHooks } from '@deepseek-ai/dsh-client-ui-slots';
import type { ComposerBarOwnerProps, ComposerInjected, PendingMode, SubmissionPhase } from './types.ts';
export declare function isComposerDisabled(input: {
    ownerDisabled: boolean;
    blocked: boolean;
    busy: boolean;
    submission: SubmissionPhase;
    mode: PendingMode;
    realSession: boolean;
}): boolean;
/**
 * Minimal public-input composer. It keeps the official session action face
 * intact and adds only the no-session just-chat preparation branch.
 */
export declare function ComposerBar(props: ComposerBarOwnerProps & Omit<ComposerInjected, 'hooks'> & PropsHooks<ComposerInjected['hooks']>): React.ReactElement;
//# sourceMappingURL=ComposerBar.d.ts.map