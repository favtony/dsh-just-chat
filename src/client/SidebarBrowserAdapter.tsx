import type React from 'react'
import { createElement, useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import type { WorkspaceBrowserProps } from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { SessionListState, WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { ViewState } from './stores/view-store.ts'
import type { ConversationOrderState } from './stores/conversation-order-store.ts'
import { automaticSessionIds, projectAutomaticSessionState, projectOrdinarySessionState, projectWorkspaceState } from './workspace-projection.ts'
import type { LiveComponent } from './live-entry.ts'

const FLAT_SESSION_ORDER_KEY = '__flat_session_order__'

export interface SidebarBrowserAdapterDeps {
  view: SnapshotStore<ViewState>
  order: SnapshotStore<ConversationOrderState>
  refreshConversationRecords(): Promise<void>
}

/**
 * Reuses the host WorkspaceBrowser twice: real workspaces remain in the
 * workspace tree, while plugin-owned conversations use the official flat list
 * as a separate top-level section.
 */
export function createSidebarBrowserAdapter(
  deps: SidebarBrowserAdapterDeps,
): (official: LiveComponent<WorkspaceBrowserProps>) => LiveComponent<WorkspaceBrowserProps> {
  return official => function SidebarBrowserAdapter(props): React.ReactElement {
    const view = useSyncExternalStore(
      listener => deps.view.subscribe(listener),
      () => deps.view.getSnapshot(),
      () => deps.view.getSnapshot(),
    )
    const conversationOrder = useSyncExternalStore(
      listener => deps.order.subscribe(listener),
      () => deps.order.getSnapshot(),
      () => deps.order.getSnapshot(),
    )
    const hostSessions = props.useSessions(state => state)
    const hostWorkspaces = props.useWorkspaces(state => state)
    const hostStore = props.useStore(state => state)
    const hostDescription = props.useHostDescription(description => description)
    const automaticIds = useMemo(
      () => automaticSessionIds(view, hostSessions),
      [hostSessions, view],
    )
    const automaticIdSet = useMemo(() => new Set(automaticIds), [automaticIds])
    const projectedWorkspaces = useMemo(
      () => projectWorkspaceState(hostWorkspaces, view, hostSessions),
      [hostSessions, hostWorkspaces, view],
    )
    const ordinarySessions = useMemo(
      () => projectOrdinarySessionState(hostSessions, automaticIds),
      [automaticIds, hostSessions],
    )
    const automaticSessions = useMemo(
      () => projectAutomaticSessionState(hostSessions, automaticIds),
      [automaticIds, hostSessions],
    )
    const conversationWorkspaces = useMemo<WorkspaceListState>(
      () => ({ ...hostWorkspaces, items: [] }),
      [hostWorkspaces],
    )
    const orderedConversationIds = useMemo(() => {
      const current = new Set(automaticIds)
      const retained = conversationOrder.sessionIds.filter(id => current.has(id))
      const newIds = automaticIds.filter(id => !retained.includes(id))
      return [...newIds, ...retained]
    }, [automaticIds, conversationOrder.sessionIds])
    const conversationUpdatedAt = useMemo(
      () => Object.fromEntries(automaticIds.map(id => [id, hostSessions.byId[id]?.updatedAt ?? 0])),
      [automaticIds, hostSessions.byId],
    )
    const workspaceStore = useMemo(
      () => ({ ...hostStore, groupBy: 'workspace' as const }),
      [hostStore],
    )
    const conversationStore = useMemo(
      () => ({
        ...hostStore,
        groupBy: 'flat' as const,
        orderBy: 'manual' as const,
        sessionOrderByAccount: {
          ...hostStore.sessionOrderByAccount,
          [FLAT_SESSION_ORDER_KEY]: orderedConversationIds,
        },
        sessionUpdatedAtByAccount: {
          ...hostStore.sessionUpdatedAtByAccount,
          [FLAT_SESSION_ORDER_KEY]: conversationUpdatedAt,
        },
      }),
      [conversationUpdatedAt, hostStore, orderedConversationIds],
    )

    const useWorkspaceSessions = useCallback(<S,>(selector: (state: SessionListState) => S): S => {
      props.useSessions(current => current)
      return selector(ordinarySessions)
    }, [ordinarySessions, props.useSessions])
    const useConversationSessions = useCallback(<S,>(selector: (state: SessionListState) => S): S => {
      props.useSessions(current => current)
      return selector(automaticSessions)
    }, [automaticSessions, props.useSessions])
    const useWorkspaceWorkspaces = useCallback(<S,>(selector: (state: WorkspaceListState) => S): S => {
      props.useWorkspaces(current => current)
      return selector(projectedWorkspaces)
    }, [projectedWorkspaces, props.useWorkspaces])
    const useConversationWorkspaces = useCallback(<S,>(selector: (state: WorkspaceListState) => S): S => {
      props.useWorkspaces(current => current)
      return selector(conversationWorkspaces)
    }, [conversationWorkspaces, props.useWorkspaces])
    const useWorkspaceStore = useCallback(<S,>(selector: (state: typeof hostStore) => S): S => {
      props.useStore(current => current)
      return selector(workspaceStore)
    }, [props.useStore, workspaceStore])
    const useConversationStore = useCallback(<S,>(selector: (state: typeof hostStore) => S): S => {
      props.useStore(current => current)
      return selector(conversationStore)
    }, [conversationStore, props.useStore])
    const useWorkspaceDirectoryFlow = useCallback(<S,>(selector: (occupied: boolean) => S): S => {
      const occupied = props.useDirectoryFlow(current => current)
      return selector(occupied)
    }, [props.useDirectoryFlow])
    const useConversationDirectoryFlow = useCallback(<S,>(selector: (occupied: boolean) => S): S => {
      props.useDirectoryFlow(current => current)
      return selector(false)
    }, [props.useDirectoryFlow])
    const useWorkspaceHostDescription = useCallback(<S,>(selector: (description: typeof hostDescription) => S): S => {
      const description = props.useHostDescription(current => current)
      return selector(description)
    }, [props.useHostDescription])
    const useConversationHostDescription = useCallback(<S,>(selector: (description: typeof hostDescription) => S): S => {
      props.useHostDescription(current => current)
      return selector(hostDescription)
    }, [hostDescription, props.useHostDescription])
    const workspaceSearchSessions = useCallback(async (query: string, signal: AbortSignal) => {
      const result = await props.searchSessions(query, signal)
      return {
        ...result,
        items: result.items.filter(item => !automaticIdSet.has(item.sessionId)),
      }
    }, [automaticIdSet, props.searchSessions])
    const conversationSearchSessions = useCallback(async (query: string, signal: AbortSignal) => {
      const result = await props.searchSessions(query, signal)
      return {
        ...result,
        items: result.items.filter(item => automaticIdSet.has(item.sessionId)),
      }
    }, [automaticIdSet, props.searchSessions])

    useEffect(() => {
      void deps.refreshConversationRecords()
    }, [deps.refreshConversationRecords])

    const workspaceActions = useMemo<typeof props.actions>(() => ({
      ...props.actions,
      setGroupBy: () => {},
      setSessionOrder: (accountKey, order) => {
        if (accountKey !== FLAT_SESSION_ORDER_KEY) props.actions.setSessionOrder(accountKey, order)
      },
      syncSessionOrderAccount: (accountKey, order, updatedAt) => {
        if (accountKey !== FLAT_SESSION_ORDER_KEY) props.actions.syncSessionOrderAccount(accountKey, order, updatedAt)
      },
    }), [props.actions])
    const conversationActions = useMemo<typeof props.actions>(() => ({
      ...props.actions,
      setGroupBy: () => {},
      setOrderBy: () => {},
      setGroupExpanded: () => {},
      retainAccountKeys: () => {},
      syncSessionOrderAccount: (accountKey, order) => {
        if (accountKey === FLAT_SESSION_ORDER_KEY) deps.order.set({ sessionIds: [...order] })
      },
      setSessionOrder: (accountKey, order) => {
        if (accountKey === FLAT_SESSION_ORDER_KEY) deps.order.set({ sessionIds: [...order] })
      },
    }), [deps.order, props.actions])
    const rejectConversationWorkspaceAction = useCallback((): Promise<void> => {
      return Promise.reject(new Error('对话分区不支持工作区操作'))
    }, [])
    const rejectConversationSessionOrder = useCallback((): Promise<void> => {
      return Promise.reject(new Error('对话分区不支持工作区会话排序'))
    }, [])
    const conversationT = useCallback<WorkspaceBrowserProps['t']>((key, params) => {
      if (key === 'section.sessions') return '对话'
      if (key === 'empty.none') return '暂无对话'
      return props.t(key, params)
    }, [props.t])

    const workspaceProps: WorkspaceBrowserProps = {
      ...props,
      useSessions: useWorkspaceSessions,
      useWorkspaces: useWorkspaceWorkspaces,
      useStore: useWorkspaceStore,
      actions: workspaceActions,
      useDirectoryFlow: useWorkspaceDirectoryFlow,
      useHostDescription: useWorkspaceHostDescription,
      searchSessions: workspaceSearchSessions,
    }
    const conversationProps: WorkspaceBrowserProps = {
      ...props,
      useSessions: useConversationSessions,
      useWorkspaces: useConversationWorkspaces,
      useStore: useConversationStore,
      actions: conversationActions,
      useDirectoryFlow: useConversationDirectoryFlow,
      useHostDescription: useConversationHostDescription,
      searchSessions: conversationSearchSessions,
      startSession: () => {},
      renameWorkspace: rejectConversationWorkspaceAction,
      deleteWorkspace: rejectConversationWorkspaceAction,
      insertWorkspaceBefore: rejectConversationWorkspaceAction,
      insertSessionBefore: rejectConversationSessionOrder,
      t: conversationT,
    }

    return createElement(
      'div',
      {
        'data-dsh-just-chat-sidebar': 'true',
        style: { display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0 },
      },
      createElement(
        'div',
        { 'data-dsh-just-chat-section': 'workspaces', style: { display: 'flex', flex: '1 1 0', minHeight: 0 } },
        createElement(official as React.ComponentType<WorkspaceBrowserProps>, workspaceProps),
      ),
      props.wide
        ? createElement(
            'div',
            { 'data-dsh-just-chat-section': 'conversations', style: { display: 'flex', flex: '1 1 0', minHeight: 0 } },
            createElement(official as React.ComponentType<WorkspaceBrowserProps>, conversationProps),
          )
        : null,
    )
  }
}
