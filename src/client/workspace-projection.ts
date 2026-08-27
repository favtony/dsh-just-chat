import type {
  SessionListState,
  WorkspaceListState,
  WorkspaceView,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { WorkspaceId, SessionId } from './types.ts'
import type { ViewState } from './stores/view-store.ts'
import type { PendingDraftState } from './stores/pending-draft-store.ts'

export const JUST_CHAT_OPTION_ID = '__dsh_just_chat_option__' as WorkspaceId

export function automaticSessionIds(view: ViewState, sessions?: SessionListState): SessionId[] {
  const ids = view.active
    .filter(record => record.status === 'active')
    .map(record => record.sessionId)
    .filter((id, index, all) => all.indexOf(id) === index)
    .filter(id => {
      const session = sessions?.byId[id]
      return session === undefined || (session.parentId === undefined && session.origin !== 'subagent')
    })
  const createdAt = new Map(view.active.map(record => [record.sessionId, record.createdAt]))
  ids.sort((left, right) => (createdAt.get(right) ?? 0) - (createdAt.get(left) ?? 0) || left.localeCompare(right))
  return ids
}

/** Remove plugin-owned sessions from the official workspace grouping view. */
export function projectWorkspaceState(
  state: WorkspaceListState,
  view: ViewState,
  sessions?: SessionListState,
): WorkspaceListState {
  const ids = automaticSessionIds(view, sessions)
  const automatic = new Set(ids)
  return {
    ...state,
    items: state.items.map(workspace => ({
      ...workspace,
      sessionIds: workspace.sessionIds.filter((id: SessionId) => !automatic.has(id)),
    })),
  }
}

/** Project only plugin-owned top-level sessions for the official flat browser. */
export function projectAutomaticSessionState(
  state: SessionListState,
  automaticIds: readonly SessionId[],
): SessionListState {
  const topLevel = new Set(automaticIds)
  const ids = automaticIds.filter(id => state.byId[id] !== undefined)
  const byId = Object.fromEntries(Object.entries(state.byId).filter(([id, session]) => {
    return topLevel.has(id as SessionId) || (session.parentId !== undefined && topLevel.has(session.parentId))
  })) as Record<SessionId, SessionListState['byId'][SessionId]>
  const subagentsByParent = Object.fromEntries(
    Object.entries(state.subagentsByParent).filter(([id]) => topLevel.has(id as SessionId)),
  ) as SessionListState['subagentsByParent']
  const jobsBySession = Object.fromEntries(
    Object.entries(state.jobsBySession).filter(([id]) => byId[id as SessionId] !== undefined),
  ) as SessionListState['jobsBySession']
  const current = state.current !== undefined && topLevel.has(state.current) ? state.current : undefined
  return {
    ...state,
    ids,
    byId,
    current,
    subagentsByParent,
    jobsBySession,
    currentAddress: current === undefined ? undefined : state.currentAddress,
  }
}

/** Project the host list for the official workspace browser, hiding plugin-owned sessions. */
export function projectOrdinarySessionState(
  state: SessionListState,
  automaticIds: readonly SessionId[],
): SessionListState {
  const automatic = new Set(automaticIds)
  const current = state.current !== undefined && automatic.has(state.current) ? undefined : state.current
  const byId = Object.fromEntries(Object.entries(state.byId).filter(([id]) => !automatic.has(id as SessionId))) as SessionListState['byId']
  const jobsBySession = Object.fromEntries(
    Object.entries(state.jobsBySession).filter(([id]) => byId[id as SessionId] !== undefined),
  ) as SessionListState['jobsBySession']
  return {
    ...state,
    ids: state.ids.filter(id => !automatic.has(id)),
    byId,
    current,
    jobsBySession,
    currentAddress: current === undefined ? undefined : state.currentAddress,
  }
}

/** Project only the picker option; automatic conversations never appear as workspaces here. */
export function projectPickerState(state: WorkspaceListState): WorkspaceListState {
  const option: WorkspaceView = {
    workspaceId: JUST_CHAT_OPTION_ID,
    path: '',
    title: '不在项目中工作',
    sessionIds: [],
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  }
  return { ...state, items: [...state.items, option] }
}

/** Project the root conversation's current session into the persisted just-chat mode. */
export function projectConversationState(
  state: WorkspaceListState,
  pending: PendingDraftState,
  sessionId: SessionId | undefined,
): WorkspaceListState {
  const projected = projectPickerState(state)
  if (pending.mode !== 'just-chat' || sessionId === undefined) return projected
  return {
    ...projected,
    items: projected.items.map(workspace => ({
      ...workspace,
      sessionIds: workspace.workspaceId === JUST_CHAT_OPTION_ID
        ? [sessionId]
        : workspace.sessionIds.filter((id: SessionId) => id !== sessionId),
    })),
  }
}
