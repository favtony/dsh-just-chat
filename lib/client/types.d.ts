import type { ClientRemote } from '@deepseek-ai/dsh-api-remotes/client';
import type { HostObservable, InjectFace, OwnerOf, PropsLocale, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SessionId, SessionListState, SessionSummary, WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client';
import type { ComposerBarInjected, EmptyWorkspaceOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client';
import type { SubmissionController } from './handoff.ts';
export type { ClientRemote, EmptyWorkspaceOwnerProps, SessionId, SessionListState, SessionSummary, SettingsScope, WorkspaceId, WorkspaceView };
export type { SidebarSectionOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client';
export type HeroWorkspaceOwnerProps = OwnerOf<'conversation.hero.workspace'>;
export type ComposerBarOwnerProps = PropsRuntime<'conversation.composer.bar'>;
/** The exact public composition used by ui-conversation's InputBar entry. */
export type ComposerBarProps = PropsRuntime<'conversation.composer.bar'> & PropsRenderSlots<'conversation.input.attachments' | 'conversation.input.plan' | 'conversation.input.model'> & InjectFace<ComposerBarInjected> & PropsLocale<'conversation'>;
export type InputActions = NonNullable<ComposerBarProps['inputActions']>;
export type InputState = NonNullable<NonNullable<ComposerBarInjected['keyboard']>['snapshot']>;
export type RemoteEvents = Pick<ClientRemote, '$on'>;
export interface ConversationRecord {
    sessionId: SessionId;
    cwd: string;
    rootDirectory: string;
    createdAt: number;
    template: string;
    status: 'prepared' | 'active';
}
export interface PreparationResponse {
    sessionId: SessionId;
    cwd: string;
    createdAt: number;
}
export interface ViewError {
    code: string;
    message: string;
}
export type PendingMode = 'none' | 'workspace' | 'just-chat';
export type SubmissionPhase = 'idle' | 'preparing' | 'creatingSession' | 'activating' | 'waitingPreset' | 'handingOff' | 'sent' | 'error';
export type WorkspacePickerInjected = {
    chooseWorkspace(): void;
    chooseJustChat(): void;
};
export type ComposerInjected = {
    hooks: {
        pendingDraft: {
            getSnapshot(): import('./stores/pending-draft-store.ts').PendingDraftState;
            subscribe(listener: () => void): () => void;
        };
        view: {
            getSnapshot(): import('./stores/view-store.ts').ViewState;
            subscribe(listener: () => void): () => void;
        };
    };
    controller: SubmissionController;
    completePendingHandoff(): void;
    releaseComposer(): void;
    updatePendingDraft(draft: string): void;
    startPreparation(text: string): Promise<void>;
};
export type SidebarInjected = {
    hooks: {
        view: {
            getSnapshot(): import('./stores/view-store.ts').ViewState;
            subscribe(listener: () => void): () => void;
        };
        order: {
            getSnapshot(): import('./stores/conversation-order-store.ts').ConversationOrderState;
            subscribe(listener: () => void): () => void;
        };
        directoryFlow: HostObservable<boolean>;
    };
    refreshConversationRecords(): Promise<void>;
    searchMessages(query: string, signal: AbortSignal): Promise<readonly {
        sessionId: SessionId;
        snippet: string;
    }[]>;
    openSession(sessionId: SessionId): void;
    createWorkspace(path: string): Promise<WorkspaceId>;
    startWorkspaceSession(workspaceId?: WorkspaceId): void;
    archiveSession(sessionId: SessionId): Promise<void>;
    renameSession(sessionId: SessionId, title: string): Promise<void>;
    forkSession(sessionId: SessionId): Promise<void>;
    setManualOrder(sessionId: SessionId, beforeSessionId?: SessionId): void;
};
//# sourceMappingURL=types.d.ts.map