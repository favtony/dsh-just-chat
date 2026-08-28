import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { createJustChatApi } from './api.ts'
import { createComposerBarAdapter } from './ComposerBarAdapter.tsx'
import { createConversationAdapter } from './ConversationAdapter.tsx'
import { createSidebarBrowserAdapter } from './SidebarBrowserAdapter.tsx'
import { createWorkspacePickerAdapter } from './WorkspacePickerAdapter.tsx'
import { installLiveEntry, OFFICIAL_ENTRY_CONTRACTS } from './live-entry.ts'
import { ConversationDirectorySection, type ConversationDirectoryInjected, type ConversationDirectorySettings } from './settings/ConversationDirectorySection.tsx'
import {
  ConversationDirectoryOnboarding,
  createConversationDirectoryOnboardingRegistration,
} from './settings/ConversationDirectoryOnboarding.tsx'
import { createSubmissionController, type SessionCreateFace } from './handoff.ts'
import { createViewStore, setConversationRecords } from './stores/view-store.ts'
import { createPendingDraftStore, setPendingDraft } from './stores/pending-draft-store.ts'
import { createConversationOrderStore } from './stores/conversation-order-store.ts'


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
  const refreshConversationRecords = async (): Promise<void> => {
    setConversationRecords(viewStore, await api.listConversations())
  }
  const settingsInjected = (): ConversationDirectoryInjected => ({
    hooks: { settings },
    api,
    pickDirectory: () => ctx.workspaces.pickDirectory(),
    saveSettings,
  })
  ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
    name: 'settings.plugin.item',
    key: 'dsh-just-chat',
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
  ctx.slots.inject('conversation.composer.bar', () => installLiveEntry(
    ctx.slots,
    'conversation.composer.bar',
    OFFICIAL_ENTRY_CONTRACTS.composer,
    createComposerBarAdapter({
      pending: pendingDraftStore,
      view: viewStore,
      controller,
      updatePendingDraft: draft => {
        const current = pendingDraftStore.getSnapshot()
        setPendingDraft(pendingDraftStore, current.mode, draft)
      },
      completePendingHandoff: () => {
        const current = pendingDraftStore.getSnapshot()
        setPendingDraft(pendingDraftStore, 'none', '')
      },
      startPreparation: text => controller.startPreparation(text),
    }),
  ))
  ctx.slots.inject('conversation', () => installLiveEntry(
    ctx.slots,
    'conversation',
    OFFICIAL_ENTRY_CONTRACTS.conversation,
    createConversationAdapter({ pending: pendingDraftStore }),
  ))
  ctx.slots.inject('conversation.hero.workspace', () => installLiveEntry(
    ctx.slots,
    'conversation.hero.workspace',
    OFFICIAL_ENTRY_CONTRACTS.picker,
    createWorkspacePickerAdapter({
      pending: pendingDraftStore,
      chooseWorkspace: () => {
        const current = pendingDraftStore.getSnapshot()
        setPendingDraft(pendingDraftStore, 'workspace', current.draft)
      },
      chooseJustChat: () => {
        const current = pendingDraftStore.getSnapshot()
        setPendingDraft(pendingDraftStore, 'just-chat', current.draft)
      },
    }),
  ))
  ctx.slots.inject('sidebar.workspaces', () => installLiveEntry(
    ctx.slots,
    'sidebar.workspaces',
    OFFICIAL_ENTRY_CONTRACTS.sidebar,
    createSidebarBrowserAdapter({ view: viewStore, order: conversationOrderStore, refreshConversationRecords }),
  ))
}
