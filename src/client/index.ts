import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { WorkspacePickerProps } from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { createJustChatApi } from './api.ts'
import { ComposerBar } from './ComposerBar.tsx'
import { createComposerTakeover, type ComposerTakeover } from './composer-takeover.ts'
import { ConversationDirectorySection, type ConversationDirectoryInjected, type ConversationDirectorySettings } from './settings/ConversationDirectorySection.tsx'
import {
  ConversationDirectoryOnboarding,
  createConversationDirectoryOnboardingRegistration,
} from './settings/ConversationDirectoryOnboarding.tsx'
import { createSubmissionController, type SessionCreateFace } from './handoff.ts'
import { createViewStore, setConversationRecords } from './stores/view-store.ts'
import { createConversationOrderStore, setConversationOrder } from './stores/conversation-order-store.ts'
import { clearPendingDraft, createPendingDraftStore, setPendingDraft } from './stores/pending-draft-store.ts'
import type { ComposerInjected, SidebarInjected, WorkspacePickerInjected } from './types.ts'
import { SidebarBrowser } from './SidebarBrowser.tsx'
import { WorkspacePicker } from './WorkspacePicker.tsx'


export const inject = ['connection', 'slots', 'sessions', 'workspaces', 'remote', 'settingsScope']

/** Register the pre-session workspace picker after its owning slot is declared. */
export function apply(ctx: ClientContext & { connection: ConnectionHandle }): void {
  const pendingDraftStore = createPendingDraftStore()
  const viewStore = createViewStore()
  const conversationOrderStore = createConversationOrderStore()
  const sessions: SessionCreateFace = {
    create: async options => {
      const { result } = await ctx.connection.api.sessions.create(options)
      if (!result.ok) throw new Error(result.error.message)
    },
    open: sessionId => ctx.sessions.open(sessionId),
    list: ctx.sessions.list,
  }
  const api = createJustChatApi()
  const settings = ctx.settingsScope.bind<ConversationDirectorySettings>({ namespace: 'dsh-just-chat' })
  const saveSettings = async (rootDirectory: string, template: string): Promise<void> => {
    await api.saveSettings(rootDirectory, template)
  }
  const controller = createSubmissionController({
    api,
    sessions,
    remote: ctx.remote,
    viewStore,
    pendingStore: pendingDraftStore,
  })
  let composerTakeover: ComposerTakeover | undefined
  const releaseComposer = (): void => {
    if (composerTakeover === undefined) throw new Error('composer takeover is not active')
    composerTakeover.release()
  }
  const directoryFlow: HostObservable<boolean> = {
    getSnapshot: () => ctx.slots.entries('conversation.hero.workspace.directoryFlow').length > 0,
    subscribe: listener => ctx.slots.subscribe('conversation.hero.workspace.directoryFlow', listener),
  }
  const sidebarDirectoryFlow: HostObservable<boolean> = {
    getSnapshot: () => ctx.slots.entries('sidebar.workspaces.directoryFlow').length > 0,
    subscribe: listener => ctx.slots.subscribe('sidebar.workspaces.directoryFlow', listener),
  }
  const injected = (): WorkspacePickerInjected & {
    createWorkspace: WorkspacePickerProps['createWorkspace']
    hooks: { directoryFlow: HostObservable<boolean> }
  } => ({
    chooseWorkspace: () => {
      const current = pendingDraftStore.getSnapshot()
      setPendingDraft(pendingDraftStore, 'workspace', current.draft)
    },
    chooseJustChat: () => {
      const current = pendingDraftStore.getSnapshot()
      setPendingDraft(pendingDraftStore, 'just-chat', current.draft)
    },
    createWorkspace: input => ctx.workspaces.create(input),
    hooks: { directoryFlow },
  })
  const composerInjected = (): ComposerInjected => ({
    hooks: { pendingDraft: pendingDraftStore, view: viewStore },
    controller,
    completePendingHandoff: () => { clearPendingDraft(pendingDraftStore) },
    releaseComposer,
    updatePendingDraft: draft => {
      const current = pendingDraftStore.getSnapshot()
      setPendingDraft(pendingDraftStore, current.mode, draft)
    },
    startPreparation: text => controller.startPreparation(text),
  })
  const refreshConversationRecords = async (): Promise<void> => {
    setConversationRecords(viewStore, await api.listConversations())
  }
  const sidebarInjected = (): SidebarInjected => ({
    hooks: { view: viewStore, order: conversationOrderStore, directoryFlow: sidebarDirectoryFlow },
    refreshConversationRecords,
    searchMessages: async (query, signal) => {
      const response = await ctx.sessions.search(query, signal)
      if (!response.ok) throw new Error(response.error.message)
      return response.value.items
    },
    openSession: sessionId => ctx.sessions.open(sessionId),
    createWorkspace: async path => (await ctx.workspaces.create({ path })).workspaceId,
    startWorkspaceSession: workspaceId => { ctx.workspaces.startSession(workspaceId) },
    archiveSession: sessionId => ctx.workspaces.archiveSession(sessionId),
    renameSession: async (sessionId, title) => {
      const session = ctx.sessions.binding(sessionId)?.session
      if (session === undefined) throw new Error(`unknown session "${sessionId}"`)
      const response = await session.rename(title)
      if (!response.ok) throw new Error(response.error.message)
    },
    forkSession: async sessionId => {
      const childId = await ctx.sessions.fork({ sessionId, increaseTitle: true })
      ctx.sessions.open(childId)
    },
    setManualOrder: (sessionId, beforeSessionId) => { setConversationOrder(conversationOrderStore, sessionId, beforeSessionId) },
  })
  const settingsInjected = (): ConversationDirectoryInjected => ({
    hooks: { settings },
    api,
    saveSettings,
  })
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'conversation-directory',
    order: 30,
    label: '对话目录',
    inject: settingsInjected,
  }, ConversationDirectorySection))
  ctx.slots.inject('settings.onboarding', () => createConversationDirectoryOnboardingRegistration({
    request: {
      getSnapshot: () => viewStore.getSnapshot().settingsSectionRequest,
      subscribe: listener => viewStore.subscribe(listener),
    },
    register: () => ctx.slots.register({
      name: 'settings.onboarding',
      id: 'conversation-directory-required',
      order: 100,
      inject: () => ({
        acknowledge: () => {
          viewStore.update(state => {
            state.settingsSectionRequest = undefined
          })
        },
      }),
    }, ConversationDirectoryOnboarding),
  }))
  ctx.slots.inject('conversation.composer.bar', () => {
    const takeover = createComposerTakeover({
      pending: pendingDraftStore,
      sessions: ctx.sessions.list,
      register: () => ctx.slots.register({
        name: 'conversation.composer.bar',
        priority: -1,
        inject: composerInjected,
      }, ComposerBar),
    })
    composerTakeover = takeover
    return () => {
      if (composerTakeover === takeover) composerTakeover = undefined
      takeover.dispose()
    }
  })
  ctx.slots.inject('conversation.hero.workspace', () => ctx.slots.register({
    name: 'conversation.hero.workspace',
    priority: -1,
    children: { 'conversation.hero.workspace.directoryFlow': { kind: 'single', scope: 'root' } },
    inject: injected,
  }, WorkspacePicker))
  ctx.slots.inject('sidebar.workspaces', () => ctx.slots.register({
    name: 'sidebar.workspaces',
    priority: -1,
    children: { 'sidebar.workspaces.directoryFlow': { kind: 'single', scope: 'root' } },
    inject: sidebarInjected,
  }, SidebarBrowser))
}
